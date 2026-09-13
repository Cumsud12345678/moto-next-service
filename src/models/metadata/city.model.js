import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
  label: String,
})

export const City = mongoose.model('City', citySchema)