import { Router } from "express";
import { 
  getAllAdsense,
  createAdsense,
  clickAdsense,
  updateAdsense,
  deleteAdsense
} from '../../controllers/admin/adsense.controller.js'
import upload from "../../middlewares/upload.middleware.js";
import { admin } from "../../middlewares/admin.middleware.js";

const router = Router();

router.get('/', getAllAdsense)
router.post('/', admin, upload.single('logo'),  createAdsense)
router.post('/click/:adsenseId', clickAdsense)
router.put('/:adsenseId', admin, upload.single('logo'), updateAdsense)
router.delete('/:adsenseId', admin, deleteAdsense)

export default router