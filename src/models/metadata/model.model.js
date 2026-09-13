import { model, Schema } from "mongoose";

const modelSchema = new Schema({
  label: String,
  make: { type: Schema.Types.ObjectId, ref: 'Make' }
})

export const Model = model('Model', modelSchema)