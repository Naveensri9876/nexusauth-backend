const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { generateOTP, sendEmailOTP, sendPhoneOTP } = require('../utils/otpUtils');
const { protect } = require('../middleware/authMiddleware');

// Helper: generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ─────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password, confirmPassword, firstName, lastName } = req.body;

    // Validation
    if (!username || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check duplicates
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone }]
    });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ message: 'Email already registered' });
      if (existingUser.username === username) return res.status(400).json({ message: 'Username already taken' });
      if (existingUser.phone === phone) return res.status(400).json({ message: 'Phone number already registered' });
    }

    const user = await User.create({
      username,
      email,
      phone,
      password,
      firstName: firstName || '',
      lastName: lastName || ''
    });

    res.status(201).json({
      message: 'Account created successfully! Please login.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/login (Username + Password)
// ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please enter username and password' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid username or password' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid username or password' });

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/send-email-otp
// ─────────────────────────────────────────
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    // Delete old OTPs for this email
    await OTP.deleteMany({ identifier: email, type: 'email' });

    const otp = generateOTP();

    await OTP.create({
      identifier: email,
      otp,
      type: 'email',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    await sendEmailOTP(email, otp);

    res.json({ message: 'OTP sent to your email! Check your inbox.' });
  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Check email config.', error: error.message });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/verify-email-otp
// ─────────────────────────────────────────
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const otpDoc = await OTP.findOne({
      identifier: email,
      type: 'email',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) return res.status(400).json({ message: 'OTP expired or invalid. Please request a new one.' });
    if (otpDoc.otp !== otp) return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });

    // Mark used
    otpDoc.used = true;
    await otpDoc.save();

    const user = await User.findOne({ email });
    const token = generateToken(user._id);

    res.json({
      message: 'Email verified! Login successful.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/send-phone-otp
// ─────────────────────────────────────────
router.post('/send-phone-otp', async (req, res) => {
  try {
    const { identifier } = req.body; // email or phone
    if (!identifier) return res.status(400).json({ message: 'Email or phone is required' });

    // Find user by email OR phone
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });
    if (!user) return res.status(404).json({ message: 'No account found with this email/phone' });

    // Delete old OTPs
    await OTP.deleteMany({ identifier: user.phone, type: 'phone' });

    const otp = generateOTP();

    await OTP.create({
      identifier: user.phone,
      otp,
      type: 'phone',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    const result = await sendPhoneOTP(user.phone, otp);

    // If fake OTP mode, return OTP in response for testing
    if (result && result.fake) {
      return res.json({
        message: `OTP sent! (DEMO MODE - Check server console for OTP)`,
        demoOtp: otp, // Only in dev mode
        phone: user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
      });
    }

    res.json({
      message: `OTP sent to ${user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`,
      phone: user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
    });
  } catch (error) {
    console.error('Send phone OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/verify-phone-otp
// ─────────────────────────────────────────
router.post('/verify-phone-otp', async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) return res.status(400).json({ message: 'Identifier and OTP are required' });

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otpDoc = await OTP.findOne({
      identifier: user.phone,
      type: 'phone',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) return res.status(400).json({ message: 'OTP expired or invalid. Request a new one.' });
    if (otpDoc.otp !== otp) return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });

    otpDoc.used = true;
    await otpDoc.save();

    const token = generateToken(user._id);

    res.json({
      message: 'Phone verified! Login successful.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Verify phone OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────
// GET /api/auth/me (Protected)
// ─────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
