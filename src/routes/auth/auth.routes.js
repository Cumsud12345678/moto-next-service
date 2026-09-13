import express from 'express'
import { registerStart, registerVerify, loginStart, loginVerify, getMe, absoluteVerifyStart, absoluteVerifyEnd } from '../../controllers/auth/auth.controller.js'
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js'

const router = express.Router()

// Register
router.post('/register', registerStart)
router.post('/register-verify', registerVerify)

// Login
router.post('/login', loginStart)
router.post('/login-verify', loginVerify)

// Absolute
router.post('/absolute/verify-start', absoluteVerifyStart)
router.post('/absolute/verify-end', absoluteVerifyEnd)

router.get('/me', optionalAuth, getMe)

export default router