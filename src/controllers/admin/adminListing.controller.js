import adminListingService from "../../services/admin/adminListing.service.js";

// page >= 1, limit 1..100
const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100)
  return { page, limit }
}

const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.max(Math.ceil(total / limit), 1)
})

const getAllListings = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)

    const { listings, total } = await adminListingService.getAllListings(page, limit)

    res.status(200).json({ success: true, data: listings, ...paginationMeta(total, page, limit) })
  }catch(err) {
    next(err)
  }
}

const getFilteredListings = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)
    const filters = req.query

    const { listings, total } = await adminListingService.getFilteredListings(filters, page, limit)

    res.status(200).json({ success: true, data: listings, ...paginationMeta(total, page, limit) })
  }catch(err) {
    next(err)
  }
}

// USERIN ELANLARIN GETIR
const getUserListings = async (req, res, next) => {
  try{
    const userId = req.params.userId

    const listings = await adminListingService.getUserListings(userId)

    res.status(200).json({ success: true, data: listings })
  }catch(err) {
    next(err)
  }
}

// PREMIUM ELANLARI GETIR
const getUrgentListings = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)

    const { urgentListings, total } = await adminListingService.getUrgentListings(page, limit)

    res.status(200).json({ success: true, data: urgentListings, ...paginationMeta(total, page, limit) })
  }catch(err) {
    next(err)
  }
}

// 1 ELANI CEK
const getListing = async (req, res, next) => {
  try{
    const listingId = req.params.listingId

    const result = await adminListingService.getListing(listingId)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

// ELANI SIL
const deleteListing = async (req, res, next) => {
  try{
    const adminId = req.user?.id
    const listingId = req.params.listingId
    const message = req.body.message

    const result = await adminListingService.deleteListing(adminId, listingId, message)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

// ELANI URGENT ET
const setUrgentListing = async (req, res, next) => {
  try{
    const listingId = req.params.listingId
    const day = req.body.day

    const result = await adminListingService.setUrgentListing(listingId, day)

    res.status(200).json({ result })
  }catch(err) {
    next(err)
  }
}


// ELANIN STATUSUNU DEYIS
const setStatusListing = async (req, res, next) => {
  try{
    const listingId = req.params.listingId
    const newStatus = req.body.status

    const result = await adminListingService.setStatusListing(listingId, newStatus)

    res.status(200).json({ result })
  }catch(err) {
    next(err)
  }
}


// SILINMIS ELANLARLA BAQLI

// SILINMIS ELANLARI GETIR
// (əvvəl req, res, next parametrləri yox idi, ona görə ReferenceError verirdi)
const getDeletedListings = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)

    const { deletedListings, total } = await adminListingService.getDeletedListings(page, limit)

    res.status(200).json({ success: true, data: deletedListings, ...paginationMeta(total, page, limit) })
  }catch(err) {
    next(err)
  }
}


export {
  getAllListings,
  getFilteredListings,
  getUserListings,
  getUrgentListings,
  getListing,
  deleteListing,
  setUrgentListing,
  setStatusListing,
  getDeletedListings
}