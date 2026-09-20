const fs = require('fs');
const original = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('index.html.backup-avant-auth', original);
console.log('✅ Sauvegarde créée : index.html.backup-avant-auth');

let html = original;

// 1. Injecter les 3 écrans juste après <body>
const bodyAnchor = '<body>';
if (!html.includes(bodyAnchor)) { console.error('❌ <body> non trouvé'); process.exit(1); }

const screensHtml = `
  <!-- Ecran de connexion -->
  <div id="authScreen" class="auth-screen">
    <div class="auth-box">
      <h1 class="auth-title">⛽ BonGasoil Scan</h1>
      <p class="auth-subtitle">Connectez-vous pour continuer</p>
      <form id="loginForm" class="auth-form">
        <div class="form-group">
          <label>Identifiant</label>
          <input type="text" id="loginUsername" class="form-input" required autocomplete="username">
        </div>
        <div class="form-group">
          <label>Mot de passe</label>
          <input type="password" id="loginPassword" class="form-input" required autocomplete="current-password">
        </div>
        <p id="loginError" class="auth-error" style="display:none;"></p>
        <button type="submit" class="btn-primary btn-lg" style="width:100%;">Se connecter</button>
      </form>
    </div>
  </div>

  <!-- Ecran Mes Projets -->
  <div id="projectsScreen" class="projects-screen" style="display:none;">
    <div class="projects-header">
      <h1>📁 Mes Projets</h1>
      <button id="btnLogout" class="btn-secondary">Deconnexion</button>
    </div>
    <button id="btnShowNewProject" class="btn-primary btn-lg" style="margin: 16px;">➕ Creer un nouveau projet</button>
    <div id="projectsList" class="projects-list"></div>
  </div>

  <!-- Modal Nouveau Projet -->
  <div id="newProjectModal" class="modal" style="display:none;">
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Nouveau Projet</h2>
      </div>
      <div class="modal-body">
        <form id="newProjectForm" class="form-simple">
          <div class="form-group">
            <label>Nom du projet</label>
            <input type="text" id="newProjectName" class="form-input" required>
          </div>
          <div class="form-group">
            <label>Production / activite</label>
            <input type="text" id="newProjectProduction" class="form-input">
          </div>
          <div class="form-group">
            <label>Responsable</label>
            <input type="text" id="newProjectResponsable" class="form-input">
          </div>
          <div class="form-actions">
            <button type="button" id="btnCancelNewProject" class="btn-secondary">Annuler</button>
            <button type="submit" class="btn-primary">Creer</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div id="appScreen" style="display:none;">
    <button id="btnBackToProjects" class="btn-secondary" style="margin:12px;">⬅ Mes Projets</button>
    <span id="currentProjectName" style="font-weight:600; margin-left:8px;"></span>
`;

html = html.replace(bodyAnchor, bodyAnchor + screensHtml);

// 2. Fermer le div appScreen juste avant </body>, et charger auth.js
const bodyClose = '</body>';
if (!html.includes(bodyClose)) { console.error('❌ </body> non trouvé'); process.exit(1); }
html = html.replace(bodyClose, `  </div>\n  <script src="auth.js"></script>\n${bodyClose}`);

fs.writeFileSync('index.html', html);
console.log('✅ index.html mis à jour avec succès.');
