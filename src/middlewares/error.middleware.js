import { logError } from "../services/system/errorLog.service.js";

const errorMiddleware = (err, req, res, next) => {
  // body-parser kimi kitabxanalar "status" istifadə edir
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Server xətası';

  // Multer-in fayl ölçüsü xətasını tut
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400
    message = 'Şəkil ölçüsü çox böyükdür (maksimum 2MB)'
  }

  // Yanlış ObjectId (/api/listings/abc) — server xətası deyil, pis sorğudur
  if (err.name === 'CastError') {
    statusCode = 400
    message = 'Yanlış ID'
  }

  if (err.name === 'ValidationError') {
    statusCode = 400
  }

  // Yalnız server xətaları (5xx) loqlanır. 4xx istifadəçi xətasıdır, bazanı doldurmasın.
  if (statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err)
    // gözləmirik — cavab loqa görə gecikməsin
    logError(err, { req, statusCode })

    // İstifadəçiyə daxili detalları (DB mesajları və s.) göstərmirik
    if (process.env.NODE_ENV === 'production' && !err.statusCode) {
      message = 'Server xətası. Bir az sonra yenidən cəhd edin'
    }
  }

  if (res.headersSent) return next(err)

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export {
  errorMiddleware
}
