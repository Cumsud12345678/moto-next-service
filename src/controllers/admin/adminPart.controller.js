import adminPartService from '../../services/admin/adminPart.service.js'
import { paginationMeta, parsePagination } from '../../utils/http.js'

// GET /api/admin/parts?q=&status=&partCategory=&seller=&page=&limit=
export const getParts = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const { parts, total } = await adminPartService.getParts(req.query, page, limit)
    res.status(200).json({ success: true, data: parts, ...paginationMeta(total, page, limit) })
  } catch (err) {
    next(err)
  }
}

export const setStatus = async (req, res, next) => {
  try {
    res.status(200).json(await adminPartService.setStatus(req.params.partId, req.body?.status, req.body?.message))
  } catch (err) {
    next(err)
  }
}

export const deletePart = async (req, res, next) => {
  try {
    res.status(200).json(await adminPartService.deletePart(req.user.id, req.params.partId, req.body?.message))
  } catch (err) {
    next(err)
  }
}
