import { z } from "zod";
import {
  objectId,
  optionalNonNegativeNumber,
  requiredPositiveNumber,
  boolish,
  toArray,
} from "./common.validation.js";

export const createListingSchema = z.object({
  // Controller req.body.listingId oxuyur (əvvəlcədən yaradılmış id) —
  // sxemdə olmasa silinir və həmişə null olur
  listingId: objectId.optional(),

  price: requiredPositiveNumber("Qiymət 0-dan böyük olmalıdır"),

  make: objectId,
  model: objectId,

  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear()),

  volume: z.coerce.number().int().positive(),

  category: objectId,

  used: boolish,

  color: objectId,
  fuelType: objectId,
  transmission: objectId,

  power: requiredPositiveNumber("Güc 0-dan böyük olmalıdır"),

  mileage: optionalNonNegativeNumber,

  // images burada YOXDUR: fayllar req.files-dədir, validateFiles yoxlayır

  equipment: toArray(objectId),

  region: objectId,

  // Telefon string saxlanılır (baş sıfır itməsin). Mongoose sxemində də String olmalıdır.
  phone: z.string().regex(/^\+?\d{9,15}$/, "Telefon nömrəsi yanlışdır"),

  barter: boolish,
  document: boolish,
  credit: boolish,

  description: z.string().max(1000).optional(),

  video: z.string().optional(),
});