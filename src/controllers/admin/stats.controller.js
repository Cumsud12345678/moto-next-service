import statsService from '../../services/admin/stats.service.js'

const getStats = async (req, res, next) => {
  try {
    res.status(200).json(await statsService.getStats())
  } catch (err) {
    next(err)
  }
}

export { getStats }
