import { model, Schema } from "mongoose";

const userSchema = new Schema({
  name: String,
  avatar: String,
  email: String,
  ip: String,
  balance: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'seller', 'service', 'admin']
  },
  giftPremiumCount: {
    type: Number,
    default: 1
  },
  isWarning: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

userSchema.virtual('listingCount', {
  ref: 'Listing',
  localField: '_id',
  foreignField: 'seller',
  count: true
})

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ ip: 1 })
userSchema.index({ role: 1 })

export const User = model('User', userSchema)