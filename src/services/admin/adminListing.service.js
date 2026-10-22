import mongoose from "mongoose"
import { DeletedListing } from "../../models/listing/deletedListing.model.js"
import { Listing } from "../../models/listing/listing.model.js"
import { Like } from "../../models/interaction/like.model.js"
import { Message } from "../../models/interaction/message.model.js"
import { User } from "../../models/user/user.model.js"
import { deleteFromR2, deleteManyFromR2 } from "../storage.service.js"
import { escapeRegex, httpError, isObjectId } from "../../utils/http.js"

export const LISTING_STATUSES = ['pending', 'active', 'sold', 'expired', 'rejected', 'blocked']

// Status dəyişəndə istifadəçiyə gedən mesajın tipi
const STATUS_MESSAGE_TYPE = {
  active: 'success',
  sold: 'success',
  pending: 'warning',
  expired: 'warning',
  rejected: 'danger',
  blocked: 'danger',
}

// Admin paneldəki filtrlərdən Mongo sorğusu
// q: elan ID, telefon nömrəsi və ya satıcının email-i
const buildListingQuery = async (filters = {}) => {
  const query = {}

  const q = String(filters.q ?? '').trim()
  if (q) {
    const digits = q.replace(/\D/g, '')
    if (isObjectId(q)) {
      query._id = q
    } else if (digits.length >= 7 && digits.length === q.replace(/[\s+()-]/g, '').length) {
      // telefon bazada 9 rəqəmli saxlanılır (501234567); "+994 50 123 45 67" də tapılsın
      query.phone = Number(digits.slice(-9))
    } else {
      const sellers = await User.find({ email: new RegExp(escapeRegex(q), 'i') }).select('_id').limit(50).lean()
      query.seller = { $in: sellers.map((s) => s._id) }
    }
  }

  // Köhnə linklər üçün (/admin/listings/filter?listingId=...&phone=...)
  if (filters.listingId && isObjectId(filters.listingId)) query._id = filters.listingId
  if (filters.phone) query.phone = Number(String(filters.phone).replace(/\D/g, '').slice(-9))

  if (filters.seller && isObjectId(filters.seller)) query.seller = filters.seller
  if (filters.make && isObjectId(filters.make)) query.make = filters.make
  if (LISTING_STATUSES.includes(filters.status)) query.status = filters.status
  if (filters.isUrgent === 'true') query.isUrgent = true
  if (filters.isUrgent === 'false') query.isUrgent = { $ne: true }

  return query
}

const getListings = async (filters, page = 1, limit = 20) => {
  const query = await buildListingQuery(filters)

  const [listings, total] = await Promise.all([
    Listing.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .withAdminFullRelations()
      .lean(),
    Listing.countDocuments(query),
  ])

  return { listings, total }
}

const getUserListings = async (userId) => {
  if (!isObjectId(userId)) throw httpError(400, 'Yanlış istifadəçi ID')
  return Listing.find({ seller: userId })
    .sort({ createdAt: -1 })
    .withAdminFullRelations()
    .lean()
}

const getUrgentListings = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit

  const [urgentListings, total] = await Promise.all([
    Listing.find({ isUrgent: true })
      .sort({ urgentExpiresAt: 1 }) // vaxtı ən tez bitənlər yuxarıda
      .skip(skip)
      .limit(limit)
      .withAdminFullRelations()
      .lean(),
    Listing.countDocuments({ isUrgent: true }),
  ])

  return { urgentListings, total }
}

// Admin istənilən statusda elanı görə bilməlidir (əvvəl yalnız "active" qaytarılırdı)
const getListing = async (listingId) => {
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')

  const listing = await Listing.findById(listingId).withAdminFullRelations().lean()
  if (!listing) throw httpError(404, 'Elan tapılmadı')

  return { success: true, data: listing }
}

const deleteListing = async (adminId, listingId, message) => {
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')

  const session = await mongoose.startSession()
  session.startTransaction()

  let imageKeys = []
  let videoKey = null
  let sellerId = null

  try {
    const listing = await Listing.findById(listingId).session(session)
    if (!listing) throw httpError(404, 'Elan tapılmadı')

    imageKeys = listing.images || []
    videoKey = listing.video || null
    sellerId = listing.seller

    await Like.deleteMany({ listing: listing._id }, { session })

    await DeletedListing.create([{
      originalListingId: listing._id,
      snapshot: listing.toObject(),
      deletedBy: adminId,
      deletedByRole: 'admin',
      deleteReason: message || '',
      viewCount: listing.viewCount,
      likedCount: listing.likedCount,
    }], { session })

    await Listing.findByIdAndDelete(listingId, { session })

    await session.commitTransaction()
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }

  // Səbəb yazılıbsa, satıcıya bildiriş
  if (sellerId && message?.trim()) {
    await Message.create({
      user: sellerId,
      messageType: 'danger',
      message: `Elanınız silindi. Səbəb: ${message.trim()}`,
    }).catch((err) => console.error('Mesaj yaradılmadı:', err.message))
  }

  try {
    if (imageKeys.length) await deleteManyFromR2(imageKeys)
    if (videoKey) await deleteFromR2(videoKey)
  } catch (err) {
    console.error('R2 faylları silinə bilmədi:', err)
  }

  return { success: true, message: 'Elan silindi' }
}

const setUrgentListing = async (listingId, day) => {
  const days = parseInt(day, 10)
  if (!days || days < 1 || days > 365) throw httpError(400, 'Gün sayı 1 ilə 365 arasında olmalıdır')
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')

  const now = new Date()
  const urgentExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const result = await Listing.updateOne(
    { _id: listingId },
    { isUrgent: true, urgentActiveAt: now, urgentExpiresAt }
  )
  if (result.matchedCount === 0) throw httpError(404, 'Elan tapılmadı')

  return {
    success: true,
    message: `Premium ${days} gün təyin edildi`,
    data: { isUrgent: true, urgentActiveAt: now, urgentExpiresAt },
  }
}

const removeUrgentListing = async (listingId) => {
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')

  const result = await Listing.updateOne(
    { _id: listingId },
    { $set: { isUrgent: false }, $unset: { urgentActiveAt: 1, urgentExpiresAt: 1 } }
  )
  if (result.matchedCount === 0) throw httpError(404, 'Elan tapılmadı')

  return { success: true, message: 'Premium ləğv edildi' }
}

// message yazılıbsa, satıcıya profilində bildiriş göndərilir
const setStatusListing = async (listingId, status, message) => {
  if (!LISTING_STATUSES.includes(status)) throw httpError(400, 'Status düzgün deyil')
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')

  const listing = await Listing.findByIdAndUpdate(listingId, { status }, { returnDocument: 'after' })
  if (!listing) throw httpError(404, 'Elan tapılmadı')

  const text = String(message ?? '').trim()
  if (text && listing.seller) {
    await Message.create({
      user: listing.seller,
      messageType: STATUS_MESSAGE_TYPE[status] ?? 'warning',
      message: text,
    })
  }

  return { success: true, message: 'Status dəyişdirildi', data: { status } }
}

const getDeletedListings = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit
  const [deletedListings, total] = await Promise.all([
    DeletedListing.find()
      .populate('deletedBy', '_id name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeletedListing.countDocuments(),
  ])

  return { deletedListings, total }
}

export default {
  getListings,
  // köhnə adlar
  getAllListings: (page, limit) => getListings({}, page, limit),
  getFilteredListings: getListings,
  getUserListings,
  getUrgentListings,
  getListing,
  deleteListing,
  setUrgentListing,
  removeUrgentListing,
  setStatusListing,
  getDeletedListings,
}
