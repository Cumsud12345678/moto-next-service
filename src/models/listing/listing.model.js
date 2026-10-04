import { Schema } from "mongoose";
import mongoose from "mongoose"

const listingSchema = new Schema({
  // Əsas məlumat
  price: Number,
  make: { type: Schema.Types.ObjectId, ref: 'Make' },
  model: { type: Schema.Types.ObjectId, ref: 'Model' },
  year: Number,
  volume: Number,
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  color: { type: Schema.Types.ObjectId, ref: 'Color' },
  fuelType: { type: Schema.Types.ObjectId, ref: 'FuelType' },
  transmission: { type: Schema.Types.ObjectId, ref: 'Transmission' },
  power: Number,
  mileage: Number,
  images: [String],
  equipment: [{ type: Schema.Types.ObjectId, ref: 'Equipment' }],
  region: { type: Schema.Types.ObjectId, ref: 'City' },
  phone: Number,

  // optional
  used: { type: Boolean, default: false },
  barter: { type: Boolean, default: false },
  document: { type: Boolean, default: false },
  credit: { type: Boolean, default: false },
  
  description: String,
  video: String,
  
  // Kim yerləşdirib
  seller: { type: Schema.Types.ObjectId, ref: 'User' },

  // Statistika
  viewCount: Number,
  likedCount: Number,

  // Status idarəetməsi
  status: {
    type: String,
    enum: ['pending', 'active', 'sold', 'expired', 'rejected', 'blocked'],
    default: 'pending'
  },

  // Sıralama
  randomKey: {
    type: Number,
    default: () => Math.random()
  },

  isUrgent: { type: Boolean, default: false },
  urgentActiveAt: { type: Date },
  urgentExpiresAt: { type: Date }
}, {
  timestamps: true
})

listingSchema.query.withCardRelations = function() {
  return this
    .populate('make')
    .populate('model')
    .populate('region')
    .populate('seller', 'role')
}

listingSchema.query.withFullRelations = function() {
  return this
    .populate('make')
    .populate('model')
    .populate('region')
    .populate('category')
    .populate('color')
    .populate('fuelType')
    .populate('transmission')
    .populate('equipment')
    .populate('seller', 'name')
}

listingSchema.query.withAdminFullRelations = function() {
  return this
    .populate('make')
    .populate('model')
    .populate('region')
    .populate('category')
    .populate('color')
    .populate('fuelType')
    .populate('transmission')
    .populate('equipment')
    .populate('seller', '_id name role email')
}

const Listing = mongoose.model('Listing', listingSchema)

export { Listing }