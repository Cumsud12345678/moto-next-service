import userService from '../../services/user/user.service.js'

// 1 USERI GETIR
const getUser = async (req, res, next) => {
  try{
    const userId = req.user?.id
    const user = await userService.getUser(userId)
    res.status(200).json({success: true, data: user})
  }catch(err) {
    next(err)
  }
}

const updateUser = async (req, res, next) => {
  try{
    const name = req.body.name
    const paramsId = req.params.userId
    const userId = req.user?.id
    
    if(userId !== paramsId) {
      return res.status(404).json({ success: false, message: 'icazesiz giris' })
    }
    
    const updated = await userService.updateUser(userId, name)

    res.status(200).json({ success: true, data: updated })

  }catch (err) {
    next(err)
  }
}


export {
  getUser,
  updateUser
}