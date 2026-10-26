const pool = require('../config/db');

// ============================
// DOCTOR/ENGINEER: Course Report
// ============================
exports.doctorCourseReport = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;

    const check = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year, m.name AS major_name
       FROM courses c
       JOIN course_staff cs ON cs.course_id = c.id
       JOIN majors m ON c.major_id = m.id
       WHERE c.id = $1 AND cs.staff_id = $2`,
      [course_id, doctorId]
    );

    if (check.rows.length === 0) return res.status(403).json({ message: 'Access denied' });
    const course = check.rows[0];

    const sessionsRes = await pool.query(
      `SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1 AND is_active = FALSE`, [course_id]
    );
    const totalSessions = parseInt(sessionsRes.rows[0].total);

    const studentsRes = await pool.query(
      `SELECT s.id AS student_id, s.full_name, s.national_id, COUNT(DISTINCT a.session_id) AS attended
       FROM enrollments e JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id IN (SELECT id FROM sessions WHERE course_id = $1 AND is_active = FALSE)
       WHERE e.course_id = $1 GROUP BY s.id, s.full_name, s.national_id ORDER BY s.full_name`, [course_id]
    );

    const students = studentsRes.rows.map(s => {
      const attended = parseInt(s.attended);
      const absent = totalSessions - attended;
      const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
      return { ...s, attended, absent: absent < 0 ? 0 : absent, percentage, total_sessions: totalSessions };
    });

    res.json({ course, total_sessions: totalSessions, total_students: students.length, students });
  } catch (err) {
    console.error('doctorCourseReport error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.exportCourseCSV = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;

    const check = await pool.query(
      `SELECT c.course_code FROM courses c JOIN course_staff cs ON cs.course_id = c.id WHERE c.id = $1 AND cs.staff_id = $2`,
      [course_id, doctorId]
    );
    if (check.rows.length === 0) return res.status(403).json({ message: 'Access denied' });
    const courseCode = check.rows[0].course_code;

    const sessionsRes = await pool.query(`SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1 AND is_active = FALSE`, [course_id]);
    const totalSessions = parseInt(sessionsRes.rows[0].total);

    const studentsRes = await pool.query(
      `SELECT s.full_name, s.national_id, COUNT(DISTINCT a.session_id) AS attended
       FROM enrollments e JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id IN (SELECT id FROM sessions WHERE course_id = $1 AND is_active = FALSE)
       WHERE e.course_id = $1 GROUP BY s.id, s.full_name, s.national_id ORDER BY s.full_name`, [course_id]
    );

    let csv = 'Student Name,National ID,Sessions Held,Attended,Absent,Percentage\n';
    studentsRes.rows.forEach(s => {
      const attended = parseInt(s.attended);
      const absent = totalSessions - attended;
      const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) + '%' : '0%';
      csv += `"${s.full_name}","${s.national_id}",${totalSessions},${attended},${absent},${percentage}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${courseCode}_Report.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('exportCourseCSV error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// HEAD: Major Overview
// ============================
exports.headMajorOverview = async (req, res) => {
  try {
    const headId = req.user.id;
    const majorRes = await pool.query(`SELECT id, name FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    const major = majorRes.rows[0];

    const counts = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE major_id = $1) AS total_students,
        (SELECT COUNT(*) FROM students WHERE major_id = $1 AND status = 'active') AS active_students,
        (SELECT COUNT(*) FROM courses WHERE major_id = $1) AS total_courses,
        (SELECT COUNT(*) FROM sessions s JOIN courses c ON s.course_id = c.id WHERE c.major_id = $1) AS total_sessions,
        (SELECT COUNT(*) FROM attendance a JOIN sessions s ON a.session_id = s.id JOIN courses c ON s.course_id = c.id WHERE c.major_id = $1) AS total_attendance`,
      [major.id]
    );

    const coursesRes = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS students
       FROM courses c WHERE c.major_id = $1 ORDER BY c.academic_year, c.course_code`, [major.id]
    );

    res.json({ major, stats: counts.rows[0], courses: coursesRes.rows });
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
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM sessions) AS total_sessions,
        (SELECT COUNT(*) FROM attendance) AS total_attendance`
    );

    const majorsRes = await pool.query(
      `SELECT m.id, m.name,
         (SELECT COUNT(*) FROM students WHERE major_id = m.id) AS students,
         (SELECT COUNT(*) FROM courses WHERE major_id = m.id) AS courses
       FROM majors m ORDER BY m.name`
    );

    res.json({ stats: counts.rows[0], majors: majorsRes.rows });
  } catch (err) {
    console.error('deanOverview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};