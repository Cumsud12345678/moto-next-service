import metadataService from "../services/metadata.service.js";

const getMetadata = async (req, res, next) => {
  try {
    const data = await metadataService.getMetadata()
    res.status(200).json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

const createMakeAndModel = async (req, res, next) => {
  try {
    const file = req.file
    const makeLabel = req.body.makeLabel
    let modelLabels = []
    try {
      modelLabels = JSON.parse(req.body.modelLabels || '[]')
    } catch {
      return res.status(400).json({ success: false, message: 'Model siyahısı düzgün deyil' })
    }

    const result = await metadataService.createMakeAndModel(file, makeLabel, modelLabels)

    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

const updateMake = async (req, res, next) => {
  try {
    const result = await metadataService.updateMake(
      req.params.makeId,
      req.body.makeLabel,
      req.file // logo göndərilməyibsə undefined olur
    )

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const deleteMake = async (req, res, next) => {
  try {
    const result = await metadataService.deleteMake(req.params.makeId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const createModel = async (req, res, next) => {
  try {
    const { makeId, modelLabels } = req.body

    const result = await metadataService.createModel(makeId, modelLabels)

    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

const updateModel = async (req, res, next) => {
  try {
    const result = await metadataService.updateModel(req.params.modelId, req.body.label)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const deleteModel = async (req, res, next) => {
  try {
    const result = await metadataService.deleteModel(req.params.modelId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const createBasicMetadata = async (req, res, next) => {
  try {
    const dataModel = req.body?.dataModel
    const dataLabel = req.body?.dataLabel

    const result = await metadataService.createBasicMetadata(dataModel, dataLabel)

    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

const deleteBasicMetadata = async (req, res, next) => {
  try {
    const dataModel = req.body?.dataModel
    const dataId = req.body?.dataId

    const result = await metadataService.deleteBasicMetadata(dataModel, dataId)

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const updateBasicMetadata = async (req, res, next) => {
  try {
    const { dataModel, dataId, dataLabel } = req.body ?? {}
    res.status(200).json(await metadataService.updateBasicMetadata(dataModel, dataId, dataLabel))
  } catch (err) {
    next(err)
  }
}

const getUsage = async (req, res, next) => {
  try {
    res.status(200).json(await metadataService.getUsage())
  } catch (err) {
    next(err)
  }
}

export {
  getMetadata,
  updateBasicMetadata,
  getUsage,
  createMakeAndModel,
  updateMake,
  deleteMake,
  createModel,
  updateModel,
  deleteModel,
  createBasicMetadata,
  deleteBasicMetadata
}