const validateFiles = (req, res, next) => {
  const files = req.files || [];

  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Ən azı bir şəkil yükləməlisiniz",
    });
  }

  const validFiles = files.filter((file) => {
    if (!file.buffer || file.buffer.length === 0) {
      console.warn(
        `0 byte fayl atlandı: ${file.originalname}`
      );

      return false;
    }

    return true;
  });

  if (validFiles.length === 0) {
    return res.status(400).json({
      success: false,
      message:
        "Yüklədiyiniz şəkillər boş gəldi. Zəhmət olmasa yenidən seçin.",
    });
  }

  req.files = validFiles;

  next();
};

export default validateFiles;