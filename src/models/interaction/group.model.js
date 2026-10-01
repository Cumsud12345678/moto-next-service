import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  logo: String,
  title: String,
  link: String,
  clickCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

export const Group = mongoose.model('Group', groupSchema)