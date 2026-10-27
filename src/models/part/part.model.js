import mongoose, { Schema } from "mongoose";

// Ehtiyat hissəsi elanı. Motosiklet elanlarından (Listing) tam ayrı kolleksiyadır —
// mövcud elanlara və onların sorğularına heç bir təsiri yoxdur.
export const PART_STATUSES = ['pending', 'active', 'sold', 'expired', 'rejected', 'blocked']
export const PART_CONDITIONS = ['new', 'used']

const partSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  partCategory: { type: Schema.Types.ObjectId, ref: 'PartCategory', required: true },
  condition: { type: String, enum: PART_CONDITIONS, default: 'used' },

  // Hansı motosikletə uyğundur (könüllü)
  make: { type: Schema.Types.ObjectId, ref: 'Make' },
  model: { type: Schema.Types.ObjectId, ref: 'Model' },

  price: { type: Number, required: true },
  images: [String],
  region: { type: Schema.Types.ObjectId, ref: 'City' },
  phone: Number,
  description: String,
  delivery: { type: Boolean, default: false },

  seller: { type: Schema.Types.ObjectId, ref: 'User', index: true },

  viewCount: { type: Number, default: 0 },
  likedCount: { type: Number, default: 0 },

  status: { type: String, enum: PART_STATUSES, default: 'active' },
  activeSince: { type: Date, default: () => new Date() },
}, {
  timestamps: true
})

partSchema.query.withCardRelations = function () {
  return this
    .populate('partCategory')
    .populate('make')
    .populate('model')
    .populate('region')
    .populate('seller', 'role')
}

partSchema.query.withFullRelations = function () {
  return this
    .populate('partCategory')
    .populate('make')
    .populate('model')
    .populate('region')
    .populate('seller', 'name role')
}

partSchema.query.withAdminRelations = function () {
  return this
    .populate('partCategory')
    .populate('make')
    .populate('model')
    .populate('region')
    .populate('seller', '_id name role email')
}

partSchema.index({ status: 1, createdAt: -1 })
partSchema.index({ status: 1, partCategory: 1, createdAt: -1 })
partSchema.index({ status: 1, make: 1, model: 1 })
partSchema.index({ status: 1, price: 1 })
partSchema.index({ seller: 1, createdAt: -1 })

export const Part = mongoose.model('Part', partSchema)
