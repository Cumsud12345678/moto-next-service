import { Message } from "../../models/interaction/message.model.js";

const getAllMessage = async (userId) => {
  const messages = await Message.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean()

  return {
    success: true,
    data: messages
  }
}

const getNotViewMessageCount = async (userId) => {
  const count = await Message.countDocuments({ user: userId, isView: false })

  return {
    success: true,
    total: count
  }
}

const updateViewMessage = async (userId, ids) => {
  await Message.updateMany({ user: userId, _id: { $in: ids } }, {
    isView: true
  })
}

export default {
  getAllMessage,
  getNotViewMessageCount,
  updateViewMessage
}