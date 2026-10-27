import { Router } from "express";
import { getParts, setStatus, deletePart } from '../../controllers/admin/adminPart.controller.js'

const router = Router();

router.get('/', getParts)
router.put('/status/:partId', setStatus)
router.delete('/:partId', deletePart)

export default router
