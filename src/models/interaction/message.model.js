import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messageType: {
    type: String,
    enum: ['success', 'warning', 'danger', 'error'],
    default: 'success'
  },
  isView: {
    type: Boolean,
    default: false
  },
  message: String
}, {
  timestamps: true
})

export const Message = mongoose.model('Message', messageSchema)