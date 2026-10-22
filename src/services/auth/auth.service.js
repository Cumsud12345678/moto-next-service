import { redis } from "../../config/redis.config.js";
import { User } from "../../models/user/user.model.js";
import { sendOtpEmail } from "../email/sendMail.service.js";
import jwt from 'jsonwebtoken'

// Email-i həmişə eyni formaya salırıq: " Test@Gmail.com " -> "test@gmail.com"
// Əks halda mobil klaviatura böyük hərflə yazanda yeni hesab yaranırdı.
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const absoluteVerifyStart = async (rawEmail) => {
  const email = normalizeEmail(rawEmail)
  const user = await User.findOne({ email: email })

  if(user && user.isLocked) {
    const error = new Error('Hesabınız bloklanıb. Əlavə məlumat üçün dəsdəklə əlaqə saxlayın');
    error.statusCode = 404;
    throw error;
  }

  // Eyni emailə 60 saniyə ərzində təkrar kod göndərilməsin (double click / spam)
  const cooldown = await redis.set(`absolute-verify-cooldown:${email}`, '1', { NX: true, EX: 60 })
  if (!cooldown) {
    const error = new Error('Kod artıq göndərilib. 1 dəqiqə sonra yenidən cəhd edin');
    error.statusCode = 429;
    throw error;
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));

  try {
    await sendOtpEmail(email, otp, user ? 'Login' : 'Register');

    await redis.set(
      `absolute-verify-start:${email}`,
      JSON.stringify({ otp, email }),
      { EX: 300 }
    );
    // Yeni kod göndərildisə, köhnə yanlış cəhdləri sıfırla
    await redis.del(`absolute-verify-attempts:${email}`);

    return {
      success: true,
      isOldUser: user ? true : false,
      message: 'Kod göndərildi'
    };
  } catch (mailErr) {
    await redis.del(`absolute-verify-cooldown:${email}`);
    console.error('OTP email xətası:', mailErr.message);
    const error = new Error('Kod göndərilmədi, bir az sonra yenidən cəhd edin');
    error.statusCode = 500;
    throw error;
  }
}

const absoluteVerifyEnd = async (rawEmail, name, otp, ip) => {
  const email = normalizeEmail(rawEmail)
  const startKey = `absolute-verify-start:${email}`
  const verifyAttemptsKey = `absolute-verify-attempts:${email}`;

  const existing = await User.findOne({ email: email })

  if(existing && existing.isLocked) {
    const error = new Error('Hesabınız bloklanıb. Əlavə məlumat üçün dəsdəklə əlaqə saxlayın');
    error.statusCode = 404;
    throw error;
  }

  const data = await redis.get(startKey);
  if (!data) {
    const error = new Error('Təsdiqləmə kodunun vaxtı bitib və ya müraciət tapılmadı');
    error.statusCode = 400;
    throw error;
  }

  const verifyAttempts = await redis.incr(verifyAttemptsKey);
  if (verifyAttempts === 1) {
    await redis.expire(verifyAttemptsKey, 300);
  }

  if (verifyAttempts > 3) {
    // əvvəl burada səhvən `login-start` silinirdi
    await redis.del(startKey);
    await redis.del(verifyAttemptsKey);

    const error = new Error('Çox sayda yanlış kod daxil edildi. Xahiş olunur yenidən kod istəyin');
    error.statusCode = 429;
    throw error;
  }

  const absoluteLoginData = JSON.parse(data);

  if (String(otp) !== absoluteLoginData.otp) {
    const error = new Error('Təsdiqləmə kodu yanlışdır');
    error.statusCode = 400;
    throw error;
  }

  // Kodu ATOMİK şəkildə "istifadə edirik": eyni anda 2 sorğu gəlsə (double click),
  // yalnız birində del() 1 qaytarır, digəri dayandırılır. Əvvəl hər iki sorğu
  // keçib 2 istifadəçi yarada bilirdi.
  const consumed = await redis.del(startKey);
  if (consumed === 0) {
    const error = new Error('Bu kod artıq istifadə olunub');
    error.statusCode = 409;
    throw error;
  }
  await redis.del(verifyAttemptsKey);
  await redis.del(`absolute-verify-cooldown:${email}`);

  // Atomik upsert: varsa yenilə, yoxdursa yarat (findOne + create arasındakı race yoxdur)
  const upsert = () => User.findOneAndUpdate(
    { email: email },
    {
      $set: { ip: ip },
      $setOnInsert: { email: email, name: name || 'İstifadəçi', avatar: 'default' }
    },
    { upsert: true, returnDocument: 'after' }
  )

  let user
  try {
    user = await upsert()
  } catch (err) {
    // Unique index-ə görə paralel insert düşərsə, bir dəfə də yoxla
    if (err?.code === 11000) user = await upsert()
    else throw err
  }

  const token = await jwt.sign(
    {id: user._id, role: user.role},
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  return {
    success: true,
    message: existing ? 'Xoş gəldiniz' : 'Uğurlu qeydiyyat. Xoş gəldiniz',
    user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, isWarning: user.isWarning, giftPremiumCount: user.giftPremiumCount },
    userId: user._id,
    token
  };
}


const getMe = async (userId) => {
  return await User.findById(userId).select('_id name email avatar isWarning role giftPremiumCount')
}


export default {
  absoluteVerifyStart,
  absoluteVerifyEnd,

  getMe
}
