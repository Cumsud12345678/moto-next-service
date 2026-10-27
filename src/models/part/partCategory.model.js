import mongoose from "mongoose";

// Ehtiyat hissəsi kateqoriyaları (Mühərrik, Əyləc sistemi və s.) — admin paneldən idarə olunur
const partCategorySchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  order: { type: Number, default: 100 },
})

export const PartCategory = mongoose.model('PartCategory', partCategorySchema)

// Kolleksiya boşdursa ilkin kateqoriyalar yaradılır (yalnız bir dəfə)
export const DEFAULT_PART_CATEGORIES = [
  'Mühərrik və hissələri',
  'Əyləc sistemi',
  'Təkərlər və disklər',
  'Asma (amortizator, vilka)',
  'Ötürmə (zəncir, ulduz, debriyaj)',
  'Elektrik və işıqlandırma',
  'Kuzov və plastik hissələr',
  'İşlənmiş qaz sistemi (glushitel)',
  'Yanacaq sistemi',
  'Ekipirovka (kask, geyim, əlcək)',
  'Aksesuarlar',
  'Yağlar və mayelər',
  'Digər',
]

export const seedPartCategories = async () => {
  try {
    if (await PartCategory.estimatedDocumentCount() > 0) return
    await PartCategory.insertMany(DEFAULT_PART_CATEGORIES.map((label, i) => ({ label, order: (i + 1) * 10 })))
    console.log('İlkin hissə kateqoriyaları yaradıldı')
  } catch (err) {
    console.error('Hissə kateqoriyaları yaradılmadı:', err.message)
  }
}
