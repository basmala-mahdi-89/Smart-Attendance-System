const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const logDoctorAudit = async ({ actorId, action, targetType = null, targetId = null, details = null, ipAddress = null }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorId, 'doctor', action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (err) {
    console.error('logDoctorAudit error:', err.message);
  }
};

exports.scanStudentPersonalQR = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const { qr_data } = req.body;

    if (!qr_data) return res.status(400).json({ message: 'QR data is required' });

    let payload;
    try { payload = JSON.parse(qr_data); } catch (err) { return res.status(400).json({ message: 'Invalid QR format' }); }
    
    if (payload.type !== 'student_personal' || !payload.student_id || !payload.otp) {
      return res.status(400).json({ message: 'Invalid student QR' });
    }

    const sessCheck = await pool.query(`SELECT id, course_id, is_active FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (sessCheck.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (!sessCheck.rows[0].is_active) return res.status(400).json({ message: 'Session is not active' });
    const courseId = sessCheck.rows[0].course_id;

    const studentRes = await pool.query(`SELECT id, full_name, full_name_ar, status, totp_secret, national_id FROM students WHERE id = $1 OR id::text = $2`, [payload.student_id, payload.student_id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ message: 'Student not found' });
    const student = studentRes.rows[0];
    if (student.status !== 'active') return res.status(403).json({ message: `Student account is ${student.status}` });
    if (!student.totp_secret) return res.status(400).json({ message: 'Student has no Personal QR setup' });

    const verified = speakeasy.totp.verify({ secret: student.totp_secret, encoding: 'base32', token: payload.otp, window: 1 });
    if (!verified) return res.status(400).json({ message: 'Invalid or expired QR code. Ask student to refresh.' });

    const enrollCheck = await pool.query(`SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2`, [student.id, courseId]);
    if (enrollCheck.rows.length === 0) return res.status(403).json({ message: 'Student not enrolled in this course' });

    const dupCheck = await pool.query(`SELECT id FROM attendance WHERE session_id = $1 AND student_id = $2`, [session_id, student.id]);
    if (dupCheck.rows.length > 0) return res.status(400).json({ message: 'Student already marked present' });

    const result = await pool.query(`INSERT INTO attendance (session_id, student_id, method) VALUES ($1, $2, 'qr_scan') RETURNING *`, [session_id, student.id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session_id}`).emit('attendance-update', { 
        session_id: parseInt(session_id), 
        student_id: student.id, 
        full_name: student.full_name, 
        university_id: student.university_id || null,
        method: 'qr_scan', 
        attendance_id: result.rows[0].id,
        at: new Date().toISOString() 
      });
    }

    logDoctorAudit({
      actorId: doctorId,
      action: 'MARK_ATTENDANCE_REVERSE_QR',
      targetType: 'student',
      targetId: student.id,
      details: { session_id },
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ message: '✅ Attendance marked', student: { full_name: student.full_name, national_id: student.national_id } });
  } catch (err) {
    console.error('scanStudentPersonalQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDoctorStats = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const statsRes = await pool.query(
      `SELECT
         (SELECT COUNT(DISTINCT cs.course_id) FROM course_staff cs WHERE cs.staff_id = $1) AS total_courses,
         (SELECT COUNT(*) FROM sessions WHERE created_by = $1) AS total_sessions,
         (SELECT COUNT(*) FROM sessions WHERE created_by = $1 AND is_active = FALSE) AS completed_sessions,
         (SELECT COUNT(*) FROM sessions WHERE created_by = $1 AND is_active = TRUE) AS active_sessions,
         (SELECT COUNT(DISTINCT a.student_id) FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE s.created_by = $1) AS unique_students_attended`,
      [doctorId]
    );
    res.json(statsRes.rows[0]);
  } catch (err) {
    console.error('getDoctorStats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMySessions = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const result = await pool.query(
      `SELECT s.id, s.course_id, s.session_date, s.start_time, s.end_time, s.is_active, s.type,
              c.course_code, c.course_name, c.academic_year,
              (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS attendance_count,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = s.course_id) AS enrolled_count
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.created_by = $1
       ORDER BY s.start_time DESC
       LIMIT 50`,
      [doctorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getMySessions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSessionAttendanceList = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const check = await pool.query(`SELECT id, course_id FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Session not found' });

    const result = await pool.query(
      `SELECT a.id AS attendance_id, a.student_id, a.method, a.created_at,
              s.full_name, s.full_name_ar, s.national_id, s.university_id, s.email, s.academic_year
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.session_id = $1
       ORDER BY a.created_at ASC`,
      [session_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getSessionAttendanceList error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeAttendance = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id, attendance_id } = req.params;

    const check = await pool.query(`SELECT s.id FROM sessions s WHERE s.id = $1 AND s.created_by = $2 AND s.is_active = TRUE`, [session_id, doctorId]);
    if (check.rows.length === 0) return res.status(403).json({ message: 'Can only remove attendance from your active session' });

    const attRes = await pool.query(
      `SELECT a.id, a.student_id, st.full_name FROM attendance a JOIN students st ON a.student_id = st.id WHERE a.id = $1 AND a.session_id = $2`,
      [attendance_id, session_id]
    );
    if (attRes.rows.length === 0) return res.status(404).json({ message: 'Attendance record not found' });

    await pool.query(`DELETE FROM attendance WHERE id = $1`, [attendance_id]);

    logDoctorAudit({
      actorId: doctorId,
      action: 'REMOVE_ATTENDANCE',
      targetType: 'attendance',
      targetId: attendance_id,
      details: { session_id, student_id: attRes.rows[0].student_id, student_name: attRes.rows[0].full_name },
      ipAddress: req.ip
    }).catch(() => {});

    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session_id}`).emit('attendance-removed', { session_id: parseInt(session_id), attendance_id: parseInt(attendance_id), student_id: attRes.rows[0].student_id });
    }

    res.json({ message: 'Attendance removed successfully' });
  } catch (err) {
    console.error('removeAttendance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyCourses = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const result = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.major_id, c.academic_year, c.term, m.name AS major_name,
              cs.role_in_course, cs.is_primary,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id) AS total_sessions,
              (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id AND s.is_active = FALSE) AS completed_sessions,
              (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id AND s.is_active = TRUE) AS active_sessions,
              (SELECT COUNT(DISTINCT a.student_id) FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE s.course_id = c.id) AS unique_students_attended
       FROM course_staff cs
       JOIN courses c ON cs.course_id = c.id
       JOIN majors m ON c.major_id = m.id
       WHERE cs.staff_id = $1
       ORDER BY c.academic_year, c.course_code`,
      [doctorId]
    );
    const courses = result.rows;
    for (let i = 0; i < courses.length; i++) {
      const engRes = await pool.query(
        `SELECT s.full_name, s.full_name_ar FROM course_staff cs JOIN staff s ON cs.staff_id = s.id WHERE cs.course_id = $1 AND cs.role_in_course = 'engineer'`,
        [courses[i].id]
      );
      courses[i].engineers = engRes.rows.map(e => e.full_name);
    }
    
    let current_term = '1';
    if (courses.length > 0) {
      current_term = courses[0].term;
    } else {
       const majorRes = await pool.query(
        `SELECT DISTINCT m.current_term FROM course_staff cs
         JOIN courses c ON cs.course_id = c.id
         JOIN majors m ON c.major_id = m.id
         WHERE cs.staff_id = $1 LIMIT 1`, [doctorId]
       );
       if (majorRes.rows.length > 0) current_term = majorRes.rows[0].current_term;
    }
    
    res.json({ courses, current_term });
  } catch (err) {
    console.error('getMyCourses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.startSession = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const userRole = req.user.role;
    const { course_id } = req.body;
    
    if (!course_id) return res.status(400).json({ message: 'course_id is required' });

    const check = await pool.query(`SELECT id FROM course_staff WHERE staff_id = $1 AND course_id = $2`, [doctorId, course_id]);
    if (check.rows.length === 0) return res.status(403).json({ message: 'You are not assigned to this course' });

    const activeCheck = await pool.query(`SELECT id FROM sessions WHERE course_id = $1 AND is_active = TRUE`, [course_id]);
    if (activeCheck.rows.length > 0) return res.status(400).json({ message: 'Active session already exists', session_id: activeCheck.rows[0].id });

    const sessionType = userRole === 'engineer' ? 'section' : 'lecture';

    const result = await pool.query(
      `INSERT INTO sessions (course_id, created_by, session_date, start_time, is_active, type) 
       VALUES ($1, $2, CURRENT_DATE, NOW(), TRUE, $3) RETURNING *`,
      [course_id, doctorId, sessionType]
    );
    const newSessionId = result.rows[0].id;
    const courseInfo = await pool.query(`SELECT id, course_code, course_name FROM courses WHERE id = $1`, [course_id]);
    res.status(201).json({ message: 'Session started', session: { ...result.rows[0], course_code: courseInfo.rows[0]?.course_code, course_name: courseInfo.rows[0]?.course_name } });
  } catch (err) {
    console.error('startSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCurrentActiveSession = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const result = await pool.query(
      `SELECT s.*, c.course_code, c.course_name FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.created_by = $1 AND s.is_active = TRUE LIMIT 1`,
      [doctorId]
    );
    res.json({ session: result.rows.length > 0 ? result.rows[0] : null });
  } catch (err) {
    console.error('getCurrentActiveSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getActiveSession = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.course_code, c.course_name FROM sessions s JOIN courses c ON s.course_id = c.id
       WHERE s.course_id = $1 AND s.is_active = TRUE AND s.created_by = $2 ORDER BY s.start_time DESC LIMIT 1`,
      [req.params.course_id, req.user.id]
    );
    res.json({ session: result.rows.length > 0 ? result.rows[0] : null });
  } catch (err) {
    console.error('getActiveSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.generateQR = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const check = await pool.query(`SELECT id, course_id, is_active FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (!check.rows[0].is_active) return res.status(400).json({ message: 'Session is not active' });

    const qrToken = jwt.sign(
      { session_id: parseInt(session_id), course_id: check.rows[0].course_id, type: 'attendance_qr' },
      process.env.JWT_SECRET, { expiresIn: '1h' }
    );
    res.json({ token: qrToken, expires_at: new Date(Date.now() + 3600000).toISOString(), refresh_in: 5 });
  } catch (err) {
    console.error('generateQR error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSessionAttendance = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const check = await pool.query(`SELECT id, course_id FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Session not found' });

    const result = await pool.query(
      `SELECT a.id, a.student_id, a.method, a.created_at, s.full_name, s.full_name_ar, s.national_id, s.university_id, s.email, s.academic_year, m.name AS major_name
       FROM attendance a JOIN students s ON a.student_id = s.id LEFT JOIN majors m ON s.major_id = m.id WHERE a.session_id = $1 ORDER BY a.created_at DESC`,
      [session_id]
    );
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM enrollments WHERE course_id = $1`, [check.rows[0].course_id]);
    res.json({ total_enrolled: parseInt(countRes.rows[0].total), total_present: result.rows.length, attendance: result.rows });
  } catch (err) {
    console.error('getSessionAttendance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.endSession = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sessions SET is_active = FALSE, end_time = NOW() WHERE id = $1 AND created_by = $2 AND is_active = TRUE RETURNING *`,
      [req.params.session_id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Active session not found' });
    res.json({ message: 'Session ended', session: result.rows[0] });
  } catch (err) {
    console.error('endSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const sessCheck = await pool.query(`SELECT id, course_id FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (sessCheck.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    const result = await pool.query(`DELETE FROM sessions WHERE id = $1 RETURNING *`, [session_id]);
    res.json({ message: 'Session deleted', session: result.rows[0] });
  } catch (err) {
    console.error('deleteSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.manualScan = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const { personal_qr } = req.body;
    if (!personal_qr) return res.status(400).json({ message: 'personal_qr is required' });

    let payload;
    try { payload = JSON.parse(personal_qr); } catch (err) { return res.status(400).json({ message: 'Invalid QR format' }); }
    const { student_id, otp } = payload;
    if (!student_id || !otp) return res.status(400).json({ message: 'Invalid QR data' });

    const sessCheck = await pool.query(`SELECT id, course_id, is_active FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (sessCheck.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (!sessCheck.rows[0].is_active) return res.status(400).json({ message: 'Session is not active' });
    const courseId = sessCheck.rows[0].course_id;

    const studentRes = await pool.query(`SELECT id, full_name, full_name_ar, status, totp_secret, national_id FROM students WHERE id = $1`, [student_id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ message: 'Student not found' });
    const student = studentRes.rows[0];
    if (student.status !== 'active') return res.status(403).json({ message: `Student account is ${student.status}` });
    if (!student.totp_secret) return res.status(400).json({ message: 'Student has no personal QR setup' });

    const verified = speakeasy.totp.verify({ secret: student.totp_secret, encoding: 'base32', token: otp, window: 1 });
    if (!verified) return res.status(400).json({ message: '❌ Expired or invalid Personal QR.' });

    const enrollCheck = await pool.query(`SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2`, [student.id, courseId]);
    if (enrollCheck.rows.length === 0) return res.status(403).json({ message: 'Student not enrolled in this course' });

    const dupCheck = await pool.query(`SELECT id FROM attendance WHERE session_id = $1 AND student_id = $2`, [session_id, student.id]);
    if (dupCheck.rows.length > 0) return res.status(400).json({ message: '❌ Student already marked present' });

    const result = await pool.query(`INSERT INTO attendance (session_id, student_id, method) VALUES ($1, $2, 'manual') RETURNING *`, [session_id, student.id]);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session_id}`).emit('attendance-update', { 
        session_id: parseInt(session_id), 
        student_id: student.id, 
        full_name: student.full_name, 
        university_id: student.university_id || null,
        method: 'manual', 
        attendance_id: result.rows[0].id,
        at: new Date().toISOString() 
      });
    }

    res.json({ message: '✅ Attendance recorded (manual)', attendance: { ...result.rows[0], full_name: student.full_name, national_id: student.national_id } });
  } catch (err) {
    console.error('manualScan error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.manualAdd = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;
    const { short_id } = req.body;

    if (!short_id || short_id.length !== 5) {
      return res.status(400).json({ message: 'Please enter exactly the last 5 digits of the National ID' });
    }

    const sessCheck = await pool.query(`SELECT id, course_id, is_active FROM sessions WHERE id = $1 AND created_by = $2`, [session_id, doctorId]);
    if (sessCheck.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (!sessCheck.rows[0].is_active) return res.status(400).json({ message: 'Session is not active' });
    const courseId = sessCheck.rows[0].course_id;

    const studentRes = await pool.query(
      `SELECT s.id, s.full_name, s.status FROM students s
       JOIN enrollments e ON s.id = e.student_id
       WHERE RIGHT(s.national_id, 5) = $1 AND e.course_id = $2`,
      [short_id, courseId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: 'No student enrolled in this course ends with these 5 digits' });
    }
    if (studentRes.rows.length > 1) {
      return res.status(400).json({ message: 'Multiple students found with these digits. Contact Admin.' });
    }

    const student = studentRes.rows[0];
    if (student.status !== 'active') return res.status(403).json({ message: `Student account is ${student.status}` });

    const dupCheck = await pool.query(`SELECT id FROM attendance WHERE session_id = $1 AND student_id = $2`, [session_id, student.id]);
    if (dupCheck.rows.length > 0) return res.status(400).json({ message: 'Student already marked present' });

    const result = await pool.query(`INSERT INTO attendance (session_id, student_id, method) VALUES ($1, $2, 'manual') RETURNING *`, [session_id, student.id]);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session_id}`).emit('attendance-update', { 
        session_id: parseInt(session_id), 
        student_id: student.id, 
        full_name: student.full_name, 
        university_id: student.university_id || null,
        method: 'manual', 
        attendance_id: result.rows[0].id,
        at: new Date().toISOString() 
      });
    }

    res.json({ message: '✅ Attendance added manually', attendance: { ...result.rows[0], full_name: student.full_name } });
  } catch (err) {
    console.error('manualAdd error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};