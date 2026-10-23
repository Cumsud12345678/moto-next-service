import { Router } from 'express'
import {
  getReports,
  updateReport,
  resolveListingReports,
  deleteReport,
} from '../../controllers/user/report.controller.js'

// app.js-də admin middleware ilə qoşulur
const router = Router()

router.get('/', getReports)
router.patch('/listing/:listingId', resolveListingReports)
router.patch('/:id', updateReport)
router.delete('/:id', deleteReport)

export default router
