const fs = require('fs');
let code = fs.readFileSync('auth.js', 'utf8');
fs.writeFileSync('auth.js.backup-avant-displayprojects', code);

const anchor = `              <span class="user-status-badge \${statusClass}">\${statusLabel}</span>
              <div class="user-username">@\${escapeHtml(u.username)}</div>`;

if (!code.includes(anchor)) { console.error('❌ Ancre non trouvée'); process.exit(1); }

const replacement = `              <span class="user-status-badge \${statusClass}">\${statusLabel}</span>
              <div class="user-username">@\${escapeHtml(u.username)}</div>
              \${u.role === 'collaborator' ? '<div class="user-projects">' + (u.project_names && u.project_names.length ? '📁 ' + u.project_names.map(escapeHtml).join(', ') : '<span class=\\'no-access\\'>Aucun projet assigne</span>') + '</div>' : ''}`;

code = code.replace(anchor, replacement);
fs.writeFileSync('auth.js', code);
console.log('✅ auth.js mis à jour.');
