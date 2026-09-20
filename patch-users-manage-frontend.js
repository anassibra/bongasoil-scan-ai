const fs = require('fs');
let code = fs.readFileSync('auth.js', 'utf8');
fs.writeFileSync('auth.js.backup-avant-manage', code);

const anchor = `      users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = \`<div>
            <strong>\${escapeHtml(u.full_name)}</strong>
            <span class="user-role-badge">\${u.role === 'client' ? 'Client' : 'Collaborateur'}</span>
            <div class="user-username">@\${escapeHtml(u.username)}</div>
          </div>\`;
        list.appendChild(row);
      });`;

if (!code.includes(anchor)) { console.error('❌ Ancre non trouvée'); process.exit(1); }

const replacement = `      users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'user-row user-row-manage';
        const statusLabel = u.active ? 'Actif' : 'Desactive';
        const statusClass = u.active ? 'status-active' : 'status-inactive';
        row.innerHTML = \`<div class="user-row-top">
            <div>
              <strong>\${escapeHtml(u.full_name)}</strong>
              <span class="user-role-badge">\${u.role === 'client' ? 'Client' : 'Collaborateur'}</span>
              <span class="user-status-badge \${statusClass}">\${statusLabel}</span>
              <div class="user-username">@\${escapeHtml(u.username)}</div>
            </div>
          </div>
          <div class="user-row-actions">
            \${u.role === 'collaborator' ? '<button type="button" class="btn-link btn-edit-access" data-id="' + u.id + '">Modifier acces</button>' : ''}
            <button type="button" class="btn-link btn-toggle-active" data-id="\${u.id}" data-active="\${u.active}">\${u.active ? 'Desactiver' : 'Reactiver'}</button>
          </div>
          <div id="editAccessBox-\${u.id}" class="edit-access-box" style="display:none;"></div>\`;
        list.appendChild(row);
      });

      list.querySelectorAll('.btn-toggle-active').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const currentlyActive = btn.dataset.active === 'true';
          if (!confirm(currentlyActive ? 'Desactiver ce compte ?' : 'Reactiver ce compte ?')) return;
          const res = await fetch('/api/users/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !currentlyActive })
          });
          if (res.ok) loadUsers(); else alert('Erreur lors de la mise a jour.');
        });
      });

      list.querySelectorAll('.btn-edit-access').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const box = document.getElementById('editAccessBox-' + id);
          if (box.style.display === 'block') { box.style.display = 'none'; return; }
          box.style.display = 'block';
          box.innerHTML = 'Chargement...';
          try {
            const [projectsRes, accessRes] = await Promise.all([
              fetch('/api/projects'),
              fetch('/api/users/' + id + '/access')
            ]);
            const projects = await projectsRes.json();
            const currentAccess = await accessRes.json();
            box.innerHTML = '';
            const list2 = document.createElement('div');
            list2.className = 'project-checkbox-box';
            projects.forEach(p => {
              const label = document.createElement('label');
              label.className = 'project-checkbox-row';
              const checked = currentAccess.includes(p.id) ? 'checked' : '';
              label.innerHTML = '<input type="checkbox" value="' + p.id + '" ' + checked + '> ' + escapeHtml(p.name);
              list2.appendChild(label);
            });
            box.appendChild(list2);
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'btn-primary';
            saveBtn.style.marginTop = '8px';
            saveBtn.textContent = 'Enregistrer les acces';
            saveBtn.addEventListener('click', async () => {
              const projectIds = Array.from(list2.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
              const res = await fetch('/api/users/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds })
              });
              if (res.ok) { box.style.display = 'none'; } else { alert('Erreur.'); }
            });
            box.appendChild(saveBtn);
          } catch (e) {
            box.innerHTML = 'Erreur de chargement.';
          }
        });
      });`;

code = code.replace(anchor, replacement);
fs.writeFileSync('auth.js', code);
console.log('✅ auth.js mis à jour avec gestion des acces.');
