const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

// ── Middleware ──────────────────────────
app.use(cors({
  // Allow both localhost dev AND your Render frontend URL
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://nexusauth-frontend.onrender.com',
      process.env.CLIENT_URL
    ].filter(Boolean); // removes undefined

    // Allow requests with no origin (Postman, mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────
app.use('/api/auth', authRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 NexusAuth API is running!', 
    status: 'OK',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// ── MongoDB Connection ───────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅ Configured (' + process.env.EMAIL_USER + ')' : '❌ NOT configured'}`);
      console.log(`📱 Phone OTP: ${process.env.USE_FAKE_OTP === 'true' ? 'FAKE mode (check console)' : 'REAL Twilio'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
