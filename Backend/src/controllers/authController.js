const crypto = require('crypto');

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail } = require('../utils/emailService');

// ============================
// Request password reset (public)
// Sends an email with a one-time link if the account exists.
// Never reveals whether an account exists.
// ============================
exports.forgotPassword = async (req, res) => {
  try {
    const { national_id, email } = req.body;

    if (!national_id && !email) {
      return res
        .status(400)
        .json({ message: 'Provide either National ID or email to reset your password' });
    }

    let user = null;
    let userType = null;

    // Try staff first, then students
    if (national_id) {
      const staffRes = await pool.query(`SELECT id, email, full_name FROM staff WHERE national_id = $1`, [national_id]);
      if (staffRes.rows.length > 0) {
        user = staffRes.rows[0];
        userType = 'staff';
      } else {
        const studentRes = await pool.query(`SELECT id, email, full_name FROM students WHERE national_id = $1`, [national_id]);
        if (studentRes.rows.length > 0) {
          user = studentRes.rows[0];
          userType = 'student';
        }
      }
    }

    if (!user && email) {
      const staffRes = await pool.query(`SELECT id, email, full_name FROM staff WHERE LOWER(email) = LOWER($1)`, [email]);
      if (staffRes.rows.length > 0) {
        user = staffRes.rows[0];
        userType = 'staff';
      } else {
        const studentRes = await pool.query(`SELECT id, email, full_name FROM students WHERE LOWER(email) = LOWER($1)`, [email]);
        if (studentRes.rows.length > 0) {
          user = studentRes.rows[0];
          userType = 'student';
        }
      }
    }

    // Always return the same message to avoid user enumeration
    if (!user || !user.email) {
      return res.json({
        message: 'If an account matches those details, a password reset email has been sent.'
      });
    }

    // Invalidate any existing unused tokens for this user
    await pool.query(`DELETE FROM password_resets WHERE user_type = $1 AND user_id = $2 AND used_at IS NULL`, [userType, user.id]);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_resets (user_type, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [userType, user.id, tokenHash, expiresAt]
    );

    const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

    // Dev convenience only: make the link visible in server logs when email is not configured.
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔗 Password reset link (dev):', resetUrl);
    }

    try {
      await sendPasswordResetEmail(user.email, user.full_name, resetUrl);
    } catch (err) {
      console.error('forgotPassword email error:', err.message);
    }

    return res.json({
      message: 'If an account matches those details, a password reset email has been sent.'
    });
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Validate reset token (public)
// ============================
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ valid: false });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT id, expires_at, used_at FROM password_resets WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) return res.status(400).json({ valid: false });
    const row = result.rows[0];
    if (row.used_at) return res.status(400).json({ valid: false });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ valid: false });

    return res.json({ valid: true });
  } catch (err) {
    console.error('validateResetToken error:', err.message);
    return res.status(500).json({ valid: false });
  }
};

// ============================
// Reset password (public)
// ============================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRes = await pool.query(
      `SELECT id, user_type, user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );

    if (resetRes.rows.length === 0) return res.status(400).json({ message: 'Invalid or expired reset link' });
    const reset = resetRes.rows[0];
    if (reset.used_at) return res.status(400).json({ message: 'This reset link has already been used' });
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ message: 'This reset link has expired' });

    const password_hash = await bcrypt.hash(password, 10);
    const table = reset.user_type === 'staff' ? 'staff' : 'students';
    await pool.query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [password_hash, reset.user_id]);
    await pool.query(`UPDATE password_resets SET used_at = NOW() WHERE id = $1`, [reset.id]);
    await pool.query(`DELETE FROM password_resets WHERE user_type = $1 AND user_id = $2 AND used_at IS NULL`, [reset.user_type, reset.user_id]);

    return res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    console.error('resetPassword error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};


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
      `SELECT s.*, m.name AS major_name
         FROM staff s
         LEFT JOIN majors m ON m.id = s.major_id
        WHERE s.national_id = $1`,
      [national_id]
    );

    if (staffRes.rows.length > 0) {
      user = staffRes.rows[0];
      userType = 'staff';
    } else {
      const studentRes = await pool.query(
        `SELECT s.*, m.name AS major_name
           FROM students s
           LEFT JOIN majors m ON m.id = s.major_id
          WHERE s.national_id = $1`,
        [national_id]
      );

      if (studentRes.rows.length > 0) {
        user = studentRes.rows[0];
        userType = 'student';
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid National ID' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Password' });
    }

    if (userType === 'staff') {
      if (user.status === 'banned') {
        return res.status(403).json({ message: '🚫 Your account has been blocked by the Dean.' });
      }
    }

    // Student-specific checks
    if (userType === 'student') {
      if (user.status === 'pending') {
        return res.status(403).json({ message: 'Your account is pending approval by the Head of Department.' });
      }
      if (user.status === 'banned') {
        return res.status(403).json({ message: '🚫 Account banned. Contact your Head of Department.' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ message: `Account is ${user.status}` });
      }

      if (!user.is_verified) {
        await pool.query(`UPDATE students SET is_verified = TRUE WHERE id = $1`, [user.id]);
      }

      // ⚡ Device Fingerprint — save on first login, update when logging in from a new device
      const { device_fingerprint } = req.body;
      if (device_fingerprint) {
        await pool.query(
          `UPDATE students SET device_fingerprint = $1 WHERE id = $2`,
          [device_fingerprint, user.id]
        );
      }

      // Login limit removed
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

    const profile = {
      id: user.id,
      full_name: user.full_name,
      full_name_ar: user.full_name_ar || null,
      email: user.email,
      role: userType === 'staff' ? user.role : 'student',
      type: userType,
      national_id: user.national_id,
      major_id: user.major_id || null,
      major_name: user.major_name || null,
      status: userType === 'staff' ? 'active' : user.status,
      created_at: user.created_at || null,
    };

    if (userType === 'student') {
      profile.academic_year = user.academic_year || null;
      profile.phone = user.phone || null;
      profile.is_verified = !!user.is_verified;
    }

    res.json({
      message: 'Login successful',
      token,
      user: profile
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Public list of majors (used by student registration)
// ============================
exports.getPublicMajors = async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM majors ORDER BY name ASC`);
    // Never cache: the dean may add, rename or delete a major at any time.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ majors: result.rows });
  } catch (err) {
    console.error('Public majors error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get current user (me)
// ============================
exports.me = async (req, res) => {
  try {
    const { id, type, role } = req.user;

    let result;
    if (type === 'staff') {
      result = await pool.query(
        `SELECT s.id, s.full_name, s.full_name_ar, s.email, s.national_id, s.major_id, s.created_at,
                m.name AS major_name
           FROM staff s
           LEFT JOIN majors m ON m.id = s.major_id
          WHERE s.id = $1`,
        [id]
      );
    } else {
      result = await pool.query(
        `SELECT s.id, s.full_name, s.full_name_ar, s.email, s.national_id, s.phone, s.academic_year,
                s.major_id, s.status, s.is_verified, s.created_at,
                m.name AS major_name
           FROM students s
           LEFT JOIN majors m ON m.id = s.major_id
          WHERE s.id = $1`,
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = { ...result.rows[0], role, type };
    if (type === 'staff') profile.status = 'active';

    res.json(profile);
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};