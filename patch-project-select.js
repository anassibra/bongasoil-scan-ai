const fs = require('fs');
let code = fs.readFileSync('auth.js', 'utf8');
fs.writeFileSync('auth.js.backup-avant-projectselect', code);

// 1. Charger et afficher les projets quand on ouvre la modale (si role client)
const anchor1 = `document.getElementById('btnManageUsers').addEventListener('click', () => {
    openModal('usersModal');
    loadUsers();
  });`;

if (!code.includes(anchor1)) { console.error('❌ Ancre 1 non trouvée'); process.exit(1); }

const replacement1 = `document.getElementById('btnManageUsers').addEventListener('click', () => {
    openModal('usersModal');
    loadUsers();
    setupProjectCheckboxes();
  });

  async function setupProjectCheckboxes() {
    const wrap = document.getElementById('newUserProjectsWrap');
    if (window.currentUser.role !== 'client') {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';
    const box = document.getElementById('newUserProjectsList');
    box.innerHTML = 'Chargement...';
    try {
      const res = await fetch('/api/projects');
      const projects = await res.json();
      if (!projects.length) {
        box.innerHTML = '<p class="projects-empty" style="padding:8px 0;">Creez d\\'abord un projet.</p>';
        return;
      }
      box.innerHTML = '';
      projects.forEach(p => {
        const label = document.createElement('label');
        label.className = 'project-checkbox-row';
        label.innerHTML = '<input type="checkbox" value="' + p.id + '"> ' + escapeHtml(p.name);
        box.appendChild(label);
      });
    } catch (e) {
      box.innerHTML = '<p class="projects-empty">Erreur de chargement.</p>';
    }
  }`;

code = code.replace(anchor1, replacement1);

// 2. Inclure les projectIds coches lors de la creation
const anchor2 = `body: JSON.stringify({ username, password, fullName })`;
if (!code.includes(anchor2)) { console.error('❌ Ancre 2 non trouvée'); process.exit(1); }
const replacement2 = `body: JSON.stringify({
          username, password, fullName,
          projectIds: Array.from(document.querySelectorAll('#newUserProjectsList input:checked')).map(cb => parseInt(cb.value))
        })`;
code = code.replace(anchor2, replacement2);

fs.writeFileSync('auth.js', code);
console.log('✅ auth.js mis à jour avec la sélection de projets.');
