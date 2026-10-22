import express from 'express'
import { getMe, absoluteVerifyStart, absoluteVerifyEnd, logout } from '../../controllers/auth/auth.controller.js'
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js'
import { auth } from "../../middlewares/auth.middleware.js";
import { rateLimit } from '../../middlewares/rateLimit.middleware.js'

const router = express.Router()

// Köhnə /register, /register-verify, /login, /login-verify endpoint-ləri silindi:
// frontend yalnız /absolute/* istifadə edir, qalanları boş yerə email göndərmək üçün açıq qapı idi.

// Bir IP-dən 15 dəqiqədə 10 kod — başqalarının emailinə spam göndərmək olmasın
router.post(
  '/absolute/verify-start',
  rateLimit({ name: 'otp-start', max: 10, windowSec: 15 * 60, message: 'Çox sayda kod istədiniz. 15 dəqiqə sonra yenidən cəhd edin' }),
  absoluteVerifyStart
)
// Bir IP-dən 15 dəqiqədə 20 təsdiq cəhdi — kodu təxmin etməyə çalışmaq olmasın
router.post(
  '/absolute/verify-end',
  rateLimit({ name: 'otp-end', max: 20, windowSec: 15 * 60, message: 'Çox sayda cəhd. 15 dəqiqə sonra yenidən yoxlayın' }),
  absoluteVerifyEnd
)

router.get('/logout', auth, logout)

router.get('/me', optionalAuth, getMe)

export default router
