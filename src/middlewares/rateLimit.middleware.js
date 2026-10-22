import { redis } from '../config/redis.config.js'

/**
 * Redis əsaslı sadə rate limit (əlavə paket lazım deyil).
 * @param {object} opts
 * @param {string} opts.name     - limitin adı (açar prefiksi)
 * @param {number} opts.max      - pəncərə ərzində icazə verilən sorğu sayı
 * @param {number} opts.windowSec - pəncərə (saniyə)
 * @param {(req) => string} [opts.key] - kimə görə sayılır (default: IP)
 * @param {string} [opts.message]
 */
export const rateLimit = ({ name, max, windowSec, key, message }) => async (req, res, next) => {
  try {
    const who = key ? key(req) : req.ip
    const redisKey = `rl:${name}:${who}`

    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSec)

    if (count > max) {
      const ttl = await redis.ttl(redisKey)
      res.set('Retry-After', String(Math.max(ttl, 1)))
      return res.status(429).json({
        success: false,
        message: message || 'Çox sayda sorğu göndərdiniz. Bir az sonra yenidən cəhd edin',
      })
    }

    next()
  } catch (err) {
    // Redis işləməsə sayt dayanmasın — limitsiz davam edirik
    console.error('rateLimit xətası:', err.message)
    next()
  }
}
