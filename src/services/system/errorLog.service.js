import crypto from 'crypto'
import mongoose from 'mongoose'
import { ErrorLog } from '../../models/system/errorLog.model.js'

// Bu sahələr heç vaxt bazaya yazılmır
const SENSITIVE_KEYS = ['otp', 'token', 'password', 'pass', 'secret', 'authorization', 'cookie', 'code']

const MAX_STRING = 500
const MAX_STACK = 4000

const sanitize = (value, depth = 0) => {
  if (value == null) return value
  if (depth > 3) return '[...]'

  if (typeof value === 'string') {
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitize(v, depth + 1))
  }
  if (typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value).slice(0, 50)) {
      out[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))
        ? '[gizlədildi]'
        : sanitize(val, depth + 1)
    }
    return out
  }
  return value
}

// Stack-in ilk sətri (xətanın harada yarandığı) + mesaj + route = eyni xəta
const makeFingerprint = ({ source, statusCode, message, route, method, stack }) => {
  // mesajdakı ObjectId və rəqəmləri silirik ki, "elan 6a.. tapılmadı" hər id üçün ayrı sayılmasın
  const normalizedMessage = String(message || '')
    .replace(/[a-f0-9]{24}/gi, ':id')
    .replace(/\d+/g, ':n')
  const firstFrame = String(stack || '').split('\n').slice(1, 2).join('').trim()

  return crypto
    .createHash('sha1')
    .update([source, statusCode, method, route, normalizedMessage, firstFrame].join('|'))
    .digest('hex')
}

/**
 * Xətanı bazaya yazır. HEÇ VAXT xəta atmır — loq yazılmasa belə əsas cavab pozulmamalıdır.
 * @param {Error} err
 * @param {{ req?: import('express').Request, statusCode?: number, source?: 'request'|'process'|'job', context?: string }} opts
 */
const logError = async (err, { req, statusCode, source = 'request', context } = {}) => {
  try {
    // Mongo qoşulu deyilsə (məs. elə DB xətasıdır) yalnız konsola yazırıq
    if (mongoose.connection.readyState !== 1) {
      console.error('[errorLog] DB qoşulu deyil, xəta konsola yazıldı:', err)
      return
    }

    // Route şablonu ("/api/listings/:listingId") — yoxdursa, path-dəki id-ləri əvəz edirik
    let route = context || null
    if (req) {
      route = req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : String(req.originalUrl || req.path || '').split('?')[0].replace(/[a-f0-9]{24}/gi, ':id')
    }

    const data = {
      source,
      statusCode: statusCode ?? err?.statusCode ?? 500,
      name: err?.name || 'Error',
      message: String(err?.message || err || 'Naməlum xəta').slice(0, 1000),
      stack: String(err?.stack || '').slice(0, MAX_STACK),
      method: req?.method || null,
      route,
    }

    const fingerprint = makeFingerprint(data)
    const now = new Date()

    await ErrorLog.updateOne(
      { fingerprint },
      {
        $set: {
          ...data,
          url: req?.originalUrl?.slice(0, 500) || null,
          body: req ? sanitize(req.body) : null,
          query: req ? sanitize(req.query) : null,
          user: req?.user?._id || req?.user?.id || null,
          ip: req?.ip || null,
          userAgent: req?.get?.('user-agent')?.slice(0, 300) || null,
          lastSeen: now,
          // həll edilmiş xəta yenidən baş verdisə, yenidən "açıq" olur
          resolved: false,
          resolvedAt: null,
        },
        $inc: { count: 1 },
        $setOnInsert: { firstSeen: now },
      },
      { upsert: true }
    )
  } catch (logErr) {
    console.error('[errorLog] loq yazıla bilmədi:', logErr?.message, '| əsas xəta:', err?.message)
  }
}

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100)
  return { page, limit }
}

const getErrorLogs = async (query) => {
  const { page, limit } = parsePagination(query)
  const filter = {}
  if (query.resolved === 'true') filter.resolved = true
  if (query.resolved === 'false') filter.resolved = false

  const [items, total, openCount] = await Promise.all([
    ErrorLog.find(filter)
      .select('-body -query -stack')
      .sort({ lastSeen: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ErrorLog.countDocuments(filter),
    ErrorLog.countDocuments({ resolved: false }),
  ])

  return {
    success: true,
    data: items,
    total,
    openCount,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  }
}

const getErrorLog = async (id) => {
  const item = await ErrorLog.findById(id).populate('user', '_id name email').lean()
  if (!item) {
    const error = new Error('Loq tapılmadı')
    error.statusCode = 404
    throw error
  }
  return { success: true, data: item }
}

const setResolved = async (id, resolved) => {
  const item = await ErrorLog.findByIdAndUpdate(
    id,
    { resolved: !!resolved, resolvedAt: resolved ? new Date() : null },
    { returnDocument: 'after' }
  ).select('-body -query -stack').lean()

  if (!item) {
    const error = new Error('Loq tapılmadı')
    error.statusCode = 404
    throw error
  }
  return { success: true, data: item }
}

const deleteErrorLog = async (id) => {
  await ErrorLog.deleteOne({ _id: id })
  return { success: true, message: 'Silindi' }
}

const deleteResolved = async () => {
  const result = await ErrorLog.deleteMany({ resolved: true })
  return { success: true, message: `${result.deletedCount} həll edilmiş loq silindi` }
}

export {
  logError,
  getErrorLogs,
  getErrorLog,
  setResolved,
  deleteErrorLog,
  deleteResolved,
}
