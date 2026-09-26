import messageService from "../../services/user/message.service.js";

const getAllMessage = async (req, res, next) => {
  try{
    const userId = req.user?.id
    const result = await messageService.getAllMessage(userId)
    res.status(200).json(result)
  }catch(err){
    next(err)
  }
}

const getNotViewMessageCount = async (req, res, next) => {
  try{
    const userId = req.user?.id
    const result = await messageService.getNotViewMessageCount(userId)
    res.status(200).json(result)
  }catch(err){
    next(err)
  }
}

const updateViewMessage = async (req, res, next) => {
  try{
    const userId = req.user?.id
    const ids = req.body.ids
    const result = await messageService.updateViewMessage(userId, ids)
    res.status(200).json(result)
  }catch(err){
    next(err)
  }
}

export {
  getAllMessage,
  getNotViewMessageCount,
  updateViewMessage
}