import { redis } from "../../config/redis.config.js";
import { User } from "../../models/user/user.model.js";
import { sendOtpEmail } from "../email/sendMail.service.js";
import jwt from 'jsonwebtoken'

const registerStart = async (email, name) => {
  // 1. İstifadəçi mövcudluğunu yoxlayırıq
  const user = await User.findOne({ email });
  if (user) {
    const error = new Error('İstifadəçi hesabı mövcuddur');
    error.statusCode = 409; // 409 Conflict
    throw error;
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));

  // 2. Cəhd sayını (Rate limit) yoxlayırıq
  const attemptsKey = await redis.get(`register-attempts:${email}`);
  let attempts = 0;

  if (attemptsKey) {
    const parsedAttempts = JSON.parse(attemptsKey);
    attempts = parsedAttempts.failCount;
  }

  if (attempts >= 5) {
    const error = new Error('Çox sayda cəhd edildi. xahiş olunur 5 dəqiqə sonra yenidən sınayın');
    error.statusCode = 429; // 429 Too Many Requests
    throw error;
  }

  try {
    // 3. Email göndəririk
    await sendOtpEmail(email, otp, 'register');

    // 4. Redis-ə data yazırıq (5 dəqiqəlik)
    await redis.set(
      `register-start:${email}`,
      JSON.stringify({ otp, email, name }),
      { EX: 300 }
    );

    // 5. Cəhd sayını yeniləyirik
    await redis.set(
      `register-attempts:${email}`,
      JSON.stringify({ failCount: attempts + 1 }),
      { EX: 300 }
    );

    return {
      success: true,
      message: 'Kod göndərildi',
    };
  } catch (mailErr) {
    console.error('OTP email xətası:', mailErr.message);
    const error = new Error('Kod göndərilmədi, bir az sonra yenidən cəhd edin');
    error.statusCode = 500;
    throw error;
  }
};

const registerVerify = async (email, otp, ip) => {
  const user = await User.findOne({ email });
  if (user) {
    const error = new Error('İstifadəçi hesabı mövcuddur');
    error.statusCode = 409;
    throw error;
  }

  // 1. Redis-dən OTP və istifadəçi datasını çəkirik
  const data = await redis.get(`register-start:${email}`);

  if (!data) {
    const error = new Error('Təsdiqləmə kodunun vaxtı bitib və ya müraciət tapılmadı');
    error.statusCode = 400;
    throw error;
  }

  // 2. Brute-force qarşısını almaq üçün doğrulama cəhdlərini yoxlayırıq
  const verifyAttemptsKey = `register-verify-attempts:${email}`;
  const verifyAttempts = await redis.incr(verifyAttemptsKey);

  // Əgər ilk cəhddirsə, açara 5 dəqiqəlik (300san) ömür veririk
  if (verifyAttempts === 1) {
    await redis.expire(verifyAttemptsKey, 300);
  }

  // Əgər istifadəçi 3 dəfə yanlış OTP yazarsa, təhlükəsizlik üçün sessiyanı ləğv edirik
  if (verifyAttempts > 3) {
    await redis.del(`register-start:${email}`);
    await redis.del(verifyAttemptsKey);

    const error = new Error('Çox sayda yanlış kod daxil edildi. Xahiş olunur yenidən kod istəyin');
    error.statusCode = 429; // Too Many Requests / Limit Exceeded
    throw error;
  }

  const registerData = JSON.parse(data);

  // 3. OTP Kodunu yoxlayırıq
  if (otp !== registerData.otp) {
    const remainingAttempts = 3 - verifyAttempts;
    const error = new Error(`Təsdiqləmə kodu yanlışdır. Qalan cəhd sayısı: ${remainingAttempts}`);
    error.statusCode = 400;
    throw error;
  }

  // 4. Uğurlu Hal: İstifadəçi yaradılır və bütün Redis key-ləri silinir
  const newUser = await User.create({
    name: registerData.name,
    avatar: 'default',
    email: email,
    ip: ip,
  });

  const token = await jwt.sign(
    {id: newUser._id, role: newUser.role},
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  // Uğurlu olduqdan sonra bütün keçici məlumatları təmizləyirik
  await redis.del(`register-start:${email}`);
  await redis.del(`register-attempts:${email}`);
  await redis.del(verifyAttemptsKey);

  return {
    success: true,
    message: 'Uğurlu qeydiyyat. Xoş gəldiniz',
    data: newUser,
    token: token
  };
};


const loginStart = async (email) => {
  const user = await User.findOne({ email: email })
  if(!user) {
    const error = new Error('İstifadəçi hesabı tapilmadi');
    error.statusCode = 404; // 409 Conflict
    throw error;
  }

  if(user.isLocked) {
    const error = new Error('Hesabınız bloklanıb. Əlavə məlumat üçün dəsdəklə əlaqə saxlayın');
    error.statusCode = 404; // 409 Conflict
    throw error;
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));

  const attemptsKey = await redis.get(`login-attempts:${email}`)
  let attempts = 0

  if(attemptsKey) {
    const parsedAttempts = JSON.parse(attemptsKey)
    attempts = parsedAttempts.failCount
  }

  if (attempts >= 5) {
    const error = new Error('Çox sayda cəhd edildi. xahiş olunur 5 dəqiqə sonra yenidən sınayın');
    error.statusCode = 429; // 429 Too Many Requests
    throw error;
  }

  try{
    
    await sendOtpEmail(email, otp, 'login')

    await redis.set(
      `login-start:${email}`,
      JSON.stringify({ email: email, otp }),
      { EX: 300 }
    )

    await redis.set(
      `login-attempts:${email}`,
      JSON.stringify({ failCount: attempts + 1 }),
      { EX: 300 }
    )

    return {
      success: true,
      message: 'Kod göndərildi'
    }

  } catch (mailErr) {
    console.error('OTP email xətası:', mailErr.message);
    const error = new Error('Kod göndərilmədi, bir az sonra yenidən cəhd edin');
    error.statusCode = 500;
    throw error;
  }
}


const loginVerify = async (email, otp, ip) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('İstifadəçi hesabı movcud deyil');
    error.statusCode = 404;
    throw error;
  }

  if(user.isLocked) {
    const error = new Error('Hesabınız bloklanıb. Əlavə məlumat üçün dəsdəklə əlaqə saxlayın');
    error.statusCode = 404; // 409 Conflict
    throw error;
  }

  // 1. Redis-dən datanı çəkirik
  const data = await redis.get(`login-start:${email}`);

  // 2. Vaxtı bitibsə və ya mövcud deyilsə:
  if (!data) {
    const error = new Error('Təsdiqləmə kodunun vaxtı bitib və ya müraciət tapılmadı');
    error.statusCode = 400;
    throw error;
  }

  // 2. Brute-force qarşısını almaq üçün doğrulama cəhdlərini yoxlayırıq
  const verifyAttemptsKey = `login-verify-attempts:${email}`;
  const verifyAttempts = await redis.incr(verifyAttemptsKey);

  // Əgər ilk cəhddirsə, açara 5 dəqiqəlik (300san) ömür veririk
  if (verifyAttempts === 1) {
    await redis.expire(verifyAttemptsKey, 300);
  }

  // Əgər istifadəçi 3 dəfə yanlış OTP yazarsa, təhlükəsizlik üçün sessiyanı ləğv edirik
  if (verifyAttempts > 3) {
    await redis.del(`login-start:${email}`);
    await redis.del(verifyAttemptsKey);

    const error = new Error('Çox sayda yanlış kod daxil edildi. Xahiş olunur yenidən kod istəyin');
    error.statusCode = 429; // Too Many Requests / Limit Exceeded
    throw error;
  }

  const loginData = JSON.parse(data);

  // 3. OTP Kodunu yoxlayırıq
  if (otp !== loginData.otp) {
    const error = new Error('Təsdiqləmə kodu yanlışdır');
    error.statusCode = 400;
    throw error;
  }

  // 4. Uğurludur: İstifadəçi yenileyirik və Redis təmizlənir
  const updatedUser = await User.updateOne({ email: email }, {
    ip: ip,
  });

  const token = await jwt.sign(
    {id: user._id, role: user.role},
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  // Məlumatları təmizləyirik
  await redis.del(`login-start:${email}`);
  await redis.del(`login-attempts:${email}`);
  await redis.del(verifyAttemptsKey);

  return {
    success: true,
    message: 'Uğurlu qeydiyyat. Xoş gəldiniz',
    data: user,
    token: token
  };
};


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
  registerStart,
  registerVerify,

  loginStart,
  loginVerify,

  absoluteVerifyStart,
  absoluteVerifyEnd,

  getMe
}
