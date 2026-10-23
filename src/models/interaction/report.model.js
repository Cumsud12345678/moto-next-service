import { model, Schema } from "mongoose";

export const REPORT_CATEGORIES = ['fraud', 'wrong_info', 'sold', 'duplicate', 'inappropriate', 'other']
export const REPORT_STATUSES = ['new', 'reviewed', 'dismissed']

// İstifadəçinin elan haqqında şikayəti
const reportSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  category: { type: String, enum: REPORT_CATEGORIES, required: true },
  message: { type: String, trim: true, maxlength: 1000, default: '' },
  email: { type: String, trim: true, lowercase: true, required: true },

  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  ip: String,

  // new: baxılmayıb, reviewed: tədbir görülüb, dismissed: əsassız
  status: { type: String, enum: REPORT_STATUSES, default: 'new' },
  adminNote: { type: String, default: '' },
  handledAt: { type: Date, default: null },
}, {
  timestamps: true
})

reportSchema.index({ status: 1, createdAt: -1 })

export const Report = model('Report', reportSchema)
