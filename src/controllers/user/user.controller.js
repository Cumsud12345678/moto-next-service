import listingService from '../../services/user/listing.service.js'
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
    
    const result = await userService.updateUser(userId, name)

    res.status(200).json(result)

  }catch (err) {
    next(err)
  }
}


const usingTheGift = async (req, res, next) => {
  try{
    const userId = req.params.userId;
    const listingId = req.params.listingId;

    const result1 = await userService.usingTheGift(userId)
    // if(!result1.success) return res.status(500).json({ success: false, message: 'Bir xeta oldu' });
    const result2 = await listingService.freeListingUrgent(listingId)
    // if(!result2.success) return res.status(500).json({ success: false, message: 'Bir xeta oldu' });

    res.status(200).json({ success: true, message: 'Elan premium edildi' })
  }catch(err) {
    next(err)
  }
}


export {
  getUser,
  updateUser,
  usingTheGift
}