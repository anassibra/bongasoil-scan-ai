const express = require('express');
const { pool } = require('./db');
const router = express.Router();

async function hasProjectAccess(userId, role, projectId) {
  if (role === 'admin') return true;
  const proj = await pool.query('SELECT owner_id FROM projects WHERE id = $1', [projectId]);
  if (proj.rows.length === 0) return false;
  if (role === 'client') return proj.rows[0].owner_id === userId;
  const access = await pool.query(
    'SELECT 1 FROM project_access WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return access.rows.length > 0;
}

// GET /api/records?projectId=1&type=gasoil
router.get('/', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const projectId = parseInt(req.query.projectId);
    if (!projectId) return res.status(400).json({ error: 'projectId requis' });
    if (!(await hasProjectAccess(userId, role, projectId))) {
      return res.status(403).json({ error: 'Accès refusé à ce projet' });
    }
    const params = [projectId];
    let query = `
      SELECT r.id, r.type, r.data, r.created_at, r.updated_at,
             uc.username AS created_by_username,
             uu.username AS updated_by_username
      FROM records r
      JOIN users uc ON uc.id = r.created_by
      LEFT JOIN users uu ON uu.id = r.updated_by
      WHERE r.project_id = $1`;
    if (req.query.type) {
      params.push(req.query.type);
      query += ` AND r.type = $2`;
    }
    query += ` ORDER BY r.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/records
router.post('/', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const { projectId, type, data } = req.body;
    if (!projectId || !type || !data) return res.status(400).json({ error: 'Champs manquants' });
    if (!['gasoil', 'autoroute', 'charge'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide' });
    }
    if (!(await hasProjectAccess(userId, role, projectId))) {
      return res.status(403).json({ error: 'Accès refusé à ce projet' });
    }
    const result = await pool.query(
      `INSERT INTO records (project_id, type, data, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [projectId, type, data, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/records/:id
router.put('/:id', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const { data } = req.body;
    const existing = await pool.query('SELECT project_id FROM records WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Introuvable' });
    if (!(await hasProjectAccess(userId, role, existing.rows[0].project_id))) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const result = await pool.query(
      `UPDATE records SET data = $1, updated_by = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [data, userId, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/records/:id
router.delete('/:id', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const existing = await pool.query('SELECT project_id FROM records WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Introuvable' });
    if (!(await hasProjectAccess(userId, role, existing.rows[0].project_id))) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    await pool.query('DELETE FROM records WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
