import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.MAIL_FROM
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Motoelan'

const otpEmailTemplate = (otp, purpose = 'qeydiyyat') => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background:#f9fafb; border-radius:12px;">
    <h2 style="color:#111827; margin-bottom:8px;">Təsdiq kodunuz</h2>
    <p style="color:#4b5563; font-size:14px;">${purpose === 'login' ? 'Girişi təsdiqləmək üçün aşağıdakı kodu daxil edin' : 'Qeydiyyatı tamamlamaq üçün aşağıdakı kodu daxil edin'}:</p>
    <div style="font-size:32px; font-weight:700; letter-spacing:6px; color:#111827; text-align:center; padding:16px 0;">
      ${otp}
    </div>
    <p style="color:#9ca3af; font-size:12px;">Bu kod 5 dəqiqə ərzində etibarlıdır. Əgər bu tələbi siz etməmisinizsə, bu emaili nəzərə almayın.</p>
  </div>
`

/**
 * OTP email göndərir
 * @param {string} to - alıcının emaili
 * @param {string} otp - 6 rəqəmli kod
 * @param {'register'|'login'} purpose
**/

const sendOtpEmail = async (to, otp, purpose = 'register') => {
  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject: purpose === 'login' ? 'Giriş təsdiq kodu' : 'Qeydiyyat təsdiq kodu',
    html: otpEmailTemplate(otp, purpose),
    text: `Təsdiq kodunuz: ${otp}\n\nBu kod 5 dəqiqə ərzində etibarlıdır. Əgər bu tələbi siz etməmisinizsə, bu emaili nəzərə almayın.`
  })

  if (error) {
    // Email göndərilməsə də, xətanı yuxarı ötürürük ki, controller uyğun cavab versin
    throw new Error('Email göndərilə bilmədi: ' + (error.message || JSON.stringify(error)))
  }

  return data
}

export {
  sendOtpEmail
}
