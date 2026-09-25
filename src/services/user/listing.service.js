import { Listing } from "../../models/listing/listing.model.js";
import { DeletedListing } from "../../models/deleted/deletedListing.model.js";
import { Like } from "../../models/like.model.js";
import mongoose from "mongoose";
import { deleteFromR2, deleteManyFromR2, uploadToR2 } from "../storage.service.js";
import crypto from 'crypto';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2 from "../../config/r2Client.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Adsense } from "../../models/adsense.model.js";

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

  return { ...listing, isLiked };
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

  return listings.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString())
  }))
}


// ELANLARI GETIR  MODEL 2:  VIP ELANLAR SONRA ADI
const getListings = async (page = 1, limit = 10, userId, guestLikedIds) => {
  
  const skip = (page - 1) * limit

  const listings = await Listing.find({ status: 'active' })
    .select('images document barter credit isUrgent price year volume mileage')
    .sort({ isUrgent: -1, randomKey: -1 })
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

  return listings.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString())
  }));
};


// FILTERLENMIS ELANLARI GETIR
const getFilteredListings = async (filters, page=1, limit=10, userId, guestLikedIds) => {
  const skip = (page - 1) * limit
  const query = generateQuery(filters)

  const listings = await Listing.find(query)
    .select('-randomKey -boostRemainingCount -lastBoostedAt -urgentExpiresAt')
    .sort({ randomKey: -1 })
    .skip(skip)
    .limit(limit)
    .withCardRelations()
    .lean()

  const listingIds = listings.map(l => l._id)
  let likedListingIds

  if (userId) {
    const likes = await Like.find({ user: userId, listing: { $in: listingIds } })
    likedListingIds = new Set(likes.map(l => l.listing.toString()))
  } else {
    likedListingIds = new Set(guestLikedIds);
  }

  return listings.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString())
  }))
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
const updateListing = async (listingId, data, newFiles = [], keepImageKeys = []) => {
  // keepImageKeys -> Front-end tərəfdən gələn, silinməyib saxlanılan köhnə şəkil key-ləri
  
  const listing = await Listing.findById(listingId);
  if (!listing) throw new Error('Elan tapılmadı');

  const oldImageKeys = listing.images || []; // Bazadakı bütün köhnə şəkillər
  const newlyUploadedKeys = [];

  try {
    // 1. Yeni yüklənən şəkilləri R2-yə vururuq (Unikal adlarla)
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const key = generateStorageKey(listingId, file.originalname);

      await uploadToR2(file, key);
      newlyUploadedKeys.push(key);
    }

    // 2. Yekun şəkil siyahısını hazırlayırıq (Saxlanılan köhnələr + Yeni yüklənənlər)
    const updatedImages = [...keepImageKeys, ...newlyUploadedKeys];

    // 3. Verilənlər bazasını yeniləyirik
    const updatedListing = await Listing.findByIdAndUpdate(
      listingId,
      {
        ...data,
        images: updatedImages,
      },
      { returnDocument: 'after', runValidators: true }
    );

    // 4. DB uğurla yeniləndi! İndi silinməli olan köhnə şəkilləri tapıb R2-dən silirik
    const keysToDelete = oldImageKeys.filter(key => !keepImageKeys.includes(key));
    if (keysToDelete.length > 0) {
      await deleteManyFromR2(keysToDelete);
    }

    return {
      success: true,
      data: updatedListing,
    };

  } catch (err) {
    // Əgər DB yenilənməsində və ya başqa yerdə XƏTA çıxsa:
    // Yalnız YENİ yüklənən şəkilləri R2-dən silirik ki, köhnələr zərər görməsin!
    if (newlyUploadedKeys.length > 0) {
      try {
        await deleteManyFromR2(newlyUploadedKeys);
        if(listing.video && data.video !== listing.video) await deleteFromR2(listing.video)
      } catch (cleanupErr) {
        console.error('R2 cleanup failed during update:', cleanupErr);
      }
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

  if(userId) {
    const likes = await Like.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'listing',
        select: '-randomKey -boostRemainingCount -lastBoostedAt -urgentExpiresAt',
        populate: [
          {
            path: 'make'
          },
          {
            path: 'model'
          },
          {
            path: 'region'
          }
        ]
      })
      .lean()

    liked = likes.map(like => like.listing).filter(Boolean);
  }else {
    const listings = await Listing.find({_id: { $in: guestLikedIds }})
      .withCardRelations()
      .lean()

    // guestLikedIds-in sırasını qoruyuruq (frontend-in göndərdiyi bəyənmə sırası)
    const listingMap = new Map(listings.map(l => [l._id.toString(), l]));
    liked = guestLikedIds.map(id => listingMap.get(id)).filter(Boolean);
  }

  return liked
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


// listing.service.js
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

  return combined.map(l => ({
    ...l,
    isLiked: likedListingIds.has(l._id.toString())
  }))
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


const clickListing = async (listingId = null) => {
  const listing = await Listing.findById(listingId)
  if (!listing) throw new Error('Elan tapilmadi');

  await Adsense.updateOne(
    { _id: listingId },
    {
      $inc: { viewCount: 1 }
    }
  )

  return {
    success: true
  }
}


export default {
  getListing,
  getUserListings,
  getListings,
  getFilteredListings,
  createListing,
  updateListing,
  deleteListing,

  toggleLikeForUser,
  adjustLikedCount,
  migrateGuestLikes,
  getMyLikedListings,
  getSimilarListings,

  createUrlVideo,
  clickListing
}