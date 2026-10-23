import mongoose from 'mongoose'
import { Report, REPORT_CATEGORIES, REPORT_STATUSES } from '../../models/interaction/report.model.js'
import { Listing } from '../../models/listing/listing.model.js'
import { httpError, isObjectId } from '../../utils/http.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// İSTİFADƏÇİ: şikayət göndər
const createReport = async ({ listingId, category, message, email, userId, ip }) => {
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')
  if (!REPORT_CATEGORIES.includes(category)) throw httpError(400, 'Şikayət növünü seçin')

  const cleanEmail = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 100) throw httpError(400, 'Emailinizi düzgün yazın')

  const cleanMessage = String(message ?? '').trim().slice(0, 1000)
  if (category === 'other' && cleanMessage.length < 5) throw httpError(400, 'Şikayətin səbəbini qısaca yazın')

  if (!(await Listing.exists({ _id: listingId }))) throw httpError(404, 'Elan tapılmadı')

  // Eyni şəxs eyni elana baxılmamış şikayəti təkrar göndərməsin
  const duplicate = await Report.exists({ listing: listingId, email: cleanEmail, status: 'new' })
  if (duplicate) {
    return { success: true, message: 'Bu elan barədə şikayətiniz artıq qəbul olunub. Tezliklə baxılacaq' }
  }

  await Report.create({
    listing: listingId,
    category,
    message: cleanMessage,
    email: cleanEmail,
    user: userId || null,
    ip,
  })

  return { success: true, message: 'Şikayətiniz göndərildi. Təşəkkür edirik, tezliklə baxılacaq' }
}

// ADMIN: şikayətlər
const getReports = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100)

  const filter = {}
  if (REPORT_STATUSES.includes(query.status)) filter.status = query.status
  if (REPORT_CATEGORIES.includes(query.category)) filter.category = query.category
  if (isObjectId(query.listing)) filter.listing = query.listing

  const [items, total, newCount] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'listing',
        select: 'make model year price images status seller',
        populate: [
          { path: 'make', select: 'label' },
          { path: 'model', select: 'label' },
          { path: 'seller', select: 'name email' },
        ],
      })
      .populate('user', 'name email')
      .lean(),
    Report.countDocuments(filter),
    Report.countDocuments({ status: 'new' }),
  ])

  // Hər elana neçə baxılmamış şikayət gəlib — eyni elana çox şikayət ciddi siqnaldır
  const listingIds = [...new Set(items.map((r) => r.listing?._id).filter(Boolean).map(String))]
  const counts = await Report.aggregate([
    { $match: { listing: { $in: listingIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: 'new' } },
    { $group: { _id: '$listing', count: { $sum: 1 } } },
  ])
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]))

  return {
    success: true,
    data: items.map((r) => ({ ...r, listingReportCount: r.listing ? countMap[String(r.listing._id)] ?? 0 : 0 })),
    total,
    newCount,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  }
}

const updateReport = async (id, { status, adminNote }) => {
  if (!isObjectId(id)) throw httpError(400, 'Yanlış ID')
  if (!REPORT_STATUSES.includes(status)) throw httpError(400, 'Status düzgün deyil')

  const report = await Report.findByIdAndUpdate(
    id,
    {
      status,
      handledAt: status === 'new' ? null : new Date(),
      ...(adminNote !== undefined ? { adminNote: String(adminNote).slice(0, 500) } : {}),
    },
    { returnDocument: 'after' }
  )
  if (!report) throw httpError(404, 'Şikayət tapılmadı')

  return { success: true, message: 'Status dəyişdirildi', data: report }
}

// Bir elanın bütün baxılmamış şikayətlərini birdən bağla (məs. elan silinəndə/bloklananda)
const resolveListingReports = async (listingId, status = 'reviewed') => {
  if (!isObjectId(listingId)) throw httpError(400, 'Yanlış elan ID')
  if (!REPORT_STATUSES.includes(status) || status === 'new') throw httpError(400, 'Status düzgün deyil')
  const result = await Report.updateMany({ listing: listingId, status: 'new' }, { status, handledAt: new Date() })
  return { success: true, message: `${result.modifiedCount} şikayət bağlandı` }
}

const deleteReport = async (id) => {
  if (!isObjectId(id)) throw httpError(400, 'Yanlış ID')
  await Report.deleteOne({ _id: id })
  return { success: true, message: 'Şikayət silindi' }
}

export default {
  createReport,
  getReports,
  updateReport,
  resolveListingReports,
  deleteReport,
}
