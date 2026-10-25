const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ============================
// Login (Staff + Students)
// ============================
exports.login = async (req, res) => {
  try {
    const { national_id, password } = req.body;

    if (!national_id || !password) {
      return res.status(400).json({ message: 'National ID and password are required' });
    }

    // Try staff first
    let user = null;
    let userType = null;

    const staffRes = await pool.query(
      `SELECT * FROM staff WHERE national_id = $1`,
      [national_id]
    );

    if (staffRes.rows.length > 0) {
      user = staffRes.rows[0];
      userType = 'staff';
    } else {
      const studentRes = await pool.query(
        `SELECT * FROM students WHERE national_id = $1`,
        [national_id]
      );

      if (studentRes.rows.length > 0) {
        user = studentRes.rows[0];
        userType = 'student';
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

// Student-specific checks
if (userType === 'student') {
  // ⚡ 1. لو الـ Head لسه موافقش، امنعه
  if (user.status === 'pending') {
    return res.status(403).json({ message: 'Your account is pending approval by the Head of Department.' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ message: `Account is ${user.status}` });
  }

  // ⚡ 2. أول تسجيل دخول: هنأكد الإيميل أوتوماتيك (عشان مفيش OTP)
  if (!user.is_verified) {
    await pool.query(`UPDATE students SET is_verified = TRUE WHERE id = $1`, [user.id]);
    user.is_verified = true; // تحديث القيمة في الذاكرة
  }

  // ⚡ 3. التعامل مع الـ Device Fingerprint (شروط الأمان)
  const { device_fingerprint } = req.body;
  
  if (device_fingerprint) {
    // نشوف هل الموبايل ده متسجل لطالب تاني؟
    const deviceOwner = await pool.query(
      `SELECT id, full_name FROM students WHERE device_fingerprint = $1 AND id != $2`,
      [device_fingerprint, user.id]
    );

    if (deviceOwner.rows.length > 0) {
      return res.status(403).json({
        message: '❌ This device is already registered to another student',
        bound_to: deviceOwner.rows[0].full_name
      });
    }

    // لو الموبايل جديد أو بتاعه، نحدث الـ Fingerprint بتاعه
    if (user.device_fingerprint !== device_fingerprint) {
      await pool.query(
        `UPDATE students SET device_fingerprint = $1 WHERE id = $2`,
        [device_fingerprint, user.id]
      );
    }
  }

  // ⚡ 4. نظام الـ Login Limit (3 مرات في اليوم)
  const today = new Date().toISOString().split('T')[0];
  const lastDate = user.last_login_date
    ? new Date(user.last_login_date).toISOString().split('T')[0]
    : null;

  let newLoginCount = 1;

  if (lastDate === today) {
    newLoginCount = (user.login_count_today || 0) + 1;
    if (newLoginCount > 3) {
      await pool.query(`UPDATE students SET status = 'banned' WHERE id = $1`, [user.id]);
      return res.status(403).json({
        message: '🚫 Too many login attempts today. Account banned.'
      });
    }
  }

  // تحديث عدد مرات الدخول
  await pool.query(
    `UPDATE students 
     SET login_count_today = $1, last_login_date = CURRENT_DATE
     WHERE id = $2`,
    [newLoginCount, user.id]
  );
}

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: userType === 'staff' ? user.role : 'student',
        type: userType
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: userType === 'staff' ? user.role : 'student'
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get current user (me)
// ============================
exports.me = async (req, res) => {
  try {
    const { id, type, role } = req.user;

    const table = type === 'staff' ? 'staff' : 'students';
    const result = await pool.query(
      `SELECT id, full_name, email, national_id FROM ${table} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ ...result.rows[0], role });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};