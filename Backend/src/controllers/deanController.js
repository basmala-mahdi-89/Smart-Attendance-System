const pool = require('../config/db');

// ============================
// MAJORS
// ============================

// Add Major
exports.addMajor = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO majors (name) VALUES ($1) RETURNING *`,
      [name]
    );

    res.status(201).json({ message: 'Major added', major: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Major already exists' });
    }
    console.error('addMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Majors
exports.getMajors = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, s.full_name AS head_name, s.email AS head_email
       FROM majors m
       LEFT JOIN staff s ON m.head_staff_id = s.id
       ORDER BY m.id`
    );
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

    const result = await pool.query(
      `UPDATE majors SET name = $1 WHERE id = $2 RETURNING *`,
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Major not found' });
    }
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
    const result = await pool.query(
      `DELETE FROM majors WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Major not found' });
    }
    res.json({ message: 'Major deleted' });
  } catch (err) {
    console.error('deleteMajor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};