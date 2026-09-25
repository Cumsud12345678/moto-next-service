import { Router } from "express";
import { 
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup
} from '../../controllers/admin/group.controller.js'
import upload from "../../middlewares/upload.middleware.js";
import { admin } from "../../middlewares/admin.middleware.js";

const router = Router();

router.get('/', getGroups)
router.post('/', admin, upload.single('logo'),  createGroup)
router.put('/:groupId', admin, upload.single('logo'), updateGroup)
router.delete('/:groupId', admin, deleteGroup)

export default router