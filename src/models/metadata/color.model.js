import mongoose from "mongoose"

const colorSchema = new mongoose.Schema({
  label: String
})

export const Color = mongoose.model('Color', colorSchema)