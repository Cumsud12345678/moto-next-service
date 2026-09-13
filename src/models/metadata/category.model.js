import mongoose from "mongoose"

const categorySchema = new mongoose.Schema({
  label: String
})

export const Category = mongoose.model('Category', categorySchema)