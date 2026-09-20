(function () {
  const authScreen = document.getElementById('authScreen');
  const projectsScreen = document.getElementById('projectsScreen');
  const appScreen = document.getElementById('appScreen');

  function showOnly(el) {
    [authScreen, projectsScreen, appScreen].forEach(s => { if (s) s.style.display = 'none'; });
    if (el) el.style.display = el === appScreen ? 'block' : 'flex';
  }

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

  async function loadProjects() {
    showOnly(projectsScreen);
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
      document.getElementById('newProjectModal').style.display = 'none';
      loadProjects();
    }
  });

  document.getElementById('btnShowNewProject').addEventListener('click', () => {
    document.getElementById('newProjectModal').style.display = 'flex';
  });
  document.getElementById('btnCancelNewProject').addEventListener('click', () => {
    document.getElementById('newProjectModal').style.display = 'none';
  });

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

  checkSession();
})();
