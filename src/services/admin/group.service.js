import crypto from 'node:crypto'
import { Group } from "../../models/interaction/group.model.js";
import { deleteFromR2, uploadToR2 } from "../storage.service.js";
import { httpError, isObjectId } from "../../utils/http.js";

const assertImage = (file) => {
  if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file?.mimetype ?? '')) {
    throw httpError(400, 'Logo şəkil olmalıdır (png, jpg, webp, svg)')
  }
}

const buildKey = (file) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase() || 'webp'
  return `vp-groups/${crypto.randomUUID()}.${ext}`
}

// Yalnız icazə verilən sahələr (əvvəl req.body bütövlükdə yazılırdı — clickCount da dəyişdirilə bilərdi)
const cleanData = ({ title, link } = {}, { partial = false } = {}) => {
  const data = {}

  if (title !== undefined || !partial) {
    const t = String(title ?? '').trim()
    if (!t) throw httpError(400, 'Qrup adını yazın')
    if (t.length > 80) throw httpError(400, 'Qrup adı maksimum 80 simvol ola bilər')
    data.title = t
  }

  if (link !== undefined || !partial) {
    const l = String(link ?? '').trim()
    if (!/^https?:\/\/\S+$/i.test(l)) throw httpError(400, 'Link https:// ilə başlamalıdır')
    data.link = l
  }

  return data
}

const getGroups = async () => {
  const groups = await Group.find().sort({ createdAt: -1 }).lean()
  return { success: true, data: groups }
}

const createGroup = async (file, body) => {
  if (!file) throw httpError(400, 'Logo seçin')
  assertImage(file)
  const data = cleanData(body)

  const key = buildKey(file)
  await uploadToR2(file, key)

  try {
    const group = await Group.create({ ...data, logo: key })
    return { success: true, message: 'Qrup əlavə olundu', data: group }
  } catch (err) {
    await deleteFromR2(key).catch(() => {})
    throw err
  }
}

const updateGroup = async (groupId, file, body) => {
  if (!isObjectId(groupId)) throw httpError(400, 'Yanlış qrup ID')
  const group = await Group.findById(groupId)
  if (!group) throw httpError(404, 'Qrup tapılmadı')

  const data = cleanData(body, { partial: true })

  let oldKey = null
  if (file) {
    assertImage(file)
    const key = buildKey(file)
    await uploadToR2(file, key)
    oldKey = group.logo
    data.logo = key
  }

  Object.assign(group, data)
  await group.save()

  if (oldKey) await deleteFromR2(oldKey).catch((err) => console.error('Köhnə logo silinmədi:', err))

  return { success: true, message: 'Qrup yeniləndi', data: group }
}

const deleteGroup = async (groupId) => {
  if (!isObjectId(groupId)) throw httpError(400, 'Yanlış qrup ID')
  const group = await Group.findByIdAndDelete(groupId)
  if (!group) throw httpError(404, 'Qrup tapılmadı')

  if (group.logo) await deleteFromR2(group.logo).catch((err) => console.error('Logo silinmədi:', err))

  // ƏVVƏL: heç nə qaytarılmırdı, cavab boş gedirdi
  return { success: true, message: 'Qrup silindi' }
}

export default {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup
}
