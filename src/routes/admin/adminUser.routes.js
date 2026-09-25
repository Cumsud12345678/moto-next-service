import { Router } from "express";
import { admin } from "../../middlewares/admin.middleware.js";
import { 
  getAllUsers,
  getFilteredUsers,
  // getUser,
  deleteUser,
  warningUser,
  resetWarningUser,
  blockedUser,
  unBlockedUser,
  editUserRole,
  getDeletedUsers
} from '../../controllers/admin/adminUser.controller.js'


const router = Router();

router.get('/', getAllUsers)
router.get('/filter', getFilteredUsers)
// router.get('/user', getUser)
router.delete('/:userId', deleteUser)
router.put('/warn/:userId', warningUser)
router.put('/warn/reset/:userId', resetWarningUser)
router.put('/block/:userId', blockedUser)
router.put('/unblock/:userId', unBlockedUser)
router.put('/edit/role/:userId', editUserRole)
router.get('/deleted', getDeletedUsers)

export default router