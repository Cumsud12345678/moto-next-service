import mongoose from "mongoose";

const likeSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
})

likeSchema.index({ user: 1, listing: 1 }, { unique: true });

export const Like = mongoose.model('Like', likeSchema)