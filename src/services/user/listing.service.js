import { Listing } from "../../models/listing/listing.model.js";
import { DeletedListing } from "../../models/listing/deletedListing.model.js";
import { Like } from "../../models/interaction/like.model.js";
import mongoose from "mongoose";
import { deleteFromR2, deleteManyFromR2, uploadToR2 } from "../storage.service.js";
import crypto from 'crypto';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2 from "../../config/r2Client.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Adsense } from "../../models/advertising/adsense.model.js";
import { formatListingDate } from "../../utils/dateFormatter.js";

// 1 ELANI GETIR
const getListing = async (listingId, userId, guestLikedIds = []) => {
  const listing = await Listing.findOne({
    _id: listingId,
    status: 'active'
  })
    .select('-randomKey -boostRemainingCount -lastBoostedAt -urgentExpiresAt')
    .withFullRelations()
    .lean()

  if (!listing) return null;

  let isLiked = false;

  if (userId) {
    const like = await Like.findOne({ user: userId, listing: listingId });
    isLiked = !!like;
  } else {
    isLiked = guestLikedIds.includes(listingId.toString());
  }

  const data = { ...listing, isLiked, createdAt: formatListingDate(listing.createdAt) };

  return {
    success: true,
    data
  }
}

// ISDIFADECININ ELANLARIN GETIR
const getUserListings = async (userId) => {
  const listings = await Listing.find({seller: userId})
    .sort({ createdAt: -1 })
    .withCardRelations()
    .lean()

  const listingIds = listings.map(l => l._id)
  const likes = await Like.find({ user: userId, listing: { $in: listingIds } })
  const likedListingIds = new Set(likes.map(l => l.listing.toString()))

  const data = listings.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString()),
    createdAt: formatListingDate(l.createdAt)
  }))

  return {
    success: true,
    data
  }
}


// ELANLARI GETIR  MODEL 2:  VIP ELANLAR SONRA ADI
const getListings = async (page = 1, limit = 10, userId, guestLikedIds) => {
  
  const skip = (page - 1) * limit

  const listings = await Listing.find({ status: 'active' })
    .select('images document barter credit isUrgent price year volume mileage createdAt')
    .sort({ isUrgent: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .withCardRelations()
    .lean();

  const listingIds = listings.map(l => l._id);
  let likedListingIds;

  if (userId) {
    const likes = await Like.find({ user: userId, listing: { $in: listingIds } });
    likedListingIds = new Set(likes.map(l => l.listing.toString()));
  } else {
    likedListingIds = new Set(guestLikedIds);
  }

  const data = listings.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString()),
    createdAt: formatListingDate(l.createdAt)
  }));

  return {
    success: true,
    data
  }
};


// FILTERLENMIS ELANLARI GETIR
const getFilteredListings = async (filters, page=1, limit=10, userId, guestLikedIds) => {
  const skip = (page - 1) * limit
  const query = generateQuery(filters)

  const [listings, total] = await Promise.all([
    Listing.find(query)
      .select('-randomKey -boostRemainingCount -lastBoostedAt -urgentExpiresAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .withCardRelations()
      .lean(),
    Listing.countDocuments(query)
  ]) 

  const listingIds = listings.map(l => l._id)
  let likedListingIds

  if (userId) {
    const likes = await Like.find({ user: userId, listing: { $in: listingIds } })
    likedListingIds = new Set(likes.map(l => l.listing.toString()))
  } else {
    likedListingIds = new Set(guestLikedIds);
  }

  const data = listings.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString()),
    createdAt: formatListingDate(l.createdAt)
  }))

  return {
    success: true,
    data,
    total
  }
}

// ELAN YARAT
const createListing = async (userId, data, files, listingId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Dəyişən try/catch-dən kənarda təyin olunur ki, catch daxilində çata bilsin
  const uploadedKeys = [];
  let newListingId = listingId

  try {
    
    if(!listingId) newListingId = new mongoose.Types.ObjectId()

    // 1. Şəkilləri R2-yə yükləyirik
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const key = generateStorageKey(newListingId, file.originalname)
      
      await uploadToR2(file, key);
      uploadedKeys.push(key);
    }

    // 2. Bazada elan yaradırıq
    const listing = await Listing.create([{
      _id: newListingId,
      ...data,
      seller: userId,
      status: 'active',
      images: uploadedKeys
    }], { session });

    await session.commitTransaction();

    return {
      success: true,
      message: 'Elan uğurla yaradıldı',
      data: listing[0]
    };
  } catch (err) {
    // DB dəyişiklikləri ləğv edilir
    await session.abortTransaction();

    // Xəta olduqda R2-yə yüklənmiş şəkillər təmizlənir
    if (uploadedKeys.length > 0) {
      try {
        await deleteManyFromR2(uploadedKeys);
      } catch (cleanupError) {
        console.error('R2 cleanup failed:', cleanupError);
      }
    }

    throw err;
  } finally {
    await session.endSession();
  }
};

// ELANI GUNCELLE
const updateListing = async (userId, listingId, data, newFiles = [], keepImageKeys = []) => {
  // Yalnız elanın sahibi dəyişə bilər
  const listing = await Listing.findOne({ _id: listingId, seller: userId });
  if (!listing) throw new Error('Elan tapılmadı');
 
  const oldImageKeys = listing.images || [];
  const oldVideo = listing.video || null;
 
  // Client-dən gələn key-lərdən yalnız bu elana aid olanlar qəbul edilir
  const safeKeepKeys = keepImageKeys.filter((key) => oldImageKeys.includes(key));
 
  // R2-yə toxunmazdan ƏVVƏL şəkil sayını yoxlayırıq
  const totalImages = safeKeepKeys.length + newFiles.length;
  if (totalImages < 1) throw new Error('Ən azı 1 şəkil olmalıdır');
  if (totalImages > 10) throw new Error('Maksimum 10 şəkil ola bilər');
 
  const newlyUploadedKeys = [];
 
  try {
    // 1. Yeni şəkilləri R2-yə yüklə
    for (const file of newFiles) {
      const key = generateStorageKey(listingId, file.originalname);
      await uploadToR2(file, key);
      newlyUploadedKeys.push(key);
    }
 
    // 2. Yekun siyahı
    const updatedImages = [...safeKeepKeys, ...newlyUploadedKeys];
 
    // 3. DB yenilənir
    const updatedListing = await Listing.findByIdAndUpdate(
      listingId,
      { ...data, images: updatedImages },
      { returnDocument: 'after', runValidators: true }
    );
 
    // 4. DB uğurlu oldu -> artıq lazım olmayan köhnə faylları sil
    const keysToDelete = oldImageKeys.filter((key) => !safeKeepKeys.includes(key));
    try {
      if (keysToDelete.length > 0) await deleteManyFromR2(keysToDelete);
      if (oldVideo && data.video && data.video !== oldVideo) await deleteFromR2(oldVideo);
    } catch (cleanupErr) {
      // Elan artıq yenilənib; təmizləmə xətası istifadəçiyə xəta kimi qayıtmamalıdır
      console.error('R2 old files cleanup failed:', cleanupErr);
    }
 
    return { success: true, message: 'Elan güncəlləndi', data: updatedListing };
  } catch (err) {
    // XƏTA: yalnız bu sorğuda yaradılan faylları sil, köhnələrə toxunma
    try {
      if (newlyUploadedKeys.length > 0) await deleteManyFromR2(newlyUploadedKeys);
      // Yeni yüklənmiş video (köhnə yox!) yetim qalmasın
      if (data.video && data.video !== oldVideo) await deleteFromR2(data.video);
    } catch (cleanupErr) {
      console.error('R2 cleanup failed during update:', cleanupErr);
    }
    throw err;
  }
};

// ELANI SIL
const deleteListing = async (userId, listingId) => {
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
      deletedBy: userId,
      deletedByRole: 'user',
      deleteReason: '',
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

const updateExpiredListing = async (listingId, userId) => {
  const listing = await Listing.findOne({ _id: listingId, status: 'expired', seller: userId })
  if (!listing) throw new Error('Elan tapilmadi');
 
  await Listing.updateOne({ _id: listingId }, {
    status: "active"
  })

  return {
    success: true,
    message: 'Elan aktiv edildi'
  }
}

// USER UCUN LIKE/UNLIKE
const toggleLikeForUser = async (userId, listingId) => {
  const existing = await Like.findOne({ user: userId, listing: listingId });

  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    await Listing.findByIdAndUpdate(listingId, { $inc: { likedCount: -1 } });
    return { liked: false };
  }

  await Like.create({ user: userId, listing: listingId });
  await Listing.findByIdAndUpdate(listingId, { $inc: { likedCount: 1 } });
  return { liked: true };
};

// LIKED COUNT-U DEYISDIR (qonaq ucun)
const adjustLikedCount = async (listingId, delta) => {
  await Listing.findByIdAndUpdate(listingId, { $inc: { likedCount: delta } });
};

// BEYENILMIS ELANLARI CEK
const getMyLikedListings = async (userId, guestLikedIds) => {
  let liked

  if (userId) {
    const likes = await Like.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'listing',
        match: { status: 'active' },
        select: '-randomKey -boostRemainingCount -lastBoostedAt -urgentExpiresAt',
        populate: [
          { path: 'make' },
          { path: 'model' },
          { path: 'region' }
        ]
      })
      .lean()

    liked = likes
      .map(like => like.listing)
      .filter(Boolean)

  } else {
    const listings = await Listing.find({
      _id: { $in: guestLikedIds },
      status: 'active'
    })
      .withCardRelations()
      .lean()

    const listingMap = new Map(
      listings.map(l => [l._id.toString(), l])
    )

    liked = guestLikedIds
      .map(id => listingMap.get(id))
      .filter(Boolean)
  }

  // createdAt formatla
  liked = liked.map(listing => ({
    ...listing,
    createdAt: formatListingDate(listing.createdAt)
  }))

  return {
    success: true,
    data: liked
  }
}

// SIMILAR LISTINGS
const getSimilarListings = async (currentListingId, userId, guestLikedIds, filters, limit = 12) => {
  const { make, model, price } = filters

  const excludeCurrentQuery = { _id: { $ne: currentListingId }, status: 'active' }

  // 1. Eyni marka + model
  const listings1 = await Listing.find({
    ...excludeCurrentQuery,
    make,
    model,
  })
    .limit(limit)
    .withCardRelations()
    .lean()

  let combined = listings1

  if (combined.length < limit) {
    const foundIds = listings1.map(l => l._id)

    // 2. Eyni marka (fərqli model)
    const listings2 = await Listing.find({
      ...excludeCurrentQuery,
      make,
      _id: { $nin: [...foundIds, currentListingId] },
    })
      .limit(limit - combined.length)
      .withCardRelations()
      .lean()

    combined = [...combined, ...listings2]
  }

  if (combined.length < limit) {
    const combinedIds = combined.map(l => l._id)

    // 3. Oxşar qiymət aralığı
    const listings3 = await Listing.find({
      ...excludeCurrentQuery,
      price: { $gte: price * 0.7, $lte: price * 1.3 },
      _id: { $nin: [...combinedIds, currentListingId] },
    })
      .limit(limit - combined.length)
      .withCardRelations()
      .lean()

    combined = [...combined, ...listings3]
  }

  // ============ isLiked ƏLAVƏ ET ============
  const listingIds = combined.map(l => l._id)
  let likedListingIds

  if (userId) {
    const likes = await Like.find({ user: userId, listing: { $in: listingIds } })
    likedListingIds = new Set(likes.map(l => l.listing.toString()))
  } else {
    likedListingIds = new Set(guestLikedIds)
  }

  const data = combined.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString()),
    createdAt: formatListingDate(l.createdAt)
  }))

  return {
    success: true,
    data
  }
}

const createUrlVideo = async (id) => {
  let listingId
  if(id) {
    listingId = id
  }else {
    listingId = new mongoose.Types.ObjectId();
  }
  const extension = 'mp4'
  const uniqueId = crypto.randomUUID(); // və ya Date.now()

  const key = `listings/${listingId}/video/${uniqueId}.${extension}`

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: 'video/mp4'
  })

  const uploadUrl = await getSignedUrl(r2, command, {
    expiresIn: 600,
  })

  return {
    uploadUrl: uploadUrl,
    key: key,
    listingId: listingId
  }
}

const clickListing = async (listingId) => {
  const listing = await Listing.findById(listingId)
  if (!listing) throw new Error('Elan tapilmadi');

  await Listing.updateOne(
    { _id: listingId },
    {
      $inc: { viewCount: 1 }
    }
  )

  return {
    success: true
  }
}

const freeListingUrgent = async (listingId) => {
  const listing = await Listing.findById(listingId)
  if (!listing) throw new Error('Elan tapilmadi');

  const now = new Date()
  
  await Listing.updateOne({ _id: listingId }, {
    isUrgent: true,
    urgentActiveAt: now,
    urgentExpiresAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
  })

  return {
    success: true
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

const generateStorageKey = (listingId, originalname) => {
  const extension = originalname.split('.').pop()?.toLowerCase() || 'webp';
  const uniqueId = crypto.randomUUID(); // və ya Date.now()
  return `listings/${listingId}/${uniqueId}.${extension}`
}

const migrateGuestLikes = async (userId, listingIds) => {
  const ops = listingIds.map((listingId) => ({
    updateOne: {
      filter: { user: userId, listing: listingId },
      update: { $setOnInsert: { user: userId, listing: listingId } },
      upsert: true,
    },
  }));
  await Like.bulkWrite(ops);
};

export default {
  getListing,
  getUserListings,
  getListings,
  getFilteredListings,
  createListing,
  updateListing,
  deleteListing,
  updateExpiredListing,

  toggleLikeForUser,
  adjustLikedCount,
  migrateGuestLikes,
  getMyLikedListings,
  getSimilarListings,

  createUrlVideo,
  clickListing,

  freeListingUrgent
}