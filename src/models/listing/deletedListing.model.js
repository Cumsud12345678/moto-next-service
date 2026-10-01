import { model, Schema } from "mongoose";

const deletedListingSchema = new Schema({
  originalListingId: { type: Schema.Types.ObjectId, required: true, index: true },
  
  // Elanın snapshot-u (silinmə anındakı tam halı)
  snapshot: { type: Schema.Types.Mixed, required: true },
  
  // Kim, nə vaxt, niyə sildi
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedByRole: { type: String, enum: ['user', 'admin', 'system'] }, // özü, admin, yoxsa avtomatik (expired)
  deleteReason: { type: String }, // 'sold', 'user_deleted', 'admin_removed', 'spam', 'expired_cleanup'

  // Statistika
  viewCount: Number,
  likedCount: Number
}, {
  timestamps: true
})

export const DeletedListing = model('DeletedListing', deletedListingSchema)