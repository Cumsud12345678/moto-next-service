import { Router } from 'express'
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js'
import { createMakeRequest } from '../../controllers/metadata/makeRequest.controller.js'

const router = Router()

// İstifadəçi (login olmadan da) göndərə bilər
router.post('/', optionalAuth, createMakeRequest)

export default router
