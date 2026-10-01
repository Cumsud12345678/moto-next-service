import jwt from 'jsonwebtoken'
import { redis } from '../config/redis.config.js'
import { User } from '../models/user/user.model.js'

const admin = async (req, res, next) => {
  try {
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' })
    }

    const isBlacklisted = await redis.get(`blacklist:${token}`)
    if (isBlacklisted) {
      return res.status(401).json({ success: false, message: 'Sessiya bitib' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    const user = await User.findById(decoded.id)
    if(!user) {
      return res.status(403).json({ success: false, message: 'Sehf token' })
    }
    if(user.isLocked){
      return res.status(403).json({ success: false, message: 'Hesabınız kilidlənib' })
    }
    if(user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' })
    }

    req.user = user

    next()

  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token yararsızdır və ya vaxtı bitib' })
  }
}

export { admin }