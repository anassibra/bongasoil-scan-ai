(function () {
  const authScreen = document.getElementById('authScreen');
  const projectsScreen = document.getElementById('projectsScreen');
  const appScreen = document.getElementById('appScreen');

  function showOnly(el) {
    [authScreen, projectsScreen, appScreen].forEach(s => { if (s) s.style.display = 'none'; });
    if (el) el.style.display = el === appScreen ? 'block' : 'flex';
  }

  function openModal(id) { document.getElementById(id).classList.add('is-open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('is-open'); }

  async function checkSession() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        window.currentUser = await res.json();
        loadProjects();
      } else {
        showOnly(authScreen);
      }
    } catch (e) {
      showOnly(authScreen);
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Erreur de connexion';
        errorEl.style.display = 'block';
        return;
      }
      window.currentUser = data;
      loadProjects();
    } catch (err) {
      errorEl.textContent = 'Erreur reseau';
      errorEl.style.display = 'block';
    }
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  async function loadProjects() {
    showOnly(projectsScreen);
    document.getElementById('btnManageUsers').style.display =
      (window.currentUser.role === 'collaborator') ? 'none' : 'inline-flex';

    const list = document.getElementById('projectsList');
    list.innerHTML = '<p class="projects-empty">Chargement...</p>';
    try {
      const res = await fetch('/api/projects');
      const projects = await res.json();
      if (!projects.length) {
        list.innerHTML = '<p class="projects-empty">Aucun projet pour le moment. Creez-en un.</p>';
        return;
      }
      list.innerHTML = '';
      projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `<h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.production || '')}</p>
          <p class="project-responsable">${escapeHtml(p.responsable || '')}</p>`;
        card.addEventListener('click', () => openProject(p));
        list.appendChild(card);
      });
    } catch (e) {
      list.innerHTML = '<p class="projects-empty">Erreur de chargement.</p>';
    }
  }

  document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProjectName').value.trim();
    const production = document.getElementById('newProjectProduction').value.trim();
    const responsable = document.getElementById('newProjectResponsable').value.trim();
    if (!name) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, production, responsable })
    });
    if (res.ok) {
      document.getElementById('newProjectForm').reset();
      closeModal('newProjectModal');
      loadProjects();
    } else {
      alert('Erreur lors de la creation du projet.');
    }
  });

  document.getElementById('btnShowNewProject').addEventListener('click', () => openModal('newProjectModal'));
  document.getElementById('btnCancelNewProject').addEventListener('click', () => closeModal('newProjectModal'));

  function openProject(project) {
    window.currentProject = project;
    sessionStorage.setItem('currentProjectId', project.id);
    document.getElementById('currentProjectName').textContent = project.name;
    showOnly(appScreen);
  }

  document.getElementById('btnBackToProjects').addEventListener('click', loadProjects);

  document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.currentUser = null;
    window.currentProject = null;
    sessionStorage.removeItem('currentProjectId');
    showOnly(authScreen);
  });

  async function loadUsers() {
    const list = document.getElementById('usersList');
    list.innerHTML = '<p class="projects-empty">Chargement...</p>';
    try {
      const res = await fetch('/api/users');
      const users = await res.json();
      if (!users.length) {
        list.innerHTML = '<p class="projects-empty">Aucun utilisateur cree pour le moment.</p>';
        return;
      }
      list.innerHTML = '';
      users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `<div>
            <strong>${escapeHtml(u.full_name)}</strong>
            <span class="user-role-badge">${u.role === 'client' ? 'Client' : 'Collaborateur'}</span>
            <div class="user-username">@${escapeHtml(u.username)}</div>
          </div>`;
        list.appendChild(row);
      });
    } catch (e) {
      list.innerHTML = '<p class="projects-empty">Erreur de chargement.</p>';
    }
  }

  document.getElementById('btnManageUsers').addEventListener('click', () => {
    openModal('usersModal');
    loadUsers();
  });
  document.getElementById('btnCloseUsersModal').addEventListener('click', () => closeModal('usersModal'));

  document.getElementById('newUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const fullName = document.getElementById('newUserFullName').value.trim();
    const errorEl = document.getElementById('newUserError');
    errorEl.style.display = 'none';
    if (!username || !password || !fullName) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, fullName })
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Erreur lors de la creation.';
        errorEl.style.display = 'block';
        return;
      }
      document.getElementById('newUserForm').reset();
      loadUsers();
    } catch (err) {
      errorEl.textContent = 'Erreur reseau.';
      errorEl.style.display = 'block';
    }
  });

  checkSession();
})();
