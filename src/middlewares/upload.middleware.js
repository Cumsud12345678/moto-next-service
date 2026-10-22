import multer from "multer";

// Yalnız şəkillər qəbul olunur (videolar birbaşa R2-yə presigned URL ilə yüklənir)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|heic|heif|svg\+xml)$/i.test(file.mimetype)) return cb(null, true)
    const error = new Error('Yalnız şəkil faylı yükləmək olar (jpg, png, webp)')
    error.statusCode = 400
    cb(error)
  },
});

export default upload;
