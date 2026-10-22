import adminListingService from '../../services/admin/adminListing.service.js'
import { paginationMeta, parsePagination } from '../../utils/http.js'

// GET /api/admin/listings?q=&status=&isUrgent=&make=&seller=&page=&limit=
// (/filter də eyni funksiyaya yönəlir — köhnə linklər işləsin)
const getListings = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const { listings, total } = await adminListingService.getListings(req.query, page, limit)
    res.status(200).json({ success: true, data: listings, ...paginationMeta(total, page, limit) })
  } catch (err) {
    next(err)
  }
}

const getUserListings = async (req, res, next) => {
  try {
    const listings = await adminListingService.getUserListings(req.params.userId)
    res.status(200).json({ success: true, data: listings })
  } catch (err) {
    next(err)
  }
}

const getUrgentListings = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const { urgentListings, total } = await adminListingService.getUrgentListings(page, limit)
    res.status(200).json({ success: true, data: urgentListings, ...paginationMeta(total, page, limit) })
  } catch (err) {
    next(err)
  }
}

const getListing = async (req, res, next) => {
  try {
    res.status(200).json(await adminListingService.getListing(req.params.listingId))
  } catch (err) {
    next(err)
  }
}

const deleteListing = async (req, res, next) => {
  try {
    const result = await adminListingService.deleteListing(req.user?.id, req.params.listingId, req.body?.message)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

// ƏVVƏL: cavab { result: {...} } içinə bükülürdü, frontend mesajı oxuya bilmirdi
const setUrgentListing = async (req, res, next) => {
  try {
    res.status(200).json(await adminListingService.setUrgentListing(req.params.listingId, req.body?.day))
  } catch (err) {
    next(err)
  }
}

const removeUrgentListing = async (req, res, next) => {
  try {
    res.status(200).json(await adminListingService.removeUrgentListing(req.params.listingId))
  } catch (err) {
    next(err)
  }
}

const setStatusListing = async (req, res, next) => {
  try {
    const result = await adminListingService.setStatusListing(req.params.listingId, req.body?.status, req.body?.message)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const getDeletedListings = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const { deletedListings, total } = await adminListingService.getDeletedListings(page, limit)
    res.status(200).json({ success: true, data: deletedListings, ...paginationMeta(total, page, limit) })
  } catch (err) {
    next(err)
  }
}

export {
  getListings,
  getListings as getAllListings,
  getListings as getFilteredListings,
  getUserListings,
  getUrgentListings,
  getListing,
  deleteListing,
  setUrgentListing,
  removeUrgentListing,
  setStatusListing,
  getDeletedListings,
}
