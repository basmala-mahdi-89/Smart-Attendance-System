const pool = require('../config/db');
const jwt = require('jsonwebtoken');

// ============================
// Get Doctor's Courses
// ============================
exports.getMyCourses = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const result = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.major_id, c.academic_year,
              m.name AS major_name,
              cs.role_in_course, cs.is_primary,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count
       FROM course_staff cs
       JOIN courses c ON cs.course_id = c.id
       JOIN majors m ON c.major_id = m.id
       WHERE cs.staff_id = $1
       ORDER BY c.academic_year, c.course_code`,
      [doctorId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getMyCourses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Start Session (create)
// ============================
exports.startSession = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ message: 'course_id is required' });
    }

    // Verify doctor is on this course
    const check = await pool.query(
      `SELECT id FROM course_staff WHERE staff_id = $1 AND course_id = $2`,
      [doctorId, course_id]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    // Check if there's already an active session for this course
    const activeCheck = await pool.query(
      `SELECT id FROM sessions WHERE course_id = $1 AND is_active = TRUE`,
      [course_id]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({
        message: 'Active session already exists for this course',
        session_id: activeCheck.rows[0].id
      });
    }

    // Create session
    const result = await pool.query(
      `INSERT INTO sessions (course_id, created_by, session_date, start_time, is_active)
       VALUES ($1, $2, CURRENT_DATE, NOW(), TRUE)
       RETURNING *`,
      [course_id, doctorId]
    );

    res.status(201).json({
      message: 'Session started',
      session: result.rows[0]
    });
  } catch (err) {
    console.error('startSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Active Session for Course
// ============================
exports.getActiveSession = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;

    const result = await pool.query(
      `SELECT s.*, c.course_code, c.course_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.course_id = $1 AND s.is_active = TRUE AND s.created_by = $2
       ORDER BY s.start_time DESC LIMIT 1`,
      [course_id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.json({ session: null });
    }

    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error('getActiveSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Generate Dynamic QR Token
// ⚠️ Token expires in 15 seconds (يُجدد كل 5-10 ثواني من الفرونت)
// ============================
exports.generateQR = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;

    // Verify session belongs to doctor and is active
    const check = await pool.query(
      `SELECT id, course_id, is_active FROM sessions
       WHERE id = $1 AND created_by = $2`,
      [session_id, doctorId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!check.rows[0].is_active) {
      return res.status(400).json({ message: 'Session is not active' });
    }

    // Generate short-lived JWT for QR
    const qrToken = jwt.sign(
      {
        session_id: parseInt(session_id),
        course_id: check.rows[0].course_id,
        type: 'attendance_qr'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15s' }  // ⚠️ expires in 15 seconds
    );

    const expiresAt = new Date(Date.now() + 15 * 1000).toISOString();

    res.json({
      token: qrToken,
      expires_at: expiresAt,
      refresh_in: 5  // seconds (الفرونت يجدد كل 5 ثواني)
    });
  } catch (err) {
    console.error('generateQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Live Attendance for Session
// ============================
exports.getSessionAttendance = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;

    // Verify session belongs to doctor
    const check = await pool.query(
      `SELECT id, course_id FROM sessions WHERE id = $1 AND created_by = $2`,
      [session_id, doctorId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get attendance records
    const result = await pool.query(
      `SELECT a.id, a.student_id, a.method, a.created_at,
              s.full_name, s.national_id, s.email, s.academic_year
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.session_id = $1
       ORDER BY a.created_at DESC`,
      [session_id]
    );

    // Get total enrolled students
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM enrollments WHERE course_id = $1`,
      [check.rows[0].course_id]
    );

    res.json({
      total_enrolled: parseInt(countRes.rows[0].total),
      total_present: result.rows.length,
      attendance: result.rows
    });
  } catch (err) {
    console.error('getSessionAttendance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// End Session
// ============================
exports.endSession = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;

    const result = await pool.query(
      `UPDATE sessions
       SET is_active = FALSE, end_time = NOW()
       WHERE id = $1 AND created_by = $2 AND is_active = TRUE
       RETURNING *`,
      [session_id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    res.json({ message: 'Session ended', session: result.rows[0] });
  } catch (err) {
    console.error('endSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Manual Scan (Student Personal QR) — Offline fallback
// ============================
exports.manualScan = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const { student_national_id } = req.body;

    if (!student_national_id) {
      return res.status(400).json({ message: 'student_national_id is required' });
    }

    // Verify session
    const sessCheck = await pool.query(
      `SELECT id, course_id, is_active FROM sessions
       WHERE id = $1 AND created_by = $2`,
      [session_id, doctorId]
    );

    if (sessCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!sessCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Session is not active' });
    }

    const courseId = sessCheck.rows[0].course_id;

    // Find student
    const studentRes = await pool.query(
      `SELECT s.id, s.full_name, s.status FROM students s
       WHERE s.national_id = $1`,
      [student_national_id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = studentRes.rows[0];

    if (student.status !== 'active') {
      return res.status(403).json({ message: `Student account is ${student.status}` });
    }

    // Check enrolled
    const enrollCheck = await pool.query(
      `SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2`,
      [student.id, courseId]
    );

    if (enrollCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Student not enrolled in this course' });
    }

    // Check duplicate
    const dupCheck = await pool.query(
      `SELECT id FROM attendance WHERE session_id = $1 AND student_id = $2`,
      [session_id, student.id]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Already marked present' });
    }

    // Insert attendance
    const result = await pool.query(
      `INSERT INTO attendance (session_id, student_id, method)
       VALUES ($1, $2, 'manual')
       RETURNING *`,
      [session_id, student.id]
    );

    res.json({
      message: 'Attendance recorded (manual)',
      attendance: {
        ...result.rows[0],
        full_name: student.full_name
      }
    });
  } catch (err) {
    console.error('manualScan error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};