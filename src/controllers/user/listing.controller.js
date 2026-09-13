import listingService from '../../services/user/listing.service.js'

// listing.controller.js — faylın yuxarısına əlavə et
const parseGuestLikedIds = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// 1 ELANI GETIR
const getListing = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const userId = req.user?.id;
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds); // tək deyil, massiv

    const listing = await listingService.getListing(listingId, userId, guestLikedIds);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Elan tapılmadı' });
    }

    return res.status(200).json({ success: true, data: listing });
  } catch (err) {
    next(err)
  }
};

// ISTIFADƏÇININ ELANLARIN GETIR
const getUserListings = async (req, res, next) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(400).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }

    const listings = await listingService.getUserListings(userId);

    return res.status(200).json({ success: true, data: listings });
  } catch (err) {
    next(err)
  }
};

const getListings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user?.id;
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds); // ✅

    const listings = await listingService.getListings(page, limit, userId, guestLikedIds);
    return res.status(200).json({ success: true, data: listings });
  } catch (err) {
    next(err)
  }
};

const getFilteredListings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user?.id;
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds); // ✅
    const { page: _p, limit: _l, ...filters } = req.query;
    const listings = await listingService.getFilteredListings(filters, page, limit, userId, guestLikedIds);
    return res.status(200).json({ success: true, data: listings });
  } catch (err) {
    next(err)
  }
};

// ELAN YARAT
const createListing = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const data = req.body;
    const files = req.files || [];

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    // Bütün biznes məntiqi servisə ötürülür
    const result = await listingService.createListing(userId, data, files);

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// ELANI GUNCELLE
const updateListing = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { listingId } = req.params;
    
    // Express req.body daxilində keepImageKeys gəlir
    const { keepImageKeys, ...data } = req.body;
    const newFiles = req.files || [];

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    // 1. keepImageKeys məlumatını Massiv (Array) halına gətiririk
    let formattedKeepImageKeys = [];

    if (keepImageKeys) {
      if (Array.isArray(keepImageKeys)) {
        // Əgər multipart/form-data ilə birdən çox keepImageKeys gəlibsə: ['key1', 'key2']
        formattedKeepImageKeys = keepImageKeys;
      } else if (typeof keepImageKeys === 'string') {
        try {
          // Əgər JSON string olaraq göndərilibsə: '["key1", "key2"]'
          formattedKeepImageKeys = JSON.parse(keepImageKeys);
        } catch {
          // Əgər tək bir string kimi gəlibsə: 'key1'
          formattedKeepImageKeys = [keepImageKeys];
        }
      }
    }

    // 2. Servisi çağırırıq
    const result = await listingService.updateListing(
      listingId,
      data,
      newFiles,
      formattedKeepImageKeys
    );

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ELANI SIL
const deleteListing = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    const result = await listingService.deleteListing(userId, listingId);

    return res.status(200).json(result);
  } catch (err) {
    next(err)
  }
};


// ELANI URGENT ET
const activeUrgent = async (req, res, next) => {
  try {
    const { listingId } = req.params;

    const listing = await listingService.activeUrgent(listingId);

    return res.status(200).json({ success: true, data: listing });
  } catch (err) {
    next(err)
  }
};



const toggleLike = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const userId = req.user?.id;

    if (userId) {
      const result = await listingService.toggleLikeForUser(userId, listingId);
      return res.status(200).json({ success: true, data: result });
    }

    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds); // ✅ (əvvəlki try/catch-i əvəz edir)

    const alreadyLiked = guestLikedIds.includes(listingId);
    let updatedIds, liked;

    if (alreadyLiked) {
      updatedIds = guestLikedIds.filter((id) => id !== listingId);
      liked = false;
    } else {
      updatedIds = [...guestLikedIds, listingId];
      liked = true;
    }

    await listingService.adjustLikedCount(listingId, liked ? 1 : -1);

    res.cookie('guestLikedIds', JSON.stringify(updatedIds), {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(200).json({ success: true, data: { liked } });
  } catch (err) {
    next(err);
  }
};


const getMyLikedListings = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds); // ✅

    const data = await listingService.getMyLikedListings(userId, guestLikedIds)
    res.status(200).json({ success: true, data: data })
  } catch (err) {
    next(err)
  }
}

// listing.controller.js
const getSimilarListings = async (req, res, next) => {
  try {
    const { listingId } = req.params
    const userId = req.user?.id
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds)

    const listing = await listingService.getListing(listingId, userId, guestLikedIds)

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Elan tapılmadı' });
    }

    const similar = await listingService.getSimilarListings(
      listingId,
      userId,
      guestLikedIds,
      {
        make: listing.make._id,
        model: listing.model._id,
        price: listing.price
      }
    )

    res.status(200).json({ success: true, data: similar })
  } catch (err) {
    next(err)
  }
}


export {
  getListing,
  getUserListings,
  getListings,
  getFilteredListings,
  createListing,
  updateListing,
  deleteListing,
  activeUrgent,
  toggleLike,
  getMyLikedListings,
  getSimilarListings
};