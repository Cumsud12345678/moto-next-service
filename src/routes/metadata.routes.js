import express from 'express'
import { 
  getMetadata,
  createMakeAndModel,
  deleteMake,
  createModel,
  createBasicMetadata,
  deleteBasicMetadata
} from '../controllers/metadata.controller.js'

import upload from "../middlewares/upload.middleware.js";

const router = express.Router()

router.get('/', getMetadata)
router.post('/make&model', upload.single('logo'), createMakeAndModel)
router.delete('/make/:makeId', deleteMake)
router.post('/model', createModel)
router.post('/', createBasicMetadata)
router.delete('/', deleteBasicMetadata)

export default router