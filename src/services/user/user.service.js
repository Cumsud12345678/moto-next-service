import { User } from "../../models/user/user.model.js";
import { httpError } from "../../utils/http.js";

// 1 USERI GETIR
const getUser = async (userId) => {
  return await User.findById(userId).select('name avatar email role giftPremiumCount isWarning').lean()
}

// ADI DEYIS
const updateUser = async (userId, name) => {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length < 2) throw httpError(400, 'Ad ən azı 2 simvol olmalıdır')
  if (clean.length > 50) throw httpError(400, 'Ad maksimum 50 simvol ola bilər')

  const updated = await User.findByIdAndUpdate(
    userId,
    { name: clean },
    { returnDocument: 'after', runValidators: true }
  ).select('name avatar email role giftPremiumCount isWarning')

  if (!updated) throw httpError(404, 'İstifadəçi tapılmadı')

  return {
    success: true,
    message: 'Ad dəyişdirildi',
    data: updated
  };
}

// Hədiyyə premium haqqından 1 dənə istifadə et (atomik: eyni anda 2 sorğu 2 dəfə xərcləyə bilməz)
const useGift = async (userId) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, giftPremiumCount: { $gte: 1 } },
    { $inc: { giftPremiumCount: -1 } },
    { returnDocument: 'after' }
  )
  if (!user) throw httpError(400, 'Hədiyyə premium haqqınız qalmayıb')
  return user.giftPremiumCount
}

// Elan premium edilə bilmədisə haqqı geri qaytar
const refundGift = async (userId) => {
  await User.updateOne({ _id: userId }, { $inc: { giftPremiumCount: 1 } })
}

export default {
  getUser,
  updateUser,
  useGift,
  refundGift,
}
