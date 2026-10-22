import adminUserService from "../../services/admin/adminUser.service.js";
import { paginationMeta, parsePagination } from "../../utils/http.js";

// GET /api/admin/users?q=&role=&status=&page=&limit=
// (/filter də eyni funksiyaya yönəlir — köhnə linklər işləsin)
const getUsers = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const { users, total } = await adminUserService.getUsers(req.query, page, limit)
    res.status(200).json({ success: true, data: users, ...paginationMeta(total, page, limit) })
  } catch (err) {
    next(err)
  }
}

const deleteUser = async (req, res, next) => {
  try {
    const result = await adminUserService.deleteUser(req.params.userId, req.user?.id, req.body?.reason)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const warningUser = async (req, res, next) => {
  try {
    // "reasons" köhnə frontend üçün saxlanılıb
    const message = req.body?.message ?? req.body?.reasons
    res.status(200).json(await adminUserService.warningUser(req.params.userId, message))
  } catch (err) {
    next(err)
  }
}

const resetWarningUser = async (req, res, next) => {
  try {
    res.status(200).json(await adminUserService.resetWarningUser(req.params.userId))
  } catch (err) {
    next(err)
  }
}

const blockedUser = async (req, res, next) => {
  try {
    res.status(200).json(await adminUserService.blokedUser(req.params.userId, req.body?.message, req.user?.id))
  } catch (err) {
    next(err)
  }
}

const unBlockedUser = async (req, res, next) => {
  try {
    res.status(200).json(await adminUserService.unBlokedUser(req.params.userId))
  } catch (err) {
    next(err)
  }
}

const editUserRole = async (req, res, next) => {
  try {
    res.status(200).json(await adminUserService.editUserRole(req.params.userId, req.body?.role, req.user?.id))
  } catch (err) {
    next(err)
  }
}

const getDeletedUsers = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const { deletedUsers, total } = await adminUserService.getDeletedUsers(page, limit)
    res.status(200).json({ success: true, data: deletedUsers, ...paginationMeta(total, page, limit) })
  } catch (err) {
    next(err)
  }
}

export {
  getUsers,
  getUsers as getAllUsers,
  getUsers as getFilteredUsers,
  deleteUser,
  warningUser,
  resetWarningUser,
  blockedUser,
  unBlockedUser,
  editUserRole,
  getDeletedUsers,
}
