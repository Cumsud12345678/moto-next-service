import { Router } from "express";
import { 
  getAllMessage,
  getNotViewMessageCount,
  updateViewMessage
} from '../../controllers/user/message.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router();

router.get('/', auth, getAllMessage)
router.get('/not/view', auth, getNotViewMessageCount)
router.put('/not/view', auth, updateViewMessage)

export default router