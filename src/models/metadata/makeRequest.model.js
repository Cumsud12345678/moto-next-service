import { model, Schema } from "mongoose";

// İstifadəçinin "axtardığım marka/model tapılmadı" sorğusu
const makeRequestSchema = new Schema({
  // "Bajaj" və ya "Bajaj Pulsar NS200" — istifadəçinin yazdığı kimi
  text: { type: String, required: true, trim: true, maxlength: 100 },

  // Marka əlavə olunanda xəbər almaq istəyirsə (könüllü)
  email: { type: String, trim: true, lowercase: true, default: null },

  status: {
    type: String,
    enum: ['pending', 'added', 'rejected'],
    default: 'pending'
  },

  // Admin "əlavə olundu" edəndə email göndərilibmi
  notifiedAt: { type: Date, default: null },

  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  ip: String,
}, {
  timestamps: true
})

makeRequestSchema.index({ status: 1, createdAt: -1 })

export const MakeRequest = model('MakeRequest', makeRequestSchema)
