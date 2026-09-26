import mongoose from "mongoose";
import { User } from "../../models/user.model.js";
import { deleteFromR2, uploadToR2 } from "../storage.service.js";

// 1 USERI GETIR
const getUser = async (userId) => {
  return await User.findById(userId).select('name avatar email role isWarning').lean()
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

export default {
  getUser,
  updateUser,
}