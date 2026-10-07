import { Router } from "express";
import { admin } from "../../middlewares/admin.middleware.js";
import { 
  getAllListings,
  getFilteredListings,
  getUserListings,
  getUrgentListings,
  getListing,
  deleteListing,
  setUrgentListing,
  setStatusListing,
  getDeletedListings
} from '../../controllers/admin/adminListing.controller.js'


const router = Router();

router.get('/', getAllListings)
router.get('/filter', getFilteredListings)
router.get('/user/:userId', getUserListings)
router.get('/urgent', getUrgentListings)
// '/:listingId'-dən ƏVVƏL olmalıdır, yoxsa "deleted" listingId kimi qəbul olunur
router.get('/deleted', getDeletedListings)
router.get('/:listingId', getListing)
router.delete('/:listingId', deleteListing)
router.put('/urgent/:listingId', setUrgentListing)
router.put('/edit/status/:listingId', setStatusListing)

export default router