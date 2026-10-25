const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendInvitationEmail } = require('../utils/emailService');

// ============================
// Create Invitation (Dean → Head, Head → Doctor/Engineer)
// ============================
exports.createInvitation = async (req, res) => {
  try {
    const { email, national_id, full_name, role, major_id } = req.body;
    const invitedBy = req.user.id;
    const inviterRole = req.user.role;

    // ====== Validation ======
    if (!email || !national_id || !full_name || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Rule 1: Dean → only 'head'
    if (inviterRole === 'dean' && role !== 'head') {
      return res.status(403).json({ message: 'Dean can only invite Heads' });
    }

    // Rule 2: Head → only 'doctor' or 'engineer'
    if (inviterRole === 'head' && !['doctor', 'engineer'].includes(role)) {
      return res.status(403).json({ message: 'Head can only invite Doctors or Engineers' });
    }

    // Rule 3: Doctor → only 'engineer'
    if (inviterRole === 'doctor' && role !== 'engineer') {
      return res.status(403).json({ message: 'Doctor can only invite Engineers' });
    }

    // Rule 4: Engineer → can't invite anyone
    if (inviterRole === 'engineer') {
      return res.status(403).json({ message: 'Engineers cannot send invitations' });
    }

    // Head invitation must have major_id
    if (role === 'head' && !major_id) {
      return res.status(400).json({ message: 'major_id is required for Head invitations' });
    }

    // ⚡ CHECK 1: Does this major already have a Head?
    if (role === 'head' && major_id) {
      const majorHasHead = await pool.query(
        `SELECT id FROM staff WHERE major_id = $1 AND role = 'head'`,
        [major_id]
      );
      if (majorHasHead.rows.length > 0) {
        return res.status(400).json({ message: 'This major already has a head. Remove the existing head first.' });
      }
    }

    // Check if email already exists in staff
    const existingStaff = await pool.query(
      `SELECT id FROM staff WHERE email = $1 OR national_id = $2`,
      [email, national_id]
    );
    if (existingStaff.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists in staff' });
    }

    // Check if pending invitation exists
    const existingInvite = await pool.query(
      `SELECT id FROM invitations WHERE email = $1 AND status = 'pending'`,
      [email]
    );
    if (existingInvite.rows.length > 0) {
      return res.status(400).json({ message: 'Pending invitation already exists' });
    }

    // ====== Generate Token ======
       const token = crypto.randomBytes(32).toString('hex');
  

    // ====== Insert Invitation ======
    // ====== Insert Invitation ======
    const result = await pool.query(
      `INSERT INTO invitations (email, national_id, full_name, role, invited_by, major_id, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days') 
       RETURNING id, email, full_name, role, token, expires_at`,
      [email, national_id, full_name, role, invitedBy, major_id || null, token]
    );

    // ====== Send Email ======
    try {
      const frontendOrigin = req.headers.origin || process.env.FRONTEND_URL;
await sendInvitationEmail(email, full_name, role, token, frontendOrigin);
    } catch (emailErr) {
      console.error('Email error:', emailErr.message);
      // Roll back invitation if email fails
      await pool.query(`DELETE FROM invitations WHERE id = $1`, [result.rows[0].id]);
      return res.status(500).json({ message: 'Failed to send email. Check your EMAIL_USER/EMAIL_PASS.' });
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: result.rows[0]
    });
  } catch (err) {
    console.error('createInvitation error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get All Invitations (by current user)
// ============================
exports.getInvitations = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT i.*, m.name AS major_name
       FROM invitations i
       LEFT JOIN majors m ON i.major_id = m.id
       WHERE i.invited_by = $1
       ORDER BY i.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getInvitations error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Get Invitation by Token (public)
// ============================
exports.getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `SELECT i.id, i.email, i.national_id, i.full_name, i.role, i.status, i.expires_at, m.name AS major_name
       FROM invitations i
       LEFT JOIN majors m ON i.major_id = m.id
       WHERE i.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    const invitation = result.rows[0];

    if (invitation.status === 'accepted') {
      return res.status(400).json({ message: 'Invitation already accepted' });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await pool.query(
        `UPDATE invitations SET status = 'expired' WHERE id = $1`,
        [invitation.id]
      );
      return res.status(400).json({ message: 'Invitation expired' });
    }

    res.json(invitation);
  } catch (err) {
    console.error('getInvitationByToken error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================
// Accept Invitation (public)
// ============================
exports.acceptInvitation = async (req, res) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    await client.query('BEGIN');

    // Get invitation
    const invRes = await client.query(
      `SELECT * FROM invitations WHERE token = $1`,
      [token]
    );

    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invitation not found' });
    }

    const invitation = invRes.rows[0];

    if (invitation.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Invitation is ${invitation.status}` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await client.query(
        `UPDATE invitations SET status = 'expired' WHERE id = $1`,
        [invitation.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ message: 'Invitation expired' });
    }

    // ⚡ CHECK 2: If role is 'head', check if major already has a head
    if (invitation.role === 'head' && invitation.major_id) {
      const existingHead = await client.query(
        `SELECT id FROM staff WHERE major_id = $1 AND role = 'head'`,
        [invitation.major_id]
      );
      
      if (existingHead.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'This major already has a head. Cannot accept invitation.' 
        });
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create staff
    const staffRes = await client.query(
      `INSERT INTO staff (national_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role`,
      [invitation.national_id, invitation.full_name, invitation.email, password_hash, invitation.role]
    );

    const newStaff = staffRes.rows[0];

    // If Head → link to major
    if (invitation.role === 'head' && invitation.major_id) {
      // Update staff major_id
      await client.query(
        `UPDATE staff SET major_id = $1 WHERE id = $2`,
        [invitation.major_id, newStaff.id]
      );
      
      // Link major to head
      await client.query(
        `UPDATE majors SET head_staff_id = $1 WHERE id = $2`,
        [newStaff.id, invitation.major_id]
      );
    }

    // Mark invitation as accepted
    await client.query(
      `UPDATE invitations SET status = 'accepted' WHERE id = $1`,
      [invitation.id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Invitation accepted successfully. You can now login.',
      user: newStaff
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('acceptInvitation error:', err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};