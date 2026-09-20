const express = require('express');
const { pool } = require('./db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { userId, role } = req.session;
    let result;
    if (role === 'admin') {
      result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    } else if (role === 'client') {
      result = await pool.query('SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC', [userId]);
    } else {
      result = await pool.query(
        `SELECT p.* FROM projects p
         JOIN project_access pa ON pa.project_id = p.id
         WHERE pa.user_id = $1 ORDER BY p.created_at DESC`, [userId]);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, role } = req.session;
    if (role !== 'client' && role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    const { name, production, responsable } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom du projet requis' });
    const result = await pool.query(
      `INSERT INTO projects (name, production, responsable, owner_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, production || null, responsable || null, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
