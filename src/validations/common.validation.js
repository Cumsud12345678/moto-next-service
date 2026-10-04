import { z } from "zod";
import mongoose from "mongoose";

// ObjectId
export const objectId = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Keçərli ID deyil",
  });

// "" və ya undefined/null -> undefined (sahə göndərilməyib sayılır)
const emptyToUndefined = (value) =>
  value === "" || value === null ? undefined : value;

// İxtiyari müsbət ədəd (boş ola bilər)
export const optionalNumber = z.preprocess(
  emptyToUndefined,
  z.coerce.number().positive().optional()
);

// İxtiyari mənfi olmayan ədəd (boş ola bilər)
export const optionalNonNegativeNumber = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative().optional()
);

// MƏCBURİ müsbət ədəd: boş / yoxdursa 0 sayılır və positive() rədd edir,
// beləliklə istifadəçiyə aydın mesaj gedir
export const requiredPositiveNumber = (message) =>
  z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? 0 : value),
    z.coerce.number().positive(message)
  );

// multipart/form-data-da gələn "true"/"false" sətirləri üçün
// (z.coerce.boolean() "false"-u true edir!)
export const boolish = z.preprocess(
  (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "") return undefined;
    return value;
  },
  z.boolean().optional()
);

// multipart-da tək element string, çox element massiv gəlir -> həmişə massiv
export const toArray = (itemSchema) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return [value];
      }
    }
    return [];
  }, z.array(itemSchema));