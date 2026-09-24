const fs = require('fs');
let code = fs.readFileSync('routes-users.js', 'utf8');
fs.writeFileSync('routes-users.js.backup-avant-delete', code);

const anchor = 'module.exports = router;';
if (!code.includes(anchor)) { console.error('❌ Ancre non trouvée'); process.exit(1); }

const addition = `
// Supprimer definitivement un utilisateur
router.delete('/:id', async (req, res) => {
  try {
    const { userId, role } = req.session;
    const target = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (role !== 'admin' && target.rows[0].created_by !== userId) return res.status(403).json({ error: 'Acces refuse' });

    await pool.query('DELETE FROM project_access WHERE user_id=$1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Impossible: cet utilisateur a deja enregistre des bons/tickets. Desactivez-le plutot pour garder l\\'historique.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
`;

code = code.replace(anchor, addition + '\n' + anchor);
fs.writeFileSync('routes-users.js', code);
console.log('✅ routes-users.js mis à jour.');
