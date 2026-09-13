import { sendErrorMail } from "../services/email/sendErrorMail.service.js";

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server xətası';

  // Multer-in fayl ölçüsü xətasını tut
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400
    message = 'Şəkil ölçüsü çox böyükdür (maksimum 2MB)'
  }
 
  if (statusCode >= 500) {
    sendErrorMail({
      statusCode,
      message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      user: req.user?.id,
      ip: req.ip,
    }).catch(console.error);
  }
 
  res.status(statusCode).json({
    success: false,
    message,
  });
};
 
export {
  errorMiddleware
}