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
    {id: newUser._id, role: newUser.role, token: token},
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


const absoluteVerifyStart = async (email) => {
  const user = await User.findOne({ email: email })
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  if(user && user.isLocked) {
    const error = new Error('Hesabınız bloklanıb. Əlavə məlumat üçün dəsdəklə əlaqə saxlayın');
    error.statusCode = 404; // 409 Conflict
    throw error;
  }

  try {
    // 3. Email göndəririk
    await sendOtpEmail(email, otp, user ? 'Login' : 'Register');

    // 4. Redis-ə data yazırıq (5 dəqiqəlik)
    await redis.set(
      `absolute-verify-start:${email}`,
      JSON.stringify({ otp, email }),
      { EX: 300 }
    );

    return {
      success: true,
      isOldUser: user ? true : false,
      message: 'Kod göndərildi'
    };
  } catch (mailErr) {
    console.error('OTP email xətası:', mailErr.message);
    const error = new Error('Kod göndərilmədi, bir az sonra yenidən cəhd edin');
    error.statusCode = 500;
    throw error;
  }
}

const absoluteVerifyEnd = async (email, name, otp, ip) => {
  const user = await User.findOne({ email: email })

  if(user && user.isLocked) {
    const error = new Error('Hesabınız bloklanıb. Əlavə məlumat üçün dəsdəklə əlaqə saxlayın');
    error.statusCode = 404; // 409 Conflict
    throw error;
  }

  // 1. Redis-dən datanı çəkirik
  const data = await redis.get(`absolute-verify-start:${email}`);

  // 2. Vaxtı bitibsə və ya mövcud deyilsə:
  if (!data) {
    const error = new Error('Təsdiqləmə kodunun vaxtı bitib və ya müraciət tapılmadı');
    error.statusCode = 400;
    throw error;
  }

  // 2. Brute-force qarşısını almaq üçün doğrulama cəhdlərini yoxlayırıq
  const verifyAttemptsKey = `absolute-verify-attempts:${email}`;
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

  const absoluteLoginData = JSON.parse(data);

  console.log(`userin gonderdiyi: ${otp}, redisde olan: ${absoluteLoginData.otp}`)

  // 3. OTP Kodunu yoxlayırıq
  if (otp !== absoluteLoginData.otp) {
    const error = new Error('Təsdiqləmə kodu yanlışdır');
    error.statusCode = 400;
    throw error;
  }

  // 4. Uğurludur: İstifadəçi yenileyirik və Redis təmizlənir

  let newUser

  if(user) {
    newUser = await User.findOneAndUpdate({ email: email }, {
      ip: ip,
    });
  }else {
    newUser = await User.create({
      name: name,
      avatar: 'default',
      email: email,
      ip: ip,
    });
  }

  const token = await jwt.sign(
    {id: newUser._id, role: newUser.role},
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  // Məlumatları təmizləyirik
  await redis.del(`absolute-verify-start:${email}`);
  await redis.del(`absolute-verify-attempts:${email}`);
  await redis.del(verifyAttemptsKey);

  return {
    success: true,
    message: 'Uğurlu qeydiyyat. Xoş gəldiniz',
    user: { _id: newUser._id, name: newUser.name, email: newUser.email, avatar: newUser.avatar, role: newUser.role, isWarning: newUser.isWarning },
    userId: newUser._id,
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
