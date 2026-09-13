import { Schema, model } from "mongoose";

const deletedUserSerSchema = new Schema({
  originalUserId: { type: Schema.Types.ObjectId, required: true, index: true },

  // Userin snapshot-u (silinmə anındakı tam halı)
  snapshot: { type: Schema.Types.Mixed, required: true },

  // Kim, nə vaxt, niyə sildi
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedByRole: { type: String, enum: ['user', 'admin', 'system'] }, // özü, admin, yoxsa avtomatik (expired)
  deleteReason: { type: String }, // 'sold', 'user_deleted', 'admin_removed', 'spam', 'expired_cleanup'
}, {
  timestamps: true
})

export const DeletedUser = model('DeletedUser', deletedUserSerSchema)