import mongoose from "mongoose";
import { User } from "../../models/user/user.model.js";
import { deleteFromR2, uploadToR2 } from "../storage.service.js";

// 1 USERI GETIR
const getUser = async (userId) => {
  return await User.findById(userId).select('name avatar email role giftPremiumCount isWarning').lean()
}

// USERI GUNCELLE
const updateUser = async (userId, name) => {
  
  const updated = await User.findByIdAndUpdate(userId, {
    name: name,
  }, {
    new: true, // returnDocument əvəzinə bunu işlətmək daha etibarlıdır Mongoose-da
    runValidators: true
  });

  if (!updated) {
    throw new Error('User not found'); // və ya öz error handling-in
  }
  return {
    success: true,
    message: 'Ad dəyişdirildi',
    data: updated
  };
}

const usingTheGift = async (userId) => {
  const user = await User.findOne({ _id: userId, giftPremiumCount: { $gte: 1 } })
  if (!user) throw new Error('User tapilmadi');

  await User.updateOne({_id: userId}, {
    $inc: {
      giftPremiumCount: -1
    }
  })

  return {
    success: true
  }
}

export default {
  getUser,
  updateUser,
  usingTheGift
}