const pool = require('../config/db');

// ============================
// Utility: Convert to CSV
// ============================
function toCSV(rows, columns) {
  if (!rows || rows.length === 0) return '';
  
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(row => 
    columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = '';
      if (typeof val === 'string') val = val.replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  ).join('\n');
  
  return `${header}\n${body}`;
}

// ============================
// DOCTOR: Course Report
// ============================
exports.doctorCourseReport = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;

    // Verify doctor on this course
    const check = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year,
              m.name AS major_name
       FROM courses c
       JOIN course_staff cs ON cs.course_id = c.id
       JOIN majors m ON c.major_id = m.id
       WHERE c.id = $1 AND cs.staff_id = $2`,
      [course_id, doctorId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Course not assigned to you' });
    }

    const course = check.rows[0];

    // Total sessions
    const sessionsRes = await pool.query(
      `SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1`,
      [course_id]
    );
    const totalSessions = parseInt(sessionsRes.rows[0].total);

    // Enrolled students + attendance count
    const studentsRes = await pool.query(
      `SELECT 
         s.id AS student_id,
         s.full_name,
         s.national_id,
         s.email,
         COUNT(DISTINCT a.session_id) AS attended,
         COUNT(DISTINCT CASE WHEN a.method = 'qr_scan' THEN a.session_id END) AS qr_scans,
         COUNT(DISTINCT CASE WHEN a.method = 'manual' THEN a.session_id END) AS manual_scans
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id IN (
         SELECT id FROM sessions WHERE course_id = $1
       )
       WHERE e.course_id = $1
       GROUP BY s.id, s.full_name, s.national_id, s.email
       ORDER BY s.full_name`,
      [course_id]
    );

    const students = studentsRes.rows.map(s => ({
      ...s,
      attended: parseInt(s.attended),
      qr_scans: parseInt(s.qr_scans),
      manual_scans: parseInt(s.manual_scans),
      total_sessions: totalSessions,
      percentage: totalSessions > 0 
        ? Math.round((parseInt(s.attended) / totalSessions) * 100) 
        : 0
    }));

    res.json({
      course,
      total_sessions: totalSessions,
      total_students: students.length,
      students
    });
  } catch (err) {
    console.error('doctorCourseReport error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// DOCTOR: Session Report
// ============================
exports.doctorSessionReport = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { session_id } = req.params;

    const sessRes = await pool.query(
      `SELECT s.*, c.course_code, c.course_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.id = $1 AND s.created_by = $2`,
      [session_id, doctorId]
    );

    if (sessRes.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessRes.rows[0];

    // Present
    const presentRes = await pool.query(
      `SELECT s.id, s.full_name, s.national_id, s.email,
              a.method, a.created_at
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.session_id = $1
       ORDER BY a.created_at`,
      [session_id]
    );

    // Absent
    const absentRes = await pool.query(
      `SELECT s.id, s.full_name, s.national_id, s.email
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       WHERE e.course_id = $1
       AND s.id NOT IN (
         SELECT student_id FROM attendance WHERE session_id = $2
       )
       ORDER BY s.full_name`,
      [session.course_id, session_id]
    );

    res.json({
      session: {
        id: session.id,
        course_code: session.course_code,
        course_name: session.course_name,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        is_active: session.is_active
      },
      total_enrolled: presentRes.rows.length + absentRes.rows.length,
      total_present: presentRes.rows.length,
      total_absent: absentRes.rows.length,
      present: presentRes.rows,
      absent: absentRes.rows
    });
  } catch (err) {
    console.error('doctorSessionReport error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// HEAD: Course Report
// ============================
exports.headCourseReport = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_id } = req.params;

    // Verify course in head's major
    const check = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year,
              m.name AS major_name
       FROM courses c
       JOIN majors m ON c.major_id = m.id
       WHERE c.id = $1 AND m.head_staff_id = $2`,
      [course_id, headId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Course not in your major' });
    }

    const course = check.rows[0];

    const sessionsRes = await pool.query(
      `SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1`,
      [course_id]
    );
    const totalSessions = parseInt(sessionsRes.rows[0].total);

    const studentsRes = await pool.query(
      `SELECT 
         s.id AS student_id,
         s.full_name,
         s.national_id,
         s.email,
         COUNT(DISTINCT a.session_id) AS attended
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id IN (
         SELECT id FROM sessions WHERE course_id = $1
       )
       WHERE e.course_id = $1
       GROUP BY s.id, s.full_name, s.national_id, s.email
       ORDER BY s.full_name`,
      [course_id]
    );

    const students = studentsRes.rows.map(s => ({
      ...s,
      attended: parseInt(s.attended),
      total_sessions: totalSessions,
      percentage: totalSessions > 0 
        ? Math.round((parseInt(s.attended) / totalSessions) * 100) 
        : 0
    }));

    res.json({
      course,
      total_sessions: totalSessions,
      total_students: students.length,
      students
    });
  } catch (err) {
    console.error('headCourseReport error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// HEAD: Major Overview
// ============================
exports.headMajorOverview = async (req, res) => {
  try {
    const headId = req.user.id;

    const majorRes = await pool.query(
      `SELECT id, name FROM majors WHERE head_staff_id = $1`,
      [headId]
    );

    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'No major assigned to you' });
    }

    const major = majorRes.rows[0];

    // Counts
    const counts = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE major_id = $1) AS total_students,
        (SELECT COUNT(*) FROM students WHERE major_id = $1 AND status = 'active') AS active_students,
        (SELECT COUNT(*) FROM students WHERE major_id = $1 AND status = 'pending') AS pending_students,
        (SELECT COUNT(*) FROM courses WHERE major_id = $1) AS total_courses,
        (SELECT COUNT(*) FROM sessions s 
         JOIN courses c ON s.course_id = c.id 
         WHERE c.major_id = $1) AS total_sessions,
        (SELECT COUNT(*) FROM attendance a
         JOIN sessions s ON a.session_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE c.major_id = $1) AS total_attendance`,
      [major.id]
    );

    // Courses breakdown
    const coursesRes = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS students,
              (SELECT COUNT(*) FROM sessions WHERE course_id = c.id) AS sessions
       FROM courses c
       WHERE c.major_id = $1
       ORDER BY c.academic_year, c.course_code`,
      [major.id]
    );

    res.json({
      major,
      stats: counts.rows[0],
      courses: coursesRes.rows
    });
  } catch (err) {
    console.error('headMajorOverview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// DEAN: Overview
// ============================
exports.deanOverview = async (req, res) => {
  try {
    const counts = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM majors) AS total_majors,
        (SELECT COUNT(*) FROM staff WHERE role = 'head') AS total_heads,
        (SELECT COUNT(*) FROM staff WHERE role = 'doctor') AS total_doctors,
        (SELECT COUNT(*) FROM staff WHERE role = 'engineer') AS total_engineers,
        (SELECT COUNT(*) FROM students) AS total_students,
        (SELECT COUNT(*) FROM students WHERE status = 'active') AS active_students,
        (SELECT COUNT(*) FROM students WHERE status = 'pending') AS pending_students,
        (SELECT COUNT(*) FROM students WHERE status = 'banned') AS banned_students,
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM sessions) AS total_sessions,
        (SELECT COUNT(*) FROM attendance) AS total_attendance`
    );

    // Per-major stats
    const majorsRes = await pool.query(
      `SELECT 
         m.id, m.name,
         (SELECT COUNT(*) FROM students WHERE major_id = m.id) AS students,
         (SELECT COUNT(*) FROM courses WHERE major_id = m.id) AS courses,
         (SELECT COUNT(*) FROM attendance a
          JOIN sessions s ON a.session_id = s.id
          JOIN courses c ON s.course_id = c.id
          WHERE c.major_id = m.id) AS total_attendance
       FROM majors m
       ORDER BY m.name`
    );

    res.json({
      stats: counts.rows[0],
      majors: majorsRes.rows
    });
  } catch (err) {
    console.error('deanOverview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// EXPORT: Course Report CSV
// ============================
exports.exportCourseCSV = async (req, res) => {
  try {
    const { course_id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Verify access
    if (userRole === 'doctor' || userRole === 'engineer') {
      const check = await pool.query(
        `SELECT id FROM course_staff WHERE course_id = $1 AND staff_id = $2`,
        [course_id, userId]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (userRole === 'head') {
      const check = await pool.query(
        `SELECT c.id FROM courses c
         JOIN majors m ON c.major_id = m.id
         WHERE c.id = $1 AND m.head_staff_id = $2`,
        [course_id, userId]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Get course info
    const courseRes = await pool.query(
      `SELECT course_code, course_name FROM courses WHERE id = $1`,
      [course_id]
    );

    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const course = courseRes.rows[0];

    // Sessions count
    const sessRes = await pool.query(
      `SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1`,
      [course_id]
    );
    const totalSessions = parseInt(sessRes.rows[0].total);

    // Students report
    const studentsRes = await pool.query(
      `SELECT 
         s.national_id,
         s.full_name,
         s.email,
         COUNT(DISTINCT a.session_id) AS attended,
         COUNT(DISTINCT CASE WHEN a.method = 'qr_scan' THEN a.session_id END) AS qr_scans,
         COUNT(DISTINCT CASE WHEN a.method = 'manual' THEN a.session_id END) AS manual_scans
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id IN (
         SELECT id FROM sessions WHERE course_id = $1
       )
       WHERE e.course_id = $1
       GROUP BY s.id, s.national_id, s.full_name, s.email
       ORDER BY s.full_name`,
      [course_id]
    );

    const rows = studentsRes.rows.map(s => ({
      national_id: s.national_id,
      full_name: s.full_name,
      email: s.email,
      attended: s.attended,
      total_sessions: totalSessions,
      percentage: totalSessions > 0 
        ? Math.round((s.attended / totalSessions) * 100) + '%'
        : '0%',
      qr_scans: s.qr_scans,
      manual_scans: s.manual_scans
    }));

    const csv = toCSV(rows, [
      { key: 'national_id', label: 'National ID' },
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'attended', label: 'Attended' },
      { key: 'total_sessions', label: 'Total Sessions' },
      { key: 'percentage', label: 'Percentage' },
      { key: 'qr_scans', label: 'QR Scans' },
      { key: 'manual_scans', label: 'Manual Scans' }
    ]);

    const filename = `${course.course_code}_report.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('exportCourseCSV error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// DEAN: Export Overview CSV
// ============================
exports.exportDeanOverviewCSV = async (req, res) => {
  try {
    const majorsRes = await pool.query(
      `SELECT 
         m.name AS major_name,
         (SELECT COUNT(*) FROM students WHERE major_id = m.id) AS students,
         (SELECT COUNT(*) FROM courses WHERE major_id = m.id) AS courses,
         (SELECT COUNT(*) FROM staff WHERE role = 'doctor' AND major_id = m.id) AS doctors,
         (SELECT COUNT(*) FROM staff WHERE role = 'engineer' AND major_id = m.id) AS engineers,
         (SELECT COUNT(*) FROM attendance a
          JOIN sessions s ON a.session_id = s.id
          JOIN courses c ON s.course_id = c.id
          WHERE c.major_id = m.id) AS total_attendance
       FROM majors m
       ORDER BY m.name`
    );

    const csv = toCSV(majorsRes.rows, [
      { key: 'major_name', label: 'Major' },
      { key: 'students', label: 'Students' },
      { key: 'courses', label: 'Courses' },
      { key: 'doctors', label: 'Doctors' },
      { key: 'engineers', label: 'Engineers' },
      { key: 'total_attendance', label: 'Total Attendance' }
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dean_overview.csv"');
    res.send(csv);
  } catch (err) {
    console.error('exportDeanOverviewCSV error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};