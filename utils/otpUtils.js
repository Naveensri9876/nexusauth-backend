// ============================================================
// otpUtils.js — Uses Resend API (works on Render free tier)
// Render BLOCKS smtp ports 465/587, so nodemailer won't work.
// Resend uses HTTPS port 443 which is always open.
// ============================================================

const https = require('https');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email via Resend API (HTTPS - works on Render free tier)
const sendEmailOTP = async (email, otp) => {
  return new Promise((resolve, reject) => {
    if (!process.env.RESEND_API_KEY) {
      return reject(new Error('RESEND_API_KEY is not set in environment variables'));
    }

    const emailHTML = `
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
    `;

    const payload = JSON.stringify({
      from: 'NexusAuth <onboarding@resend.dev>',
      to: [email],
      subject: '🔐 Your NexusAuth Verification Code',
      html: emailHTML
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ OTP Email sent via Resend to:', email, '| ID:', parsed.id);
            resolve(parsed);
          } else {
            console.error('❌ Resend API error:', parsed);
            reject(new Error(parsed.message || 'Resend API error: ' + res.statusCode));
          }
        } catch (e) {
          reject(new Error('Failed to parse Resend response: ' + data));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Resend request failed:', err.message);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
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
