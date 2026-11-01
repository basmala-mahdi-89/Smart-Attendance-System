const pool = require('../config/db');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

exports.sendWarnings = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { course_id } = req.params;
    const { student_ids } = req.body; 

    if (!student_ids || student_ids.length === 0) {
      return res.status(400).json({ message: 'Please select at least one student.' });
    }

    // 1. Get Course Details & Limit (بيشتغل للدكتور والمهندس)
    const courseRes = await pool.query(
      `SELECT c.id, c.course_code, c.course_name, c.max_absence_percentage
       FROM courses c JOIN course_staff cs ON cs.course_id = c.id
       WHERE c.id = $1 AND cs.staff_id = $2`,
      [course_id, doctorId]
    );
    
    if (courseRes.rows.length === 0) return res.status(403).json({ message: 'Access denied. You are not assigned to this course.' });

    const course = courseRes.rows[0];
    const maxAllowed = parseFloat(course.max_absence_percentage || 25);

    // 2. Total Sessions
    const sessRes = await pool.query(
      `SELECT COUNT(*) AS total FROM sessions WHERE course_id = $1 AND is_active = FALSE`, [course_id]
    );
    const totalSessions = parseInt(sessRes.rows[0].total);
    
    if (totalSessions === 0) return res.json({ message: 'No lectures held yet.', warnings_sent: [] });

    const warningsSent = [];
    const skipped = [];

    // 3. Loop over SELECTED students
    for (const studentId of student_ids) {
      const studentRes = await pool.query(
        `SELECT s.id, s.full_name, s.email, COUNT(DISTINCT a.session_id) AS attended
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id IN (SELECT id FROM sessions WHERE course_id = $1 AND is_active = FALSE)
         WHERE s.id = $2
         GROUP BY s.id, s.full_name, s.email`,
        [course_id, studentId]
      );

      if (studentRes.rows.length === 0) continue;
      const s = studentRes.rows[0];
      const attended = parseInt(s.attended);
      const absencePct = ((totalSessions - attended) / totalSessions) * 100;

      const level = (absencePct > maxAllowed + 15) ? 2 : 1;

      // Check if already sent
      const existing = await pool.query(
        `SELECT id FROM warnings WHERE student_id = $1 AND course_id = $2 AND level = $3`,
        [s.id, course_id, level]
      );

      if (existing.rows.length > 0) {
        skipped.push({ student: s.full_name, reason: 'Already sent this level' });
        continue;
      }

      // Insert Warning
      await pool.query(
        `INSERT INTO warnings (student_id, course_id, level, absence_percentage, max_allowed) VALUES ($1, $2, $3, $4, $5)`,
        [s.id, course_id, level, absencePct, maxAllowed]
      );

      // Send Email
      let emailFailed = false;
      try {
        await transporter.sendMail({
          from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
          to: s.email,
          subject: `⚠️ Warning - Absence in ${course.course_code}`,
          html: `
            <h2>Warning Level ${level}</h2>
            <p>Dear ${s.full_name},</p>
            <p>You have been issued a warning in <b>${course.course_code} - ${course.course_name}</b>.</p>
            <ul>
              <li>Total Lectures: ${totalSessions}</li>
              <li>Attended: ${attended}</li>
              <li>Your Absence: <b>${absencePct.toFixed(1)}%</b></li>
              <li>Max Allowed: <b>${maxAllowed}%</b></li>
            </ul>
            <p>Please contact your doctor immediately.</p>
          `
        });
      } catch (err) { console.error('Email error:', err.message); emailFailed = true; }

      warningsSent.push({ student: s.full_name, level, absence: absencePct.toFixed(1), email_failed: emailFailed });
    }

    const failedEmails = warningsSent.filter((w) => w.email_failed).length;
    // Audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [doctorId, 'doctor', 'SEND_WARNINGS', 'course', course_id, JSON.stringify({ sent: warningsSent.length, failed_emails: failedEmails, skipped: skipped.length }), req.ip]
      );
    } catch (e) { console.error('audit error:', e.message); }

    res.json({ message: `Sent ${warningsSent.length} warnings.`, warnings_sent: warningsSent, skipped, failed_emails: failedEmails });
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
    const result = await pool.query(
      `SELECT w.id, w.level, w.absence_percentage, w.max_allowed, w.sent_at, 
              c.id AS course_id, c.course_code, c.course_name
       FROM warnings w
       JOIN courses c ON w.course_id = c.id
       WHERE w.student_id = $1
       ORDER BY w.sent_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getMyWarnings error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// DEAN: Send Custom Warning to Staff
// ============================
exports.sendStaffWarning = async (req, res) => {
  try {
    const { staff_ids, message } = req.body;

    if (!staff_ids || staff_ids.length === 0 || !message) {
      return res.status(400).json({ message: 'Select staff and write a message' });
    }

    // جلب إيميلات الدكاترة
    const staffRes = await pool.query(
      `SELECT id, full_name, email FROM staff WHERE id = ANY($1::int[])`,
      [staff_ids]
    );

    let sentCount = 0;
    let failedCount = 0;
    for (const staff of staffRes.rows) {
      try {
        await transporter.sendMail({
          from: `"Dean of Faculty" <${process.env.EMAIL_USER}>`,
          to: staff.email,
          subject: `⚠️ Important Notice from the Dean`,
          html: `
            <h2>Hello Dr. ${staff.full_name},</h2>
            <p style="white-space: pre-wrap;">${message}</p>
            <br/>
            <p>Regards,<br/>Dean's Office</p>
          `
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${staff.email}:`, err.message);
        failedCount++;
      }
    }

    try {
      await pool.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, 'dean', 'SEND_STAFF_WARNING', 'staff', null, JSON.stringify({ sent: sentCount, failed: failedCount, total: staffRes.rows.length }), req.ip]
      );
    } catch (e) { console.error('audit error:', e.message); }

    res.json({ message: `Warning sent to ${sentCount} staff member(s).`, sent: sentCount, failed: failedCount });
  } catch (err) {
    console.error('sendStaffWarning error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};