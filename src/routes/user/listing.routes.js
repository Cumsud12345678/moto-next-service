import { Router } from "express";
import upload from "../../middlewares/upload.middleware.js";

import {
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
  clickListing,
} from "../../controllers/user/listing.controller.js";
import { createReport } from "../../controllers/user/report.controller.js";

// TODO: öz auth middleware faylının yolunu bura yaz
import { optionalAuth } from "../../middlewares/optionalAuth.middleware.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createListingSchema } from "../../validations/createListing.validation.js";
import { updateListingSchema } from "../../validations/updateListing.validation.js";
import validateFiles from "../../middlewares/validateFiles.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";

// İstifadəçi başına: saatda 20 elan, 30 video linki
const createLimit = rateLimit({ name: 'listing-create', max: 20, windowSec: 3600, key: (req) => String(req.user?.id), message: 'Bir saatda çox elan yerləşdirdiniz. Bir az sonra yenidən cəhd edin' })
const videoLimit = rateLimit({ name: 'video-url', max: 30, windowSec: 3600, key: (req) => String(req.user?.id) })
const likeLimit = rateLimit({ name: 'like', max: 60, windowSec: 60 })
// Bir IP-dən saatda 10 şikayət
const reportLimit = rateLimit({ name: 'report', max: 10, windowSec: 3600, message: 'Çox sayda şikayət göndərdiniz. Bir az sonra yenidən cəhd edin' })

// listing.routes.js
const router = Router();

router.get("/", optionalAuth, getListings);
router.get("/filter", optionalAuth, getFilteredListings);
router.get("/user/me", auth, getUserListings);

router.get('/create/uploads/video/url', auth, videoLimit, createUrlVideo)
router.get('/create/uploads/video/url/:id', auth, videoLimit, authCreateUrlVideo)

router.get('/likes', optionalAuth, getMyLikedListings);
router.get('/:listingId/similar', optionalAuth, getSimilarListings);
router.get("/:listingId", optionalAuth, getListing);   // ← indi bundan sonra gəlir

router.get("/expired/listing/update/:listingId", auth, updateExpiredListing)

router.post("/click/:listingId", clickListing);
router.post("/", auth, createLimit, upload.array("images", 10), validateFiles, validate(createListingSchema), createListing);
router.put("/:listingId", auth, upload.array("images", 10), validate(updateListingSchema), updateListing);
router.delete("/:listingId", auth, deleteListing);
router.post("/:listingId/like", likeLimit, optionalAuth, toggleLike);
router.post("/:listingId/report", reportLimit, optionalAuth, createReport);

export default router