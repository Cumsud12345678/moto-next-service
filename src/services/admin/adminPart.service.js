import { Part, PART_STATUSES } from "../../models/part/part.model.js"
import { User } from "../../models/user/user.model.js"
import { Message } from "../../models/interaction/message.model.js"
import { removePart } from "../user/part.service.js"
import { escapeRegex, httpError, isObjectId } from "../../utils/http.js"

const STATUS_MESSAGE_TYPE = { active: 'success', sold: 'success', pending: 'warning', expired: 'warning', rejected: 'danger', blocked: 'danger' }

// q: elan ID, telefon, satıcı email-i və ya elanın adı
const buildQuery = async (filters = {}) => {
  const query = {}
  const q = String(filters.q ?? '').trim()
  if (q) {
    const digits = q.replace(/\D/g, '')
    if (isObjectId(q)) {
      query._id = q
    } else if (digits.length >= 7 && digits.length === q.replace(/[\s+()-]/g, '').length) {
      query.phone = Number(digits.slice(-9))
    } else if (q.includes('@')) {
      const sellers = await User.find({ email: new RegExp(escapeRegex(q), 'i') }).select('_id').limit(50).lean()
      query.seller = { $in: sellers.map((s) => s._id) }
    } else {
      query.title = new RegExp(escapeRegex(q), 'i')
    }
  }
  if (isObjectId(filters.seller)) query.seller = filters.seller
  if (isObjectId(filters.partCategory)) query.partCategory = filters.partCategory
  if (PART_STATUSES.includes(filters.status)) query.status = filters.status
  return query
}

const getParts = async (filters, page = 1, limit = 20) => {
  const query = await buildQuery(filters)
  const [parts, total] = await Promise.all([
    Part.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).withAdminRelations().lean(),
    Part.countDocuments(query),
  ])
  return { parts, total }
}

const setStatus = async (partId, status, message) => {
  if (!PART_STATUSES.includes(status)) throw httpError(400, 'Status düzgün deyil')
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')

  const current = await Part.findById(partId).select('status seller title')
  if (!current) throw httpError(404, 'Elan tapılmadı')

  const update = { status }
  if (status === 'active' && current.status !== 'active') update.activeSince = new Date()
  await Part.updateOne({ _id: partId }, update)

  const text = String(message ?? '').trim()
  if (text && current.seller) {
    await Message.create({ user: current.seller, messageType: STATUS_MESSAGE_TYPE[status] ?? 'warning', message: text })
  }

  return { success: true, message: 'Status dəyişdirildi', data: { status } }
}

const deletePart = async (adminId, partId, message) => {
  if (!isObjectId(partId)) throw httpError(400, 'Yanlış elan ID')
  const part = await Part.findById(partId)
  if (!part) throw httpError(404, 'Elan tapılmadı')

  await removePart(part, { deletedBy: adminId, deletedByRole: 'admin', reason: message || '' })

  if (part.seller && message?.trim()) {
    await Message.create({
      user: part.seller,
      messageType: 'danger',
      message: `"${part.title}" hissə elanınız silindi. Səbəb: ${message.trim()}`,
    }).catch((err) => console.error('Mesaj yaradılmadı:', err.message))
  }

  return { success: true, message: 'Elan silindi' }
}

export default { getParts, setStatus, deletePart }
