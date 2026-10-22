import crypto from 'node:crypto'
import { Category } from "../models/metadata/category.model.js";
import { City } from "../models/metadata/city.model.js";
import { Color } from "../models/metadata/color.model.js";
import { Equipment } from "../models/metadata/equipment.model.js";
import { FuelType } from "../models/metadata/fuelType.model.js";
import { Make } from "../models/metadata/make.model.js";
import { Model } from "../models/metadata/model.model.js";
import { Transmission } from "../models/metadata/transmission.model.js";
import { Listing } from "../models/listing/listing.model.js";
import { deleteFromR2, uploadToR2 } from "./storage.service.js";
import { escapeRegex, httpError, isObjectId } from "../utils/http.js";

const getMetadata = async () => {
  const [
    makes, models, fuelTypes, transmissions, cities, colors, categories, equipments
  ] =
    await Promise.all([
      Make.find().sort({ label: 1 }),
      Model.find().sort({ label: 1 }),
      FuelType.find(),
      Transmission.find(),
      City.find(),
      Color.find(),
      Category.find(),
      Equipment.find(),
    ])

  return {
    makes, models, fuelTypes, transmissions, cities, colors, categories, equipments
  }
}

const buildLogoKey = (file) => {
  const extension = file.originalname.split('.').pop()?.toLowerCase() || 'webp'
  return `metadata/makes/${crypto.randomUUID()}.${extension}`
}

const cleanLabels = (labels) => {
  if (!Array.isArray(labels)) return []
  const cleaned = labels
    .map((l) => (typeof l === 'string' ? l.trim() : ''))
    .filter(Boolean)
  // təkrarlananları at (böyük/kiçik hərfə həssas olmadan)
  return [...new Map(cleaned.map((l) => [l.toLowerCase(), l])).values()]
}

const sameLabel = (label) => new RegExp(`^${escapeRegex(label.trim())}$`, 'i')

const assertImage = (file) => {
  if (!file) throw httpError(400, 'Logo seçilməyib')
  if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.mimetype)) throw httpError(400, 'Logo şəkil olmalıdır (png, jpg, webp, svg)')
}

// MARKA VE MODEL YARAT
const createMakeAndModel = async (file, makeLabel, modelLabels) => {
  assertImage(file)
  if (!makeLabel?.trim()) throw httpError(400, 'Marka adı boş ola bilməz')
  if (await Make.exists({ label: sameLabel(makeLabel) })) throw httpError(409, `"${makeLabel.trim()}" markası artıq var`)

  const key = buildLogoKey(file)

  await uploadToR2(file, key)

  let newMake
  try {
    newMake = await Make.create({ label: makeLabel.trim(), logo: key })

    const labels = cleanLabels(modelLabels)
    if (labels.length) {
      await Model.insertMany(labels.map((label) => ({ label, make: newMake._id })))
    }
  } catch (err) {
    // yarımçıq qalmasın deyə geri al
    if (newMake) {
      await Model.deleteMany({ make: newMake._id })
      await Make.findByIdAndDelete(newMake._id)
    }
    try { await deleteFromR2(key) } catch (e) { console.error('R2 logo silinmədi:', e) }
    throw err
  }

  return {
    success: true,
    message: 'Marka və modellər əlavə olundu',
    data: newMake,
  }
}

// MARKA YENILE (ad ve/ve ya logo)
const updateMake = async (makeId, makeLabel, file) => {
  if (!isObjectId(makeId)) throw httpError(400, 'Yanlış marka ID')
  const make = await Make.findById(makeId)
  if (!make) throw httpError(404, 'Marka tapılmadı')

  if (makeLabel !== undefined) {
    if (!makeLabel.trim()) throw httpError(400, 'Marka adı boş ola bilməz')
    if (await Make.exists({ _id: { $ne: makeId }, label: sameLabel(makeLabel) })) {
      throw httpError(409, `"${makeLabel.trim()}" markası artıq var`)
    }
    make.label = makeLabel.trim()
  }

  let oldKey = null
  if (file) {
    assertImage(file)
    const newKey = buildLogoKey(file)
    await uploadToR2(file, newKey)
    oldKey = make.logo
    make.logo = newKey
  }

  await make.save()

  if (oldKey) {
    try { await deleteFromR2(oldKey) } catch (err) { console.error('Köhnə logo silinmədi:', err) }
  }

  return {
    success: true,
    message: 'Marka yeniləndi',
    data: make
  }
}

// Elanlarda istifadə olunan dəyəri silmək elanları sındırır (səhifədə make.label boş qalır)
const assertNotUsed = async (field, id, what) => {
  const count = await Listing.countDocuments({ [field]: id })
  if (count > 0) {
    throw httpError(409, `Bu ${what} ${count} elanda istifadə olunur. Əvvəlcə həmin elanları dəyişin və ya silin`)
  }
}

// MARKA SIL
const deleteMake = async (makeId) => {
  if (!isObjectId(makeId)) throw httpError(400, 'Yanlış marka ID')
  const make = await Make.findById(makeId)
  if (!make) throw httpError(404, 'Marka tapılmadı')

  await assertNotUsed('make', makeId, 'marka')

  await Model.deleteMany({ make: makeId })
  await Make.findByIdAndDelete(makeId)

  try {
    if (make.logo) await deleteFromR2(make.logo)
  } catch (err) {
    console.error('R2 logo silinə bilmədi:', err)
  }

  return {
    success: true,
    message: 'Marka silindi'
  }
}

// MARKAYA MODEL(LER) ELAVE ET
const createModel = async (makeId, modelLabels) => {
  if (!isObjectId(makeId)) throw httpError(400, 'Yanlış marka ID')
  const make = await Make.findById(makeId)
  if (!make) throw httpError(404, 'Marka tapılmadı')

  // tək string də göndərilə bilər
  const labels = cleanLabels(Array.isArray(modelLabels) ? modelLabels : [modelLabels])
  if (!labels.length) throw httpError(400, 'Model adı boş ola bilməz')

  // Bu markada artıq olan modelləri təkrar yaratmırıq
  const existing = await Model.find({ make: makeId }).select('label').lean()
  const existingSet = new Set(existing.map((m) => m.label.toLowerCase()))
  const fresh = labels.filter((l) => !existingSet.has(l.toLowerCase()))
  if (!fresh.length) throw httpError(409, 'Bu model(lər) artıq var')

  const created = await Model.insertMany(fresh.map((label) => ({ label, make: makeId })))

  return {
    success: true,
    message: fresh.length === 1 ? 'Model əlavə olundu' : `${fresh.length} model əlavə olundu`,
    data: created
  }
}

// MODEL YENILE
const updateModel = async (modelId, label) => {
  if (!isObjectId(modelId)) throw httpError(400, 'Yanlış model ID')
  if (!label?.trim()) throw httpError(400, 'Model adı boş ola bilməz')

  const model = await Model.findByIdAndUpdate(
    modelId,
    { label: label.trim() },
    { returnDocument: 'after' }
  )
  if (!model) throw httpError(404, 'Model tapılmadı')

  return {
    success: true,
    message: 'Model yeniləndi',
    data: model
  }
}

// MODEL SIL
const deleteModel = async (modelId) => {
  if (!isObjectId(modelId)) throw httpError(400, 'Yanlış model ID')
  await assertNotUsed('model', modelId, 'model')

  const model = await Model.findByIdAndDelete(modelId)
  if (!model) throw httpError(404, 'Model tapılmadı')

  return {
    success: true,
    message: 'Model silindi'
  }
}

// Controller dataModel-i toLowerCase edir, ona görə açarlar da kiçik hərflə olmalıdır
// field: Listing modelindəki uyğun sahə (istifadə sayını yoxlamaq üçün)
const basicModels = {
  category: { Schema: Category, field: 'category', name: 'ban növü' },
  city: { Schema: City, field: 'region', name: 'şəhər' },
  color: { Schema: Color, field: 'color', name: 'rəng' },
  equipment: { Schema: Equipment, field: 'equipment', name: 'avadanlıq' },
  fueltype: { Schema: FuelType, field: 'fuelType', name: 'mühərrik növü' },
  transmission: { Schema: Transmission, field: 'transmission', name: 'sürətlər qutusu' },
}

const getBasic = (dataModel) => {
  const entry = basicModels[String(dataModel ?? '').toLowerCase()]
  if (!entry) throw httpError(400, 'Parametr növü düzgün deyil')
  return entry
}

// METADATA ELAVE ET (şəhər, rəng və s.)
const createBasicMetadata = async (dataModel, dataLabel) => {
  const { Schema, name } = getBasic(dataModel)
  const label = String(dataLabel ?? '').trim()
  if (!label) throw httpError(400, 'Ad boş ola bilməz')
  if (label.length > 60) throw httpError(400, 'Ad maksimum 60 simvol ola bilər')
  if (await Schema.exists({ label: sameLabel(label) })) throw httpError(409, `"${label}" artıq var`)

  const created = await Schema.create({ label })

  return {
    success: true,
    message: `Yeni ${name} əlavə olundu`,
    data: created
  }
}

// METADATA ADINI DEYIS
const updateBasicMetadata = async (dataModel, dataId, dataLabel) => {
  const { Schema } = getBasic(dataModel)
  if (!isObjectId(dataId)) throw httpError(400, 'Yanlış ID')
  const label = String(dataLabel ?? '').trim()
  if (!label) throw httpError(400, 'Ad boş ola bilməz')
  if (await Schema.exists({ _id: { $ne: dataId }, label: sameLabel(label) })) throw httpError(409, `"${label}" artıq var`)

  const updated = await Schema.findByIdAndUpdate(dataId, { label }, { returnDocument: 'after' })
  if (!updated) throw httpError(404, 'Tapılmadı')

  return { success: true, message: 'Yeniləndi', data: updated }
}

// METADATALARDAN 1 DENESIN SIL
const deleteBasicMetadata = async (dataModel, dataId) => {
  const { Schema, field, name } = getBasic(dataModel)
  if (!isObjectId(dataId)) throw httpError(400, 'Yanlış ID')

  await assertNotUsed(field, dataId, name)

  const deleted = await Schema.findByIdAndDelete(dataId)
  if (!deleted) throw httpError(404, 'Tapılmadı')

  return {
    success: true,
    message: 'Silindi'
  }
}

// Hər marka/model/parametrin neçə elanda istifadə olunduğu (admin panel üçün)
// { make: { <id>: 12 }, model: {...}, region: {...}, ... }
const getUsage = async () => {
  const fields = ['make', 'model', 'category', 'region', 'color', 'fuelType', 'transmission']

  const [facets] = await Listing.aggregate([
    {
      $facet: {
        ...Object.fromEntries(fields.map((f) => [f, [{ $group: { _id: `$${f}`, count: { $sum: 1 } } }]])),
        equipment: [{ $unwind: '$equipment' }, { $group: { _id: '$equipment', count: { $sum: 1 } } }],
      },
    },
  ])

  const data = Object.fromEntries(
    Object.entries(facets ?? {}).map(([field, rows]) => [
      field,
      Object.fromEntries(rows.filter((r) => r._id).map((r) => [String(r._id), r.count])),
    ])
  )

  return { success: true, data }
}

export default {
  getMetadata,
  createMakeAndModel,
  updateMake,
  deleteMake,
  createModel,
  updateModel,
  deleteModel,
  createBasicMetadata,
  updateBasicMetadata,
  deleteBasicMetadata,
  getUsage,
}
