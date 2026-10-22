import { Router } from 'express'
import {
  getErrorLogs,
  getErrorLog,
  resolveErrorLog,
  deleteErrorLog,
  clearResolved,
  testError,
} from '../../controllers/system/errorLog.controller.js'

// app.js-də admin middleware ilə qoşulur
const router = Router()

router.get('/', getErrorLogs)
router.post('/test', testError)
router.delete('/resolved', clearResolved)
router.get('/:id', getErrorLog)
router.patch('/:id', resolveErrorLog)
router.delete('/:id', deleteErrorLog)

export default router
