import { model, Schema } from "mongoose";

// Backend xətaları. Eyni xəta (eyni mesaj + eyni route) təkrarlananda yeni sənəd
// yaradılmır, "count" artırılır — baza dolmur, admin paneldə siyahı oxunaqlı qalır.
const errorLogSchema = new Schema({
  fingerprint: { type: String, required: true, unique: true },

  source: { type: String, enum: ['request', 'process', 'job'], default: 'request' },

  statusCode: Number,
  name: String,
  message: String,
  stack: String,

  method: String,
  route: String,      // /api/listings/:listingId — qruplaşdırma üçün
  url: String,        // son baş verdiyi tam URL

  // Son baş verdiyi sorğunun detalları (həssas sahələr gizlədilir)
  body: Schema.Types.Mixed,
  query: Schema.Types.Mixed,
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  ip: String,
  userAgent: String,

  count: { type: Number }, // default yoxdur: upsert zamanı $inc ilə 1 olur
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },

  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date, default: null },
})

errorLogSchema.index({ resolved: 1, lastSeen: -1 })
// 90 gün təkrarlanmayan xəta avtomatik silinir
errorLogSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const ErrorLog = model('ErrorLog', errorLogSchema)
