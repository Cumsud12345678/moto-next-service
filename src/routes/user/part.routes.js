import { Router } from "express";
import upload from "../../middlewares/upload.middleware.js";
import validateFiles from "../../middlewares/validateFiles.middleware.js";
import { optionalAuth } from "../../middlewares/optionalAuth.middleware.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import { createPartSchema, updatePartSchema } from "../../validations/part.validation.js";
import {
  getParts, getPart, getMyParts, getMyPart, getSimilarParts, getSellerParts,
  createPart, updatePart, deletePart, toggleLike, getLikedParts, clickPart,
} from "../../controllers/user/part.controller.js";

// İstifadəçi başına saatda 20 hissə elanı
const createLimit = rateLimit({ name: 'part-create', max: 20, windowSec: 3600, key: (req) => String(req.user?.id), message: 'Bir saatda çox elan yerləşdirdiniz. Bir az sonra yenidən cəhd edin' })
const likeLimit = rateLimit({ name: 'part-like', max: 60, windowSec: 60 })

const router = Router();

// Sabit yollar "/:partId"-dən əvvəl gəlməlidir
router.get("/", optionalAuth, getParts);
router.get("/my", auth, getMyParts);
router.get("/my/:partId", auth, getMyPart);
router.get("/likes", optionalAuth, getLikedParts);

router.get("/:partId", optionalAuth, getPart);
router.get("/:partId/similar", optionalAuth, getSimilarParts);
router.get("/:partId/seller", optionalAuth, getSellerParts);

router.post("/", auth, createLimit, upload.array("images", 10), validateFiles, validate(createPartSchema), createPart);
router.put("/:partId", auth, upload.array("images", 10), validate(updatePartSchema), updatePart);
router.delete("/:partId", auth, deletePart);
router.post("/:partId/like", likeLimit, optionalAuth, toggleLike);
router.post("/:partId/click", optionalAuth, clickPart);

export default router
