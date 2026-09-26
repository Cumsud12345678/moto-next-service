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

// TODO: öz auth middleware faylının yolunu bura yaz
import { optionalAuth } from "../../middlewares/optionalAuth.middleware.js";
import { auth } from "../../middlewares/auth.middleware.js";

// listing.routes.js
const router = Router();

router.get("/", optionalAuth, getListings);
router.get("/filter", optionalAuth, getFilteredListings);
router.get("/user/me", auth, getUserListings);

router.get('/create/uploads/video/url', auth, createUrlVideo)
router.get('/create/uploads/video/url/:id', auth, authCreateUrlVideo)

router.get('/likes', optionalAuth, getMyLikedListings);
router.get('/:listingId/similar', optionalAuth, getSimilarListings);
router.get("/:listingId", optionalAuth, getListing);   // ← indi bundan sonra gəlir

router.get("/expired/listing/update/:listingId", auth, updateExpiredListing)

router.post("/click/:listingId", clickListing);
router.post("/", auth, upload.array("images"), createListing);
router.put("/:listingId", auth, upload.array("images"), updateListing);
router.delete("/:listingId", auth, deleteListing);
router.post("/:listingId/like", optionalAuth, toggleLike);

export default router