import { z } from "zod";
import {
  optionalNonNegativeNumber,
  requiredPositiveNumber,
  boolish,
  toArray,
} from "./common.validation.js";

export const updateListingSchema = z.object({
  // Əsas məlumatlar
  used: boolish,
  barter: boolish,
  document: boolish,
  credit: boolish,

  // Məcburi: boş göndərilsə 400 qaytarır
  power: requiredPositiveNumber("Güc 0-dan böyük olmalıdır"),
  price: requiredPositiveNumber("Qiymət 0-dan böyük olmalıdır"),

  mileage: optionalNonNegativeNumber,

  description: z.string().max(1000).optional(),

  video: z.string().optional(),

  // Saxlanılan köhnə şəkillərin key-ləri.
  // Sxemdə olmasa Zod onu silir və bütün köhnə şəkillər itir!
  keepImageKeys: toArray(z.string().min(1)),
});