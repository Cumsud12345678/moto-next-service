import { Message } from "../../models/interaction/message.model.js";
import { isObjectId } from "../../utils/http.js";

const getAllMessage = async (userId) => {
  const messages = await Message.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(100)
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

// ids göndərilməsə istifadəçinin bütün oxunmamış mesajları oxunmuş olur
// ƏVVƏL: heç nə qaytarılmırdı (cavab boş gedirdi) və ids yoxlanılmırdı
const updateViewMessage = async (userId, ids) => {
  const filter = { user: userId, isView: false }
  if (Array.isArray(ids)) {
    // Frontend bəzən id əvəzinə bütün mesaj obyektini göndərir — hər ikisini qəbul edirik
    filter._id = { $in: ids.map((x) => (x && typeof x === 'object' ? x._id : x)).filter(isObjectId) }
  }

  const result = await Message.updateMany(filter, { isView: true })
  return { success: true, updated: result.modifiedCount }
}

export default {
  getAllMessage,
  getNotViewMessageCount,
  updateViewMessage
}