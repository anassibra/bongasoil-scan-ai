const fs = require('fs');
let code = fs.readFileSync('routes-users.js', 'utf8');
fs.writeFileSync('routes-users.js.backup-avant-listprojects', code);

const anchor = `router.get('/', async (req, res) => {
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
});`;

if (!code.includes(anchor)) { console.error('❌ Ancre non trouvée'); process.exit(1); }

const replacement = `router.get('/', async (req, res) => {
  try {
    const { userId } = req.session;
    const result = await pool.query(
      \`SELECT u.id, u.username, u.full_name, u.role, u.active, u.created_at,
              COALESCE(
                json_agg(p.name) FILTER (WHERE p.name IS NOT NULL), '[]'
              ) AS project_names
       FROM users u
       LEFT JOIN project_access pa ON pa.user_id = u.id
       LEFT JOIN projects p ON p.id = pa.project_id
       WHERE u.created_by = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC\`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});`;

code = code.replace(anchor, replacement);
fs.writeFileSync('routes-users.js', code);
console.log('✅ routes-users.js mis à jour.');
