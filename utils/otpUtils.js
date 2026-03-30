const nodemailer = require('nodemailer');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Email using Nodemailer
const sendEmailOTP = async (email, otp) => {
  try {
    // Verify required env vars are present
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('EMAIL_USER or EMAIL_PASS is not set in environment variables');
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.EMAIL_USER,
        // Remove ALL spaces from app password (Gmail app passwords have spaces when copied)
        pass: process.env.EMAIL_PASS.replace(/\s/g, '')
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection before sending
    await transporter.verify();
    console.log('✅ SMTP connection verified');

    const mailOptions = {
      from: `"NexusAuth 🚀" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your NexusAuth Verification Code',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #6c63ff, #3ecfcf); padding: 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 32px; letter-spacing: 2px;">NEXUS<span style="color: #0a0a1a;">AUTH</span></h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Secure Authentication System</p>
          </div>
          <div style="padding: 40px; text-align: center;">
            <h2 style="color: #6c63ff; margin-bottom: 8px;">Email Verification</h2>
            <p style="color: #aaa; margin-bottom: 32px;">
              Use the code below to verify your email address. 
              It expires in <strong style="color: #3ecfcf;">5 minutes</strong>.
            </p>
            <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); border: 2px solid #6c63ff; border-radius: 12px; padding: 24px; display: inline-block;">
              <p style="margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #6c63ff; font-family: monospace;">
                ${otp}
              </p>
            </div>
            <p style="color: #555; margin-top: 32px; font-size: 12px;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP Email sent successfully to:', email, '| MessageID:', info.messageId);

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    // Re-throw so the route handler can return a proper 500 error
    throw error;
  }
};

// Send OTP via Phone (Twilio or Fake)
const sendPhoneOTP = async (phone, otp) => {
  if (process.env.USE_FAKE_OTP === 'true') {
    console.log(`\n📱 FAKE SMS OTP for ${phone}: ${otp}\n`);
    return { fake: true, otp };
  }

  const twilio = require('twilio');
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    body: `🔐 Your NexusAuth verification code is: ${otp}. Valid for 5 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone
  });
};

module.exports = { generateOTP, sendEmailOTP, sendPhoneOTP };
