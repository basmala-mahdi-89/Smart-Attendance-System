const pool = require('../config/db');

// ============================
// Get All Staff in Head's Major
// ============================
exports.getStaff = async (req, res) => {
  try {
    const headId = req.user.id;

    // Get head's major
    const majorRes = await pool.query(
      `SELECT id FROM majors WHERE head_staff_id = $1`,
      [headId]
    );

    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'No major assigned to you' });
    }

    const majorId = majorRes.rows[0].id;

    // Get staff who teach courses in this major
    const result = await pool.query(
      `SELECT DISTINCT s.id, s.full_name, s.email, s.national_id, s.role,
              cs.role_in_course, c.course_code, c.course_name
       FROM staff s
       JOIN course_staff cs ON cs.staff_id = s.id
       JOIN courses c ON cs.course_id = c.id
       WHERE c.major_id = $1 AND s.role IN ('doctor', 'engineer')
       ORDER BY s.id`,
      [majorId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getStaff error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get All Courses in Head's Major
// ============================
exports.getCourses = async (req, res) => {
  try {
    const headId = req.user.id;

    // Get head's major
    const majorRes = await pool.query(
      `SELECT id FROM majors WHERE head_staff_id = $1`,
      [headId]
    );

    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'No major assigned to you' });
    }

    const majorId = majorRes.rows[0].id;

    // Get courses + staff count
    const result = await pool.query(
      `SELECT c.*,
              COUNT(cs.id) AS staff_count
       FROM courses c
       LEFT JOIN course_staff cs ON cs.course_id = c.id
       WHERE c.major_id = $1
       GROUP BY c.id
       ORDER BY c.academic_year, c.course_code`,
      [majorId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getCourses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Create Course (in Head's Major)
// ============================
exports.createCourse = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_code, course_name, academic_year } = req.body;

    if (!course_code || !course_name || !academic_year) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['1', '2', '3', '4'].includes(academic_year)) {
      return res.status(400).json({ message: 'Academic year must be 1, 2, 3, or 4' });
    }

    // Get head's major
    const majorRes = await pool.query(
      `SELECT id FROM majors WHERE head_staff_id = $1`,
      [headId]
    );

    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'No major assigned to you' });
    }

    const majorId = majorRes.rows[0].id;

    // Insert course
    const result = await pool.query(
      `INSERT INTO courses (course_code, course_name, major_id, academic_year)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [course_code, course_name, majorId, academic_year]
    );

    res.status(201).json({ message: 'Course created', course: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Course already exists in this major/year' });
    }
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

    if (!['doctor', 'engineer'].includes(role_in_course)) {
      return res.status(400).json({ message: 'role_in_course must be doctor or engineer' });
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

    // Verify staff exists and has correct role
    const staffCheck = await pool.query(
      `SELECT id, role FROM staff WHERE id = $1`,
      [staff_id]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    if (staffCheck.rows[0].role !== role_in_course) {
      return res.status(400).json({
        message: `Staff role is '${staffCheck.rows[0].role}', not '${role_in_course}'`
      });
    }

    // If is_primary = true, unset other primaries for this course
    if (is_primary) {
      await pool.query(
        `UPDATE course_staff SET is_primary = FALSE WHERE course_id = $1`,
        [course_id]
      );
    }

    // Insert assignment
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
// Remove Staff from Course
// ============================
exports.removeStaffFromCourse = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_id, staff_id } = req.params;

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
      `DELETE FROM course_staff WHERE course_id = $1 AND staff_id = $2 RETURNING id`,
      [course_id, staff_id]
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

// ============================
// Get Course Details (with staff)
// ============================
exports.getCourseDetails = async (req, res) => {
  try {
    const headId = req.user.id;
    const { course_id } = req.params;

    // Verify course belongs to head's major
    const courseRes = await pool.query(
      `SELECT c.*, m.name AS major_name
       FROM courses c
       JOIN majors m ON c.major_id = m.id
       WHERE c.id = $1 AND m.head_staff_id = $2`,
      [course_id, headId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found in your major' });
    }

    // Get staff assigned to this course
    const staffRes = await pool.query(
      `SELECT cs.id AS assignment_id, cs.role_in_course, cs.is_primary,
              s.id AS staff_id, s.full_name, s.email, s.national_id, s.role
       FROM course_staff cs
       JOIN staff s ON cs.staff_id = s.id
       WHERE cs.course_id = $1
       ORDER BY cs.is_primary DESC, s.full_name`,
      [course_id]
    );

    res.json({
      course: courseRes.rows[0],
      staff: staffRes.rows
    });
  } catch (err) {
    console.error('getCourseDetails error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Pending Students (in Head's Major)
// ============================
exports.getPendingStudents = async (req, res) => {
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
      `SELECT id, national_id, full_name, email, phone, academic_year, status, created_at
       FROM students
       WHERE major_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [majorId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getPendingStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get All Students (in Head's Major)
// ============================
exports.getAllStudents = async (req, res) => {
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
      `SELECT id, national_id, full_name, email, phone, academic_year, status, created_at
       FROM students
       WHERE major_id = $1
       ORDER BY status, created_at DESC`,
      [majorId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getAllStudents error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Approve Student
// ============================
exports.approveStudent = async (req, res) => {
  try {
    const headId = req.user.id;
    const { student_id } = req.params;

    // Verify student in head's major
    const check = await pool.query(
      `SELECT s.id FROM students s
       JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Student not in your major' });
    }

    const result = await pool.query(
      `UPDATE students SET status = 'active'
       WHERE id = $1 AND status = 'pending'
       RETURNING id, full_name, email, status`,
      [student_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Student not pending' });
    }

    res.json({ message: 'Student approved', student: result.rows[0] });
  } catch (err) {
    console.error('approveStudent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Reject Student
// ============================
exports.rejectStudent = async (req, res) => {
  try {
    const headId = req.user.id;
    const { student_id } = req.params;

    const check = await pool.query(
      `SELECT s.id FROM students s
       JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Student not in your major' });
    }

    const result = await pool.query(
      `UPDATE students SET status = 'banned'
       WHERE id = $1 AND status = 'pending'
       RETURNING id, full_name, email, status`,
      [student_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Student not pending' });
    }

    res.json({ message: 'Student rejected', student: result.rows[0] });
  } catch (err) {
    console.error('rejectStudent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Enroll Student in Courses
// ============================
exports.enrollStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const headId = req.user.id;
    const { student_id } = req.params;
    const { course_ids } = req.body;

    if (!Array.isArray(course_ids) || course_ids.length === 0) {
      return res.status(400).json({ message: 'course_ids must be a non-empty array' });
    }

    // Verify student in head's major
    const studentCheck = await client.query(
      `SELECT s.id, s.major_id, s.academic_year FROM students s
       JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Student not in your major' });
    }

    const student = studentCheck.rows[0];

    await client.query('BEGIN');

    const enrolled = [];
    const skipped = [];

    for (const courseId of course_ids) {
      // Verify course in student's major + year
      const courseCheck = await client.query(
        `SELECT id, course_code, academic_year FROM courses
         WHERE id = $1 AND major_id = $2`,
        [courseId, student.major_id]
      );

      if (courseCheck.rows.length === 0) {
        skipped.push({ course_id: courseId, reason: 'Not in your major' });
        continue;
      }

      if (courseCheck.rows[0].academic_year !== student.academic_year) {
        skipped.push({ course_id: courseId, reason: 'Wrong academic year' });
        continue;
      }

      // Insert enrollment
      try {
        await client.query(
          `INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2)`,
          [student_id, courseId]
        );
        enrolled.push(courseCheck.rows[0]);
      } catch (e) {
        if (e.code === '23505') {
          skipped.push({ course_id: courseId, reason: 'Already enrolled' });
        } else {
          throw e;
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Enrollment complete',
      enrolled,
      skipped
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('enrollStudent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

// ============================
// Get Student Enrollments
// ============================
exports.getStudentEnrollments = async (req, res) => {
  try {
    const headId = req.user.id;
    const { student_id } = req.params;

    // Verify student in head's major
    const check = await pool.query(
      `SELECT s.id FROM students s
       JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Student not in your major' });
    }

    const result = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.academic_year
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = $1
       ORDER BY c.course_code`,
      [student_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getStudentEnrollments error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Remove Student Enrollment
// ============================
exports.removeEnrollment = async (req, res) => {
  try {
    const headId = req.user.id;
    const { student_id, course_id } = req.params;

    // Verify student in head's major
    const check = await pool.query(
      `SELECT s.id FROM students s
       JOIN majors m ON s.major_id = m.id
       WHERE s.id = $1 AND m.head_staff_id = $2`,
      [student_id, headId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Student not in your major' });
    }

    const result = await pool.query(
      `DELETE FROM enrollments WHERE student_id = $1 AND course_id = $2 RETURNING id`,
      [student_id, course_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    res.json({ message: 'Enrollment removed' });
  } catch (err) {
    console.error('removeEnrollment error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};