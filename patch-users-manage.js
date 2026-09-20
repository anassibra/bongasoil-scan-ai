const fs = require('fs');
let code = fs.readFileSync('routes-users.js', 'utf8');
fs.writeFileSync('routes-users.js.backup-avant-manage', code);

const anchor = 'module.exports = router;';
if (!code.includes(anchor)) { console.error('❌ Ancre non trouvée'); process.exit(1); }

const addition = `
// Voir les projets actuellement accessibles a un utilisateur
router.get('/:id/access', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const target = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (role !== 'admin' && target.rows[0].created_by !== userId) return res.status(403).json({ error: 'Acces refuse' });
    const result = await pool.query('SELECT project_id FROM project_access WHERE user_id=$1', [req.params.id]);
    res.json(result.rows.map(r => r.project_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier le statut actif/inactif et/ou les projets accessibles
router.patch('/:id', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const target = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (role !== 'admin' && target.rows[0].created_by !== userId) return res.status(403).json({ error: 'Acces refuse' });

    const { active, projectIds } = req.body;

    if (typeof active === 'boolean') {
      await pool.query('UPDATE users SET active=$1 WHERE id=$2', [active, req.params.id]);
    }

    if (Array.isArray(projectIds)) {
      await pool.query('DELETE FROM project_access WHERE user_id=$1', [req.params.id]);
      for (const pid of projectIds) {
        await pool.query(
          'INSERT INTO project_access (project_id, user_id, granted_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [pid, req.params.id, userId]
        );
      }
    }

    const updated = await pool.query('SELECT id, username, full_name, role, active FROM users WHERE id=$1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
`;

code = code.replace(anchor, addition + '\n' + anchor);
fs.writeFileSync('routes-users.js', code);
console.log('✅ routes-users.js mis à jour.');
