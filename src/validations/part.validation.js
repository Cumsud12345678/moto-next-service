import { z } from "zod";
import { objectId, requiredPositiveNumber, boolish, toArray } from "./common.validation.js";

// multipart-da boş seçim "" gəlir -> sahə yoxdur
const optionalObjectId = z.preprocess(
  (value) => (value === "" || value === null || value === "null" ? undefined : value),
  objectId.optional()
);

const baseFields = {
  title: z.string().trim().min(3, "Elanın adı ən azı 3 simvol olmalıdır").max(100, "Elanın adı maksimum 100 simvol ola bilər"),
  partCategory: objectId,
  condition: z.enum(["new", "used"]),
  make: optionalObjectId,
  model: optionalObjectId,
  price: requiredPositiveNumber("Qiymət 0-dan böyük olmalıdır"),
  region: objectId,
  phone: z.string().regex(/^\d{9}$/, "Telefon nömrəsi 9 rəqəmdən ibarət olmalıdır"),
  delivery: boolish,
  description: z.string().max(2000, "Təsvir maksimum 2000 simvol ola bilər").optional(),
};

export const createPartSchema = z.object(baseFields);

export const updatePartSchema = z.object({
  ...baseFields,
  // Saxlanılan köhnə şəkillərin key-ləri (sxemdə olmasa Zod silir və köhnə şəkillər itir)
  keepImageKeys: toArray(z.string().min(1)),
});
