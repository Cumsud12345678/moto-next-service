import mongoose from "mongoose"

const adsenseSchema = mongoose.Schema({
  logo: String,
  link: String,
  position: {
    type: String,
    enum: ['mobile', 'deskop_left', 'deskop_right'],
    default: 'mobile'
  },
  isHome: Boolean,
  isDetails: Boolean,
  clickCount: {
    type: Number,
    default: 0
  },
  adsenseExpiresAt: { 
    type: Date,
    default: new Date()
  },
  ownerName: String,
  ownerPhone: String
},{
  timestamps: true
})

export const Adsense = mongoose.model('Adsense', adsenseSchema)
