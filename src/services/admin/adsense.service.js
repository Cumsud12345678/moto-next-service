import crypto from 'node:crypto'
import { Adsense } from "../../models/advertising/adsense.model.js"
import { uploadToR2, deleteFromR2 } from "../storage.service.js"
import { httpError, isObjectId } from "../../utils/http.js"

export const POSITIONS = ['mobile', 'deskop_left', 'deskop_right']
const DAY_MS = 24 * 60 * 60 * 1000

const assertImage = (file) => {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file?.mimetype ?? '')) {
    throw httpError(400, 'Reklam şəkli png, jpg, webp və ya gif olmalıdır')
  }
}

const buildKey = (file) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase() || 'webp'
  return `adsense/${crypto.randomUUID()}.${ext}`
}

// FormData-dan gələn "true"/"false"
const toBool = (v) => v === true || v === 'true'

// Yalnız icazə verilən sahələr. partial=true: yeniləmədə göndərilməyən sahələrə toxunmur
const cleanData = (body = {}, { partial = false } = {}) => {
  const data = {}
  const has = (key) => body[key] !== undefined || !partial

  if (has('link')) {
    const link = String(body.link ?? '').trim()
    if (!/^https?:\/\/\S+$/i.test(link)) throw httpError(400, 'Link https:// ilə başlamalıdır')
    data.link = link
  }
  if (has('position')) {
    if (!POSITIONS.includes(body.position)) throw httpError(400, 'Yerləşmə düzgün deyil')
    data.position = body.position
  }
  if (has('ownerName')) {
    const name = String(body.ownerName ?? '').trim()
    if (!name) throw httpError(400, 'Reklam sahibinin adını yazın')
    data.ownerName = name.slice(0, 80)
  }
  if (has('ownerPhone')) {
    const phone = String(body.ownerPhone ?? '').trim()
    if (!phone) throw httpError(400, 'Reklam sahibinin telefonunu yazın')
    data.ownerPhone = phone.slice(0, 30)
  }
  if (has('isHome')) data.isHome = toBool(body.isHome)
  if (has('isDetails')) data.isDetails = toBool(body.isDetails)

  // day: bu gündən neçə gün göstəriləcək. Yeniləmədə göndərilsə müddət yenidən hesablanır
  if ((body.day !== undefined && body.day !== '') || !partial) {
    const day = parseInt(body.day, 10)
    if (!day || day < 1 || day > 365) throw httpError(400, 'Gün sayı 1 ilə 365 arasında olmalıdır')
    data.adsenseExpiresAt = new Date(Date.now() + day * DAY_MS)
  }

  return data
}

// SAYT ÜÇÜN: yalnız vaxtı bitməmiş reklamlar
// ƏVVƏL: vaxtı bitmiş reklamlar da saytda göstərilirdi
const getActiveAdsense = async () => {
  const adsense = await Adsense.find({ adsenseExpiresAt: { $gt: new Date() } })
    .select('logo link position isHome isDetails')
    .lean()
  return { success: true, data: adsense }
}

// ADMIN ÜÇÜN: hamısı (sahibin telefonu ilə birlikdə)
const getAllAdsense = async () => {
  const adsense = await Adsense.find().sort({ adsenseExpiresAt: -1 }).lean()
  return { success: true, data: adsense }
}

const createAdsense = async (file, body) => {
  if (!file) throw httpError(400, 'Reklam şəklini seçin')
  assertImage(file)
  const data = cleanData(body)

  // ƏVVƏL: burada mövcud olmayan "data" dəyişəni istifadə olunurdu — reklam yaratmaq həmişə xəta verirdi
  const key = buildKey(file)
  await uploadToR2(file, key)

  try {
    const adsense = await Adsense.create({ ...data, logo: key })
    return { success: true, message: 'Reklam əlavə olundu', data: adsense }
  } catch (err) {
    await deleteFromR2(key).catch(() => {})
    throw err
  }
}

const clickAdsense = async (adsenseId) => {
  if (!isObjectId(adsenseId)) throw httpError(400, 'Yanlış ID')
  await Adsense.updateOne({ _id: adsenseId }, { $inc: { clickCount: 1 } })
  return { success: true }
}

const updateAdsense = async (adsenseId, file, body) => {
  if (!isObjectId(adsenseId)) throw httpError(400, 'Yanlış ID')
  const adsense = await Adsense.findById(adsenseId)
  if (!adsense) throw httpError(404, 'Reklam tapılmadı')

  const data = cleanData(body, { partial: true })

  let oldKey = null
  if (file) {
    assertImage(file)
    const key = buildKey(file)
    await uploadToR2(file, key)
    oldKey = adsense.logo
    data.logo = key
  }

  Object.assign(adsense, data)
  await adsense.save()

  if (oldKey) await deleteFromR2(oldKey).catch((err) => console.error('Köhnə şəkil silinmədi:', err))

  return { success: true, message: 'Reklam yeniləndi', data: adsense }
}

const deleteAdsense = async (adsenseId) => {
  if (!isObjectId(adsenseId)) throw httpError(400, 'Yanlış ID')
  const adsense = await Adsense.findByIdAndDelete(adsenseId)
  if (!adsense) throw httpError(404, 'Reklam tapılmadı')

  if (adsense.logo) await deleteFromR2(adsense.logo).catch((err) => console.error('Şəkil silinmədi:', err))

  return { success: true, message: 'Reklam silindi' }
}

export default {
  getActiveAdsense,
  getAllAdsense,
  createAdsense,
  clickAdsense,
  updateAdsense,
  deleteAdsense
}
