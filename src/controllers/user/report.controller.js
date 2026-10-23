import reportService from '../../services/user/report.service.js'

const createReport = async (req, res, next) => {
  try {
    const result = await reportService.createReport({
      listingId: req.params.listingId,
      category: req.body?.category,
      message: req.body?.message,
      email: req.body?.email,
      userId: req.user?._id || req.user?.id,
      ip: req.ip,
    })
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

// ADMIN
const getReports = async (req, res, next) => {
  try {
    res.status(200).json(await reportService.getReports(req.query))
  } catch (err) {
    next(err)
  }
}

const updateReport = async (req, res, next) => {
  try {
    res.status(200).json(await reportService.updateReport(req.params.id, req.body ?? {}))
  } catch (err) {
    next(err)
  }
}

const resolveListingReports = async (req, res, next) => {
  try {
    res.status(200).json(await reportService.resolveListingReports(req.params.listingId, req.body?.status))
  } catch (err) {
    next(err)
  }
}

const deleteReport = async (req, res, next) => {
  try {
    res.status(200).json(await reportService.deleteReport(req.params.id))
  } catch (err) {
    next(err)
  }
}

export { createReport, getReports, updateReport, resolveListingReports, deleteReport }
