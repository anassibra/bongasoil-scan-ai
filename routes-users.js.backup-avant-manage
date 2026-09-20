const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const { username, password, fullName, projectIds } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({ error: 'Champs requis manquants' });

    let newRole;
    if (role === 'admin') newRole = 'client';
    else if (role === 'client') newRole = 'collaborator';
    else return res.status(403).json({ error: 'Accès refusé' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, username, full_name, role`,
      [username, hash, fullName, newRole, userId]
    );
    const newUser = result.rows[0];

    if (newRole === 'collaborator' && Array.isArray(projectIds)) {
      for (const pid of projectIds) {
        await pool.query(
          `INSERT INTO project_access (project_id, user_id, granted_by) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [pid, newUser.id, userId]
        );
      }
    }
    res.json(newUser);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Cet identifiant existe déjà' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { userId } = req.session;
    const result = await pool.query(
      'SELECT id, username, full_name, role, active, created_at FROM users WHERE created_by = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
