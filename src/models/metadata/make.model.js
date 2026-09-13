import { model, Schema } from "mongoose";

const makeSchema = new Schema({
  label: String,
  logo: String
})

export const Make = model('Make', makeSchema)