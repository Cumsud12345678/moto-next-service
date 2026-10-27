import crypto from 'crypto'
import mongoose from 'mongoose'
import { Part } from '../../models/part/part.model.js'
import { PartLike } from '../../models/part/partLike.model.js'
import { Model } from '../../models/metadata/model.model.js'
import { DeletedListing } from '../../models/listing/deletedListing.model.js'
import { deleteManyFromR2, uploadToR2 } from '../storage.service.js'
import { processImage } from '../image.service.js'
import { formatListingDate } from '../../utils/dateFormatter.js'
import { redis } from '../../config/redis.config.js'
import { escapeRegex, httpError, isObjectId } from '../../utils/http.js'

const MAX_IMAGES = 10

// Kartlarda lazım olan sahələr (telefon, təsvir və statistika siyahıda göndərilmir)
const CARD_FIELDS = 'title price images condition delivery partCategory make model region seller createdAt status'

export const PART_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: -1 },
  price_desc: { price: -1, _id: -1 },
}

const generateKey = (partId) => `parts/${partId}/${crypto.randomUUID()}.webp`

// Bəyənilmiş elanların id-ləri (giriş edibsə bazadan, qonaqdırsa cookie-dən)
const likedSet = async (userId, guestLikedIds, partIds) => {
  if (userId) {
    const likes = await PartLike.find({ user: userId, part: { $in: partIds } }).select('part').lean()
    return new Set(likes.map((l) => l.part.toString()))
  }
  return new Set(guestLikedIds)
}

const toCards = async (parts, userId, guestLikedIds) => {
  const liked = await likedSet(userId, guestLikedIds, parts.map((p) => p._id))
  return parts.map((p) => ({
    ...p,
    isLiked: liked.has(p._id.toString()),
    createdAt: formatListingDate(p.createdAt),
  }))
}

// Seçilmiş model həqiqətən seçilmiş markaya aiddirmi
const assertMakeModel = async (data) => {
  if (data.model && !data.make) throw httpError(400, 'Model seçilibsə marka da seçilməlidir')
  if (data.model) {
    const ok = await Model.exists({ _id: data.model, make: data.make })
    if (!ok) throw httpError(400, 'Model seçilmiş markaya aid deyil')
  }
}

// Saytdakı filtrlərdən sorğu (yalnız aktiv elanlar)
const buildQuery = (filters = {}) => {
  const query = { status: 'active' }

  if (isObjectId(filters.partCategory)) query.partCategory = filters.partCategory
  if (isObjectId(filters.make)) query.make = filters.make
  if (isObjectId(filters.model)) query.model = filters.model
  if (isObjectId(filters.region)) query.region = filters.region
  if (filters.condition === 'new' || filters.condition === 'used') query.condition = filters.condition
  if (filters.delivery === '1' || filters.delivery === 'true') query.delivery = true

  const min = Number(filters.minPrice)
  const max = Number(filters.maxPrice)
  if (min > 0 || max > 0) {
    query.price = {}
    if (min > 0) query.price.$gte = min
    if (max > 0) query.price.$lte = max
  }

  const q = String(filters.q ?? '').trim().slice(0, 60)
  if (q) query.title = new RegExp(escapeRegex(q), 'i')

  return query
}

// SİYAHI
const getParts = async (filters, page = 1, limit = 20, userId, guestLikedIds = []) => {
  const query = buildQuery(filters)
  const sort = PART_SORTS[filters?.sort] ?? PART_SORTS.newest

  const [parts, total] = await Promise.all([
    Part.find(query).select(CARD_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit).withCardRelations().lean(),
    Part.countDocuments(query),
  ])

  return { success: true, data: await toCards(parts, userId, guestLikedIds), total }
}

// 1 ELAN (yalnız aktiv; baxış sayını yalnız sahibi görür)
const getPart = async (partId, userId, guestLikedIds = []) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')

  const part = await Part.findOne({ _id: partId, status: 'active' }).withFullRelations().lean()
  if (!part) return null

  const isOwner = !!userId && String(part.seller?._id ?? part.seller) === String(userId)
  const isLiked = userId
    ? !!(await PartLike.exists({ user: userId, part: partId }))
    : guestLikedIds.includes(String(partId))

  const { viewCount, likedCount, ...rest } = part
  return {
    success: true,
    data: {
      ...rest,
      ...(isOwner && { viewCount: viewCount ?? 0 }),
      isLiked,
      createdAt: formatListingDate(part.createdAt),
    },
  }
}

// Düzəliş forması üçün: sahib öz elanını istənilən statusda görür
const getMyPart = async (userId, partId) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  const part = await Part.findOne({ _id: partId, seller: userId }).lean()
  if (!part) throw httpError(404, 'Elan tapılmadı')
  return { success: true, data: part }
}

// İSTİFADƏÇİNİN ÖZ HİSSƏ ELANLARI (profil)
const getMyParts = async (userId) => {
  const parts = await Part.find({ seller: userId })
    .select(`${CARD_FIELDS} viewCount`)
    .sort({ createdAt: -1 })
    .withCardRelations()
    .lean()
  return { success: true, data: await toCards(parts, userId, []) }
}

// OXŞAR: eyni kateqoriya (+ eyni marka əvvəldə)
const getSimilarParts = async (partId, userId, guestLikedIds = [], limit = 12) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  const current = await Part.findOne({ _id: partId, status: 'active' }).select('partCategory make seller').lean()
  if (!current) return { success: true, data: [] }

  const base = { status: 'active', _id: { $ne: current._id }, partCategory: current.partCategory }
  let parts = []
  if (current.make) {
    parts = await Part.find({ ...base, make: current.make }).select(CARD_FIELDS).sort({ createdAt: -1 }).limit(limit).withCardRelations().lean()
  }
  if (parts.length < limit) {
    const more = await Part.find({ ...base, _id: { $nin: [current._id, ...parts.map((p) => p._id)] } })
      .select(CARD_FIELDS).sort({ createdAt: -1 }).limit(limit - parts.length).withCardRelations().lean()
    parts = [...parts, ...more]
  }

  return { success: true, data: await toCards(parts, userId, guestLikedIds) }
}

// SATICININ DİGƏR HİSSƏ ELANLARI
const getSellerParts = async (partId, userId, guestLikedIds = [], limit = 8) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  const current = await Part.findOne({ _id: partId, status: 'active' }).select('seller').lean()
  if (!current?.seller) return { success: true, data: [], total: 0 }

  const query = { seller: current.seller, status: 'active', _id: { $ne: current._id } }
  const [parts, total] = await Promise.all([
    Part.find(query).select(CARD_FIELDS).sort({ createdAt: -1 }).limit(limit).withCardRelations().lean(),
    Part.countDocuments(query),
  ])
  return { success: true, data: await toCards(parts, userId, guestLikedIds), total }
}

// YARAT
const createPart = async (userId, data, files = []) => {
  if (!files.length) throw httpError(400, 'Ən azı bir şəkil yükləməlisiniz')
  if (files.length > MAX_IMAGES) throw httpError(400, `Maksimum ${MAX_IMAGES} şəkil ola bilər`)
  await assertMakeModel(data)

  const partId = new mongoose.Types.ObjectId()
  const uploadedKeys = []

  try {
    for (const file of files) {
      const processed = await processImage(file)
      const key = generateKey(partId)
      await uploadToR2(processed, key)
      uploadedKeys.push(key)
    }

    const part = await Part.create({
      _id: partId,
      ...data,
      phone: Number(data.phone),
      seller: userId,
      status: 'active',
      images: uploadedKeys,
    })

    return { success: true, message: 'Elan uğurla yaradıldı', data: part }
  } catch (err) {
    if (uploadedKeys.length) {
      try { await deleteManyFromR2(uploadedKeys) } catch (e) { console.error('R2 cleanup failed:', e) }
    }
    throw err
  }
}

// DÜZƏLİŞ
const updatePart = async (userId, partId, data, newFiles = [], keepImageKeys = []) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  const part = await Part.findOne({ _id: partId, seller: userId })
  if (!part) throw httpError(404, 'Elan tapılmadı')
  await assertMakeModel(data)

  const oldKeys = part.images || []
  const safeKeep = keepImageKeys.filter((key) => oldKeys.includes(key))
  const total = safeKeep.length + newFiles.length
  if (total < 1) throw httpError(400, 'Ən azı 1 şəkil olmalıdır')
  if (total > MAX_IMAGES) throw httpError(400, `Maksimum ${MAX_IMAGES} şəkil ola bilər`)

  const uploaded = []
  try {
    for (const file of newFiles) {
      const processed = await processImage(file)
      const key = generateKey(partId)
      await uploadToR2(processed, key)
      uploaded.push(key)
    }

    // Marka/model silinibsə bazadan da silinsin
    const unset = {}
    if (!data.make) unset.make = 1
    if (!data.model) unset.model = 1
    const { make, model, ...rest } = data

    const updated = await Part.findByIdAndUpdate(
      partId,
      {
        $set: {
          ...rest,
          ...(make && { make }),
          ...(model && { model }),
          phone: Number(data.phone),
          images: [...safeKeep, ...uploaded],
        },
        ...(Object.keys(unset).length && { $unset: unset }),
      },
      { returnDocument: 'after', runValidators: true }
    )

    const toDelete = oldKeys.filter((key) => !safeKeep.includes(key))
    if (toDelete.length) {
      try { await deleteManyFromR2(toDelete) } catch (e) { console.error('R2 old images cleanup failed:', e) }
    }

    return { success: true, message: 'Elan yeniləndi', data: updated }
  } catch (err) {
    if (uploaded.length) {
      try { await deleteManyFromR2(uploaded) } catch (e) { console.error('R2 cleanup failed:', e) }
    }
    throw err
  }
}

// Silmə (istifadəçi və ya admin). Surət "Silinmiş elanlar"-da qalır.
export const removePart = async (part, { deletedBy, deletedByRole, reason = '' }) => {
  await DeletedListing.create({
    kind: 'part',
    originalListingId: part._id,
    snapshot: part.toObject ? part.toObject() : part,
    deletedBy,
    deletedByRole,
    deleteReason: reason,
    viewCount: part.viewCount,
    likedCount: part.likedCount,
  })
  await PartLike.deleteMany({ part: part._id })
  await Part.deleteOne({ _id: part._id })

  if (part.images?.length) {
    try { await deleteManyFromR2(part.images) } catch (e) { console.error('R2 şəkilləri silinmədi:', e) }
  }
}

const deletePart = async (userId, partId) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  const part = await Part.findOne({ _id: partId, seller: userId })
  if (!part) throw httpError(404, 'Elan tapılmadı')

  await removePart(part, { deletedBy: userId, deletedByRole: 'user', reason: 'user_deleted' })
  return { success: true, message: 'Elan silindi' }
}

// BƏYƏN (giriş etmiş istifadəçi)
const toggleLikeForUser = async (userId, partId) => {
  if (!isObjectId(partId) || !(await Part.exists({ _id: partId }))) throw httpError(404, 'Elan tapılmadı')

  const removed = await PartLike.findOneAndDelete({ user: userId, part: partId })
  if (removed) {
    await Part.updateOne({ _id: partId, likedCount: { $gt: 0 } }, { $inc: { likedCount: -1 } })
    return { liked: false }
  }

  try {
    await PartLike.create({ user: userId, part: partId })
  } catch (err) {
    if (err?.code === 11000) return { liked: true } // eyni anda iki klik
    throw err
  }
  await Part.updateOne({ _id: partId }, { $inc: { likedCount: 1 } })
  return { liked: true }
}

const adjustLikedCount = async (partId, delta) => {
  if (!isObjectId(partId)) throw httpError(404, 'Elan tapılmadı')
  const filter = delta < 0 ? { _id: partId, likedCount: { $gt: 0 } } : { _id: partId }
  const res = await Part.updateOne(filter, { $inc: { likedCount: delta } })
  if (delta > 0 && res.matchedCount === 0) throw httpError(404, 'Elan tapılmadı')
}

// SEÇİLMİŞ HİSSƏLƏR
const getLikedParts = async (userId, guestLikedIds = []) => {
  let ids
  if (userId) {
    const likes = await PartLike.find({ user: userId }).sort({ createdAt: -1 }).select('part').lean()
    ids = likes.map((l) => l.part)
  } else {
    ids = guestLikedIds.filter(isObjectId)
  }
  if (!ids.length) return { success: true, data: [] }

  const parts = await Part.find({ _id: { $in: ids }, status: 'active' }).select(CARD_FIELDS).withCardRelations().lean()
  // bəyənmə sırası saxlanılsın
  const order = new Map(ids.map((id, i) => [String(id), i]))
  parts.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0))

  return { success: true, data: parts.map((p) => ({ ...p, isLiked: true, createdAt: formatListingDate(p.createdAt) })) }
}

// BAXIŞ: eyni IP 1 saatda bir dəfə, sahibin öz baxışı sayılmır
const clickPart = async (partId, ip, userId) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  if (userId && await Part.exists({ _id: partId, seller: userId })) return { success: true }

  try {
    const fresh = await redis.set(`part-view:${partId}:${ip}`, '1', { NX: true, EX: 3600 })
    if (!fresh) return { success: true }
  } catch {
    // Redis işləməsə də sayırıq
  }

  await Part.updateOne({ _id: partId, status: 'active' }, { $inc: { viewCount: 1 } })
  return { success: true }
}

// Giriş edəndə qonaq bəyənmələri hesaba köçürülür
const migrateGuestLikes = async (userId, partIds = []) => {
  const ids = partIds.filter(isObjectId)
  if (!ids.length) return
  await PartLike.bulkWrite(ids.map((part) => ({
    updateOne: { filter: { user: userId, part }, update: { $setOnInsert: { user: userId, part } }, upsert: true },
  })))
}

export default {
  getParts,
  getPart,
  getMyPart,
  getMyParts,
  getSimilarParts,
  getSellerParts,
  createPart,
  updatePart,
  deletePart,
  toggleLikeForUser,
  adjustLikedCount,
  getLikedParts,
  clickPart,
  migrateGuestLikes,
}
