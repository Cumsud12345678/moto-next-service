import authService from '../../services/auth/auth.service.js'
import listingService from '../../services/user/listing.service.js';
import partService from '../../services/user/part.service.js';
import { GUEST_PART_COOKIE, parseGuestParts } from '../user/part.controller.js';
import jwt from 'jsonwebtoken'
import { redis } from '../../config/redis.config.js'

// guestLikedIds cookie zədəlidirsə JSON.parse bütün login-i 500-ə salmasın
const parseGuestLikedIds = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const absoluteVerifyStart = async (req, res, next) => {
  try{
    const email = req.body.email;
    if(!email || email.length < 5) {
      return res.status(403).json({ success: false, message: 'Xahiş olunur düzgün email daxil edin.' })
    }

    const result = await authService.absoluteVerifyStart(email)
    res.status(200).json(result) // message, success
  }catch (err) {
    next(err)
  }
}

const absoluteVerifyEnd = async (req, res, next) => {
  try{
    const email = req.body.email;
    const name = req.body.name || null;
    const otp = req.body.otp;
    const ip = req.ip;

    if(!email || email.length < 5) {
      return res.status(403).json({ success: false, message: 'Məlumatlar əksikdir.' })
    }

    const result = await authService.absoluteVerifyEnd(email, name, otp, ip)
    
    // Cookie-ni burada set et
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    // login uğurlu olandan sonra
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds);

    if (guestLikedIds.length > 0) {
      try {
        await listingService.migrateGuestLikes(result.userId, guestLikedIds);
      } catch (e) {
        // bəyənmələrin köçürülməsi alınmasa belə giriş uğurlu sayılmalıdır
        console.error('migrateGuestLikes xətası:', e.message);
      }
      res.clearCookie('guestLikedIds');
    }

    // Qonaq kimi bəyənilmiş hissə elanları da hesaba köçürülür
    const guestParts = parseGuestParts(req.cookies?.[GUEST_PART_COOKIE]);
    if (guestParts.length > 0) {
      try {
        await partService.migrateGuestLikes(result.userId, guestParts);
      } catch (e) {
        console.error('Hissə bəyənmələri köçürülmədi:', e.message);
      }
      res.clearCookie(GUEST_PART_COOKIE);
    }
    
    res.status(200).json(result) // success, userId
  }catch (err) {
    next(err)
  }
}

// LOGOUT
const logout = async (req, res, next) => {
  try {
    const token = req.cookies.token

    if (token) {
      let decoded = null;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        // etibarsız, saxta və ya vaxtı keçmiş token — sadəcə cookie-ni təmizləyib davam edirik
        decoded = null;
      }
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000)
        if (ttl > 0) {
          await redis.set(`blacklist:${token}`, '1', { EX: ttl })
        }
      }
    }

    const isProd = process.env.NODE_ENV === 'production'
    const isTunnel = process.env.USE_TUNNEL === 'true'

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    return res.status(200).json({ success: true, message: 'Çıxış edildi' })
  } catch (err) {
    next(err)
  }
}

const getMe = async (req, res, next) => {
  try{
    const userId = req.user?.id
    if(!userId) return res.status(200).json({ success: true, data: undefined });
    const user = await authService.getMe(userId)
    res.status(200).json({ success: true, data: user })
  }catch(err) {
    next(err)
  }
}


export {
  absoluteVerifyStart,
  absoluteVerifyEnd,

  logout,

  getMe
}
