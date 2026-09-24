const fs = require('fs');

// ---- 1. auth.js : bouton Supprimer ----
let js = fs.readFileSync('auth.js', 'utf8');
fs.writeFileSync('auth.js.backup-avant-delete', js);

const anchorJs = `            <button type="button" class="btn-link btn-toggle-active" data-id="\${u.id}" data-active="\${u.active}">\${u.active ? 'Desactiver' : 'Reactiver'}</button>
          </div>`;

if (!js.includes(anchorJs)) { console.error('❌ Ancre JS non trouvée'); process.exit(1); }

const replacementJs = `            <button type="button" class="btn-link btn-toggle-active" data-id="\${u.id}" data-active="\${u.active}">\${u.active ? 'Desactiver' : 'Reactiver'}</button>
            <button type="button" class="btn-link btn-delete-user" data-id="\${u.id}" style="color:#dc2626;">Supprimer</button>
          </div>`;

js = js.replace(anchorJs, replacementJs);

const anchorListeners = `      list.querySelectorAll('.btn-edit-access').forEach(btn => {`;
if (!js.includes(anchorListeners)) { console.error('❌ Ancre listeners non trouvée'); process.exit(1); }

const deleteListener = `      list.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (!confirm('Supprimer definitivement ce compte ? Cette action est irreversible.')) return;
          const res = await fetch('/api/users/' + id, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) { loadUsers(); } else { alert(data.error || 'Erreur lors de la suppression.'); }
        });
      });

      list.querySelectorAll('.btn-edit-access').forEach(btn => {`;

js = js.replace(anchorListeners, deleteListener);
fs.writeFileSync('auth.js', js);
console.log('✅ auth.js mis à jour (bouton Supprimer).');

// ---- 2. index.html : oeil pour afficher/masquer le mot de passe ----
let html = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('index.html.backup-avant-eye', html);

const passwordFields = [
  { id: 'loginPassword' },
  { id: 'newUserPassword' }
];

passwordFields.forEach(({ id }) => {
  const regex = new RegExp(`(<input type="password" id="${id}"[^>]*>)`);
  const match = html.match(regex);
  if (match) {
    const wrapped = `<div class="password-wrap">${match[1]}<button type="button" class="btn-eye" data-target="${id}">👁</button></div>`;
    html = html.replace(match[1], wrapped);
  } else {
    console.log('⚠️ Champ non trouvé pour oeil: ' + id);
  }
});

fs.writeFileSync('index.html', html);
console.log('✅ index.html mis à jour (oeil mot de passe).');
