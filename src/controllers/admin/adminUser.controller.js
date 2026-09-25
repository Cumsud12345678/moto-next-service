import adminUserService from "../../services/admin/adminUser.service.js";

const getAllUsers = async (req, res, next) => {
  try{
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const { users, total } = await adminUserService.getAllUsers(page, limit)
    res.status(200).json({ success: true, data: users, total })
  }catch(err) {
    next(err)
  }
}

const getFilteredUsers = async (req, res, next) => {
  try{
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = req.query

    console.log(filters)

    const { users, total } = await adminUserService.getFilteredUsers(filters, page, limit)
    res.status(200).json({ success: true, data: users, total })
  }catch(err) {
    next(err)
  }
}

// const getUser = async (req, res, next) => {
//   try{
//     const userId = req.body.id || null;
//     const email = req.body.email;

//     const user = await adminUserService.getUser(userId, email)
//     res.status(200).json({ success: true, data: user })
//   }catch(err) {
//     next(err)
//   }
// }

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

    console.log(message)

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
const getDeletedUsers = async () => {
  const page = parseInt(req.params.page) || 1;
  const limit = parseInt(req.params.limit) || 10;

  const { deletedUsers, total } = await adminUserService.getDeletedUsers(page, limit);

  res.status(200).json({ success: true, data: deletedUsers, total })
}


export {
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
}
