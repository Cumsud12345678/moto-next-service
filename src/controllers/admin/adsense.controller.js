import adsenseService from "../../services/admin/adsense.service.js";

const getActiveAdsense = async (req, res, next) => {
  try {
    res.status(200).json(await adsenseService.getActiveAdsense())
  } catch (err) {
    next(err)
  }
}

const getAllAdsense = async (req, res, next) => {
  try {
    res.status(200).json(await adsenseService.getAllAdsense())
  } catch (err) {
    next(err)
  }
}

const createAdsense = async (req, res, next) => {
  try {
    res.status(201).json(await adsenseService.createAdsense(req.file, req.body))
  } catch (err) {
    next(err)
  }
}

const clickAdsense = async (req, res, next) => {
  try {
    res.status(200).json(await adsenseService.clickAdsense(req.params.adsenseId))
  } catch (err) {
    next(err)
  }
}

const updateAdsense = async (req, res, next) => {
  try {
    res.status(200).json(await adsenseService.updateAdsense(req.params.adsenseId, req.file, req.body))
  } catch (err) {
    next(err)
  }
}

const deleteAdsense = async (req, res, next) => {
  try {
    res.status(200).json(await adsenseService.deleteAdsense(req.params.adsenseId))
  } catch (err) {
    next(err)
  }
}

export {
  getActiveAdsense,
  getAllAdsense,
  createAdsense,
  clickAdsense,
  updateAdsense,
  deleteAdsense
}
