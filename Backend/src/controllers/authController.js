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
  if (!user.is_verified) {
    return res.status(403).json({ message: 'Email not verified' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({
      message: '🚫 Account banned. Contact your Head of Department.'
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: `Account is ${user.status}` });
  }

  // ⚠️ استخدم PostgreSQL للتحقق (بدل JS timezone)
  const loginCheckRes = await pool.query(
    `SELECT 
       last_login_date = CURRENT_DATE AS is_same_day,
       COALESCE(login_count_today, 0) AS current_count
     FROM students WHERE id = $1`,
    [user.id]
  );

  const { is_same_day, current_count } = loginCheckRes.rows[0];

  console.log('📊 Login Check:', {
    is_same_day,
    current_count
  });

  let newLoginCount = 1;

  if (is_same_day) {
    newLoginCount = parseInt(current_count) + 1;

    if (newLoginCount > 3) {
      await pool.query(
        `UPDATE students SET status = 'banned' WHERE id = $1`,
        [user.id]
      );
      return res.status(403).json({
        message: '🚫 Too many login attempts today. Account banned.',
        login_attempts: newLoginCount
      });
    }
  }

  const { device_fingerprint } = req.body;

  if (device_fingerprint) {
    const deviceOwner = await pool.query(
      `SELECT id, full_name FROM students 
       WHERE device_fingerprint = $1 AND id != $2`,
      [device_fingerprint, user.id]
    );

    if (deviceOwner.rows.length > 0) {
      return res.status(403).json({
        message: '❌ This device is registered to another student',
        bound_to: deviceOwner.rows[0].full_name
      });
    }

    await pool.query(
      `UPDATE students 
       SET device_fingerprint = $1, 
           login_count_today = $2, 
           last_login_date = CURRENT_DATE
       WHERE id = $3`,
      [device_fingerprint, newLoginCount, user.id]
    );
  } else {
    await pool.query(
      `UPDATE students 
       SET login_count_today = $1, 
           last_login_date = CURRENT_DATE
       WHERE id = $2`,
      [newLoginCount, user.id]
    );
  }

  console.log('✅ Login count updated to:', newLoginCount);
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