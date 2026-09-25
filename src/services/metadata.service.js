import { Category } from "../models/metadata/category.model.js";
import { City } from "../models/metadata/city.model.js";
import { Color } from "../models/metadata/color.model.js";
import { Equipment } from "../models/metadata/equipment.model.js";
import { FuelType } from "../models/metadata/fuelType.model.js";
import { Make } from "../models/metadata/make.model.js";
import { Model } from "../models/metadata/model.model.js";
import { Transmission } from "../models/metadata/transmission.model.js";
import { deleteFromR2, deleteManyFromR2, uploadToR2 } from "./storage.service.js";

const getMetadata = async () => {
  const [ 
    makes, models, fuelTypes, transmissions, cities, colors, categories, equipments
  ] = 
    await Promise.all([
      Make.find(),
      Model.find(),
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

// MARKA VE MODEL YARAT
const createMakeAndModel = async (file, makeLabel, modelLabels) => {
  const extension = file.originalname.split('.').pop()?.toLowerCase() || 'webp'
  const unique = crypto.randomUUID()

  const key = `metadata/${unique}.${extension}`

  console.log(modelLabels)

  try{
    await uploadToR2(file, key)

    const newMake = await Make.create({
      label: makeLabel,
      logo: key
    })

    if(newMake) {
      await Promise.all(
        modelLabels.map((modelLabel) =>
          Model.create({ label: modelLabel, make: newMake._id })
        )
      )

      return {
        success: true,
        message: 'Marka ve modellerr olusturuldu'
      }
    }else {
      throw new Error('Marka olusturulmadi');
    }

  }catch(err) {
    throw err
  }
}

// MARKA SIL
const deleteMake = async (makeId) => {
  const make = await Make.findById(makeId);
  if(!make) throw new Error('Marka tapilmadi');

  try{
    await deleteFromR2(make.logo)
  }catch (err) {
    console.error('R2 şəkilləri silinə bilmədi:', err)
  }

  await Make.findByIdAndDelete(makeId)
  await Model.deleteMany({ make : makeId })

  return {
    success: true,
    message: 'Uqurla silindi'
  }
}

const createModel = async (makeId, modelLabels) => {
  const make = await Make.findById(makeId);
  if(!make) throw new Error('Marka tapilmadi');

  modelLabels.forEach(async (modelLabel) => {
    await Model.create({
      label: modelLabel,
      make: makeId
    })
  })

  return {
    success: true,
    message: 'Islem basarili'
  }
}


const createBasicMetadata = async (dataModel, dataLabel) => {
  
  switch(dataModel) {
    case "category" : 
      await Category.create({ label: dataLabel })
      break;
    case "City" :
      await City.create({ label: dataLabel });
      break;
    case "color" : 
      await Color.create({ label: dataLabel })
      break;
    case "equipment" : 
      await Equipment.create({ label: dataLabel })
      break;
    case "fueltype" : 
      await FuelType.create({ label: dataLabel })
      break;
    case "transmission" : 
      await Transmission.create({ label: dataLabel })
      break;
    default : 
      throw new Error('Model tapilmadi')
  }

  return {
    success: true,
    message: 'Uqurlu islem'
  }

}

// METADATALARDAN 1 DENESIN SIL
const deleteBasicMetadata = async (dataModel, dataId) => {
  switch(dataModel) {
    case "category" : 
      await Category.findByIdAndDelete(dataId)
      break;
    case "City" :
      await City.findByIdAndDelete(dataId)
      break;
    case "color" : 
      await Color.findByIdAndDelete(dataId)
      break;
    case "equipment" : 
      await Equipment.findByIdAndDelete(dataId)
      break;
    case "fueltype" : 
      await FuelType.findByIdAndDelete(dataId)
      break;
    case "transmission" : 
      await Transmission.findByIdAndDelete(dataId)
      break;
    default : 
      throw new Error('Model tapilmadi')
  }

  return {
    success: true,
    message: 'Uqurlu islem'
  }
}

export default {
  getMetadata,
  createMakeAndModel,
  deleteMake,
  createModel,
  createBasicMetadata,
  deleteBasicMetadata
}