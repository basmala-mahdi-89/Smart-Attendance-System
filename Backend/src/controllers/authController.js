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
      if (user.status !== 'active') {
        return res.status(403).json({ message: `Account is ${user.status}` });
      }

      // One login per day
      const today = new Date().toISOString().split('T')[0];
      if (user.last_login_date && user.last_login_date.toISOString().split('T')[0] === today) {
        return res.status(403).json({ message: 'Already logged in today' });
      }

      await pool.query(
        `UPDATE students SET last_login_date = $1 WHERE id = $2`,
        [today, user.id]
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