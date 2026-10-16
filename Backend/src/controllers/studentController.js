const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ============================
// Email transporter
// ============================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ============================
// Register Student
// ============================
exports.register = async (req, res) => {
  try {
    const {
      national_id,
      full_name,
      email,
      phone,
      academic_year,
      major_id,
      password
    } = req.body;

    // Validate
    if (!national_id || !full_name || !email || !phone || !academic_year || !major_id || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (national_id.length !== 14) {
      return res.status(400).json({ message: 'National ID must be 14 digits' });
    }

    if (!['1', '2', '3', '4'].includes(academic_year)) {
      return res.status(400).json({ message: 'Academic year must be 1, 2, 3, or 4' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check duplicate
    const dup = await pool.query(
      `SELECT id FROM students WHERE national_id = $1 OR email = $2`,
      [national_id, email]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ message: 'National ID or Email already exists' });
    }

    // Check major exists
    const majorRes = await pool.query(`SELECT id FROM majors WHERE id = $1`, [major_id]);
    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Major not found' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // Insert student
    const result = await pool.query(
      `INSERT INTO students 
       (national_id, full_name, email, phone, academic_year, major_id, password_hash, personal_qr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, full_name, email, status`,
      [
        national_id,
        full_name,
        email,
        phone,
        academic_year,
        major_id,
        password_hash,
        verifyToken
      ]
    );

    // Send verification email (TEST MODE — print to console)
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verifyToken}`;
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('📧 STUDENT VERIFICATION EMAIL (TEST)');
    console.log('════════════════════════════════════════');
    console.log('   To:  ', email);
    console.log('   Name:', full_name);
    console.log('   🔗 Verify URL:');
    console.log('   ' + verifyUrl);
    console.log('════════════════════════════════════════');

    res.status(201).json({
      message: 'Registration successful. Check your email for verification.',
      student: result.rows[0],
      verifyToken // ⚠️ للتطوير فقط — شيلها في الإنتاج
    });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Verify Email
// ============================
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `UPDATE students SET is_verified = TRUE, personal_qr = NULL
       WHERE personal_qr = $1 AND is_verified = FALSE
       RETURNING id, full_name, email`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or already used token' });
    }

    // Send OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await pool.query(
      `UPDATE students SET otp_code = $1, otp_expiry = $2 WHERE id = $3`,
      [otp, otpExpiry, result.rows[0].id]
    );

    // Print OTP in console (TEST MODE)
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('📱 OTP CODE (TEST MODE)');
    console.log('════════════════════════════════════════');
    console.log('   Email:', result.rows[0].email);
    console.log('   Name: ', result.rows[0].full_name);
    console.log('   🔑 OTP: ' + otp);
    console.log('════════════════════════════════════════');

    res.json({
      message: 'Email verified. OTP sent to your email.',
      student_id: result.rows[0].id
    });
  } catch (err) {
    console.error('verifyEmail error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Verify OTP
// ============================
exports.verifyOTP = async (req, res) => {
  try {
    const { national_id, otp } = req.body;

    if (!national_id || !otp) {
      return res.status(400).json({ message: 'National ID and OTP are required' });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, otp_code, otp_expiry, status
       FROM students WHERE national_id = $1`,
      [national_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = result.rows[0];

    if (student.otp_code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date(student.otp_expiry) < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Clear OTP + set status pending (waiting for Head approval)
    await pool.query(
      `UPDATE students SET otp_code = NULL, otp_expiry = NULL, status = 'pending'
       WHERE id = $1`,
      [student.id]
    );

    res.json({
      message: 'OTP verified. Your account is pending approval by Head of Department.'
    });
  } catch (err) {
    console.error('verifyOTP error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};