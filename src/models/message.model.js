import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message_type: {
    type: String,
    enum: ['success', 'warning', 'error'],
    default: 'success'
  },
  is_view: {
    type: Boolean,
    default: false
  },
  message: String
}, {
  timestamps: true
})

export const Message = mongoose.model('Message', messageSchema)