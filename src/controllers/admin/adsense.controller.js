import adsenseService from "../../services/admin/adsense.service.js";

const getAllAdsense = async (req, res, next) => {
  try{
    const result = await adsenseService.getAllAdsense()

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const createAdsense = async (req, res, next) => {
  try{
    const file = req.file;
    const data = req.body;

    const { day, ...newData } = data

    const result = await adsenseService.createAdsense(file, newData, day)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const clickAdsense = async (req, res, next) => {
  try{
    const adsenseId = req.params.adsenseId;

    const result = await adsenseService.clickAdsense(adsenseId)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const updateAdsense = async (req, res, next) => {
  try{
    const adsenseId = req.params.adsenseId;
    const file = req.file;
    const data = req.body;

    const { day, logo, ...newData } = data

    const result = await adsenseService.updateAdsense(adsenseId, file, newData)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const deleteAdsense = async (req, res, next) => {
  try{
    const adsenseId = req.params.adsenseId;

    const result = await adsenseService.deleteAdsense(adsenseId)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

export {
  getAllAdsense,
  createAdsense,
  clickAdsense,
  updateAdsense,
  deleteAdsense
}