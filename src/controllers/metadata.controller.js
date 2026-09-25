import metadataService from "../services/metadata.service.js";

const getMetadata = async (req, res, next) => {
  try{
    const data = await metadataService.getMetadata()
    res.status(200).json({success: true, data: data})
  }catch(err) {
    next(err)
  }
}

const createMakeAndModel = async (req, res, next) => {
  try{
    const file = req.file;
    const makeLabel = req.body.makeLabel;
    const modelLabels = JSON.parse(req.body.modelLabels || '[]');

    console.log(file)

    const result = await metadataService.createMakeAndModel(file, makeLabel, modelLabels)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const deleteMake = async (req, res, next) => {
  try{
    const makeId = req.params.makeId;

    const result = await metadataService.deleteMake(makeId)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const createModel = async (req, res, next) => {
  try{
    const makeId = req.body.makeId;
    const modelLabels = req.body.modelLabels;

    const result = await metadataService.createModel(makeId, modelLabels)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const createBasicMetadata = async (req, res, next) => {
  try{
    const dataModel = req.body.dataModel.toLowerCase();
    const dataLabel = req.body.dataLabel;

    const result = await metadataService.createBasicMetadata(dataModel, dataLabel)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const deleteBasicMetadata = async (req, res, next) => {
  try{
    const dataModel = req.body.dataModel.toLowerCase();
    const dataLabel = req.body.dataLabel;

    const result = await metadataService.deleteBasicMetadata(dataModel, dataLabel)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

export {
  getMetadata,
  createMakeAndModel,
  deleteMake,
  createModel,
  createBasicMetadata,
  deleteBasicMetadata
}