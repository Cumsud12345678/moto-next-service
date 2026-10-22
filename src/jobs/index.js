import cron from 'node-cron'
import { Listing } from '../models/listing/listing.model.js'
import { logError } from '../services/system/errorLog.service.js'

const DAY_MS = 24 * 60 * 60 * 1000

// ƏVVƏL: job faylları CommonJS (module.exports) ilə yazılmışdı, import yolu da səhv idi
// və heç yerdən çağırılmırdı — heç vaxt işləmirdi. Premium və köhnə elanların vaxtı bitmirdi.

// 1) Vaxtı bitmiş premiumları ləğv et
export async function expirePremiumListings() {
  const result = await Listing.updateMany(
    { isUrgent: true, urgentExpiresAt: { $lte: new Date() } },
    { $set: { isUrgent: false }, $unset: { urgentActiveAt: 1, urgentExpiresAt: 1 } }
  )
  return result.modifiedCount
}

// 2) N gündən köhnə aktiv elanları "expired" et (istifadəçi profilindən yenidən aktivləşdirə bilər).
// Yalnız LISTING_EXPIRY_DAYS env dəyişəni təyin olunubsa işləyir.
export async function expireOldListings(days) {
  const cutoff = new Date(Date.now() - days * DAY_MS)
  const result = await Listing.updateMany(
    {
      status: 'active',
      $or: [
        { activeSince: { $lte: cutoff } },
        // activeSince sahəsi əlavə olunmazdan əvvəlki elanlar
        { activeSince: { $exists: false }, createdAt: { $lte: cutoff } },
      ],
    },
    { $set: { status: 'expired' } }
  )
  return result.modifiedCount
}

const safeRun = (name, fn) => async () => {
  try {
    const count = await fn()
    if (count) console.log(`[job] ${name}: ${count} elan yeniləndi`)
  } catch (err) {
    console.error(`[job] ${name} xətası:`, err)
    logError(err, { source: 'job', context: `job:${name}`, statusCode: 500 })
  }
}

export function startJobs() {
  const premium = safeRun('expirePremium', expirePremiumListings)
  // Render pulsuz planda server yatır və cron o vaxt işləmir — ona görə başlayanda dərhal da işlədirik
  premium()
  cron.schedule('*/5 * * * *', premium)

  const days = parseInt(process.env.LISTING_EXPIRY_DAYS, 10)
  if (days > 0) {
    const old = safeRun('expireOldListings', () => expireOldListings(days))
    old()
    cron.schedule('0 3 * * *', old, { timezone: 'Asia/Baku' })
    console.log(`[job] Köhnə elanlar ${days} gündən sonra "expired" olacaq`)
  } else {
    console.log('[job] LISTING_EXPIRY_DAYS təyin olunmayıb — köhnə elanların avtomatik bitməsi söndürülüb')
  }
}
