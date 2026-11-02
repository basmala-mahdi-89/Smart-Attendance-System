const pool = require('../config/db');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
const { sendApprovalEmail } = require('../utils/emailService');

// ============================
// 1. Get All Staff
// ============================
exports.getStaff = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, national_id, role 
       FROM staff 
       WHERE role IN ('doctor', 'engineer', 'head')
       ORDER BY role, full_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getStaff error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 2. Get Major Info (including current term)
// ============================
exports.getMajorInfo = async (req, res) => {
  try {
    const headId = req.user.id;
    const result = await pool.query(
      `SELECT id, name, current_term FROM majors WHERE head_staff_id = $1`,
      [headId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getMajorInfo error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 3. Update Current Term
// ============================
exports.updateCurrentTerm = async (req, res) => {
  try {
    const headId = req.user.id;
    const { term } = req.body;
    
    if (!['1', '2'].includes(term)) return res.status(400).json({ message: 'Invalid term' });

    const result = await pool.query(
      `UPDATE majors SET current_term = $1 WHERE head_staff_id = $2 RETURNING current_term`,
      [term, headId]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Major not found' });

    res.json({ message: 'Current term updated successfully', current_term: result.rows[0].current_term });
  } catch (err) {
    console.error('updateCurrentTerm error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 4. Get Courses
// ============================
exports.getCourses = async (req, res) => {
  try {
    const headId = req.user.id;
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    const majorId = majorRes.rows[0].id;

    const result = await pool.query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS students
       FROM courses c
       WHERE c.major_id = $1
       ORDER BY c.academic_year, c.term, c.course_code`,
      [majorId]
    );

    const courses = result.rows;

    for (let i = 0; i < courses.length; i++) {
      const staffRes = await pool.query(
        `SELECT cs.id AS assignment_id, s.id AS staff_id, s.full_name, s.full_name_ar, s.role,
                cs.role_in_course, cs.is_primary
         FROM course_staff cs
         JOIN staff s ON cs.staff_id = s.id
         WHERE cs.course_id = $1
         ORDER BY cs.role_in_course, s.full_name`,
        [courses[i].id]
      );
      courses[i].staff = staffRes.rows;
    }

    res.json(courses);
  } catch (err) {
    console.error('getCourses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 5. Create Course
// ============================
exports.createCourse = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_code, course_name, academic_year, term } = req.body;
    if (!course_code || !course_name || !academic_year) return res.status(400).json({ message: 'All fields are required' });
    
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    const majorId = majorRes.rows[0].id;

    const result = await pool.query(
      `INSERT INTO courses (course_code, course_name, major_id, academic_year, term)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [course_code, course_name, majorId, academic_year, term || '1']
    );
    res.status(201).json({ message: 'Course created', course: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Course already exists' });
    console.error('createCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 6. Update Course
// ============================
exports.updateCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    const { course_code, course_name, academic_year, term } = req.body;
    
    const result = await pool.query(
      `UPDATE courses SET course_code = $1, course_name = $2, academic_year = $3, term = $4 WHERE id = $5 RETURNING *`,
      [course_code, course_name, academic_year, term || '1', course_id]
    );
    res.json({ message: 'Course updated', course: result.rows[0] });
  } catch (err) {
    console.error('updateCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 7. Delete Course
// ============================
exports.deleteCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    await pool.query(`DELETE FROM courses WHERE id = $1`, [course_id]);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    console.error('deleteCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 8. Assign Staff to Course
// ============================
exports.assignStaffToCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    const { staff_id, role_in_course, is_primary } = req.body;

    if (is_primary) {
      await pool.query(`UPDATE course_staff SET is_primary = FALSE WHERE course_id = $1`, [course_id]);
    }

    const result = await pool.query(
      `INSERT INTO course_staff (course_id, staff_id, role_in_course, is_primary)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [course_id, staff_id, role_in_course, is_primary || false]
    );
    res.status(201).json({ message: 'Staff assigned', assignment: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Staff already assigned' });
    console.error('assignStaffToCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 9. Remove Staff from Course
// ============================
exports.removeStaffFromCourse = async (req, res) => {
  try {
    const { course_id, assignment_id } = req.params;
    await pool.query(`DELETE FROM course_staff WHERE id = $1 AND course_id = $2`, [assignment_id, course_id]);
    res.json({ message: 'Staff removed' });
  } catch (err) {
    console.error('removeStaffFromCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 10. Get Pending Students
// ============================
exports.getPendingStudents = async (req, res) => {
  try {
    const headId = req.user.id;
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    
    const result = await pool.query(
      `SELECT id, national_id, full_name, email, phone, academic_year, status, created_at
       FROM students WHERE major_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
      [majorRes.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getPendingStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 11. Get All Students
// ============================
exports.getAllStudents = async (req, res) => {
  try {
    const headId = req.user.id;
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });

    const result = await pool.query(
      `SELECT s.id, s.national_id, s.full_name, s.full_name_ar, s.email, s.phone, s.academic_year, s.status, s.created_at,
              (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id) AS enrolled_courses
       FROM students s WHERE s.major_id = $1 ORDER BY s.status, s.created_at DESC`,
      [majorRes.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getAllStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 12. Approve Student
// ============================
exports.approveStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const headId = req.user.id;
    const { student_id } = req.params;

    await client.query('BEGIN');

    const check = await client.query(
      `SELECT s.id, s.major_id, s.academic_year, s.full_name, s.email FROM students s
       JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Student not in your major' });
    }

    const student = check.rows[0];

    const result = await client.query(
      `UPDATE students SET status = 'active' WHERE id = $1 AND status = 'pending' RETURNING id, full_name, email, status`,
      [student_id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Student not pending' });
    }

    const coursesRes = await client.query(
      `SELECT id FROM courses WHERE major_id = $1 AND academic_year = $2`,
      [student.major_id, student.academic_year]
    );

    let enrolledCount = 0;
    for (const course of coursesRes.rows) {
      try {
        await client.query(`INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2)`, [student_id, course.id]);
        enrolledCount++;
      } catch (e) { if (e.code !== '23505') throw e; }
    }

    try {
      await sendApprovalEmail(student.email, student.full_name);
    } catch (emailErr) { console.error('Email error:', emailErr.message); }

    await client.query('COMMIT');
    res.json({ message: 'Student approved', student: result.rows[0], enrolled_in_courses: enrolledCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approveStudent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

// ============================
// 13. Reject Student
// ============================
exports.rejectStudent = async (req, res) => {
  try {
    const headId = req.user.id;
    const { student_id } = req.params;
    const check = await pool.query(
      `SELECT s.id FROM students s JOIN majors m ON s.major_id = m.id WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );
    if (check.rows.length === 0) return res.status(403).json({ message: 'Student not in your major' });

    const result = await pool.query(
      `UPDATE students SET status = 'banned' WHERE id = $1 AND status = 'pending' RETURNING id, full_name, status`,
      [student_id]
    );
    if (result.rows.length === 0) return res.status(400).json({ message: 'Student not pending' });
    res.json({ message: 'Student rejected', student: result.rows[0] });
  } catch (err) {
    console.error('rejectStudent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Pending Invites
// ============================
exports.getPendingInvites = async (req, res) => {
  try {
    const headId = req.user.id;
    const result = await pool.query(
      `SELECT * FROM invitations WHERE invited_by = $1 AND status = 'pending' ORDER BY created_at DESC`,
      [headId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.cancelInvite = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM invitations WHERE id = $1`, [id]);
    res.json({ message: 'Invitation cancelled' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ============================
// Toggle Student Status (Block/Unblock)
// ============================
exports.toggleStudentStatus = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { status } = req.body;
    await pool.query(`UPDATE students SET status = $1 WHERE id = $2`, [status, student_id]);
    res.json({ message: `Student ${status === 'banned' ? 'blocked' : 'unblocked'}` });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ============================
// Get Risk Students
// ============================
exports.getRiskStudents = async (req, res) => {
  try {
    const headId = req.user.id;
    const threshold = parseFloat(req.query.threshold) || 75;
    
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major' });

    const result = await pool.query(
      `SELECT s.id, s.full_name, s.full_name_ar, s.academic_year,
              COUNT(DISTINCT ses.id) AS total_sessions,
              COUNT(DISTINCT a.session_id) AS attended_sessions,
              CASE WHEN COUNT(DISTINCT ses.id) = 0 THEN 0
                   ELSE ROUND((COUNT(DISTINCT a.session_id)::decimal / COUNT(DISTINCT ses.id)) * 100, 2)
              END AS attendance_percentage
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       JOIN sessions ses ON e.course_id = ses.course_id AND ses.is_active = FALSE
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id = ses.id
       WHERE s.major_id = $1
       GROUP BY s.id, s.full_name, s.full_name_ar, s.academic_year
       HAVING (COUNT(DISTINCT a.session_id)::decimal / NULLIF(COUNT(DISTINCT ses.id), 0)) * 100 < $2`,
      [majorRes.rows[0].id, threshold]
    );
    res.json({ students: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ============================
// Send Warning to Students
// ============================
exports.sendWarningToStudents = async (req, res) => {
  try {
    const headId = req.user.id;
    const { subject, message, warning_type, academic_year } = req.body;
    
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major' });

    let query = `SELECT email, full_name FROM students WHERE major_id = $1`;
    let params = [majorRes.rows[0].id];
    
    if (academic_year) {
      query += ` AND academic_year = $2`;
      params.push(academic_year);
    }

    const students = await pool.query(query, params);
    
    // (هنا ممكن تضيف كود إرسال الإيميلات باستخدام nodemailer)
    // للتجربة هنرجع رسالة نجاح
    let sentCount = 0;
    let failedCount = 0;
    for (const s of students.rows) {
      try {
        await transporter.sendMail({
          from: `"Head of Department" <${process.env.EMAIL_USER}>`,
          to: s.email,
          subject: subject || 'Warning',
          html: `<p>Dear ${s.full_name},</p><p style="white-space: pre-wrap;">${message}</p>`
        });
        sentCount++;
      } catch (err) {
        console.error('Email error:', err.message);
        failedCount++;
      }
    }
    res.json({ message: `Warning sent to ${sentCount} student(s).`, sent: sentCount, failed: failedCount, total: students.rows.length });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ============================
// Active Sessions
// ============================
exports.getCourseStudents = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_id } = req.params;
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    const majorId = majorRes.rows[0].id;
    const check = await pool.query(`SELECT id FROM courses WHERE id = $1 AND major_id = $2`, [course_id, majorId]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Course not found' });

    const result = await pool.query(
      `SELECT s.id, s.full_name, s.full_name_ar, s.national_id, s.academic_year, s.status
       FROM enrollments e JOIN students s ON e.student_id = s.id
       WHERE e.course_id = $1 ORDER BY s.full_name`,
      [course_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getCourseStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSessionAttendance = async (req, res) => {
  try {
    const headId = req.user.id;
    const { session_id } = req.params;
    const check = await pool.query(
      `SELECT s.id FROM sessions s JOIN courses c ON s.course_id = c.id JOIN majors m ON c.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [session_id, headId]
    );
    if (check.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    const result = await pool.query(
      `SELECT a.id, a.method, a.created_at, st.id AS student_id, st.full_name, st.full_name_ar, st.national_id, st.academic_year, m.name AS major_name
       FROM attendance a JOIN students st ON a.student_id = st.id LEFT JOIN majors m ON st.major_id = m.id
       WHERE a.session_id = $1 ORDER BY a.created_at ASC`,
      [session_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getSessionAttendance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getActiveSessions = async (req, res) => {
  try {
    const headId = req.user.id;
    const result = await pool.query(
      `SELECT ses.id, c.course_code, c.course_name, s.full_name AS created_by_name, ses.start_time
       FROM sessions ses
       JOIN courses c ON ses.course_id = c.id
       JOIN majors m ON c.major_id = m.id
       JOIN staff s ON ses.created_by = s.id
       WHERE m.head_staff_id = $1 AND ses.is_active = TRUE`,
      [headId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.closeSession = async (req, res) => {
  try {
    await pool.query(`UPDATE sessions SET is_active = FALSE, end_time = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Session closed' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ============================
// Staff Performance
// ============================
exports.getStaffPerformance = async (req, res) => {
  try {
    const headId = req.user.id;
    const result = await pool.query(
      `SELECT s.id, s.full_name, s.role, 
              (SELECT COUNT(*) FROM course_staff cs JOIN courses c ON cs.course_id = c.id JOIN majors m ON c.major_id = m.id WHERE cs.staff_id = s.id AND m.head_staff_id = $1) AS courses_assigned,
              (SELECT COUNT(*) FROM sessions ses WHERE ses.created_by = s.id) AS sessions_created
       FROM staff s
       WHERE s.role IN ('doctor', 'engineer')`,
      [headId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};