import crypto from 'node:crypto'
import { Category } from "../models/metadata/category.model.js";
import { City } from "../models/metadata/city.model.js";
import { Color } from "../models/metadata/color.model.js";
import { Equipment } from "../models/metadata/equipment.model.js";
import { FuelType } from "../models/metadata/fuelType.model.js";
import { Make } from "../models/metadata/make.model.js";
import { Model } from "../models/metadata/model.model.js";
import { Transmission } from "../models/metadata/transmission.model.js";
import { deleteFromR2, uploadToR2 } from "./storage.service.js";

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

// MARKA VE MODEL YARAT
const createMakeAndModel = async (file, makeLabel, modelLabels) => {
  if (!file) throw new Error('Logo secilmeyib')
  if (!makeLabel?.trim()) throw new Error('Marka adi bos ola bilmez')

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
    try { await deleteFromR2(key) } catch (e) { console.error('R2 logo silinmedi:', e) }
    throw err
  }

  return {
    success: true,
    message: 'Marka ve modeller olusturuldu'
  }
}

// MARKA YENILE (ad ve/ve ya logo)
const updateMake = async (makeId, makeLabel, file) => {
  const make = await Make.findById(makeId)
  if (!make) throw new Error('Marka tapilmadi')

  if (makeLabel !== undefined) {
    if (!makeLabel.trim()) throw new Error('Marka adi bos ola bilmez')
    make.label = makeLabel.trim()
  }

  let oldKey = null
  if (file) {
    const newKey = buildLogoKey(file)
    await uploadToR2(file, newKey)
    oldKey = make.logo
    make.logo = newKey
  }

  await make.save()

  if (oldKey) {
    try { await deleteFromR2(oldKey) } catch (err) { console.error('Kohne logo silinmedi:', err) }
  }

  return {
    success: true,
    message: 'Marka yenilendi',
    data: make
  }
}

// MARKA SIL
const deleteMake = async (makeId) => {
  const make = await Make.findById(makeId)
  if (!make) throw new Error('Marka tapilmadi')

  try {
    await deleteFromR2(make.logo)
  } catch (err) {
    console.error('R2 şəkilləri silinə bilmədi:', err)
  }

  await Model.deleteMany({ make: makeId })
  await Make.findByIdAndDelete(makeId)

  return {
    success: true,
    message: 'Uqurla silindi'
  }
}

// MARKAYA MODEL(LER) ELAVE ET
const createModel = async (makeId, modelLabels) => {
  const make = await Make.findById(makeId)
  if (!make) throw new Error('Marka tapilmadi')

  // tək string də göndərilə bilər
  const labels = cleanLabels(Array.isArray(modelLabels) ? modelLabels : [modelLabels])
  if (!labels.length) throw new Error('Model adi bos ola bilmez')

  // forEach(async) əvəzinə await edilən insertMany
  await Model.insertMany(labels.map((label) => ({ label, make: makeId })))

  return {
    success: true,
    message: 'Islem basarili'
  }
}

// MODEL YENILE
const updateModel = async (modelId, label) => {
  if (!label?.trim()) throw new Error('Model adi bos ola bilmez')

  const model = await Model.findByIdAndUpdate(
    modelId,
    { label: label.trim() },
    { new: true }
  )
  if (!model) throw new Error('Model tapilmadi')

  return {
    success: true,
    message: 'Model yenilendi',
    data: model
  }
}

// MODEL SIL
const deleteModel = async (modelId) => {
  const model = await Model.findByIdAndDelete(modelId)
  if (!model) throw new Error('Model tapilmadi')

  return {
    success: true,
    message: 'Model silindi'
  }
}

// Controller dataModel-i toLowerCase edir, ona görə case-lər də kiçik hərflə olmalıdır
const basicModels = {
  category: Category,
  city: City,
  color: Color,
  equipment: Equipment,
  fueltype: FuelType,
  transmission: Transmission,
}

const createBasicMetadata = async (dataModel, dataLabel) => {
  const Schema = basicModels[dataModel]
  if (!Schema) throw new Error('Model tapilmadi')

  await Schema.create({ label: dataLabel })

  return {
    success: true,
    message: 'Uqurlu islem'
  }
}

// METADATALARDAN 1 DENESIN SIL
const deleteBasicMetadata = async (dataModel, dataId) => {
  const Schema = basicModels[dataModel]
  if (!Schema) throw new Error('Model tapilmadi')

  await Schema.findByIdAndDelete(dataId)

  return {
    success: true,
    message: 'Uqurlu islem'
  }
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
  deleteBasicMetadata
}