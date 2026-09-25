import mongoose from "mongoose"
import { DeletedListing } from "../../models/deleted/deletedListing.model.js"
import { DeletedUser } from "../../models/deleted/deletedUser.model.js"
import { Listing } from "../../models/listing/listing.model.js"
import { Message } from "../../models/message.model.js"
import { User } from "../../models/user.model.js"
import { Like } from "../../models/like.model.js"

// BUTUN ELANLARI GETIR
const getAllListings = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit

  const [listings, total] = await Promise.all([
    Listing.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .withAdminFullRelations()
      .lean(),
    Listing.countDocuments()
  ])

  return {
    listings,
    total
  }
}

// FILTERLENMIS ELANLARI GETIR
const getFilteredListings = async (filters, page=1, limit=10) => {
  const skip = (page - 1) * limit
  // const query = generateQuery(filters)

  const query = {}

  if(filters.listingId) query._id = filters.listingId;
  if(filters.phone) query.phone = filters.phone;

  const [listings, total] = await Promise.all([
    Listing.find(query)
      .sort({ randomKey: -1 })
      .skip(skip)
      .limit(limit)
      .withAdminFullRelations()
      .lean(),
    Listing.countDocuments(query)
  ])

  return {
    listings,
    total
  }

}

// USERIN ELANLARIN GETIR
const getUserListings = async (userId) => {
  const listings = await Listing.find({seller: userId})
    .sort({ createdAt: -1 })
    .withAdminFullRelations()
    .lean()

  return listings
}

// PREMIUM ELANLARI GETIR
const getUrgentListings = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit

  const [urgentListings, total] = await Promise.all([
    Listing.find({isUrgent: true})
      .sort({ urgentActiveAt: -1 })
      .skip(skip)
      .limit(limit)
      .withAdminFullRelations()
      .lean(),
    Listing.countDocuments({ isUrgent: true })
  ])

  return {
    urgentListings,
    total
  }
}

// 1 ELANI GETIR
const getListing = async (listingId) => {
  const listing = await Listing.findOne({
    _id: listingId,
    status: 'active'
  })
    .withAdminFullRelations()
    .lean()

  return listing
}

// ELANI SIL
const deleteListing = async (adminId, listingId, message) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  let imageKeys = []
  let videoKey

  try{
    const listing = await Listing.findById(listingId).session(session)
    if (!listing) throw new Error('Elan tapilmadi');

    imageKeys = listing.images || []
    videoKey = listing.video || null

    await Like.deleteMany({listing: listing._id}, { session })

    await DeletedListing.create([{
      originalListingId: listing._id,
      snapshot: listing.toObject(),
      deletedBy: adminId,
      deletedByRole: 'admin',
      deleteReason: message,
      viewCount: listing.viewCount,
      likedCount: listing.likedCount
    }], { session })

    await Listing.findByIdAndDelete(listingId, { session })

    await session.commitTransaction()

  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }

  try{
    await deleteManyFromR2(imageKeys)
    if(videoKey) await deleteFromR2(videoKey);
  }catch (err) {
    console.error('R2 şəkilləri silinə bilmədi:', err)
  }

  return {
    success: true,
    message: 'Elan uğurla silindi'
  }
}

// ELANI URGENT ET
const setUrgentListing = async (listingId, day) => {
  const listing = await Listing.findById(listingId)
  if (!listing) throw new Error('Elan tapilmadi');

  const now = new Date()

  await Listing.updateOne({ _id: listingId }, {
    isUrgent: true,
    urgentActiveAt: now,
    urgentExpiresAt: new Date(now.getTime() + day * 24 * 60 * 60 * 1000)
  })

  return {
    success: true,
    message: 'User guncellendi'
  }
}


// ELANIN STATUSUNU DEYIS
const setStatusListing = async (listingId, status) => {
  const listing = await Listing.findById(listingId)
  if (!listing) throw new Error('Elan tapilmadi');

  await Listing.updateOne({ _id: listingId }, {
    status: status
  })

  return {
    success: true,
    message: 'User guncellendi'
  }
}


// YARDIMCI FUNKSIYA
const generateQuery = (filters) => {
  const query = {}

  query.status = 'active'
  if(filters.make) query.make = filters.make;
  if(filters.model) query.model = filters.model;
  if(filters.category) query.category = filters.category;
  if(filters.used !== undefined) query.used = filters.used;
  if(filters.color) query.color = filters.color;
  if(filters.fuelType) query.fuelType = filters.fuelType;
  if(filters.transmission) query.transmission = filters.transmission;
  if(filters.region) query.region = filters.region;
  if(filters.barter !== undefined) query.barter = filters.barter;
  if(filters.document !== undefined) query.document = filters.document;
  if(filters.seller) query.seller = filters.seller;
  if(filters.status) query.status = filters.status;
  if(filters.isBoosted !== undefined) query.isBoosted = filters.isBoosted;
  if(filters.isUrgent !== undefined) query.isUrgent = filters.isUrgent;
  
  if(filters.equipment) {
    const equipmentArr = Array.isArray(filters.equipment) ? filters.equipment : [filters.equipment];
    query.equipment = { $all: equipmentArr };
  }
  if(filters.minPrice || filters.maxPrice) {
    query.price = {}
    if(filters.minPrice) query.price.$gte = filters.minPrice;
    if(filters.maxPrice) query.price.$lte = filters.maxPrice;
  }else if(filters.price){
    query.price = filters.price;
  }
  if(filters.minYear || filters.maxYear) {
    query.year = {}
    if(filters.minYear) query.year.$gte = filters.minYear;
    if(filters.maxYear) query.year.$lte = filters.maxYear;
  }else if(filters.year) {
    query.year = filters.year;
  }
  if(filters.minVolume || filters.maxVolume) {
    query.volume = {}
    if(filters.minVolume) query.volume.$gte = filters.minVolume;
    if(filters.maxVolume) query.volume.$lte = filters.maxVolume;
  }else if(filters.volume) {
    query.volume = filters.volume;
  }
  if(filters.minPower || filters.maxPower) {
    query.power = {}
    if(filters.minPower) query.power.$gte = filters.minPower;
    if(filters.maxPower) query.power.$lte = filters.maxPower;
  }else if(filters.power) {
    query.power = filters.power;
  }
  if(filters.minMileage || filters.maxMileage) {
    query.mileage = {}
    if(filters.minPileage) query.mileage.$gte = filters.minMileage;
    if(filters.maxPileage) query.mileage.$lte = filters.maxMileage;
  }else if(filters.mileage) {
    query.mileage = filters.mileage;
  }

  return query;
}


// SILINMIS ELANLARLA BAQLI 

// SILINMIS ELANLARI GETIR
const getDeletedListings = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit
  const [deletedListings, total] = await Promise.all([
    DeletedListing.find()
      .populate('deletedBy')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeletedListing.countDocuments()
  ])

  return {
    deletedListings,
    total
  }
}

// FILTERLENMIS SILINMIS ELANLARI GETIR
const getFilteredDeletedListing = async () => {

}


export default {
  getAllListings,
  getFilteredListings,
  getUserListings,
  getUrgentListings,
  getListing,
  deleteListing,
  setUrgentListing,
  setStatusListing,
  getDeletedListings
}