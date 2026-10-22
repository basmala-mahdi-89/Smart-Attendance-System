const pool = require('../config/db');

// ============================
// 1. Get All Staff (doctors + engineers + head himself)
// ============================
exports.getStaff = async (req, res) => {
  try {
    const headId = req.user.id;
    const result = await pool.query(
      `SELECT id, full_name, email, national_id, role 
       FROM staff 
       WHERE role IN ('doctor', 'engineer') OR id = $1
       ORDER BY role, full_name`,
      [headId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getStaff error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 2. Get All Courses in Head's Major
// ============================
exports.getCourses = async (req, res) => {
  try {
    const headId = req.user.id;
    const majorRes = await pool.query(
      `SELECT id FROM majors WHERE head_staff_id = $1`,
      [headId]
    );
    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'No major assigned to you' });
    }
    const majorId = majorRes.rows[0].id;

    const result = await pool.query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS students
       FROM courses c
       WHERE c.major_id = $1
       ORDER BY c.academic_year, c.course_code`,
      [majorId]
    );

    const courses = result.rows;

    for (let i = 0; i < courses.length; i++) {
      const staffRes = await pool.query(
        `SELECT cs.id AS assignment_id, s.id AS staff_id, s.full_name, 
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
// 3. Create Course
// ============================
exports.createCourse = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_code, course_name, academic_year } = req.body;

    if (!course_code || !course_name || !academic_year) return res.status(400).json({ message: 'All fields are required' });
    if (!['1', '2', '3', '4'].includes(academic_year)) return res.status(400).json({ message: 'Invalid academic year' });

    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });
    const majorId = majorRes.rows[0].id;

    const result = await pool.query(
      `INSERT INTO courses (course_code, course_name, major_id, academic_year)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [course_code, course_name, majorId, academic_year]
    );
    res.status(201).json({ message: 'Course created', course: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Course already exists in this major/year' });
    console.error('createCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Assign Staff to Course
// ============================
exports.assignStaffToCourse = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_id } = req.params;
    const { staff_id, role_in_course, is_primary } = req.body;

    if (!staff_id || !role_in_course) {
      return res.status(400).json({ message: 'staff_id and role_in_course required' });
    }

    // Verify course belongs to head's major
    const courseCheck = await pool.query(
      `SELECT c.id FROM courses c
       JOIN majors m ON c.major_id = m.id
       WHERE c.id = $1 AND m.head_staff_id = $2`,
      [course_id, headId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Course not in your major' });
    }

    // ⚡ Rule: Only ONE doctor per course
    if (role_in_course === 'doctor') {
      const existingDoctor = await pool.query(
        `SELECT id FROM course_staff WHERE course_id = $1 AND role_in_course = 'doctor'`,
        [course_id]
      );
      if (existingDoctor.rows.length > 0) {
        return res.status(400).json({ 
          message: 'This course already has a doctor. Please remove or edit the existing doctor first.' 
        });
      }
    }

    // If primary, unset others
    if (is_primary) {
      await pool.query(
        `UPDATE course_staff SET is_primary = FALSE WHERE course_id = $1`,
        [course_id]
      );
    }

    const result = await pool.query(
      `INSERT INTO course_staff (course_id, staff_id, role_in_course, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [course_id, staff_id, role_in_course, is_primary || false]
    );

    res.status(201).json({ message: 'Staff assigned', assignment: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Staff already assigned to this course' });
    }
    console.error('assignStaffToCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 5. Get Pending Students
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
// 6. Get All Students
// ============================
exports.getAllStudents = async (req, res) => {
  try {
    const headId = req.user.id;
    const majorRes = await pool.query(`SELECT id FROM majors WHERE head_staff_id = $1`, [headId]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'No major assigned' });

    const result = await pool.query(
      `SELECT id, national_id, full_name, email, phone, academic_year, status, created_at
       FROM students WHERE major_id = $1 ORDER BY status, created_at DESC`,
      [majorRes.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getAllStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// 7. Approve Student (with Auto-Enrollment)
// ============================
exports.approveStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const headId = req.user.id;
    const { student_id } = req.params;

    await client.query('BEGIN');

    const check = await client.query(
      `SELECT s.id, s.major_id, s.academic_year FROM students s
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
// 8. Reject Student
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
// Remove Staff from Course
// ============================
exports.removeStaffFromCourse = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_id, assignment_id } = req.params;

    // Verify course belongs to head's major
    const courseCheck = await pool.query(
      `SELECT c.id FROM courses c
       JOIN majors m ON c.major_id = m.id
       WHERE c.id = $1 AND m.head_staff_id = $2`,
      [course_id, headId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Course not in your major' });
    }

    const result = await pool.query(
      `DELETE FROM course_staff WHERE id = $1 AND course_id = $2 RETURNING id`,
      [assignment_id, course_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.json({ message: 'Staff removed from course' });
  } catch (err) {
    console.error('removeStaffFromCourse error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};