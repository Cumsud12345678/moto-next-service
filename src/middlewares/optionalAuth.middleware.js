import jwt from 'jsonwebtoken'
import { User } from '../models/user/user.model.js'

const optionalAuth = async (req, res, next) => {
  try{
    const token = req.cookies?.token;

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')

    // bloklanmış istifadəçi giriş etmiş sayılmasın (əvvəl ikinci sətir bunu ləğv edirdi)
    if (user && !user.isLocked) {
      req.user = user
    }

    next()
  } catch (err) {
    next()
  }
  
}

export { optionalAuth }