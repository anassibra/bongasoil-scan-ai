const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('index.html.backup-avant-projectselect', html);

const anchor = `<p id="newUserError" class="auth-error" style="display:none;"></p>`;
if (!html.includes(anchor)) { console.error('❌ Ancre non trouvée'); process.exit(1); }

const injection = `<div id="newUserProjectsWrap" style="display:none; margin-bottom:14px;">
            <label style="display:block; margin-bottom:6px; font-size:13px; color:#64748b;">Acces aux projets</label>
            <div id="newUserProjectsList" class="project-checkbox-box"></div>
          </div>
          ` + anchor;

html = html.replace(anchor, injection);
fs.writeFileSync('index.html', html);
console.log('✅ index.html mis à jour.');
