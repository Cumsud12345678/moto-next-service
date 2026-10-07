import adminUserService from "../../services/admin/adminUser.service.js";

// page >= 1, limit 1..100 (çox böyük limit göndərib serveri yormasın)
const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100)
  return { page, limit }
}

const getAllUsers = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)

    const { users, total } = await adminUserService.getAllUsers(page, limit)
    res.status(200).json({
      success: true,
      data: users,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    })
  }catch(err) {
    next(err)
  }
}

const getFilteredUsers = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)
    const filters = req.query

    const { users, total } = await adminUserService.getFilteredUsers(filters, page, limit)
    res.status(200).json({
      success: true,
      data: users,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    })
  }catch(err) {
    next(err)
  }
}

const deleteUser = async (req, res, next) => {
  try{
    const userId = req.params.userId
    const adminId = req.user?.id
    const reason = req.body.reason

    await adminUserService.deleteUser(userId, adminId, reason)
    res.status(200).json({ success: true, message: 'User silindi' })
  }catch(err) {
    next(err)
  }
}

const warningUser = async (req, res, next) => {
  try{
    const userId = req.params.userId
    const message = req.body.reasons

    const result = await adminUserService.warningUser(userId, message)
    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const resetWarningUser = async (req, res, next) => {
  try{
    const userId = req.params.userId

    const result = await adminUserService.resetWarningUser(userId)
    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const blockedUser = async (req, res, next) => {
  try{
    const userId = req.params.userId
    const message = req.body.message

    const result = await adminUserService.blokedUser(userId, message)
    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const unBlockedUser = async (req, res, next) => {
  try{
    const userId = req.params.userId

    const result = await adminUserService.unBlokedUser(userId)
    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const editUserRole = async (req, res, next) => {
  try{
    const userId = req.params.userId
    const role = req.body.role

    const result = await adminUserService.editUserRole(userId, role)
    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}


// DELETED USERS LE BAQLI
// (əvvəl req, res, next parametrləri yox idi və try/catch yox idi;
//  page/limit də req.params-dan oxunurdu, düzgünü req.query-dir)
const getDeletedUsers = async (req, res, next) => {
  try{
    const { page, limit } = parsePagination(req.query)

    const { deletedUsers, total } = await adminUserService.getDeletedUsers(page, limit)

    res.status(200).json({
      success: true,
      data: deletedUsers,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    })
  }catch(err) {
    next(err)
  }
}


export {
  getAllUsers,
  getFilteredUsers,
  deleteUser,
  warningUser,
  resetWarningUser,
  blockedUser,
  unBlockedUser,
  editUserRole,
  getDeletedUsers
}