import mongoose from "mongoose"

const transmissionSchema = new mongoose.Schema({
  label: String
})

export const Transmission = mongoose.model('Transmission', transmissionSchema)