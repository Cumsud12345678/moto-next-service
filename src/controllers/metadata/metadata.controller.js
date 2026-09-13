import metadataService from "../../services/metadata/metadata.service.js";

const getMetadata = async (req, res, next) => {
  try{
    const data = await metadataService.getMetadata()
    res.status(200).json({success: true, data: data})
  }catch(err) {
    next(err)
  }
}

export {
  getMetadata
}