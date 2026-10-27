import partService from '../../services/user/part.service.js'
import { parsePagination } from '../../utils/http.js'

export const GUEST_PART_COOKIE = 'guestLikedParts'

export const parseGuestParts = (raw) => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 500) : []
  } catch {
    return []
  }
}

const guestIds = (req) => parseGuestParts(req.cookies?.[GUEST_PART_COOKIE])
const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res) } catch (err) { next(err) }
}

// GET /api/parts?partCategory=&make=&model=&condition=&region=&minPrice=&maxPrice=&q=&delivery=&sort=&page=&limit=
export const getParts = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query, 20)
  const result = await partService.getParts(req.query, page, limit, req.user?.id, guestIds(req))
  res.status(200).json({ ...result, page, limit, totalPages: Math.max(Math.ceil(result.total / limit), 1) })
})

export const getPart = wrap(async (req, res) => {
  const result = await partService.getPart(req.params.partId, req.user?.id, guestIds(req))
  if (!result) return res.status(404).json({ success: false, message: 'Elan tapılmadı' })
  res.status(200).json(result)
})

export const getMyParts = wrap(async (req, res) => {
  res.status(200).json(await partService.getMyParts(req.user.id))
})

export const getMyPart = wrap(async (req, res) => {
  res.status(200).json(await partService.getMyPart(req.user.id, req.params.partId))
})

export const getSimilarParts = wrap(async (req, res) => {
  res.status(200).json(await partService.getSimilarParts(req.params.partId, req.user?.id, guestIds(req)))
})

export const getSellerParts = wrap(async (req, res) => {
  res.status(200).json(await partService.getSellerParts(req.params.partId, req.user?.id, guestIds(req)))
})

export const createPart = wrap(async (req, res) => {
  const result = await partService.createPart(req.user.id, req.body, req.files || [])
  res.status(201).json(result)
})

export const updatePart = wrap(async (req, res) => {
  const { keepImageKeys, ...data } = req.body
  const result = await partService.updatePart(req.user.id, req.params.partId, data, req.files || [], keepImageKeys)
  res.status(200).json(result)
})

export const deletePart = wrap(async (req, res) => {
  res.status(200).json(await partService.deletePart(req.user.id, req.params.partId))
})

export const toggleLike = wrap(async (req, res) => {
  const { partId } = req.params

  if (req.user?.id) {
    const result = await partService.toggleLikeForUser(req.user.id, partId)
    return res.status(200).json({ success: true, data: result })
  }

  // Qonaq: bəyənmələr cookie-də saxlanılır
  const ids = guestIds(req)
  const liked = !ids.includes(partId)
  await partService.adjustLikedCount(partId, liked ? 1 : -1)
  const updated = liked ? [...ids, partId] : ids.filter((id) => id !== partId)

  res.cookie(GUEST_PART_COOKIE, JSON.stringify(updated), {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 365,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  res.status(200).json({ success: true, data: { liked } })
})

export const getLikedParts = wrap(async (req, res) => {
  res.status(200).json(await partService.getLikedParts(req.user?.id, guestIds(req)))
})

export const clickPart = wrap(async (req, res) => {
  res.status(200).json(await partService.clickPart(req.params.partId, req.ip, req.user?.id))
})
