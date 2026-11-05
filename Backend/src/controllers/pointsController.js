const pool = require('../config/db');

const MAX_POINTS = 20;
const MAX_REASON = 200;

const normalizeType = (type) => {
  if (type === 'bonus') return 'bonus';
  if (type === 'penalty' || type === 'minus') return 'penalty';
  return null;
};

const canManageCourse = async (user, courseId) => {
  if (!user) return false;
  if (user.role === 'head' || user.role === 'dean') return true;
  const res = await pool.query(
    `SELECT id FROM course_staff WHERE staff_id = $1 AND course_id = $2 LIMIT 1`,
    [user.id, courseId]
  );
  return res.rows.length > 0;
};

const writeAudit = async ({ user, action, targetType, targetId, details, ip }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.role, action, targetType, targetId, details ? JSON.stringify(details) : null, ip]
    );
  } catch (err) {
    console.error('points audit error:', err.message);
  }
};

const parsePoints = (raw) => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, MAX_POINTS);
};

// ============================
// STAFF: Award bonus / penalty inside a session
// ============================
exports.awardSessionPoints = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { student_id, type, points, reason } = req.body;

    const cleanType = normalizeType(type);
    if (!cleanType) return res.status(400).json({ message: 'type must be bonus or penalty' });

    const value = parsePoints(points ?? 1);
    if (!value) return res.status(400).json({ message: `points must be between 1 and ${MAX_POINTS}` });

    const sessionRes = await pool.query(
      `SELECT id, course_id, is_active FROM sessions WHERE id = $1`,
      [session_id]
    );
    if (sessionRes.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    const session = sessionRes.rows[0];

    if (!(await canManageCourse(req.user, session.course_id))) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const studentRes = await pool.query(
      `SELECT s.id, s.full_name, s.full_name_ar
       FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE s.id = $1 AND e.course_id = $2
       LIMIT 1`,
      [student_id, session.course_id]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Student is not enrolled in this course' });
    }
    const student = studentRes.rows[0];

    const cleanReason =
      typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, MAX_REASON) : null;

    const insert = await pool.query(
      `INSERT INTO student_points (student_id, course_id, session_id, staff_id, type, points, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [student.id, session.course_id, session.id, req.user.id, cleanType, value, cleanReason]
    );

    const point = {
      ...insert.rows[0],
      full_name: student.full_name,
      full_name_ar: student.full_name_ar,
      staff_role: req.user.role,
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session.id}`).emit('points-update', {
        action: 'awarded',
        session_id: session.id,
        point,
      });
    }

    writeAudit({
      user: req.user,
      action: cleanType === 'bonus' ? 'AWARD_BONUS' : 'AWARD_PENALTY',
      targetType: 'student',
      targetId: student.id,
      details: { session_id: session.id, course_id: session.course_id, points: value, reason: cleanReason },
      ip: req.ip,
    });

    res.status(201).json({
      message:
        cleanType === 'bonus'
          ? `Bonus added to ${student.full_name}`
          : `Penalty recorded for ${student.full_name}`,
      point,
    });
  } catch (err) {
    console.error('awardSessionPoints error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// STAFF: Session points ledger
// ============================
exports.getSessionPoints = async (req, res) => {
  try {
    const { session_id } = req.params;
    const sessionRes = await pool.query(
      `SELECT id, course_id FROM sessions WHERE id = $1`,
      [session_id]
    );
    if (sessionRes.rows.length === 0) return res.status(404).json({ message: 'Session not found' });

    const session = sessionRes.rows[0];
    if (!(await canManageCourse(req.user, session.course_id))) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const entries = await pool.query(
      `SELECT p.*, s.full_name, s.full_name_ar, s.national_id, st.full_name AS staff_name
       FROM student_points p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN staff st ON st.id = p.staff_id
       WHERE p.session_id = $1
       ORDER BY p.created_at DESC`,
      [session.id]
    );

    res.json({ entries: entries.rows });
  } catch (err) {
    console.error('getSessionPoints error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// STAFF: Course points ledger + per-student totals
// ============================
exports.getCoursePoints = async (req, res) => {
  try {
    const { course_id } = req.params;
    const courseRes = await pool.query(
      `SELECT id, course_code, course_name FROM courses WHERE id = $1`,
      [course_id]
    );
    if (courseRes.rows.length === 0) return res.status(404).json({ message: 'Course not found' });

    if (!(await canManageCourse(req.user, course_id))) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const entries = await pool.query(
      `SELECT p.*, s.full_name, s.full_name_ar, s.national_id, st.full_name AS staff_name
       FROM student_points p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN staff st ON st.id = p.staff_id
       WHERE p.course_id = $1
       ORDER BY p.created_at DESC`,
      [course_id]
    );

    const summary = await pool.query(
      `SELECT s.id AS student_id,
              s.full_name,
              s.full_name_ar,
              COALESCE(SUM(CASE WHEN p.type = 'bonus' THEN p.points ELSE 0 END), 0)::int AS bonus,
              COALESCE(SUM(CASE WHEN p.type = 'penalty' THEN p.points ELSE 0 END), 0)::int AS penalty
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN student_points p ON p.student_id = s.id AND p.course_id = e.course_id
       WHERE e.course_id = $1
       GROUP BY s.id, s.full_name, s.full_name_ar
       ORDER BY s.full_name`,
      [course_id]
    );

    const rows = summary.rows.map((row) => ({
      ...row,
      net: row.bonus - row.penalty,
    }));

    const totals = rows.reduce(
      (acc, row) => {
        acc.bonus += row.bonus;
        acc.penalty += row.penalty;
        return acc;
      },
      { bonus: 0, penalty: 0 }
    );
    totals.net = totals.bonus - totals.penalty;

    res.json({
      course: courseRes.rows[0],
      entries: entries.rows,
      summary: rows.filter((row) => row.bonus > 0 || row.penalty > 0),
      totals,
    });
  } catch (err) {
    console.error('getCoursePoints error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// STAFF: Remove a point entry (undo)
// ============================
exports.deletePoint = async (req, res) => {
  try {
    const { point_id } = req.params;
    const pointRes = await pool.query(`SELECT * FROM student_points WHERE id = $1`, [point_id]);
    if (pointRes.rows.length === 0) return res.status(404).json({ message: 'Point entry not found' });

    const point = pointRes.rows[0];
    if (!(await canManageCourse(req.user, point.course_id))) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    await pool.query(`DELETE FROM student_points WHERE id = $1`, [point.id]);

    const io = req.app.get('io');
    if (io && point.session_id) {
      io.to(`session-${point.session_id}`).emit('points-update', {
        action: 'removed',
        session_id: point.session_id,
        point_id: point.id,
      });
    }

    writeAudit({
      user: req.user,
      action: 'REMOVE_POINTS',
      targetType: 'student',
      targetId: point.student_id,
      details: { point_id: point.id, type: point.type, points: point.points },
      ip: req.ip,
    });

    res.json({ message: 'Point entry removed' });
  } catch (err) {
    console.error('deletePoint error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// STUDENT: My own bonus / penalty ledger
// ============================
exports.getMyPoints = async (req, res) => {
  try {
    const studentId = req.user.id;

    const entries = await pool.query(
      `SELECT p.*, c.course_code, c.course_name, st.full_name AS staff_name
       FROM student_points p
       JOIN courses c ON c.id = p.course_id
       LEFT JOIN staff st ON st.id = p.staff_id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [studentId]
    );

    const totals = entries.rows.reduce(
      (acc, row) => {
        if (row.type === 'bonus') acc.bonus += row.points;
        else acc.penalty += row.points;
        return acc;
      },
      { bonus: 0, penalty: 0 }
    );
    totals.net = totals.bonus - totals.penalty;

    res.json({ entries: entries.rows, totals });
  } catch (err) {
    console.error('getMyPoints error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
