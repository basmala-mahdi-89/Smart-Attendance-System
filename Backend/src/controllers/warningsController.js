const pool = require('../config/db');
const nodemailer = require('nodemailer');

// ⚠️ TEST MODE: يطبع في Terminal بدل إرسال
const TEST_MODE = true;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ============================
// Doctor: Set Absence Limit
// ============================
exports.setAbsenceLimit = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;
    const { max_absence_percentage } = req.body;

    if (max_absence_percentage === undefined || max_absence_percentage < 0 || max_absence_percentage > 100) {
      return res.status(400).json({ message: 'max_absence_percentage must be between 0 and 100' });
    }

    // Verify doctor on this course
    const check = await pool.query(
      `SELECT id FROM course_staff WHERE course_id = $1 AND staff_id = $2`,
      [course_id, doctorId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Course not assigned to you' });
    }

    await pool.query(
      `UPDATE courses SET max_absence_percentage = $1 WHERE id = $2`,
      [max_absence_percentage, course_id]
    );

    res.json({ 
      message: 'Absence limit updated',
      max_absence_percentage 
    });
  } catch (err) {
    console.error('setAbsenceLimit error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Doctor: Get Absence Limit
// ============================
exports.getAbsenceLimit = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;

    const check = await pool.query(
      `SELECT c.id, c.course_code, c.max_absence_percentage
       FROM courses c
       JOIN course_staff cs ON cs.course_id = c.id
       WHERE c.id = $1 AND cs.staff_id = $2`,
      [course_id, doctorId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Course not assigned to you' });
    }

    res.json(check.rows[0]);
  } catch (err) {
    console.error('getAbsenceLimit error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Doctor: Send Warnings (Manual)
// ============================
exports.sendWarnings = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;

    // Verify doctor on this course + get limit
    const courseRes = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.max_absence_percentage
       FROM courses c
       JOIN course_staff cs ON cs.course_id = c.id
       WHERE c.id = $1 AND cs.staff_id = $2`,
      [course_id, doctorId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(403).json({ message: 'Course not assigned to you' });
    }

    const course = courseRes.rows[0];
    const maxAllowed = parseFloat(course.max_absence_percentage);

    // Total sessions
    const sessRes = await pool.query(
      `SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1`,
      [course_id]
    );
    const totalSessions = parseInt(sessRes.rows[0].total);

    if (totalSessions === 0) {
      return res.json({ 
        message: 'No sessions yet',
        total_sessions: 0,
        warnings_sent: []
      });
    }

    // Students with attendance
    const studentsRes = await pool.query(
      `SELECT 
         s.id AS student_id,
         s.full_name,
         s.email,
         s.national_id,
         COUNT(DISTINCT a.session_id) AS attended
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN attendance a ON a.student_id = s.id 
         AND a.session_id IN (SELECT id FROM sessions WHERE course_id = $1)
       WHERE e.course_id = $1
       GROUP BY s.id, s.full_name, s.email, s.national_id`,
      [course_id]
    );

    const results = {
      course: {
        id: course.id,
        course_code: course.course_code,
        course_name: course.course_name,
        max_absence_percentage: maxAllowed
      },
      total_sessions: totalSessions,
      total_students: studentsRes.rows.length,
      warnings_sent: [],
      skipped: []
    };

    for (const s of studentsRes.rows) {
      const attended = parseInt(s.attended);
      const absencePct = ((totalSessions - attended) / totalSessions) * 100;

      // Check if exceeds limit
      if (absencePct <= maxAllowed) {
        continue; // تحت الحد
      }

      const exceededBy = absencePct - maxAllowed;

      // Determine level
      let level;
      if (exceededBy > 15) {
        level = 2; // Final Warning
      } else {
        level = 1; // Warning
      }

      // Check if already sent
      const existing = await pool.query(
        `SELECT id FROM warnings 
         WHERE student_id = $1 AND course_id = $2 AND level = $3`,
        [s.student_id, course_id, level]
      );

      if (existing.rows.length > 0) {
        results.skipped.push({
          student_id: s.student_id,
          full_name: s.full_name,
          level,
          reason: 'Already sent'
        });
        continue;
      }

      // Insert warning
      await pool.query(
        `INSERT INTO warnings (student_id, course_id, level, absence_percentage, max_allowed)
         VALUES ($1, $2, $3, $4, $5)`,
        [s.student_id, course_id, level, absencePct, maxAllowed]
      );

      // Send email (TEST MODE)
      const levelText = level === 1 ? '⚠️ Warning' : '🚨 Final Warning';
      
      if (TEST_MODE) {
        console.log('');
        console.log('════════════════════════════════════════');
        console.log(`${levelText} EMAIL (TEST MODE)`);
        console.log('════════════════════════════════════════');
        console.log('   To:      ', s.email);
        console.log('   Student: ', s.full_name);
        console.log('   Course:  ', course.course_code, '-', course.course_name);
        console.log('   Absence: ', absencePct.toFixed(1) + '%');
        console.log('   Allowed: ', maxAllowed + '%');
        console.log('   Level:   ', level);
        console.log('════════════════════════════════════════');
      } else {
        try {
          await transporter.sendMail({
            from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
            to: s.email,
            subject: `${levelText} - ${course.course_code}`,
            html: `
              <h2>${levelText}</h2>
              <p>Dear ${s.full_name},</p>
              <p>Your attendance in <b>${course.course_code} - ${course.course_name}</b> has exceeded the allowed limit.</p>
              <ul>
                <li>Total Sessions: <b>${totalSessions}</b></li>
                <li>Attended: <b>${attended}</b></li>
                <li>Absence: <b>${absencePct.toFixed(1)}%</b></li>
                <li>Max Allowed: <b>${maxAllowed}%</b></li>
              </ul>
              <p>Please improve your attendance.</p>
              <p>Regards,<br/>Smart Attendance System</p>
            `
          });
        } catch (emailErr) {
          console.error('Email error:', emailErr.message);
        }
      }

      results.warnings_sent.push({
        student_id: s.student_id,
        full_name: s.full_name,
        level,
        absence_percentage: parseFloat(absencePct.toFixed(2)),
        max_allowed: maxAllowed
      });
    }

    res.json({
      message: `Warnings sent: ${results.warnings_sent.length}, Skipped: ${results.skipped.length}`,
      ...results
    });
  } catch (err) {
    console.error('sendWarnings error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Student: Get My Warnings
// ============================
exports.getMyWarnings = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `SELECT w.id, w.level, w.absence_percentage, w.max_allowed, w.sent_at,
              c.course_code, c.course_name
       FROM warnings w
       JOIN courses c ON w.course_id = c.id
       WHERE w.student_id = $1
       ORDER BY w.sent_at DESC`,
      [studentId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('getMyWarnings error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Head: View All Warnings in Major
// ============================
exports.headViewWarnings = async (req, res) => {
  try {
    const headId = req.user.id;

    const majorRes = await pool.query(
      `SELECT id FROM majors WHERE head_staff_id = $1`,
      [headId]
    );

    if (majorRes.rows.length === 0) {
      return res.status(404).json({ message: 'No major assigned' });
    }

    const result = await pool.query(
      `SELECT w.id, w.level, w.absence_percentage, w.max_allowed, w.sent_at,
              s.full_name AS student_name, s.national_id, s.email,
              c.course_code, c.course_name
       FROM warnings w
       JOIN students s ON w.student_id = s.id
       JOIN courses c ON w.course_id = c.id
       WHERE c.major_id = $1
       ORDER BY w.sent_at DESC`,
      [majorRes.rows[0].id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('headViewWarnings error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};