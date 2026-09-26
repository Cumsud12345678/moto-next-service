import { Router } from "express";
import { getUser, updateUser } from '../../controllers/user/user.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router();

router.get('/:userId', auth, getUser)
router.put('/edit/name/:userId', auth, updateUser)

export default router