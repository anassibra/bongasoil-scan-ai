function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Non authentifié' });
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  };
}
module.exports = { requireAuth, requireRole };
