import mongoose from "mongoose"

const equipmentSchema = new mongoose.Schema({
  label: String
})

export const Equipment = mongoose.model('Equipment', equipmentSchema)