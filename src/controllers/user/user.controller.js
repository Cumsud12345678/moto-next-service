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
    
    if(String(userId) !== String(paramsId)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' })
    }
    
    const result = await userService.updateUser(userId, name)

    res.status(200).json(result)

  }catch (err) {
    next(err)
  }
}


// URL: /api/users/:userId/urgent/listing/:listingId
// ƏVVƏL: istifadəçi URL-dəki :userId-dən götürülürdü — istənilən istifadəçi başqasının hədiyyəsini
// xərcləyib istənilən (hətta başqasının) elanını premium edə bilirdi. İndi yalnız giriş etmiş
// istifadəçinin özü və yalnız öz elanı üçün işləyir (:userId nəzərə alınmır).
const usingTheGift = async (req, res, next) => {
  const userId = req.user?.id
  let charged = false

  try {
    const listingId = req.params.listingId

    const left = await userService.useGift(userId)
    charged = true

    await listingService.freeListingUrgent(userId, listingId)

    res.status(200).json({ success: true, message: 'Elan 1 günlük premium edildi', data: { giftPremiumCount: left } })
  } catch (err) {
    if (charged) await userService.refundGift(userId).catch(() => {})
    next(err)
  }
}


export {
  getUser,
  updateUser,
  usingTheGift
}