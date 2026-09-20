const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
const anchor = "const app = express();";
if (!code.includes(anchor)) {
  console.error('❌ Ancre non trouvée');
  process.exit(1);
}
if (code.includes("trust proxy")) {
  console.log('ℹ️ Déjà présent, rien à faire.');
} else {
  code = code.replace(anchor, anchor + "\napp.set('trust proxy', 1);");
  fs.writeFileSync('server.js', code);
  console.log('✅ trust proxy ajouté.');
}
