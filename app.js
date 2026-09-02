// State
let state = {
  records: [],
  departments: [],
  searchQuery: '',
  filterDept: 'ALL',
  filterPerson: 'ALL',
  cameraStream: null,
  currentEditingId: null,
  tempScannedImage: null
};

const DEFAULT_DEPARTMENTS = ['Régie (REGIS)', 'Logistique', 'Commercial', 'Maintenance', 'Direction', 'Service Technique', 'RH'];

document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  loadDepartments();
  setupEventListeners();
  updateAllFilterDropdowns();
  renderStats();
  renderTable();
});

function loadRecords() {
  const saved = localStorage.getItem('bon_gasoil_records');
  state.records = saved ? JSON.parse(saved) : [...SAMPLE_DATA];
}

function saveRecords() {
  localStorage.setItem('bon_gasoil_records', JSON.stringify(state.records));
  updateAllFilterDropdowns();
  renderStats();
  renderTable();
}

function loadDepartments() {
  const saved = localStorage.getItem('bon_gasoil_departments');
  state.departments = saved ? JSON.parse(saved) : [...DEFAULT_DEPARTMENTS];
}

function saveDepartments() {
  localStorage.setItem('bon_gasoil_departments', JSON.stringify(state.departments));
  updateAllFilterDropdowns();
}

function updateAllFilterDropdowns() {
  updateDepartmentFilterDropdown();
  updatePersonFilterDropdown();
  updateFormDepartmentDropdown();
}

function updateDepartmentFilterDropdown() {
  const select = document.getElementById('filterDeptSelect');
  if (!select) return;
  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();
  select.innerHTML = '<option value="ALL">Tous les depts</option>';
  allDepts.forEach(dept => {
    const opt = document.createElement('option');
    opt.value = dept;
    opt.textContent = dept;
    select.appendChild(opt);
  });
}

function updatePersonFilterDropdown() {
  const select = document.getElementById('filterPersonSelect');
  if (!select) return;
  const names = Array.from(new Set(state.records.map(r => r.nomPrenom).filter(Boolean))).sort();
  select.innerHTML = '<option value="ALL">Toutes les personnes</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function updateFormDepartmentDropdown() {
  const select = document.getElementById('inputDepartement');
  if (!select) return;
  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();
  select.innerHTML = '';
  allDepts.forEach(dept => {
    const opt = document.createElement('option');
    opt.value = dept;
    opt.textContent = dept;
    select.appendChild(opt);
  });
}

function getFilteredRecords() {
  return state.records.filter(r => {
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      if (!(r.nomPrenom?.toLowerCase().includes(q) || r.departement?.toLowerCase().includes(q) || r.immatriculation?.toLowerCase().includes(q))) return false;
    }
    if (state.filterDept !== 'ALL' && r.departement !== state.filterDept) return false;
    if (state.filterPerson !== 'ALL' && r.nomPrenom !== state.filterPerson) return false;
    return true;
  });
}

function renderStats() {
  const filtered = getFilteredRecords();
  const total = filtered.reduce((acc, r) => acc + (parseFloat(r.montant) || 0), 0);
  document.getElementById('statCount').textContent = filtered.length;
  document.getElementById('statTotal').textContent = total.toFixed(2);
}

function renderTable() {
  const tbody = document.getElementById('recordsTableBody');
  tbody.innerHTML = '';
  const filtered = getFilteredRecords();
  
  if (filtered.length === 0) {
    document.getElementById('emptyState').style.display = 'block';
    return;
  }
  document.getElementById('emptyState').style.display = 'none';
  
  filtered.forEach(record => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(record.nomPrenom)}</strong></td>
      <td>${record.date}</td>
      <td><strong>${parseFloat(record.montant).toFixed(2)} DH</strong></td>
      <td>${escapeHtml(record.departement)}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn" onclick="viewVoucherImage('${record.id}')">👁️</button>
          <button class="action-btn" onclick="editRecord('${record.id}')">✏️</button>
          <button class="action-btn delete" onclick="deleteRecord('${record.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderStats();
    renderTable();
  });

  document.getElementById('filterDeptSelect').addEventListener('change', (e) => {
    state.filterDept = e.target.value;
    renderStats();
    renderTable();
  });

  document.getElementById('filterPersonSelect').addEventListener('change', (e) => {
    state.filterPerson = e.target.value;
    renderStats();
    renderTable();
  });

  document.getElementById('btnResetFilters').addEventListener('click', () => {
    state.searchQuery = '';
    state.filterDept = 'ALL';
    state.filterPerson = 'ALL';
    document.getElementById('searchInput').value = '';
    updateAllFilterDropdowns();
    renderStats();
    renderTable();
    showToast("Filtres réinitialisés.", "info");
  });

  document.getElementById('btnOpenScanner').addEventListener('click', openCameraModal);
  document.getElementById('btnCloseCameraModal').addEventListener('click', closeCameraModal);
  document.getElementById('btnCapturePhoto').addEventListener('click', captureCameraPhoto);
  document.getElementById('btnExportExcel').addEventListener('click', exportToExcelXML);
  document.getElementById('recordForm').addEventListener('submit', saveRecordForm);
  document.getElementById('btnCloseEditModal').addEventListener('click', closeEditModal);
  document.getElementById('btnCancelEdit').addEventListener('click', closeEditModal);
  document.getElementById('btnCloseViewModal').addEventListener('click', () => {
    document.getElementById('viewImageModal').classList.remove('active');
  });
}

async function openCameraModal() {
  document.getElementById('cameraModal').classList.add('active');
  const video = document.getElementById('scannerVideo');
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = state.cameraStream;
  } catch (err) {
    showToast("Erreur caméra.", "warning");
  }
}

function closeCameraModal() {
  document.getElementById('cameraModal').classList.remove('active');
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
}

function captureCameraPhoto() {
  const video = document.getElementById('scannerVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  closeCameraModal();
  showToast("📷 Photo capturée. Remplissez les infos.", "success");
  
  // Ouvrir le modal avec la photo - l'utilisateur remplit manuellement
  openEditModalWithData({
    id: "BON-" + Date.now().toString().slice(-6),
    image: imageDataUrl
  });
}

function openEditModalWithData(data) {
  state.currentEditingId = data.id || null;
  state.tempScannedImage = data.image || null;

  document.getElementById('inputNomPrenom').value = data.nomPrenom || '';
  document.getElementById('inputDate').value = data.date || new Date().toISOString().split('T')[0];
  document.getElementById('inputMontant').value = data.montant || '';
  document.getElementById('inputKilometrage').value = data.kilometrage || '';
  document.getElementById('inputImmatriculation').value = data.immatriculation || '';

  const previewBox = document.getElementById('editModalImagePreview');
  if (data.image) {
    previewBox.src = data.image;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }

  document.getElementById('editRecordModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editRecordModal').classList.remove('active');
  state.currentEditingId = null;
  state.tempScannedImage = null;
  document.getElementById('inputNomPrenom').value = '';
  document.getElementById('inputDate').value = '';
  document.getElementById('inputMontant').value = '';
  document.getElementById('inputKilometrage').value = '';
  document.getElementById('inputImmatriculation').value = '';
  const previewBox = document.getElementById('editModalImagePreview');
  previewBox.src = '';
  previewBox.style.display = 'none';
}

function saveRecordForm(e) {
  e.preventDefault();
  const nomPrenom = document.getElementById('inputNomPrenom').value.trim();
  const date = document.getElementById('inputDate').value;
  const montant = parseFloat(document.getElementById('inputMontant').value) || 0;
  const departement = document.getElementById('inputDepartement').value;
  const kilometrage = parseInt(document.getElementById('inputKilometrage').value) || 0;
  const immatriculation = document.getElementById('inputImmatriculation').value.trim();

  if (!nomPrenom) {
    showToast("Remplissez le nom.", "warning");
    return;
  }

  const existingIndex = state.records.findIndex(r => r.id === state.currentEditingId);
  
  const recordObj = {
    id: state.currentEditingId || ("BON-" + Date.now().toString().slice(-6)),
    nomPrenom,
    date,
    montant,
    departement,
    kilometrage,
    immatriculation,
    image: state.tempScannedImage
  };

  if (existingIndex >= 0) {
    state.records[existingIndex] = recordObj;
  } else {
    state.records.unshift(recordObj);
  }

  saveRecords();
  closeEditModal();
  showToast("✅ Bon enregistré !", "success");
}

function editRecord(id) {
  const record = state.records.find(r => r.id === id);
  if (record) openEditModalWithData(record);
}

function deleteRecord(id) {
  if (confirm("Supprimer ce bon ?")) {
    state.records = state.records.filter(r => r.id !== id);
    saveRecords();
    showToast("Bon supprimé.", "info");
  }
}

function viewVoucherImage(id) {
  const record = state.records.find(r => r.id === id);
  if (!record || !record.image) return;
  document.getElementById('viewModalImage').src = record.image;
  document.getElementById('viewImageModal').classList.add('active');
}

function exportToExcelXML() {
  const filtered = getFilteredRecords();
  if (filtered.length === 0) {
    showToast("Aucune donnée.", "warning");
    return;
  }

  const totalAmount = filtered.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11pt; }
        th { background-color: #1f2937; color: #fff; font-weight: bold; border: 1px solid #475569; padding: 10px; }
        td { border: 1px solid #cbd5e1; padding: 8px; }
        .num { text-align: right; }
      </style>
    </head>
    <body>
      <div style="font-size: 16pt; font-weight: bold; margin-bottom: 10px;">Rapport Bons de Gasoil</div>
      <table>
        <thead>
          <tr>
            <th>Personne</th>
            <th>Date</th>
            <th>Montant (MAD)</th>
            <th>Département</th>
            <th>Kilométrage</th>
            <th>Immatriculation</th>
          </tr>
        </thead>
        <tbody>`;

  filtered.forEach(r => {
    html += `<tr>
      <td><b>${escapeHtml(r.nomPrenom)}</b></td>
      <td>${r.date}</td>
      <td class="num">${parseFloat(r.montant).toFixed(2)}</td>
      <td>${escapeHtml(r.departement)}</td>
      <td class="num">${parseInt(r.kilometrage).toLocaleString('fr-FR')}</td>
      <td><b>${escapeHtml(r.immatriculation)}</b></td>
    </tr>`;
  });

  html += `<tr style="background-color: #f1f5f9; font-weight: bold;">
      <td colspan="2" style="text-align: right;">TOTAL :</td>
      <td class="num" style="color: #059669;"><b>${totalAmount.toFixed(2)}</b></td>
      <td colspan="3"></td>
    </tr>
      </tbody>
      </table>
    </body>
    </html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `bons_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Excel exporté !", "success");
}

function showToast(message, type = "info") {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
