let state = {
  records: [],
  departments: [],
  searchQuery: '',
  filterDept: 'ALL',
  filterPerson: 'ALL',
  filterPlate: 'ALL',
  cameraStream: null,
  currentEditingId: null,
  tempScannedImage: null,
  countdownTimer: null,
  tesseractLoaded: false
};

const DEFAULT_DEPARTMENTS = ['Régie (REGIS)', 'Logistique', 'Commercial', 'Maintenance', 'Direction', 'Service Technique', 'RH'];

document.addEventListener('DOMContentLoaded', async () => {
  await loadRecords();
  loadDepartments();
  setupEventListeners();
  updateAllFilterDropdowns();
  renderStats();
  renderTable();
});

// STOCKAGE ILLIMITE (IndexedDB) - fonctionne 100% hors ligne, meme mecanisme site/PWA
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bongasoil_db', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadRecords() {
  try {
    const existing = await idbGet('records');
    if (existing && Array.isArray(existing) && existing.length > 0) {
      state.records = existing;
      return;
    }
    // Migration depuis l'ancien localStorage (une seule fois)
    const oldSaved = localStorage.getItem('bon_gasoil_records');
    if (oldSaved) {
      const parsed = JSON.parse(oldSaved);
      state.records = Array.isArray(parsed) ? parsed : [...SAMPLE_DATA];
      await idbSet('records', state.records);
      localStorage.removeItem('bon_gasoil_records');
    } else {
      state.records = [...SAMPLE_DATA];
    }
  } catch (e) {
    console.error('Erreur chargement IndexedDB:', e);
    state.records = [...SAMPLE_DATA];
  }
}

async function saveRecords() {
  try {
    await idbSet('records', state.records);
  } catch (e) {
    console.error('Erreur sauvegarde IndexedDB:', e);
    showToast('⚠️ Erreur de sauvegarde (stockage plein ?)', 'warning');
  }
  updateAllFilterDropdowns();
  renderStats();
  renderTable();
}

function loadDepartments() {
  const saved = localStorage.getItem('bon_gasoil_departments');
  state.departments = saved ? JSON.parse(saved) : [...DEFAULT_DEPARTMENTS];
}

function updateAllFilterDropdowns() {
  updateDepartmentFilterDropdown();
  updatePersonFilterDropdown();
  updatePlateFilterDropdown();
  updateFormDepartmentDropdown();
}

function updatePlateFilterDropdown() {
  const select = document.getElementById('filterPlateSelect');
  if (!select) return;
  const plates = Array.from(new Set(state.records.map(r => r.immatriculation).filter(Boolean))).sort();
  select.innerHTML = '<option value="ALL">Toutes les immatriculations</option>';
  plates.forEach(plate => {
    const opt = document.createElement('option');
    opt.value = plate;
    opt.textContent = plate;
    select.appendChild(opt);
  });
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
    if (state.filterPlate !== 'ALL' && r.immatriculation !== state.filterPlate) return false;
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
      <td>${escapeHtml(record.immatriculation || '-')}</td>
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

  document.getElementById('filterPlateSelect').addEventListener('change', (e) => {
    state.filterPlate = e.target.value;
    renderStats();
    renderTable();
  });

  document.getElementById('btnResetFilters').addEventListener('click', () => {
    state.searchQuery = '';
    state.filterDept = 'ALL';
    state.filterPerson = 'ALL';
    state.filterPlate = 'ALL';
    document.getElementById('searchInput').value = '';
    updateAllFilterDropdowns();
    renderStats();
    renderTable();
    showToast("Filtres réinitialisés.", "info");
  });

  document.getElementById('btnOpenScanner').addEventListener('click', openCameraModal);
  document.getElementById('btnCloseCameraModal').addEventListener('click', closeCameraModal);
  document.getElementById('btnCapturePhoto').addEventListener('click', () => {
    cancelCountdown();
    captureCameraPhoto();
  });
  document.getElementById('btnUploadPhoto').addEventListener('click', () => {
    document.getElementById('fileInputCamera').click();
  });
  document.getElementById('fileInputCamera').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        closeCameraModal();
        runOCRExtraction(ev.target.result);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  document.getElementById('btnExportExcel').addEventListener('click', exportToExcelXML);

  document.getElementById('btnImportSheet').addEventListener('click', () => {
    document.getElementById('fileInputSheet').click();
  });
  document.getElementById('fileInputSheet').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => runBatchExtraction(ev.target.result);
      reader.readAsDataURL(e.target.files[0]);
      e.target.value = '';
    }
  });
  document.getElementById('btnCloseBatchModal').addEventListener('click', closeBatchModal);
  document.getElementById('btnCancelBatch').addEventListener('click', closeBatchModal);
  document.getElementById('btnSaveBatch').addEventListener('click', saveBatchResults);
  document.getElementById('recordForm').addEventListener('submit', saveRecordForm);
  document.getElementById('btnCloseEditModal').addEventListener('click', closeEditModal);
  document.getElementById('btnCancelEdit').addEventListener('click', closeEditModal);
  document.getElementById('btnCloseViewModal').addEventListener('click', () => {
    document.getElementById('viewImageModal').classList.remove('active');
  });
}

// CAMERA
async function openCameraModal() {
  document.getElementById('cameraModal').classList.add('active');
  const video = document.getElementById('scannerVideo');
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = state.cameraStream;
    video.onloadedmetadata = () => startAutoCaptureCountdown();
  } catch (err) {
    showToast("Impossible d'accéder à la caméra.", "warning");
  }
}

function startAutoCaptureCountdown() {
  let count = 3;
  const el = document.getElementById('captureCountdown');
  el.style.display = 'flex';
  el.textContent = count;

  state.countdownTimer = setInterval(() => {
    count--;
    if (count <= 0) {
      cancelCountdown();
      captureCameraPhoto();
    } else {
      el.textContent = count;
    }
  }, 1000);
}

function cancelCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
  document.getElementById('captureCountdown').style.display = 'none';
}

function closeCameraModal() {
  cancelCountdown();
  document.getElementById('cameraModal').classList.remove('active');
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
}

function captureCameraPhoto() {
  const video = document.getElementById("scannerVideo");
  if (!video.videoWidth) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  closeCameraModal();
  runOCRExtraction(imageDataUrl);
}

// IMPORT FEUILLE MULTI-BONS
let batchResults = [];

async function runBatchExtraction(imageDataUrl) {
  document.getElementById('batchReviewModal').classList.add('active');
  document.getElementById('batchStatusText').textContent = "Analyse de la feuille en cours...";
  document.getElementById('batchList').innerHTML = '';
  document.getElementById('btnSaveBatch').style.display = 'none';

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extractedList = await response.json();
    if (!response.ok) throw new Error(extractedList.error || 'Erreur extraction');

    batchResults = extractedList.map((item, idx) => ({
      tempId: 'batch-' + idx,
      nomPrenom: item.nomPrenom || '',
      date: item.date || '',
      montant: item.montant || '',
      departement: item.departement || '',
      kilometrage: item.kilometrage || '',
      immatriculation: item.immatriculation || ''
    }));

    if (batchResults.length === 0) {
      document.getElementById('batchStatusText').textContent = "Aucun bon detecte sur cette feuille. Reessayez avec une photo plus nette.";
      return;
    }

    document.getElementById('batchStatusText').textContent = batchResults.length + " bon(s) detecte(s). Verifiez/corrigez avant d'enregistrer.";
    renderBatchList();
    document.getElementById('btnSaveBatch').style.display = 'block';
  } catch (error) {
    console.error("Erreur batch:", error);
    document.getElementById('batchStatusText').textContent = "Erreur d'extraction. Reessayez avec une photo plus nette.";
  }
}

function renderBatchList() {
  const container = document.getElementById('batchList');
  container.innerHTML = '';

  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();

  batchResults.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'batch-item';
    const deptOptions = allDepts.map(d => '<option value="' + escapeHtml(d) + '"' + (d === item.departement ? ' selected' : '') + '>' + escapeHtml(d) + '</option>').join('');

    div.innerHTML = `
      <div class="batch-item-header">
        <span class="batch-item-title">Bon #${idx + 1}</span>
        <button type="button" class="batch-item-remove" onclick="removeBatchItem(${idx})">🗑️</button>
      </div>
      <div class="batch-item-fields">
        <input type="text" class="full-width" placeholder="Nom et prenom" value="${escapeHtml(item.nomPrenom)}" oninput="updateBatchField(${idx}, 'nomPrenom', this.value)">
        <input type="date" value="${item.date}" oninput="updateBatchField(${idx}, 'date', this.value)">
        <input type="number" placeholder="Montant" value="${item.montant}" oninput="updateBatchField(${idx}, 'montant', this.value)">
        <select onchange="updateBatchField(${idx}, 'departement', this.value)">
          <option value="">-- Departement --</option>
          ${deptOptions}
        </select>
        <input type="number" placeholder="Kilometrage" value="${item.kilometrage}" oninput="updateBatchField(${idx}, 'kilometrage', this.value)">
        <input type="text" class="full-width" placeholder="Immatriculation" value="${escapeHtml(item.immatriculation)}" oninput="updateBatchField(${idx}, 'immatriculation', this.value)">
      </div>
    `;
    container.appendChild(div);
  });
}

function updateBatchField(idx, field, value) {
  batchResults[idx][field] = value;
}

function removeBatchItem(idx) {
  batchResults.splice(idx, 1);
  renderBatchList();
  document.getElementById('batchStatusText').textContent = batchResults.length + " bon(s) a enregistrer.";
}

async function saveBatchResults() {
  let savedCount = 0;
  for (const item of batchResults) {
    if (!item.nomPrenom || !item.nomPrenom.trim()) continue;
    state.records.unshift({
      id: "BON-" + Date.now().toString().slice(-6) + "-" + savedCount,
      nomPrenom: item.nomPrenom.trim(),
      date: item.date || new Date().toISOString().split('T')[0],
      montant: parseFloat(item.montant) || 0,
      departement: item.departement || '',
      kilometrage: parseInt(item.kilometrage) || 0,
      immatriculation: (item.immatriculation || '').trim(),
      image: null
    });
    savedCount++;
  }
  await saveRecords();
  closeBatchModal();
  showToast("🎉 " + savedCount + " bon(s) enregistre(s) !", "success");
}

function closeBatchModal() {
  document.getElementById('batchReviewModal').classList.remove('active');
  batchResults = [];
}

// EXTRACTION AUTOMATIQUE via IA Vision (Claude) - lit aussi l'écriture manuscrite
async function runOCRExtraction(imageDataUrl) {
  state.tempScannedImage = imageDataUrl;
  showToast("🧠 Lecture intelligente du bon en cours...", "info");

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extracted = await response.json();
    if (extracted.departement && extracted.departement.trim()) {
      const deptName = extracted.departement.trim();
      if (!state.departments.some(d => d.toLowerCase() === deptName.toLowerCase())) {
        state.departments.push(deptName);
        saveDepartments();
      }
    }
    openEditModalWithData({
      id: "BON-" + Date.now().toString().slice(-6),
      nomPrenom: extracted.nomPrenom || "",
      date: extracted.date || "",
      montant: extracted.montant || "",
      departement: extracted.departement || "",
      kilometrage: extracted.kilometrage || "",
      immatriculation: extracted.immatriculation || "",
      image: imageDataUrl
    });

    showToast("✅ Bon lu automatiquement ! Vérifiez avant d'enregistrer.", "success");
  } catch (error) {
    console.error("Erreur extraction:", error);
    showToast("⚠️ Extraction échouée, remplissez manuellement.", "warning");
    openEditModalWithData({
      id: "BON-" + Date.now().toString().slice(-6),
      image: imageDataUrl
    });
  }
}

// EDIT MODAL
function openEditModalWithData(data) {
  state.currentEditingId = data.id || null;
  state.tempScannedImage = data.image || null;

  document.getElementById('inputNomPrenom').value = data.nomPrenom || '';
  document.getElementById('inputDate').value = data.date || new Date().toISOString().split('T')[0];
  document.getElementById('inputMontant').value = data.montant || '';
  document.getElementById('inputKilometrage').value = data.kilometrage || '';
  document.getElementById('inputImmatriculation').value = data.immatriculation || '';

  const deptSelect = document.getElementById('inputDepartement');
  if (data.departement) {
    updateFormDepartmentDropdown();
    deptSelect.value = data.departement;
  }
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
    nomPrenom, date, montant, departement, kilometrage, immatriculation,
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
    <head><meta charset="utf-8"><style>
      table { border-collapse: collapse; width: 100%; font-family: Arial; font-size: 11pt; }
      th { background-color: #1f2937; color: #fff; font-weight: bold; border: 1px solid #475569; padding: 10px; }
      td { border: 1px solid #cbd5e1; padding: 8px; }
      .num { text-align: right; }
    </style></head><body>
      <div style="font-size:16pt;font-weight:bold;margin-bottom:10px;">Rapport Bons de Gasoil</div>
      <table><thead><tr><th>Personne</th><th>Date</th><th>Montant (MAD)</th><th>Département</th><th>Kilométrage</th><th>Immatriculation</th></tr></thead><tbody>`;
  filtered.forEach(r => {
    html += `<tr><td><b>${escapeHtml(r.nomPrenom)}</b></td><td>${r.date}</td><td class="num">${parseFloat(r.montant).toFixed(2)}</td><td>${escapeHtml(r.departement)}</td><td class="num">${parseInt(r.kilometrage).toLocaleString('fr-FR')}</td><td><b>${escapeHtml(r.immatriculation)}</b></td></tr>`;
  });
  html += `<tr style="background-color:#f1f5f9;font-weight:bold;"><td colspan="2" style="text-align:right;">TOTAL :</td><td class="num" style="color:#059669;"><b>${totalAmount.toFixed(2)}</b></td><td colspan="3"></td></tr></tbody></table></body></html>`;
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

// ==================== MODULE AUTOROUTE (PETTY CASH) ====================
let tollState = {
  records: [],
  filterRembourse: 'ALL',
  cameraStream: null,
  currentEditingId: null,
  tempImage: null,
  countdownTimer: null
};

async function loadTollRecords() {
  try {
    const existing = await idbGet('toll_records');
    tollState.records = (existing && Array.isArray(existing)) ? existing : [];
  } catch (e) {
    tollState.records = [];
  }
}

async function saveTollRecords() {
  try {
    await idbSet('toll_records', tollState.records);
  } catch (e) {
    showToast('⚠️ Erreur de sauvegarde', 'warning');
  }
  renderTollTable();
}

function getFilteredTollRecords() {
  return tollState.records.filter(r => {
    if (tollState.filterRembourse !== 'ALL' && r.rembourse !== tollState.filterRembourse) return false;
    return true;
  });
}

function renderTollTable() {
  const tbody = document.getElementById('tollTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const filtered = getFilteredTollRecords();

  if (filtered.length === 0) {
    document.getElementById('tollEmptyState').style.display = 'block';
    return;
  }
  document.getElementById('tollEmptyState').style.display = 'none';

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    const rembBadge = record.rembourse === 'YES'
      ? '<span style="color: var(--success);">✅ Oui</span>'
      : '<span style="color: #f59e0b;">⏳ Non</span>';
    tr.innerHTML = `
      <td>${record.date}</td>
      <td>${escapeHtml(record.trajet || '-')}</td>
      <td><strong>${parseFloat(record.montant).toFixed(2)} DH</strong></td>
      <td>${rembBadge}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn" onclick="toggleTollRembourse('${record.id}')">🔄</button>
          <button class="action-btn" onclick="editTollRecord('${record.id}')">✏️</button>
          <button class="action-btn delete" onclick="deleteTollRecord('${record.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleTollRembourse(id) {
  const record = tollState.records.find(r => r.id === id);
  if (record) {
    record.rembourse = record.rembourse === 'YES' ? 'NO' : 'YES';
    saveTollRecords();
    showToast(record.rembourse === 'YES' ? '✅ Marque comme rembourse' : '⏳ Marque comme non rembourse', 'info');
  }
}

function deleteTollRecord(id) {
  if (confirm('Supprimer ce ticket ?')) {
    tollState.records = tollState.records.filter(r => r.id !== id);
    saveTollRecords();
    showToast('Ticket supprime.', 'info');
  }
}

function editTollRecord(id) {
  const record = tollState.records.find(r => r.id === id);
  if (record) openEditTollModalWithData(record);
}

// CAMERA PEAGE
async function openCameraModalToll() {
  document.getElementById('cameraModalToll').classList.add('active');
  const video = document.getElementById('scannerVideoToll');
  try {
    tollState.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = tollState.cameraStream;
    video.onloadedmetadata = () => startTollCountdown();
  } catch (err) {
    showToast("Impossible d'acceder a la camera.", "warning");
  }
}

function startTollCountdown() {
  let count = 3;
  const el = document.getElementById('captureCountdownToll');
  el.style.display = 'flex';
  el.textContent = count;
  tollState.countdownTimer = setInterval(() => {
    count--;
    if (count <= 0) {
      cancelTollCountdown();
      captureTollPhoto();
    } else {
      el.textContent = count;
    }
  }, 1000);
}

function cancelTollCountdown() {
  if (tollState.countdownTimer) {
    clearInterval(tollState.countdownTimer);
    tollState.countdownTimer = null;
  }
  document.getElementById('captureCountdownToll').style.display = 'none';
}

function closeCameraModalToll() {
  cancelTollCountdown();
  document.getElementById('cameraModalToll').classList.remove('active');
  if (tollState.cameraStream) {
    tollState.cameraStream.getTracks().forEach(track => track.stop());
    tollState.cameraStream = null;
  }
}

function captureTollPhoto() {
  const video = document.getElementById('scannerVideoToll');
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  closeCameraModalToll();
  runTollExtraction(imageDataUrl);
}

async function runTollExtraction(imageDataUrl) {
  tollState.tempImage = imageDataUrl;
  showToast("🧠 Lecture du ticket en cours...", "info");

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract-toll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extracted = await response.json();
    if (!response.ok) throw new Error(extracted.error || 'Erreur extraction');

    openEditTollModalWithData({
      id: "TOLL-" + Date.now().toString().slice(-6),
      date: extracted.date || '',
      trajet: extracted.trajet || '',
      montant: extracted.montant || '',
      rembourse: 'NO',
      image: imageDataUrl
    });

    showToast("✅ Ticket lu automatiquement !", "success");
  } catch (error) {
    console.error("Erreur extraction toll:", error);
    showToast("⚠️ Extraction echouee, remplissez manuellement.", "warning");
    openEditTollModalWithData({
      id: "TOLL-" + Date.now().toString().slice(-6),
      image: imageDataUrl,
      rembourse: 'NO'
    });
  }
}

function openEditTollModalWithData(data) {
  tollState.currentEditingId = data.id || null;
  tollState.tempImage = data.image || null;

  document.getElementById('tollInputDate').value = data.date || new Date().toISOString().split('T')[0];
  document.getElementById('tollInputTrajet').value = data.trajet || '';
  document.getElementById('tollInputMontant').value = data.montant || '';
  document.getElementById('tollInputRembourse').value = data.rembourse || 'NO';

  const previewBox = document.getElementById('editTollImagePreview');
  if (data.image) {
    previewBox.src = data.image;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }

  document.getElementById('editTollModal').classList.add('active');
}

function closeEditTollModal() {
  document.getElementById('editTollModal').classList.remove('active');
  tollState.currentEditingId = null;
  tollState.tempImage = null;
  document.getElementById('tollInputDate').value = '';
  document.getElementById('tollInputTrajet').value = '';
  document.getElementById('tollInputMontant').value = '';
  const previewBox = document.getElementById('editTollImagePreview');
  previewBox.src = '';
  previewBox.style.display = 'none';
}

function saveTollForm(e) {
  e.preventDefault();
  const date = document.getElementById('tollInputDate').value;
  const trajet = document.getElementById('tollInputTrajet').value.trim();
  const montant = parseFloat(document.getElementById('tollInputMontant').value) || 0;
  const rembourse = document.getElementById('tollInputRembourse').value;

  const existingIndex = tollState.records.findIndex(r => r.id === tollState.currentEditingId);
  const recordObj = {
    id: tollState.currentEditingId || ("TOLL-" + Date.now().toString().slice(-6)),
    date, trajet, montant, rembourse,
    image: tollState.tempImage
  };

  if (existingIndex >= 0) {
    tollState.records[existingIndex] = recordObj;
  } else {
    tollState.records.unshift(recordObj);
  }

  saveTollRecords();
  closeEditTollModal();
  showToast("✅ Ticket enregistre !", "success");
}

function exportTollToExcel() {
  const filtered = getFilteredTollRecords();
  if (filtered.length === 0) {
    showToast("Aucune donnee.", "warning");
    return;
  }
  const totalAmount = filtered.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
      table { border-collapse: collapse; width: 100%; font-family: Arial; font-size: 11pt; }
      th { background-color: #1f2937; color: #fff; font-weight: bold; border: 1px solid #475569; padding: 10px; }
      td { border: 1px solid #cbd5e1; padding: 8px; }
      .num { text-align: right; }
    </style></head><body>
      <div style="font-size:16pt;font-weight:bold;margin-bottom:10px;">Rapport Frais Autoroute</div>
      <table><thead><tr><th>Date</th><th>Trajet</th><th>Montant (MAD)</th><th>Rembourse</th></tr></thead><tbody>`;
  filtered.forEach(r => {
    html += `<tr><td>${r.date}</td><td>${escapeHtml(r.trajet || '')}</td><td class="num">${parseFloat(r.montant).toFixed(2)}</td><td>${r.rembourse === 'YES' ? 'Oui' : 'Non'}</td></tr>`;
  });
  html += `<tr style="background-color:#f1f5f9;font-weight:bold;"><td colspan="2" style="text-align:right;">TOTAL :</td><td class="num" style="color:#059669;"><b>${totalAmount.toFixed(2)}</b></td><td></td></tr></tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `frais_autoroute_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Excel exporte !", "success");
}

// TABS
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add('active');
    });
  });
}

// EVENT LISTENERS AUTOROUTE
function setupTollEventListeners() {
  document.getElementById('btnOpenScannerToll').addEventListener('click', openCameraModalToll);
  document.getElementById('btnCloseCameraModalToll').addEventListener('click', closeCameraModalToll);
  document.getElementById('btnCapturePhotoToll').addEventListener('click', () => {
    cancelTollCountdown();
    captureTollPhoto();
  });

  document.getElementById('btnUploadToll').addEventListener('click', () => {
    document.getElementById('fileInputToll').click();
  });
  document.getElementById('fileInputToll').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => runTollExtraction(ev.target.result);
      reader.readAsDataURL(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.getElementById('tollForm').addEventListener('submit', saveTollForm);
  document.getElementById('btnCloseEditTollModal').addEventListener('click', closeEditTollModal);
  document.getElementById('btnCancelToll').addEventListener('click', closeEditTollModal);

  document.getElementById('filterTollRemb').addEventListener('change', (e) => {
    tollState.filterRembourse = e.target.value;
    renderTollTable();
  });

  document.getElementById('btnExportToll').addEventListener('click', exportTollToExcel);
}

// Init module Autoroute (appele apres le chargement principal)
(async function initTollModule() {
  document.addEventListener('DOMContentLoaded', async () => {
    await loadTollRecords();
    setupTollEventListeners();
    setupTabs();
    renderTollTable();
  });
})();
