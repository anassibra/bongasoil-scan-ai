const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND active = true', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fullName = user.full_name;
    req.session.role = user.role;
    res.json({ id: user.id, username: user.username, fullName: user.full_name, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Non authentifié' });
  res.json({
    id: req.session.userId,
    username: req.session.username,
    fullName: req.session.fullName,
    role: req.session.role
  });
});

module.exports = router;
