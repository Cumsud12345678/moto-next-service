import mongoose from "mongoose";

// Hissə elanlarının bəyənmələri (motosiklet bəyənmələrindən ayrı)
const partLikeSchema = new mongoose.Schema({
  part: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
})

partLikeSchema.index({ user: 1, part: 1 }, { unique: true });
partLikeSchema.index({ part: 1 });

export const PartLike = mongoose.model('PartLike', partLikeSchema)
