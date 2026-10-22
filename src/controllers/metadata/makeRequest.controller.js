import makeRequestService from '../../services/metadata/makeRequest.service.js'

// İSTİFADƏÇİ: "marka/model tapılmadı" sorğusu göndər
const createMakeRequest = async (req, res, next) => {
  try {
    const result = await makeRequestService.createMakeRequest({
      text: req.body?.text,
      email: req.body?.email,
      ip: req.ip,
      userId: req.user?._id || req.user?.id,
    })
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

// ADMIN
const getMakeRequests = async (req, res, next) => {
  try {
    const result = await makeRequestService.getMakeRequests(req.query)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const updateMakeRequestStatus = async (req, res, next) => {
  try {
    const result = await makeRequestService.updateMakeRequestStatus(req.params.id, req.body?.status)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const deleteMakeRequest = async (req, res, next) => {
  try {
    const result = await makeRequestService.deleteMakeRequest(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export {
  createMakeRequest,
  getMakeRequests,
  updateMakeRequestStatus,
  deleteMakeRequest,
}
