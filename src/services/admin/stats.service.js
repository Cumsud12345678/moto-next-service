import { User } from '../../models/user/user.model.js'
import { Listing } from '../../models/listing/listing.model.js'
import { MakeRequest } from '../../models/metadata/makeRequest.model.js'
import { ErrorLog } from '../../models/system/errorLog.model.js'
import { Report } from '../../models/interaction/report.model.js'

const TZ = 'Asia/Baku'
const DAY_MS = 24 * 60 * 60 * 1000

// Son N günün hər günü üçün yaradılan sənəd sayı: [{ date: '2026-10-22', count: 3 }, ...]
const dailyCounts = async (Model, days) => {
  // Bir gün artıq götürürük ki, Bakı vaxtı ilə ilk günün hamısı daxil olsun
  const from = new Date(Date.now() - days * DAY_MS)

  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
        count: { $sum: 1 },
      },
    },
  ])

  const map = new Map(rows.map((r) => [r._id, r.count]))
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

  // Boş günlər də 0 ilə qayıtsın ki, qrafikdə boşluq olmasın
  return Array.from({ length: days }, (_, i) => {
    const date = fmt.format(new Date(Date.now() - (days - 1 - i) * DAY_MS))
    return { date, count: map.get(date) ?? 0 }
  })
}

const getStats = async () => {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)

  const [
    usersTotal,
    usersWeek,
    usersBlocked,
    listingsByStatusRows,
    listingsToday,
    listingsWeek,
    premiumActive,
    viewsRow,
    makeRequestsPending,
    errorsOpen,
    reportsNew,
    listingsDaily,
    usersDaily,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({ isLocked: true }),
    Listing.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Listing.countDocuments({ createdAt: { $gte: dayAgo } }),
    Listing.countDocuments({ createdAt: { $gte: weekAgo } }),
    Listing.countDocuments({ isUrgent: true }),
    Listing.aggregate([{ $group: { _id: null, views: { $sum: { $ifNull: ['$viewCount', 0] } } } }]),
    MakeRequest.countDocuments({ status: 'pending' }),
    ErrorLog.countDocuments({ resolved: false }),
    Report.countDocuments({ status: 'new' }),
    dailyCounts(Listing, 30),
    dailyCounts(User, 30),
  ])

  const listingsByStatus = Object.fromEntries(listingsByStatusRows.map((r) => [r._id ?? 'unknown', r.count]))
  const listingsTotal = listingsByStatusRows.reduce((sum, r) => sum + r.count, 0)

  return {
    success: true,
    data: {
      users: { total: usersTotal, lastWeek: usersWeek, blocked: usersBlocked },
      listings: {
        total: listingsTotal,
        byStatus: listingsByStatus,
        lastDay: listingsToday,
        lastWeek: listingsWeek,
        premium: premiumActive,
        views: viewsRow[0]?.views ?? 0,
      },
      makeRequestsPending,
      errorsOpen,
      reportsNew,
      daily: { listings: listingsDaily, users: usersDaily },
    },
  }
}

export default { getStats }
