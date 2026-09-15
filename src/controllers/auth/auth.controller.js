import authService from '../../services/auth/auth.service.js'
import listingService from '../../services/user/listing.service.js';

const registerStart = async (req, res, next) => {
  try{
    const name = req.body.name;
    const email = req.body.email;

    const result = await authService.registerStart(email, name)
    res.status(200).json(result)
  }catch (err) {
    next(err)
  }
}

const registerVerify = async (req, res, next) => {
  try{
    const email = req.body.email;
    const otp = req.body.otp;
    const ip = req.ip;

    const result = await authService.registerVerify(email, otp, ip)
    
    // Cookie-ni burada set et
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    // login uğurlu olandan sonra
    const guestLikedIds = req.cookies?.guestLikedIds
      ? JSON.parse(req.cookies.guestLikedIds)
      : [];

    if (guestLikedIds.length > 0) {
      await listingService.migrateGuestLikes(result.data._id, guestLikedIds);
      res.clearCookie('guestLikedIds');
    }

    res.status(200).json(result)
  }catch (err) {
    next(err)
  }
}

const loginStart = async (req, res, next) => {
  try{
    const email = req.body.email;

    const result = await authService.loginStart(email)
    res.status(200).json(result)
  }catch (err) {
    next(err)
  }
}

const loginVerify = async (req, res, next) => {
  try{
    const email = req.body.email;
    const otp = req.body.otp;
    const ip = req.ip;

    const result = await authService.loginVerify(email, otp, ip)

    // Cookie-ni burada set et
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    // login uğurlu olandan sonra
    const guestLikedIds = req.cookies?.guestLikedIds
      ? JSON.parse(req.cookies.guestLikedIds)
      : [];

    if (guestLikedIds.length > 0) {
      await listingService.migrateGuestLikes(result.data._id, guestLikedIds);
      res.clearCookie('guestLikedIds');
    }

    res.status(200).json(result)
  }catch (err) {
    next(err)
  }
}


const absoluteVerifyStart = async (req, res, next) => {
  try{
    const email = req.body.email;
    // const name = req.body.name || null;

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

    const result = await authService.absoluteVerifyEnd(email, name, otp, ip)
    
    // Cookie-ni burada set et
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    // login uğurlu olandan sonra
    const guestLikedIds = req.cookies?.guestLikedIds
      ? JSON.parse(req.cookies.guestLikedIds)
      : [];

    if (guestLikedIds.length > 0) {
      await listingService.migrateGuestLikes(result.userId, guestLikedIds);
      res.clearCookie('guestLikedIds');
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
  registerStart,
  registerVerify,

  loginStart,
  loginVerify,

  absoluteVerifyStart,
  absoluteVerifyEnd,

  logout,

  getMe
}
