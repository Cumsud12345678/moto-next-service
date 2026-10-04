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

    const result = await listingService.getListing(listingId, userId, guestLikedIds);

    return res.status(200).json(result);
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

    const result = await listingService.getUserListings(userId);

    return res.status(200).json(result);
  } catch (err) {
    next(err)
  }
};

const getListings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const userId = req.user?.id;
    const guestLikedIds = parseGuestLikedIds(req.cookies?.guestLikedIds); // ✅

    const result = await listingService.getListings(page, limit, userId, guestLikedIds);
    return res.status(200).json(result)
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
    const result = await listingService.getFilteredListings(filters, page, limit, userId, guestLikedIds);
    return res.status(200).json(result);
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
    const listingId = req.body.listingId || null

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    // Bütün biznes məntiqi servisə ötürülür
    const result = await listingService.createListing(userId, data, files, listingId);

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const updateListing = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { listingId } = req.params;
    const { keepImageKeys, ...data } = req.body;
    const newFiles = req.files || [];
 
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }
 
    const result = await listingService.updateListing(
      userId,            // <-- yeni: sahiblik yoxlanışı üçün
      listingId,
      data,
      newFiles,
      keepImageKeys
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

const updateExpiredListing = async (req, res, next) => {
  try {
    const listingId = req.params.listingId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    const result = await listingService.updateExpiredListing(listingId, userId);

    return res.status(200).json(result);
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

    const result1 = await listingService.getListing(listingId, userId, guestLikedIds)

    if (!result1.data) {
      return res.status(404).json({ success: false, message: 'Elan tapılmadı' });
    }

    const result2 = await listingService.getSimilarListings(
      listingId,
      userId,
      guestLikedIds,
      {
        make: result1.data.make._id,
        model: result1.data.model._id,
        price: result1.data.price
      }
    )

    res.status(200).json(result2)
  } catch (err) {
    next(err)
  }
}


const createUrlVideo = async (req, res, next) => {
  try{
    const url = await listingService.createUrlVideo()
    res.status(200).json(url)
  }catch(err) {
    next(err)
  }
}

const authCreateUrlVideo = async (req, res, next) => {
  try{
    const id = req.params.id
    const url = await listingService.createUrlVideo(id)
    res.status(200).json(url)
  }catch(err) {
    next(err)
  }
}

const clickListing = async (req, res, next) => {
  try{
    const listingId = req.params.listingId;

    const result = await listingService.clickListing(listingId)

    res.status(200).json(result)
  }catch(err) {
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
  updateExpiredListing,

  toggleLike,
  getMyLikedListings,
  getSimilarListings,

  createUrlVideo,
  authCreateUrlVideo,
  
  clickListing
};