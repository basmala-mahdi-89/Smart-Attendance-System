const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ============================
// Audit Log Helper
// ============================
const logAudit = async ({ actorId, actorRole, action, targetType = null, targetId = null, details = null, ipAddress = null }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorId, actorRole, action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (err) {
    console.error('logAudit error:', err.message);
  }
};

// ============================
// Majors Management
// ============================

// Add Major
exports.addMajor = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

    const result = await pool.query(`INSERT INTO majors (name) VALUES ($1) RETURNING *`, [name.trim()]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ADD_MAJOR',
      targetType: 'major',
      targetId: result.rows[0].id,
      details: { major_name: result.rows[0].name },
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Major added', major: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Major already exists' });
    console.error('addMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Majors
exports.getMajors = async (req, res) => {
  try {
    const result = await pool.query(`SELECT m.*, s.full_name AS head_name FROM majors m LEFT JOIN staff s ON m.head_staff_id = s.id ORDER BY m.id`);
    res.json(result.rows);
  } catch (err) {
    console.error('getMajors error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Major
exports.updateMajor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

    const oldMajor = await pool.query(`SELECT * FROM majors WHERE id = $1`, [id]);
    if (oldMajor.rows.length === 0) return res.status(404).json({ message: 'Major not found' });

    const result = await pool.query(`UPDATE majors SET name = $1 WHERE id = $2 RETURNING *`, [name.trim(), id]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'UPDATE_MAJOR',
      targetType: 'major',
      targetId: id,
      details: { old_name: oldMajor.rows[0].name, new_name: name.trim() },
      ipAddress: req.ip
    });

    res.json({ message: 'Major updated', major: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Major already exists' });
    console.error('updateMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete Major (with safety checks)
exports.deleteMajor = async (req, res) => {
  try {
    const { id } = req.params;

    const majorRes = await pool.query(`SELECT * FROM majors WHERE id = $1`, [id]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'Major not found' });

    const studentsCount = await pool.query(`SELECT COUNT(*) FROM students WHERE major_id = $1`, [id]);
    const coursesCount = await pool.query(`SELECT COUNT(*) FROM courses WHERE major_id = $1`, [id]);
    const staffCount = await pool.query(`SELECT COUNT(*) FROM staff WHERE major_id = $1`, [id]);

    const sCount = parseInt(studentsCount.rows[0].count);
    const cCount = parseInt(coursesCount.rows[0].count);
    const stCount = parseInt(staffCount.rows[0].count);

    if (sCount > 0 || cCount > 0 || stCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete this major because it has related data. Please reassign or remove them first.',
        details: {
          students: sCount,
          courses: cCount,
          staff: stCount
        }
      });
    }

    await pool.query(`DELETE FROM majors WHERE id = $1`, [id]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'DELETE_MAJOR',
      targetType: 'major',
      targetId: id,
      details: { major_name: majorRes.rows[0].name },
      ipAddress: req.ip
    });

    res.json({ message: 'Major deleted successfully' });
  } catch (err) {
    console.error('deleteMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Heads Management
// ============================

// Add Head
exports.addHead = async (req, res) => {
  try {
    const { national_id, full_name, email, password, major_id } = req.body;
    if (!national_id || !full_name || !email || !password || !major_id) return res.status(400).json({ message: 'All fields are required' });
    
    const majorRes = await pool.query(`SELECT id, name FROM majors WHERE id = $1`, [major_id]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'Major not found' });

    const existingHead = await pool.query(`SELECT id FROM staff WHERE major_id = $1 AND role = 'head'`, [major_id]);
    if (existingHead.rows.length > 0) return res.status(400).json({ message: 'This major already has a head' });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO staff (national_id, full_name, email, password_hash, role, major_id) VALUES ($1, $2, $3, $4, 'head', $5) RETURNING id, full_name, email, role, major_id`,
      [national_id, full_name, email, password_hash, major_id]
    );
    await pool.query(`UPDATE majors SET head_staff_id = $1 WHERE id = $2`, [result.rows[0].id, major_id]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ADD_HEAD',
      targetType: 'staff',
      targetId: result.rows[0].id,
      details: { full_name, email, major_id, major_name: majorRes.rows[0].name },
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Head added', head: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Email or National ID already exists' });
    console.error('addHead error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Heads
exports.getHeads = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.national_id, s.role, m.id AS major_id, m.name AS major_name
       FROM staff s LEFT JOIN majors m ON s.major_id = m.id WHERE s.role = 'head' ORDER BY s.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getHeads error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Head
exports.updateHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, major_id } = req.body;
    const headRes = await pool.query(`SELECT id, major_id, full_name FROM staff WHERE id = $1 AND role = 'head'`, [id]);
    if (headRes.rows.length === 0) return res.status(404).json({ message: 'Head not found' });
    
    const oldMajorId = headRes.rows[0].major_id;
    await pool.query(`UPDATE staff SET full_name = $1, email = $2, major_id = $3 WHERE id = $4`, [full_name, email, major_id || null, id]);
    
    if (major_id && major_id !== oldMajorId) {
      await pool.query(`UPDATE majors SET head_staff_id = NULL WHERE head_staff_id = $1`, [id]);
      await pool.query(`UPDATE majors SET head_staff_id = $1 WHERE id = $2`, [id, major_id]);
    }
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'UPDATE_HEAD',
      targetType: 'staff',
      targetId: id,
      details: { full_name, email, old_major_id: oldMajorId, new_major_id: major_id },
      ipAddress: req.ip
    });

    res.json({ message: 'Head updated successfully' });
  } catch (err) {
    console.error('updateHead error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete Head
exports.deleteHead = async (req, res) => {
  try {
    const { id } = req.params;
    const headRes = await pool.query(`SELECT email, full_name FROM staff WHERE id = $1 AND role = 'head'`, [id]);
    if (headRes.rows.length === 0) return res.status(404).json({ message: 'Head not found' });
    
    const headEmail = headRes.rows[0].email;
    await pool.query(`UPDATE majors SET head_staff_id = NULL WHERE head_staff_id = $1`, [id]);
    await pool.query(`DELETE FROM staff WHERE id = $1`, [id]);
    await pool.query(`DELETE FROM invitations WHERE email = $1`, [headEmail]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'DELETE_HEAD',
      targetType: 'staff',
      targetId: id,
      details: { full_name: headRes.rows[0].full_name, email: headEmail },
      ipAddress: req.ip
    });

    res.json({ message: 'Head deleted successfully' });
  } catch (err) {
    console.error('deleteHead error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Dean Dashboard Data (Global Overview)
// ============================
exports.getDeanDashboardData = async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM majors) AS total_majors,
        (SELECT COUNT(*) FROM staff WHERE role = 'head') AS total_heads,
        (SELECT COUNT(*) FROM staff WHERE role = 'doctor') AS total_doctors,
        (SELECT COUNT(*) FROM staff WHERE role = 'engineer') AS total_engineers,
        (SELECT COUNT(*) FROM students) AS total_students,
        (SELECT COUNT(*) FROM students WHERE status = 'pending') AS pending_students,
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM sessions) AS total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE is_active = TRUE) AS active_sessions`
    );

    const majorStatsRes = await pool.query(
      `SELECT m.id, m.name,
              (SELECT COUNT(*) FROM students s WHERE s.major_id = m.id) AS total_students,
              (SELECT COUNT(*) FROM courses c WHERE c.major_id = m.id) AS total_courses,
              (SELECT COUNT(*) FROM staff st WHERE st.major_id = m.id AND st.role = 'doctor') AS total_doctors,
              (SELECT COUNT(*) FROM staff st WHERE st.major_id = m.id AND st.role = 'engineer') AS total_engineers
       FROM majors m ORDER BY m.name`
    );

    const gradeStatsRes = await pool.query(
      `SELECT m.name AS major_name, s.academic_year, COUNT(*) AS student_count
       FROM students s JOIN majors m ON s.major_id = m.id
       GROUP BY m.name, s.academic_year ORDER BY m.name, s.academic_year`
    );

    const staffRes = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.national_id, s.role, s.status, m.name AS major_name
       FROM staff s LEFT JOIN majors m ON s.major_id = m.id
       WHERE s.role != 'dean' ORDER BY s.role, s.full_name`
    );

    const studentsRes = await pool.query(
      `SELECT s.id, s.full_name, s.national_id, s.academic_year, s.status, m.name AS major_name,
              (SELECT COUNT(*) FROM enrollments e JOIN sessions ses ON e.course_id = ses.course_id WHERE e.student_id = s.id AND ses.is_active = FALSE) AS total_sessions,
              (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) AS attended_sessions
       FROM students s LEFT JOIN majors m ON s.major_id = m.id
       ORDER BY s.status, s.full_name`
    );

    const students = studentsRes.rows.map(s => {
      const total = parseInt(s.total_sessions) || 0;
      const attended = parseInt(s.attended_sessions) || 0;
      const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
      return { ...s, total_sessions: total, attended_sessions: attended, percentage };
    });

    const coursesRes = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year, m.name AS major_name,
              (SELECT full_name FROM staff WHERE id = (SELECT staff_id FROM course_staff WHERE course_id = c.id AND role_in_course = 'doctor' LIMIT 1)) AS doctor_name,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count
       FROM courses c JOIN majors m ON c.major_id = m.id
       ORDER BY c.academic_year, c.course_code`
    );

    const courses = coursesRes.rows;
    for (let i = 0; i < courses.length; i++) {
      const engRes = await pool.query(
        `SELECT s.full_name FROM course_staff cs JOIN staff s ON cs.staff_id = s.id WHERE cs.course_id = $1 AND cs.role_in_course = 'engineer'`,
        [courses[i].id]
      );
      courses[i].engineers = engRes.rows.map(e => e.full_name).join(', ') || 'None';
    }

    res.json({
      stats: stats.rows[0],
      major_stats: majorStatsRes.rows,
      grade_stats: gradeStatsRes.rows,
      staff: staffRes.rows,
      students: students,
      courses: courses
    });
  } catch (err) {
    console.error('getDeanDashboardData error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Pending Invitations
// ============================
exports.getInvitations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.email, i.full_name, i.role, m.name AS major_name, i.created_at
       FROM invitations i
       LEFT JOIN majors m ON i.major_id = m.id
       WHERE i.status = 'pending'
       ORDER BY i.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getInvitations error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Cancel Invitation
// ============================
exports.cancelInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const invRes = await pool.query(`SELECT email FROM invitations WHERE id = $1 AND status = 'pending'`, [id]);
    await pool.query(`DELETE FROM invitations WHERE id = $1 AND status = 'pending'`, [id]);
    
    if (invRes.rows.length > 0) {
      await logAudit({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CANCEL_INVITATION',
        targetType: 'invitation',
        targetId: id,
        details: { email: invRes.rows[0].email },
        ipAddress: req.ip
      });
    }

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (err) {
    console.error('cancelInvitation error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Block/Unblock User (Staff or Student)
// ============================
exports.toggleUserStatus = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status } = req.body;

    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const table = type === 'staff' ? 'staff' : 'students';
    
    if (type === 'staff' && parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const userRes = await pool.query(`SELECT full_name, email FROM ${table} WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    await pool.query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [status, id]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: status === 'banned' ? 'BLOCK_USER' : 'UNBLOCK_USER',
      targetType: type,
      targetId: id,
      details: { full_name: userRes.rows[0].full_name, email: userRes.rows[0].email, new_status: status },
      ipAddress: req.ip
    });

    res.json({ message: `User status updated to ${status}` });
  } catch (err) {
    console.error('toggleUserStatus error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Delete User (Staff or Student)
// ============================
exports.deleteUser = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === 'staff' && parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }

    const table = type === 'staff' ? 'staff' : 'students';
    const userRes = await pool.query(`SELECT full_name, email FROM ${table} WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    
    if (type === 'staff') {
      await pool.query(`UPDATE majors SET head_staff_id = NULL WHERE head_staff_id = $1`, [id]);
    }

    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'DELETE_USER',
      targetType: type,
      targetId: id,
      details: { full_name: userRes.rows[0].full_name, email: userRes.rows[0].email },
      ipAddress: req.ip
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('deleteUser error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Broadcast Warning to Students
// ============================
exports.broadcastWarning = async (req, res) => {
  try {
    const { major_id, academic_year, student_ids, subject, message, warning_type = 'general' } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    let query = `SELECT id, full_name, email, major_id, academic_year FROM students WHERE status = 'active'`;
    const params = [];
    let paramIndex = 1;

    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      query += ` AND id = ANY($${paramIndex}::int[])`;
      params.push(student_ids);
      paramIndex++;
    } else {
      if (major_id) {
        query += ` AND major_id = $${paramIndex}`;
        params.push(major_id);
        paramIndex++;
      }
      if (academic_year) {
        query += ` AND academic_year = $${paramIndex}`;
        params.push(academic_year);
        paramIndex++;
      }
    }

    const studentsRes = await pool.query(query, params);
    if (studentsRes.rows.length === 0) {
      return res.status(400).json({ message: 'No active students found for the selected criteria' });
    }

    let sentCount = 0;
    for (const student of studentsRes.rows) {
      try {
        await transporter.sendMail({
          from: `"Dean's Office" <${process.env.EMAIL_USER}>`,
          to: student.email,
          subject: `📢 ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #d97706;">Official Notice from the Dean</h2>
              <p>Dear <b>${student.full_name}</b>,</p>
              <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
              <br/>
              <p style="color: #666;">Warning Type: <b style="text-transform: capitalize;">${warning_type}</b></p>
              <br/>
              <hr/>
              <p style="color: #888;">Best Regards,<br/>Office of the Dean<br/>Smart Attendance System</p>
            </div>
          `
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${student.email}:`, err.message);
      }
    }

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'BROADCAST_WARNING',
      targetType: 'student',
      targetId: null,
      details: { subject, warning_type, count: sentCount, major_id, academic_year },
      ipAddress: req.ip
    });

    res.json({ message: `Broadcast warning sent to ${sentCount} student(s).` });
  } catch (err) {
    console.error('broadcastWarning error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Advanced Reports
// ============================
exports.getAttendanceOverview = async (req, res) => {
  try {
    const overviewRes = await pool.query(
      `SELECT m.id, m.name AS major_name,
              COUNT(DISTINCT s.id) AS total_students,
              COUNT(DISTINCT c.id) AS total_courses,
              COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) AS total_sessions_conducted,
              COUNT(a.id) AS total_attendance_records,
              ROUND(
                CASE 
                  WHEN COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) > 0 
                  THEN (COUNT(DISTINCT s.id) * COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE))
                  ELSE 0 
                END
              ) AS expected_attendance,
              ROUND(
                CASE 
                  WHEN (COUNT(DISTINCT s.id) * COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE)) > 0
                  THEN (COUNT(a.id)::numeric / (COUNT(DISTINCT s.id) * COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE))::numeric) * 100
                  ELSE 0
                END, 2
              ) AS attendance_rate
       FROM majors m
       LEFT JOIN students s ON s.major_id = m.id
       LEFT JOIN courses c ON c.major_id = m.id
       LEFT JOIN sessions ses ON ses.course_id = c.id
       LEFT JOIN attendance a ON a.session_id = ses.id AND a.student_id = s.id
       GROUP BY m.id, m.name
       ORDER BY m.name`
    );

    res.json(overviewRes.rows);
  } catch (err) {
    console.error('getAttendanceOverview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getHighRiskStudents = async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 75;

    const riskRes = await pool.query(
      `SELECT s.id, s.full_name, s.national_id, s.email, s.academic_year, m.name AS major_name,
              COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) AS total_sessions,
              COUNT(DISTINCT a.session_id) AS attended_sessions,
              ROUND(
                CASE 
                  WHEN COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) > 0
                  THEN (COUNT(DISTINCT a.session_id)::numeric / COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE)::numeric) * 100
                  ELSE 100
                END, 2
              ) AS attendance_percentage
       FROM students s
       JOIN majors m ON s.major_id = m.id
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN sessions ses ON ses.course_id = e.course_id AND ses.is_active = FALSE
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id = ses.id
       WHERE s.status = 'active'
       GROUP BY s.id, s.full_name, s.national_id, s.email, s.academic_year, m.name
       HAVING COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) > 0
          AND (COUNT(DISTINCT a.session_id)::numeric / COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE)::numeric) * 100 < $1
       ORDER BY attendance_percentage ASC, s.full_name`,
      [threshold]
    );

    res.json({ threshold, students: riskRes.rows });
  } catch (err) {
    console.error('getHighRiskStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStaffActivity = async (req, res) => {
  try {
    const activityRes = await pool.query(
      `SELECT st.id, st.full_name, st.role, st.email, m.name AS major_name,
              COUNT(DISTINCT ses.id) AS sessions_created,
              COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) AS sessions_completed,
              COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = TRUE) AS sessions_active,
              COUNT(DISTINCT c.id) AS courses_assigned,
              COALESCE(AVG(att_count.cnt), 0)::int AS avg_attendance_per_session
       FROM staff st
       LEFT JOIN majors m ON st.major_id = m.id
       LEFT JOIN course_staff cs ON cs.staff_id = st.id
       LEFT JOIN courses c ON c.id = cs.course_id
       LEFT JOIN sessions ses ON ses.created_by = st.id
       LEFT JOIN LATERAL (
         SELECT COUNT(a.id) AS cnt FROM attendance a WHERE a.session_id = ses.id
       ) att_count ON true
       WHERE st.role IN ('doctor', 'engineer', 'head')
       GROUP BY st.id, st.full_name, st.role, st.email, m.name
       ORDER BY sessions_created DESC, st.full_name`
    );

    res.json(activityRes.rows);
  } catch (err) {
    console.error('getStaffActivity error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Live Sessions Monitor
// ============================
exports.getActiveSessions = async (req, res) => {
  try {
    const sessionsRes = await pool.query(
      `SELECT ses.id, ses.course_id, ses.created_by, ses.session_date, ses.start_time, ses.is_active, ses.end_time,
              c.course_code, c.course_name, c.academic_year,
              m.name AS major_name,
              st.full_name AS created_by_name, st.role AS created_by_role,
              (SELECT COUNT(*) FROM attendance a WHERE a.session_id = ses.id) AS attendance_count,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ses.course_id) AS enrolled_count
       FROM sessions ses
       JOIN courses c ON c.id = ses.course_id
       JOIN majors m ON m.id = c.major_id
       JOIN staff st ON st.id = ses.created_by
       WHERE ses.is_active = TRUE
       ORDER BY ses.start_time DESC`
    );

    res.json(sessionsRes.rows);
  } catch (err) {
    console.error('getActiveSessions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.forceCloseSession = async (req, res) => {
  try {
    const { id } = req.params;

    const sessionRes = await pool.query(
      `SELECT ses.id, c.course_code, c.course_name, st.full_name
       FROM sessions ses
       JOIN courses c ON c.id = ses.course_id
       JOIN staff st ON st.id = ses.created_by
       WHERE ses.id = $1 AND ses.is_active = TRUE`,
      [id]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    const session = sessionRes.rows[0];
    await pool.query(`UPDATE sessions SET is_active = FALSE, end_time = NOW() WHERE id = $1`, [id]);

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FORCE_CLOSE_SESSION',
      targetType: 'session',
      targetId: id,
      details: { course_code: session.course_code, course_name: session.course_name, created_by: session.full_name },
      ipAddress: req.ip
    });

    // Emit socket event if io exists
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${id}`).emit('session-closed', { sessionId: id, reason: 'closed by dean' });
    }

    res.json({ message: 'Session force-closed successfully' });
  } catch (err) {
    console.error('forceCloseSession error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Analytics
// ============================
exports.getAnalytics = async (req, res) => {
  try {
    // Attendance Trend - Last 14 days
    const trendRes = await pool.query(
      `SELECT DATE(ses.session_date) AS date,
              COUNT(DISTINCT ses.id) AS sessions_count,
              COUNT(a.id) AS attendance_count
       FROM sessions ses
       LEFT JOIN attendance a ON a.session_id = ses.id
       WHERE ses.session_date >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY DATE(ses.session_date)
       ORDER BY date ASC`
    );

    // Most Absent Students (Overall)
    const mostAbsentRes = await pool.query(
      `SELECT s.id, s.full_name, s.national_id, m.name AS major_name, s.academic_year,
              COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) AS total_sessions,
              COUNT(DISTINCT a.session_id) AS attended_sessions,
              (COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) - COUNT(DISTINCT a.session_id)) AS absent_count,
              ROUND(
                CASE 
                  WHEN COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) > 0
                  THEN ((COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) - COUNT(DISTINCT a.session_id))::numeric / COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE)::numeric) * 100
                  ELSE 0
                END, 2
              ) AS absence_percentage
       FROM students s
       JOIN majors m ON s.major_id = m.id
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN sessions ses ON ses.course_id = e.course_id AND ses.is_active = FALSE
       LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id = ses.id
       WHERE s.status = 'active'
       GROUP BY s.id, s.full_name, s.national_id, m.name, s.academic_year
       HAVING COUNT(DISTINCT ses.id) FILTER (WHERE ses.is_active = FALSE) > 0
       ORDER BY absent_count DESC, absence_percentage DESC
       LIMIT 20`
    );

    // Course Completion
    const courseCompletionRes = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, m.name AS major_name, c.academic_year,
              COUNT(DISTINCT ses.id) AS total_sessions_held,
              COUNT(DISTINCT e.student_id) AS enrolled_students,
              COALESCE(AVG(session_att.cnt), 0)::int AS avg_attendance_per_session
       FROM courses c
       JOIN majors m ON m.id = c.major_id
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN sessions ses ON ses.course_id = c.id AND ses.is_active = FALSE
       LEFT JOIN LATERAL (
         SELECT COUNT(a.id) AS cnt FROM attendance a WHERE a.session_id = ses.id
       ) session_att ON true
       GROUP BY c.id, c.course_code, c.course_name, m.name, c.academic_year
       ORDER BY total_sessions_held DESC, c.course_code`
    );

    res.json({
      attendance_trend: trendRes.rows,
      most_absent_students: mostAbsentRes.rows,
      course_completion: courseCompletionRes.rows
    });
  } catch (err) {
    console.error('getAnalytics error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Audit Logs
// ============================
exports.getAuditLogs = async (req, res) => {
  try {
    const { limit = 50, offset = 0, action, actor_id } = req.query;

    let query = `SELECT al.*, s.full_name AS actor_name, s.email AS actor_email
                 FROM audit_logs al
                 LEFT JOIN staff s ON s.id = al.actor_id
                 WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    if (actor_id) {
      query += ` AND al.actor_id = $${paramIndex}`;
      params.push(actor_id);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const countRes = await pool.query(`SELECT COUNT(*) FROM audit_logs`);
    
    res.json({
      logs: result.rows,
      total: parseInt(countRes.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('getAuditLogs error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
