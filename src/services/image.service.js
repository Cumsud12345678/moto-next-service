import sharp from 'sharp'

// Render kimi az yaddaşlı serverlərdə sharp eyni anda bir şəkil emal etsin
sharp.concurrency(1)
sharp.cache(false)

const MAX_WIDTH = 1600
const QUALITY = 80

/**
 * Şəkli kiçildir, EXIF oriyentasiyasını düzəldir və WebP-yə çevirir.
 * multer faylı ilə eyni formada obyekt qaytarır ki, uploadToR2 dəyişməsin.
 */
export const processImage = async (file) => {
  try {
    const buffer = await sharp(file.buffer, { failOn: 'none' })
      .rotate()                                   // telefondan gələn yan şəkilləri düzəldir
      .resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer()                                 // EXIF/GPS metadata avtomatik silinir

    return {
      ...file,
      buffer,
      mimetype: 'image/webp',
      size: buffer.length,
      originalname: file.originalname.replace(/\.[^.]+$/, '') + '.webp',
    }
  } catch (err) {
    console.error('Şəkil emal olunmadı:', file.originalname, err.message)
    const error = new Error('Şəkil formatı dəstəklənmir və ya fayl zədəlidir')
    error.statusCode = 400
    throw error
  }
}