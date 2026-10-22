import mongoose from "mongoose"
import { DeletedListing } from "../../models/listing/deletedListing.model.js"
import { DeletedUser } from "../../models/user/deletedUser.model.js"
import { Listing } from "../../models/listing/listing.model.js"
import { Message } from "../../models/interaction/message.model.js"
import { User } from "../../models/user/user.model.js"
import { Like } from "../../models/interaction/like.model.js"
import { deleteManyFromR2 } from "../storage.service.js"
import { escapeRegex, httpError, isObjectId } from "../../utils/http.js"

export const ROLES = ['user', 'seller', 'service', 'admin']
export const MAX_WARNINGS = 5

// Admin paneldəki filtrlərdən Mongo sorğusu
// q: ID, email, ad və ya IP ilə axtarış
// status: active | warned | blocked
const buildUserQuery = (filters = {}) => {
  const query = {}

  const q = String(filters.q ?? '').trim()
  if (q) {
    if (isObjectId(q)) {
      query._id = q
    } else {
      const rx = new RegExp(escapeRegex(q), 'i')
      query.$or = [{ email: rx }, { name: rx }, { ip: q }]
    }
  }

  // Köhnə linklər üçün (/admin/users/filter?email=...&userId=...)
  if (filters.userId && isObjectId(filters.userId)) query._id = filters.userId
  if (filters.email) query.email = String(filters.email).trim().toLowerCase()

  if (ROLES.includes(filters.role)) query.role = filters.role

  if (filters.status === 'blocked') query.isLocked = true
  if (filters.status === 'active') query.isLocked = { $ne: true }
  if (filters.status === 'warned') {
    query.isLocked = { $ne: true }
    query.isWarning = { $gt: 0 }
  }

  return query
}

const getUsers = async (filters, page = 1, limit = 20) => {
  const query = buildUserQuery(filters)

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-__v')
      .populate('listingCount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ])

  return { users, total }
}

const findUserOr404 = async (userId) => {
  if (!isObjectId(userId)) throw httpError(400, 'Yanlış istifadəçi ID')
  const user = await User.findById(userId)
  if (!user) throw httpError(404, 'İstifadəçi tapılmadı')
  return user
}

const deleteUser = async (userId, adminId, reason) => {
  if (String(userId) === String(adminId)) throw httpError(400, 'Öz hesabınızı silə bilməzsiniz')

  const session = await mongoose.startSession()
  session.startTransaction()

  let imageKeys = []

  try {
    const user = await User.findById(userId).session(session)
    if (!user) throw httpError(404, 'İstifadəçi tapılmadı')

    const listings = await Listing.find({ seller: userId }).session(session)

    if (listings.length > 0) {
      imageKeys = listings.flatMap((listing) => listing.images || [])

      // ƏVVƏL: burada "originalUserId" yazılırdı, amma model "originalListingId" tələb edir.
      // Nəticədə elanı olan istifadəçini silmək həmişə xəta ilə bitirdi.
      const deletedListingDocs = listings.map((listing) => ({
        originalListingId: listing._id,
        snapshot: listing.toObject(),
        deletedBy: adminId,
        deletedByRole: 'system',
        deleteReason: 'İstifadəçi silindiyi üçün silindi',
        viewCount: listing.viewCount,
        likedCount: listing.likedCount,
      }))

      await DeletedListing.insertMany(deletedListingDocs, { session })
      await Like.deleteMany({ listing: { $in: listings.map((l) => l._id) } }).session(session)
      await Listing.deleteMany({ seller: userId }).session(session)
    }

    await Like.deleteMany({ user: userId }).session(session)
    await Message.deleteMany({ user: userId }).session(session)

    await DeletedUser.create([{
      originalUserId: userId,
      snapshot: user.toObject(),
      deletedBy: adminId,
      deletedByRole: 'admin',
      deletedReason: reason || '',
    }], { session })

    await User.findByIdAndDelete(userId).session(session)
    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    await session.endSession()
  }

  try {
    if (imageKeys.length) await deleteManyFromR2(imageKeys)
  } catch (err) {
    console.error('R2 şəkilləri silinə bilmədi:', err)
  }

  return { success: true, message: 'İstifadəçi silindi' }
}

// İstifadəçini bloklayır və aktiv elanlarını gizlədir
const lockUser = async (userId) => {
  const lockedAt = new Date()
  await Promise.all([
    User.updateOne({ _id: userId }, { isLocked: true, lockedAt }),
    Listing.updateMany({ seller: userId, status: 'active' }, { status: 'blocked' }),
  ])
  return lockedAt
}

const warningUser = async (userId, message) => {
  const text = String(message ?? '').trim()
  if (!text) throw httpError(400, 'Xəbərdarlıq səbəbini yazın')

  const user = await findUserOr404(userId)
  if (user.isWarning >= MAX_WARNINGS) throw httpError(400, `Xəbərdarlıq limiti (${MAX_WARNINGS}) dolub`)

  // ƏVVƏL: updateOne nəticəsində "isWarning" olmadığı üçün 5-ci xəbərdarlıqda
  // avtomatik bloklama heç vaxt işləmirdi. İndi yenilənmiş sənədi alırıq.
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { isWarning: 1 } },
    { returnDocument: 'after' }
  )

  await Message.create({ user: userId, messageType: 'warning', message: text })

  let lockedAt = updated.lockedAt
  const autoLocked = updated.isWarning >= MAX_WARNINGS && !updated.isLocked
  if (autoLocked) {
    lockedAt = await lockUser(userId)
    await Message.create({
      user: userId,
      messageType: 'danger',
      message: `${MAX_WARNINGS} xəbərdarlıq aldığınız üçün hesabınız bloklandı.`,
    })
  }

  return {
    success: true,
    message: autoLocked
      ? `Xəbərdarlıq edildi. ${MAX_WARNINGS} xəbərdarlığa çatdığı üçün hesab bloklandı`
      : 'Xəbərdarlıq edildi',
    data: { isWarning: updated.isWarning, isLocked: autoLocked || updated.isLocked, lockedAt },
  }
}

const resetWarningUser = async (userId) => {
  await findUserOr404(userId)

  await User.updateOne({ _id: userId }, { isWarning: 0 })

  return { success: true, message: 'Xəbərdarlıqlar sıfırlandı', data: { isWarning: 0 } }
}

const blokedUser = async (userId, message, adminId) => {
  const text = String(message ?? '').trim()
  if (!text) throw httpError(400, 'Bloklama səbəbini yazın')
  if (String(userId) === String(adminId)) throw httpError(400, 'Öz hesabınızı bloklaya bilməzsiniz')

  const user = await findUserOr404(userId)
  if (user.isLocked) throw httpError(400, 'İstifadəçi artıq bloklanıb')

  const lockedAt = await lockUser(userId)
  await Message.create({ user: userId, messageType: 'danger', message: text })

  return { success: true, message: 'İstifadəçi bloklandı', data: { isLocked: true, lockedAt } }
}

const unBlokedUser = async (userId) => {
  const user = await findUserOr404(userId)
  if (!user.isLocked) throw httpError(400, 'İstifadəçi bloklanmayıb')

  await Promise.all([
    // Blokdan çıxanda xəbərdarlıqlar da sıfırlanır, yoxsa növbəti xəbərdarlıqda dərhal yenidən bloklanar
    User.updateOne({ _id: userId }, { isLocked: false, lockedAt: null, isWarning: 0 }),
    Listing.updateMany({ seller: userId, status: 'blocked' }, { status: 'active' }),
  ])

  return { success: true, message: 'İstifadəçi blokdan çıxarıldı', data: { isLocked: false, lockedAt: null, isWarning: 0 } }
}

const editUserRole = async (userId, role, adminId) => {
  if (!ROLES.includes(role)) throw httpError(400, 'Rol düzgün deyil')
  if (String(userId) === String(adminId) && role !== 'admin') {
    throw httpError(400, 'Öz admin rolunuzu götürə bilməzsiniz')
  }

  await findUserOr404(userId)
  await User.updateOne({ _id: userId }, { role })

  return { success: true, message: 'Rol dəyişdirildi', data: { role } }
}

const getDeletedUsers = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit

  const [deletedUsers, total] = await Promise.all([
    DeletedUser.find()
      .populate('deletedBy', '_id name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeletedUser.countDocuments(),
  ])

  return { deletedUsers, total }
}

export default {
  getUsers,
  // köhnə adlar (controller-də istifadə olunur)
  getAllUsers: (page, limit) => getUsers({}, page, limit),
  getFilteredUsers: getUsers,
  deleteUser,
  warningUser,
  resetWarningUser,
  blokedUser,
  unBlokedUser,
  editUserRole,
  getDeletedUsers,
}
