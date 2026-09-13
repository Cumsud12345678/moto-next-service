import express from 'express'
import { getMetadata } from '../../controllers/metadata/metadata.controller.js'

const router = express.Router()

router.get('/', getMetadata)

export default router