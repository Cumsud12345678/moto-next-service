import { Category } from "../../models/metadata/category.model.js";
import { City } from "../../models/metadata/city.model.js";
import { Color } from "../../models/metadata/color.model.js";
import { Equipment } from "../../models/metadata/equipment.model.js";
import { FuelType } from "../../models/metadata/fuelType.model.js";
import { Make } from "../../models/metadata/make.model.js";
import { Model } from "../../models/metadata/model.model.js";
import { Transmission } from "../../models/metadata/transmission.model.js";

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

export default {
  getMetadata
}