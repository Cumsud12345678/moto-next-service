import { Adsense } from "../../models/advertising/adsense.model.js"
import { uploadToR2, deleteFromR2 } from "../storage.service.js"

const getAllAdsense = async () => {
  const adsense = await Adsense.find()
  return {
    success: true,
    data: adsense
  }
}

const createAdsense = async (file, newData, day) => {
  const existing = file.originalname.split('.').pop()?.toLowerCase() || 'webp'
  const unique = crypto.randomUUID();

  const key = `adsense/${unique}.${existing}`
  const now = new Date()

  await Adsense.create({
    logo: key,
    ...data,
    adsenseExpiresAt: new Date(now.getTime() + Number(day) * 24 * 60 * 60 * 1000)
  })

  try{
    await uploadToR2(file, key)
  }catch(err) {
    throw err
  }

  return {
    success: true,
    message: 'Reklam olusduruldu'
  }
}

const clickAdsense = async (adsenseId) => {
  const adsense = await Adsense.findById(adsenseId)
  if(!adsense) throw new Error('Reklam tapilmadi');

  await Adsense.updateOne(
    { _id: adsenseId }, 
    {
      $inc: { clickCount: 1 }
    }
  )

  return {success: true}
}

const updateAdsense = async (adsenseId, file, data) => {
  const adsense = await Adsense.findById(adsenseId)
  if(!adsense) throw new Error('Reklam tapilmadi');

  if(file) {
    const existing = file.originalname.split('.').pop()?.toLowerCase() || 'webp'
    const unique = crypto.randomUUID();

    const key = `adsense/${unique}.${existing}`

    await Adsense.updateOne({_id: adsenseId}, {
      logo: key,
      ...data
    })

    try{
      await uploadToR2(file, key)
      await deleteFromR2(adsense.logo)
    }catch(err) {
      throw err
    }
  }else {
    await Adsense.updateOne({_id: adsenseId}, {
      ...data
    })
  }

  return {
    success: true,
    message: 'Basariyla guncellendi'
  }
}

const deleteAdsense = async (adsenseId) => {
  const adsense = await Adsense.findById(adsenseId);
  if(!adsense) throw new Error('Reklam tapilmadi');

  await Adsense.findByIdAndDelete(adsenseId);

  try{
    await deleteFromR2(adsense.logo)
  }catch(err) {
    throw err
  }

  return{
    success: true,
    message: 'Basariyla silindi'
  }
}

export default {
  getAllAdsense,
  createAdsense,
  clickAdsense,
  updateAdsense,
  deleteAdsense
}