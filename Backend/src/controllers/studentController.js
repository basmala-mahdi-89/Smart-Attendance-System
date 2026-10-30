const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const { validateEgyptianNationalID } = require('../utils/validators');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.register = async (req, res) => {
  try {
    const { national_id, full_name, email, phone, academic_year, major_id, password } = req.body;

    if (!national_id || !full_name || !email || !phone || !academic_year || !major_id || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!validateEgyptianNationalID(national_id)) {
      return res.status(400).json({ message: 'Invalid Egyptian National ID. Please check the number.' });
    }
    if (!['1', '2', '3', '4'].includes(academic_year)) {
      return res.status(400).json({ message: 'Academic year must be 1, 2, 3, or 4' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const dup = await pool.query(`SELECT id FROM students WHERE national_id = $1 OR email = $2`, [national_id, email]);
    if (dup.rows.length > 0) return res.status(400).json({ message: 'National ID or Email already exists' });

    const majorRes = await pool.query(`SELECT id FROM majors WHERE id = $1`, [major_id]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'Major not found' });

    const password_hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO students (national_id, full_name, email, phone, academic_year, major_id, password_hash, personal_qr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, full_name, email, status`,
      [national_id, full_name, email, phone, academic_year, major_id, password_hash, verifyToken]
    );

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verifyToken}`;
    console.log('════════════════════════════════════════');
    console.log('📧 STUDENT VERIFICATION EMAIL (TEST)');
    console.log('   To: ', email);
    console.log('   🔗 Verify URL:', verifyUrl);
    console.log('════════════════════════════════════════');

    res.status(201).json({ message: 'Registration successful. Check your email for verification.', student: result.rows[0], verifyToken });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `UPDATE students SET is_verified = TRUE, personal_qr = NULL WHERE personal_qr = $1 AND is_verified = FALSE RETURNING id, full_name, email`,
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'Invalid or already used token' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(`UPDATE students SET otp_code = $1, otp_expiry = $2 WHERE id = $3`, [otp, otpExpiry, result.rows[0].id]);

    console.log('════════════════════════════════════════');
    console.log('📱 OTP CODE (TEST MODE)');
    console.log('   Email:', result.rows[0].email);
    console.log('   🔑 OTP:', otp);
    console.log('════════════════════════════════════════');

    res.json({ message: 'Email verified. OTP sent to your email.', student_id: result.rows[0].id });
  } catch (err) {
    console.error('verifyEmail error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { national_id, otp } = req.body;
    if (!national_id || !otp) return res.status(400).json({ message: 'National ID and OTP are required' });

    const result = await pool.query(`SELECT id, otp_code, otp_expiry FROM students WHERE national_id = $1`, [national_id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Student not found' });

    const student = result.rows[0];
    if (student.otp_code !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (new Date(student.otp_expiry) < new Date()) return res.status(400).json({ message: 'OTP expired' });

    await pool.query(`UPDATE students SET otp_code = NULL, otp_expiry = NULL, status = 'pending' WHERE id = $1`, [student.id]);
    res.json({ message: 'OTP verified. Your account is pending approval by Head of Department.' });
  } catch (err) {
    console.error('verifyOTP error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.scanQR = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { qr_token, device_fingerprint } = req.body;
    if (!qr_token) return res.status(400).json({ message: 'QR token is required' });

    let decoded;
    try {
      decoded = jwt.verify(qr_token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired QR code' });
    }

    // ⚡ التحقق من نوع الكيو آر (لازم يطابق اللي الدكتور بيبعته)
    if (decoded.type !== 'attendance_qr') {
      return res.status(400).json({ message: 'Invalid QR code type. Please scan the Session QR.' });
    }

    const { session_id, course_id } = decoded;

    const sessionRes = await pool.query(`SELECT id, course_id, is_active FROM sessions WHERE id = $1`, [session_id]);
    if (sessionRes.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (!sessionRes.rows[0].is_active) return res.status(400).json({ message: 'Session is closed' });

    const studentRes = await pool.query(`SELECT id, full_name, status, device_fingerprint FROM students WHERE id = $1`, [studentId]);
    const student = studentRes.rows[0];
    if (student.status !== 'active') return res.status(403).json({ message: `Account is ${student.status}` });

    // ⚡ التحقق من بصمة الجهاز
    if (device_fingerprint && student.device_fingerprint) {
      if (student.device_fingerprint !== device_fingerprint) {
        return res.status(403).json({ message: '❌ Wrong device. Login from your registered device.' });
      }
    } else if (device_fingerprint && !student.device_fingerprint) {
      await pool.query(`UPDATE students SET device_fingerprint = $1 WHERE id = $2`, [device_fingerprint, studentId]);
    }

    const enrollCheck = await pool.query(`SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2`, [studentId, course_id]);
    if (enrollCheck.rows.length === 0) return res.status(403).json({ message: 'You are not enrolled in this course' });

    const dupCheck = await pool.query(`SELECT id, method FROM attendance WHERE session_id = $1 AND student_id = $2`, [session_id, studentId]);
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ message: '❌ You already marked present for this session' });
    }

    // ⚡ استخدام qr_scan عشان يطابق الداتابيز
    const result = await pool.query(`INSERT INTO attendance (session_id, student_id, method) VALUES ($1, $2, 'qr_scan') RETURNING *`, [session_id, studentId]);

    // ⚡ إرسال التحديث للدكتور
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session_id}`).emit('attendance-update', {
        session_id: parseInt(session_id),
        student_id: studentId,
        full_name: student.full_name,
        method: 'qr_scan',
        at: new Date().toISOString()
      });
    }

    res.json({ message: '✅ Attendance marked successfully', attendance: result.rows[0] });
  } catch (err) {
    console.error('scanQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyPersonalQR = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentRes = await pool.query(`SELECT totp_secret FROM students WHERE id = $1`, [studentId]);
    
    let secret = studentRes.rows[0].totp_secret;

    if (!secret) {
      const newSecret = speakeasy.generateSecret({ length: 20 });
      secret = newSecret.base32;
      await pool.query(`UPDATE students SET totp_secret = $1 WHERE id = $2`, [secret, studentId]);
    }

    res.json({ totp_secret: secret, message: 'Use this secret to generate offline OTP' });
  } catch (err) {
    console.error('getMyPersonalQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.method, a.created_at, s.id AS session_id, s.session_date, c.course_code, c.course_name
       FROM attendance a JOIN sessions s ON a.session_id = s.id JOIN courses c ON s.course_id = c.id
       WHERE a.student_id = $1 ORDER BY a.created_at DESC`, [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getMyAttendance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    const result = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year, c.term, m.name AS major_name,
              (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id) AS total_sessions,
              (SELECT COUNT(*) FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.student_id = $1 AND s.course_id = c.id) AS attended_sessions
       FROM enrollments e 
       JOIN courses c ON e.course_id = c.id 
       JOIN majors m ON c.major_id = m.id
       WHERE e.student_id = $1 AND c.term = m.current_term
       ORDER BY c.course_code`, [studentId]
    );
    
    // ⚡ بنجيب الترم الحالي من تخصص الطالب مباشرة
    const majorRes = await pool.query(
      `SELECT m.current_term FROM students s JOIN majors m ON s.major_id = m.id WHERE s.id = $1`,
      [studentId]
    );
    const current_term = majorRes.rows[0]?.current_term || '1';
    
    res.json({ courses: result.rows, current_term });
  } catch (err) {
    console.error('getMyCourses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.national_id, s.full_name, s.email, s.phone, s.academic_year, s.status, s.created_at, m.name AS major_name
       FROM students s LEFT JOIN majors m ON s.major_id = m.id WHERE s.id = $1`, [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getMyProfile error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};