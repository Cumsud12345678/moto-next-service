import { Router } from 'express'
import { getStats } from '../../controllers/admin/stats.controller.js'

// app.js-də admin middleware ilə qoşulur
const router = Router()

router.get('/', getStats)

export default router
