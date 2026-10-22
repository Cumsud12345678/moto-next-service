import { Router } from 'express'
import {
  getMakeRequests,
  updateMakeRequestStatus,
  deleteMakeRequest,
} from '../../controllers/metadata/makeRequest.controller.js'

// app.js-də admin middleware ilə qoşulur
const router = Router()

router.get('/', getMakeRequests)
router.patch('/:id', updateMakeRequestStatus)
router.delete('/:id', deleteMakeRequest)

export default router
