import { MakeRequest } from '../../models/metadata/makeRequest.model.js'
import { redis } from '../../config/redis.config.js'
import { sendMakeAddedEmail } from '../email/sendMail.service.js'
import { logError } from '../system/errorLog.service.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const badRequest = (message, statusCode = 400) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const createMakeRequest = async ({ text, email, ip, userId }) => {
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim()
  const cleanEmail = email ? String(email).trim().toLowerCase() : null

  if (cleanText.length < 2) throw badRequest('Marka və ya model yazın')
  if (cleanText.length > 100) throw badRequest('Maksimum 100 simvol yaza bilərsiniz')
  if (cleanEmail && (cleanEmail.length > 100 || !EMAIL_RE.test(cleanEmail))) {
    throw badRequest('Email düzgün deyil')
  }

  // Spam qoruması: bir IP-dən saatda maksimum 5 sorğu
  const rateKey = `make-request-rate:${ip}`
  const count = await redis.incr(rateKey)
  if (count === 1) await redis.expire(rateKey, 3600)
  if (count > 5) throw badRequest('Çox sayda sorğu göndərdiniz. Bir az sonra yenidən cəhd edin', 429)

  // Eyni mətn hələ gözləmədədirsə, dublikat yaratmırıq. Email varsa, onu əlavə edirik.
  const existing = await MakeRequest.findOne({
    text: { $regex: `^${cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    status: 'pending',
    ...(cleanEmail ? { email: cleanEmail } : {}),
  })

  if (!existing) {
    await MakeRequest.create({
      text: cleanText,
      email: cleanEmail,
      ip,
      user: userId || null,
    })
  }

  return {
    success: true,
    message: cleanEmail
      ? 'Sorğunuz qəbul olundu. Əlavə olunanda emailinizə xəbər göndərəcəyik'
      : 'Sorğunuz qəbul olundu. 1 gün ərzində sayta əlavə olunacaq',
  }
}

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100)
  return { page, limit }
}

const getMakeRequests = async (query) => {
  const { page, limit } = parsePagination(query)
  const filter = {}
  if (['pending', 'added', 'rejected'].includes(query.status)) filter.status = query.status

  const [items, total, pendingCount] = await Promise.all([
    MakeRequest.find(filter)
      .populate('user', '_id name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    MakeRequest.countDocuments(filter),
    MakeRequest.countDocuments({ status: 'pending' }),
  ])

  return {
    success: true,
    data: items,
    total,
    pendingCount,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  }
}

const updateMakeRequestStatus = async (id, status) => {
  if (!['pending', 'added', 'rejected'].includes(status)) throw badRequest('Status düzgün deyil')

  const request = await MakeRequest.findById(id)
  if (!request) throw badRequest('Sorğu tapılmadı', 404)

  request.status = status

  let emailSent = false
  // "Əlavə olundu" edildisə və email varsa — bir dəfə xəbər göndəririk
  if (status === 'added' && request.email && !request.notifiedAt) {
    try {
      await sendMakeAddedEmail(request.email, request.text)
      request.notifiedAt = new Date()
      emailSent = true
    } catch (err) {
      // Email getməsə də status dəyişsin; xəta admin paneldə görünəcək
      await logError(err, { source: 'job', context: 'makeRequest:sendMakeAddedEmail', statusCode: 500 })
    }
  }

  await request.save()

  return {
    success: true,
    message: emailSent
      ? 'Status yeniləndi, istifadəçiyə email göndərildi'
      : request.email && status === 'added' && !request.notifiedAt
        ? 'Status yeniləndi, amma email göndərilmədi (Xəta loqlarına baxın)'
        : 'Status yeniləndi',
    data: request,
  }
}

const deleteMakeRequest = async (id) => {
  await MakeRequest.deleteOne({ _id: id })
  return { success: true, message: 'Silindi' }
}

export default {
  createMakeRequest,
  getMakeRequests,
  updateMakeRequestStatus,
  deleteMakeRequest,
}
