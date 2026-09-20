const fs = require('fs');
const original = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('index.html.backup-avant-users', original);
console.log('✅ Sauvegarde créée : index.html.backup-avant-users');

let html = original;

// 1. Ajouter le bouton "Gerer utilisateurs" a cote du bouton deconnexion
const anchor1 = '<button id="btnLogout" class="btn-secondary">Deconnexion</button>';
if (!html.includes(anchor1)) { console.error('❌ Ancre bouton logout non trouvée'); process.exit(1); }
html = html.replace(anchor1,
  '<button id="btnManageUsers" class="btn-secondary" style="margin-right:8px;">👥 Utilisateurs</button>\n      ' + anchor1
);

// 2. Ajouter la modale Utilisateurs juste avant la fermeture de newProjectModal's parent (avant <div id="appScreen")
const anchor2 = '<div id="appScreen" style="display:none;">';
if (!html.includes(anchor2)) { console.error('❌ Ancre appScreen non trouvée'); process.exit(1); }

const usersModalHtml = `
  <!-- Modal Gestion Utilisateurs -->
  <div id="usersModal" class="modal">
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Gerer les utilisateurs</h2>
        <button id="btnCloseUsersModal" class="btn-close">&times;</button>
      </div>
      <div class="modal-body">
        <h3 style="font-size:14px; margin-bottom:10px;">Creer un compte</h3>
        <form id="newUserForm" class="form-simple">
          <div class="form-group">
            <label>Nom complet</label>
            <input type="text" id="newUserFullName" class="form-input" required>
          </div>
          <div class="form-group">
            <label>Identifiant</label>
            <input type="text" id="newUserUsername" class="form-input" required autocomplete="off">
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input type="password" id="newUserPassword" class="form-input" required autocomplete="new-password">
          </div>
          <p id="newUserError" class="auth-error" style="display:none;"></p>
          <div class="form-actions">
            <button type="submit" class="btn-primary" style="width:100%;">Creer le compte</button>
          </div>
        </form>
        <h3 style="font-size:14px; margin:20px 0 10px;">Comptes existants</h3>
        <div id="usersList"></div>
      </div>
    </div>
  </div>

`;

html = html.replace(anchor2, usersModalHtml + anchor2);

fs.writeFileSync('index.html', html);
console.log('✅ index.html mis à jour (bouton + modale utilisateurs).');
