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



// ============================
// Scan QR (Attendance)
// ============================
exports.scanQR = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { qr_token, device_fingerprint } = req.body;

    if (!qr_token) {
      return res.status(400).json({ message: 'qr_token is required' });
    }

    // ====== 1. Verify QR Token ======
    let decoded;
    try {
      decoded = jwt.verify(qr_token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ message: 'QR code expired. Scan the new one.' });
      }
      return res.status(400).json({ message: 'Invalid QR code' });
    }

    if (decoded.type !== 'attendance_qr') {
      return res.status(400).json({ message: 'Invalid QR type' });
    }

    const { session_id, course_id } = decoded;

    // ====== 2. Verify Session Active ======
    const sessionRes = await pool.query(
      `SELECT id, course_id, is_active FROM sessions WHERE id = $1`,
      [session_id]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!sessionRes.rows[0].is_active) {
      return res.status(400).json({ message: 'Session is closed' });
    }

    // ====== 3. Verify Student Active ======
    const studentRes = await pool.query(
      `SELECT id, status, device_fingerprint FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = studentRes.rows[0];

    if (student.status !== 'active') {
      return res.status(403).json({ message: `Account is ${student.status}` });
    }

    // ====== 4. Device Fingerprint Check ======
    if (device_fingerprint) {
      if (!student.device_fingerprint) {
        // First scan — bind device
        await pool.query(
          `UPDATE students SET device_fingerprint = $1 WHERE id = $2`,
          [device_fingerprint, studentId]
        );
      } else if (student.device_fingerprint !== device_fingerprint) {
        return res.status(403).json({
          message: 'Device mismatch. This account is bound to another device.'
        });
      }
    }

    // ====== 5. Verify Enrollment ======
    const enrollCheck = await pool.query(
      `SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2`,
      [studentId, course_id]
    );

    if (enrollCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You are not enrolled in this course' });
    }

    // ====== 6. Check Duplicate ======
    const dupCheck = await pool.query(
      `SELECT id, method, created_at FROM attendance 
       WHERE session_id = $1 AND student_id = $2`,
      [session_id, studentId]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        message: 'Attendance already recorded for this session',
        attendance: dupCheck.rows[0]
      });
    }

    // ====== 7. Record Attendance ======
    const result = await pool.query(
      `INSERT INTO attendance (session_id, student_id, method)
       VALUES ($1, $2, 'qr_scan')
       RETURNING *`,
      [session_id, studentId]
    );

    res.json({
      message: '✅ Attendance recorded successfully',
      attendance: result.rows[0]
    });
  } catch (err) {
    console.error('scanQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get My Personal QR (Offline fallback)
// ============================
exports.getMyPersonalQR = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Generate a signed token with student_id
    const personalToken = jwt.sign(
      {
        student_id: studentId,
        type: 'personal_qr'
      },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }  // صالح سنة
    );

    // Update personal_qr in DB (for doctor manual scan reference)
    await pool.query(
      `UPDATE students SET personal_qr = $1 WHERE id = $2`,
      [personalToken, studentId]
    );

    res.json({
      personal_qr: personalToken,
      message: 'Show this QR to your doctor if you have no internet'
    });
  } catch (err) {
    console.error('getMyPersonalQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get My Attendance History
// ============================
exports.getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `SELECT a.id, a.method, a.created_at,
              s.id AS session_id, s.session_date, s.start_time,
              c.id AS course_id, c.course_code, c.course_name
       FROM attendance a
       JOIN sessions s ON a.session_id = s.id
       JOIN courses c ON s.course_id = c.id
       WHERE a.student_id = $1
       ORDER BY a.created_at DESC`,
      [studentId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getMyAttendance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get My Courses (Enrolled)
// ============================
exports.getMyCourses = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year,
              m.name AS major_name,
              (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id) AS total_sessions,
              (SELECT COUNT(*) FROM attendance a 
               JOIN sessions s ON a.session_id = s.id 
               WHERE a.student_id = $1 AND s.course_id = c.id) AS attended_sessions
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN majors m ON c.major_id = m.id
       WHERE e.student_id = $1
       ORDER BY c.course_code`,
      [studentId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getMyCourses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get My Profile
// ============================
exports.getMyProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `SELECT s.id, s.national_id, s.full_name, s.email, s.phone, 
              s.academic_year, s.status, s.created_at,
              m.name AS major_name
       FROM students s
       LEFT JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('getMyProfile error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};