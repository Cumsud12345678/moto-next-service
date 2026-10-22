import {
  getErrorLogs as getErrorLogsService,
  getErrorLog as getErrorLogService,
  setResolved,
  deleteErrorLog as deleteErrorLogService,
  deleteResolved,
} from '../../services/system/errorLog.service.js'

const getErrorLogs = async (req, res, next) => {
  try {
    res.status(200).json(await getErrorLogsService(req.query))
  } catch (err) {
    next(err)
  }
}

const getErrorLog = async (req, res, next) => {
  try {
    res.status(200).json(await getErrorLogService(req.params.id))
  } catch (err) {
    next(err)
  }
}

const resolveErrorLog = async (req, res, next) => {
  try {
    res.status(200).json(await setResolved(req.params.id, req.body?.resolved !== false))
  } catch (err) {
    next(err)
  }
}

const deleteErrorLog = async (req, res, next) => {
  try {
    res.status(200).json(await deleteErrorLogService(req.params.id))
  } catch (err) {
    next(err)
  }
}

const clearResolved = async (req, res, next) => {
  try {
    res.status(200).json(await deleteResolved())
  } catch (err) {
    next(err)
  }
}

// Sistemin işlədiyini yoxlamaq üçün: admin paneldən "Test xətası" basanda loq yaranmalıdır
const testError = async (req, res, next) => {
  next(new Error('Test xətası — admin paneldən yaradıldı'))
}

export {
  getErrorLogs,
  getErrorLog,
  resolveErrorLog,
  deleteErrorLog,
  clearResolved,
  testError,
}
