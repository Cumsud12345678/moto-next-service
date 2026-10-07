import express from 'express'
import {
  getMetadata,
  createMakeAndModel,
  updateMake,
  deleteMake,
  createModel,
  updateModel,
  deleteModel,
  createBasicMetadata,
  deleteBasicMetadata
} from '../controllers/metadata.controller.js'

import upload from "../middlewares/upload.middleware.js";
import { admin } from '../middlewares/admin.middleware.js';

const router = express.Router()

// Oxumaq hamıya açıqdır (elan əlavə edərkən lazımdır)
router.get('/', getMetadata)

// Yazma əməliyyatları yalnız admin üçün
router.post('/make-and-model', admin, upload.single('logo'), createMakeAndModel)
router.put('/make/:makeId', admin, upload.single('logo'), updateMake)
router.delete('/make/:makeId', admin, deleteMake)

router.post('/model', admin, createModel)
router.put('/model/:modelId', admin, updateModel)
router.delete('/model/:modelId', admin, deleteModel)

router.post('/', admin, createBasicMetadata)
router.delete('/', admin, deleteBasicMetadata)

export default router