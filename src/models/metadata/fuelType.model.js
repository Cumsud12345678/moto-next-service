import mongoose from "mongoose"

const fuelTypeSchema = new mongoose.Schema({
  label: String
})

export const FuelType = mongoose.model('FuelType', fuelTypeSchema)