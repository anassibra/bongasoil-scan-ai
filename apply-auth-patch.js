const fs = require('fs');

const original = fs.readFileSync('server.js', 'utf8');
fs.writeFileSync('server.js.backup-avant-auth', original);
console.log('✅ Sauvegarde créée : server.js.backup-avant-auth');

let code = original;

// 1. Brancher les sessions + routes auth/projets/utilisateurs juste après express.static
const anchor = "app.use(express.static(__dirname));";
if (!code.includes(anchor)) {
  console.error('❌ Ancre non trouvée, arrêt sans modification.');
  process.exit(1);
}

const injection = anchor + `

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');
const { requireAuth } = require('./auth-middleware');
const authRoutes = require('./routes-auth');
const projectRoutes = require('./routes-projects');
const userRoutes = require('./routes-users');

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'changez-moi-en-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' }
}));

app.use('/api', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/users', requireAuth, userRoutes);
`;

code = code.replace(anchor, injection);

// 2. Protéger les routes d'extraction existantes (ajout de requireAuth)
const before = code;
code = code.replace(/app\.post\('(\/api\/extract[^']*)',\s*async/g, "app.post('$1', requireAuth, async");
const count = (before.match(/app\.post\('\/api\/extract[^']*',\s*async/g) || []).length;
console.log(`✅ ${count} routes d'extraction protégées par requireAuth.`);

fs.writeFileSync('server.js', code);
console.log('✅ server.js mis à jour avec succès.');
