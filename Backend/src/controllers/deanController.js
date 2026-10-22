const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Add Major
exports.addMajor = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const result = await pool.query(`INSERT INTO majors (name) VALUES ($1) RETURNING *`, [name]);
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
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const result = await pool.query(`UPDATE majors SET name = $1 WHERE id = $2 RETURNING *`, [name, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Major not found' });
    res.json({ message: 'Major updated', major: result.rows[0] });
  } catch (err) {
    console.error('updateMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete Major
exports.deleteMajor = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM majors WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Major not found' });
    res.json({ message: 'Major deleted' });
  } catch (err) {
    console.error('deleteMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add Head
exports.addHead = async (req, res) => {
  try {
    const { national_id, full_name, email, password, major_id } = req.body;
    if (!national_id || !full_name || !email || !password || !major_id) return res.status(400).json({ message: 'All fields are required' });
    
    const majorRes = await pool.query(`SELECT id FROM majors WHERE id = $1`, [major_id]);
    if (majorRes.rows.length === 0) return res.status(404).json({ message: 'Major not found' });

    const existingHead = await pool.query(`SELECT id FROM staff WHERE major_id = $1 AND role = 'head'`, [major_id]);
    if (existingHead.rows.length > 0) return res.status(400).json({ message: 'This major already has a head' });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO staff (national_id, full_name, email, password_hash, role, major_id) VALUES ($1, $2, $3, $4, 'head', $5) RETURNING id, full_name, email, role, major_id`,
      [national_id, full_name, email, password_hash, major_id]
    );
    await pool.query(`UPDATE majors SET head_staff_id = $1 WHERE id = $2`, [result.rows[0].id, major_id]);
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
    const headRes = await pool.query(`SELECT id, major_id FROM staff WHERE id = $1 AND role = 'head'`, [id]);
    if (headRes.rows.length === 0) return res.status(404).json({ message: 'Head not found' });
    const oldMajorId = headRes.rows[0].major_id;
    await pool.query(`UPDATE staff SET full_name = $1, email = $2, major_id = $3 WHERE id = $4`, [full_name, email, major_id || null, id]);
    if (major_id && major_id !== oldMajorId) {
      await pool.query(`UPDATE majors SET head_staff_id = NULL WHERE head_staff_id = $1`, [id]);
      await pool.query(`UPDATE majors SET head_staff_id = $1 WHERE id = $2`, [id, major_id]);
    }
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
    const headRes = await pool.query(`SELECT email FROM staff WHERE id = $1 AND role = 'head'`, [id]);
    if (headRes.rows.length === 0) return res.status(404).json({ message: 'Head not found' });
    const headEmail = headRes.rows[0].email;
    await pool.query(`UPDATE majors SET head_staff_id = NULL WHERE head_staff_id = $1`, [id]);
    await pool.query(`DELETE FROM staff WHERE id = $1`, [id]);
    await pool.query(`DELETE FROM invitations WHERE email = $1`, [headEmail]);
    res.json({ message: 'Head deleted successfully' });
  } catch (err) {
    console.error('deleteHead error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};