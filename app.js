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
    if (state.filterGasoilRemb && state.filterGasoilRemb !== 'ALL' && r.rembourse !== state.filterGasoilRemb) return false;
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
      <td>${record.rembourse === 'YES' ? '<span style="color: var(--success);">✅ Oui</span>' : '<span style="color: var(--warning);">⏳ Non</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn" onclick="toggleGasoilRembourse('${record.id}')">🔄</button>
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

  const filterGasoilRembEl = document.getElementById('filterGasoilRemb');
  if (filterGasoilRembEl) {
    filterGasoilRembEl.addEventListener('change', (e) => {
      state.filterGasoilRemb = e.target.value;
      renderStats();
      renderTable();
    });
  }

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
  const rembSelect = document.getElementById('inputRembourseGasoil');
  if (rembSelect) rembSelect.value = data.rembourse || 'NO';

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
  const rembourse = document.getElementById('inputRembourseGasoil') ? document.getElementById('inputRembourseGasoil').value : 'NO';

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

function toggleGasoilRembourse(id) {
  const record = state.records.find(r => r.id === id);
  if (record) {
    record.rembourse = record.rembourse === 'YES' ? 'NO' : 'YES';
    saveRecords();
    showToast(record.rembourse === 'YES' ? '✅ Marque comme rembourse' : '⏳ Marque comme non rembourse', 'info');
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
  filterPersonne: 'ALL',
  filterDept: 'ALL',
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
  updateTollFilterDropdowns();
  renderTollTable();
}

function getFilteredTollRecords() {
  return tollState.records.filter(r => {
    if (tollState.filterRembourse !== 'ALL' && r.rembourse !== tollState.filterRembourse) return false;
    if (tollState.filterPersonne && tollState.filterPersonne !== 'ALL' && r.personne !== tollState.filterPersonne) return false;
    if (tollState.filterDept && tollState.filterDept !== 'ALL' && r.departement !== tollState.filterDept) return false;
    return true;
  });
}

function updateTollFilterDropdowns() {
  const personneSel = document.getElementById('filterTollPersonne');
  const deptSel = document.getElementById('filterTollDept');
  const names = Array.from(new Set(tollState.records.map(r => r.personne).filter(Boolean))).sort();
  const depts = Array.from(new Set(tollState.records.map(r => r.departement).filter(Boolean))).sort();

  if (personneSel) {
    const curVal = personneSel.value;
    personneSel.innerHTML = '<option value="ALL">Toutes les personnes</option>';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      personneSel.appendChild(opt);
    });
    if (names.includes(curVal)) personneSel.value = curVal;
  }
  if (deptSel) {
    const curVal = deptSel.value;
    deptSel.innerHTML = '<option value="ALL">Tous les departements</option>';
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      deptSel.appendChild(opt);
    });
    if (depts.includes(curVal)) deptSel.value = curVal;
  }
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
      <td>${escapeHtml(record.personne || '-')}</td>
      <td>${escapeHtml(record.departement || '-')}</td>
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
      image: imageDataUrl,
      personne: state.lastTollPersonne || '',
      departement: state.lastTollDept || ''
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

function updateTollDeptDropdown(selectedVal) {
  const select = document.getElementById('tollInputDepartement');
  if (!select) return;
  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();
  select.innerHTML = '<option value="">-- Departement --</option>';
  allDepts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  if (selectedVal) select.value = selectedVal;
}

function openEditTollModalWithData(data) {
  tollState.currentEditingId = data.id || null;
  tollState.tempImage = data.image || null;

  document.getElementById('tollInputPersonne').value = data.personne || '';
  updateTollDeptDropdown(data.departement || '');
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
  document.getElementById('tollInputPersonne').value = '';
  document.getElementById('tollInputDate').value = '';
  document.getElementById('tollInputTrajet').value = '';
  document.getElementById('tollInputMontant').value = '';
  const previewBox = document.getElementById('editTollImagePreview');
  previewBox.src = '';
  previewBox.style.display = 'none';
}

function saveTollForm(e) {
  e.preventDefault();
  const personne = document.getElementById('tollInputPersonne').value.trim();
  const departement = document.getElementById('tollInputDepartement').value;
  const date = document.getElementById('tollInputDate').value;
  const trajet = document.getElementById('tollInputTrajet').value.trim();
  const montant = parseFloat(document.getElementById('tollInputMontant').value) || 0;
  const rembourse = document.getElementById('tollInputRembourse').value;

  if (!personne) {
    showToast("Veuillez renseigner le nom de la personne.", "warning");
    return;
  }

  const existingIndex = tollState.records.findIndex(r => r.id === tollState.currentEditingId);
  const recordObj = {
    id: tollState.currentEditingId || ("TOLL-" + Date.now().toString().slice(-6)),
    personne, departement, date, trajet, montant, rembourse,
    image: tollState.tempImage
  };

  if (existingIndex >= 0) {
    tollState.records[existingIndex] = recordObj;
  } else {
    tollState.records.unshift(recordObj);
  }

  state.lastTollPersonne = personne;
  state.lastTollDept = departement;
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
      <table><thead><tr><th>Personne</th><th>Date</th><th>Trajet</th><th>Montant (MAD)</th><th>Rembourse</th></tr></thead><tbody>`;
  filtered.forEach(r => {
    html += `<tr><td>${escapeHtml(r.personne || '')}</td><td>${r.date}</td><td>${escapeHtml(r.trajet || '')}</td><td class="num">${parseFloat(r.montant).toFixed(2)}</td><td>${r.rembourse === 'YES' ? 'Oui' : 'Non'}</td></tr>`;
  });
  html += `<tr style="background-color:#f1f5f9;font-weight:bold;"><td colspan="3" style="text-align:right;">TOTAL :</td><td class="num" style="color:#059669;"><b>${totalAmount.toFixed(2)}</b></td><td></td></tr></tbody></table></body></html>`;
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
      if (btn.dataset.tab === 'stats') {
        renderStatsTab();
      }
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

  const filterTollPersonneEl = document.getElementById('filterTollPersonne');
  if (filterTollPersonneEl) {
    filterTollPersonneEl.addEventListener('change', (e) => {
      tollState.filterPersonne = e.target.value;
      renderTollTable();
    });
  }
  const filterTollDeptEl = document.getElementById('filterTollDept');
  if (filterTollDeptEl) {
    filterTollDeptEl.addEventListener('change', (e) => {
      tollState.filterDept = e.target.value;
      renderTollTable();
    });
  }

  document.getElementById('btnExportToll').addEventListener('click', exportTollToExcel);
}

// Init module Autoroute (appele apres le chargement principal)
(async function initTollModule() {
  document.addEventListener('DOMContentLoaded', async () => {
    await loadTollRecords();
    updateTollFilterDropdowns();
    setupTollEventListeners();
    setupTabs();
    renderTollTable();
  });
})();

// ==================== MODULE STATISTIQUES ====================
let chartInstances = {};

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    chartInstances[key] = null;
  }
}

function renderStatsTab() {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js non charge');
    return;
  }

  const filtered = getStatsFilteredData();

  const totalGasoil = filtered.gasoil.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
  const totalToll = filtered.toll.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
  const totalNonRembourse = filtered.toll
    .filter(r => r.rembourse !== 'YES')
    .reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);

  document.getElementById('statsTotalGasoil').textContent = totalGasoil.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH';
  document.getElementById('statsTotalToll').textContent = totalToll.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH';
  document.getElementById('statsTotalCombined').textContent = (totalGasoil + totalToll).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH';
  document.getElementById('statsNonRembourse').textContent = totalNonRembourse.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH';

  renderChartByDept(filtered);
  renderChartByPerson(filtered);
  renderChartByMonth(filtered);
  renderChartRembourse(filtered);
  renderConsumptionTable(filtered);
}

function getStatsFilteredData() {
  const deptFilter = document.getElementById('statsFilterDept') ? document.getElementById('statsFilterDept').value : 'ALL';
  const periodFilter = document.getElementById('statsFilterPeriod') ? document.getElementById('statsFilterPeriod').value : 'ALL';

  let cutoffDate = null;
  if (periodFilter !== 'ALL') {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(periodFilter));
  }

  const matchDept = (dept) => deptFilter === 'ALL' || dept === deptFilter;
  const matchPeriod = (dateStr) => {
    if (!cutoffDate || !dateStr) return true;
    return new Date(dateStr) >= cutoffDate;
  };

  return {
    gasoil: state.records.filter(r => matchDept(r.departement) && matchPeriod(r.date)),
    toll: tollState.records.filter(r => matchDept(r.departement) && matchPeriod(r.date)),
    charges: chargeState.records.filter(r => matchDept(r.departement) && matchPeriod(r.date))
  };
}

function updateStatsFilterDropdown() {
  const select = document.getElementById('statsFilterDept');
  if (!select) return;
  const curVal = select.value;
  const allDepts = Array.from(new Set([
    ...state.departments,
    ...state.records.map(r => r.departement).filter(Boolean),
    ...tollState.records.map(r => r.departement).filter(Boolean),
    ...chargeState.records.map(r => r.departement).filter(Boolean)
  ])).sort();
  select.innerHTML = '<option value="ALL">Tous les departements</option>';
  allDepts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    select.appendChild(opt);
  });
  if (allDepts.includes(curVal)) select.value = curVal;
}

const CHART_COLORS = ['#0ea5e9', '#059669', '#d97706', '#dc2626', '#6366f1', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];

function renderChartByDept(filtered) {
  const deptTotals = {};
  filtered.gasoil.forEach(r => {
    const d = r.departement || 'Non specifie';
    deptTotals[d] = (deptTotals[d] || 0) + (parseFloat(r.montant) || 0);
  });

  const labels = Object.keys(deptTotals);
  const data = Object.values(deptTotals);

  destroyChart('byDept');
  const ctx = document.getElementById('chartByDept');
  if (!ctx || labels.length === 0) return;

  chartInstances.byDept = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: CHART_COLORS }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#fff', font: { size: 11 } } }
      }
    }
  });
}

function renderChartByPerson(filtered) {
  const sourceFilter = document.getElementById('statsFilterSource') ? document.getElementById('statsFilterSource').value : 'ALL';
  const personTotals = {};

  if (sourceFilter === 'ALL' || sourceFilter === 'gasoil') {
    filtered.gasoil.forEach(r => {
      const p = r.nomPrenom || 'Inconnu';
      personTotals[p] = (personTotals[p] || 0) + (parseFloat(r.montant) || 0);
    });
  }
  if (sourceFilter === 'ALL' || sourceFilter === 'toll') {
    filtered.toll.forEach(r => {
      const p = r.personne || 'Inconnu';
      personTotals[p] = (personTotals[p] || 0) + (parseFloat(r.montant) || 0);
    });
  }
  if (sourceFilter === 'ALL' || sourceFilter === 'charge') {
    filtered.charges.forEach(r => {
      const p = r.personne || 'Inconnu';
      personTotals[p] = (personTotals[p] || 0) + (parseFloat(r.montant) || 0);
    });
  }

  const titleEl = document.getElementById('chartByPersonTitle');
  if (titleEl) {
    const labelMap = { ALL: 'Gasoil + Autoroute + Charges', gasoil: 'Gasoil', toll: 'Autoroute', charge: 'Charges' };
    titleEl.textContent = '👤 Depenses par Personne (Top 10, ' + labelMap[sourceFilter] + ')';
  }

  const sorted = Object.entries(personTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(e => e[0]);
  const data = sorted.map(e => e[1]);

  destroyChart('byPerson');
  const ctx = document.getElementById('chartByPerson');
  if (!ctx || labels.length === 0) return;

  chartInstances.byPerson = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Total (DH)', data, backgroundColor: '#0ea5e9' }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
        y: { ticks: { color: '#fff' }, grid: { display: false } }
      }
    }
  });
}

function renderChartByMonth(filtered) {
  const monthTotals = {};

  const addToMonth = (dateStr, amount) => {
    if (!dateStr) return;
    const month = dateStr.slice(0, 7);
    monthTotals[month] = (monthTotals[month] || 0) + amount;
  };

  filtered.gasoil.forEach(r => addToMonth(r.date, parseFloat(r.montant) || 0));
  filtered.toll.forEach(r => addToMonth(r.date, parseFloat(r.montant) || 0));
  filtered.charges.forEach(r => addToMonth(r.date, parseFloat(r.montant) || 0));

  const sortedMonths = Object.keys(monthTotals).sort();
  const labels = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    const noms = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    return noms[parseInt(mo) - 1] + ' ' + y;
  });
  const data = sortedMonths.map(m => monthTotals[m]);

  destroyChart('byMonth');
  const ctx = document.getElementById('chartByMonth');
  if (!ctx || labels.length === 0) return;

  chartInstances.byMonth = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Depenses totales (DH)',
        data,
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
      }
    }
  });
}

function renderChartRembourse(filtered) {
  const rembourse = filtered.toll.filter(r => r.rembourse === 'YES').reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);
  const nonRembourse = filtered.toll.filter(r => r.rembourse !== 'YES').reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);

  destroyChart('rembourse');
  const ctx = document.getElementById('chartRembourse');
  if (!ctx) return;
  if (rembourse === 0 && nonRembourse === 0) return;

  chartInstances.rembourse = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Rembourse', 'Non rembourse'],
      datasets: [{ data: [rembourse, nonRembourse], backgroundColor: ['#059669', '#d97706'] }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } }
    }
  });
}

function renderConsumptionTable(filtered) {
  const tbody = document.getElementById('consumptionTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const byPerson = {};
  filtered.gasoil.forEach(r => {
    const p = r.nomPrenom || 'Inconnu';
    if (!byPerson[p]) byPerson[p] = [];
    if (r.date && r.kilometrage) byPerson[p].push(r);
  });

  const rows = [];
  Object.keys(byPerson).forEach(p => {
    const records = byPerson[p].slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (records.length < 2) return;

    const first = records[0];
    const last = records[records.length - 1];
    const firstKm = parseInt(first.kilometrage) || 0;
    const lastKm = parseInt(last.kilometrage) || 0;
    const distance = lastKm - firstKm;
    if (distance <= 0) return;

    const totalSpend = records.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
    const costPerKm = totalSpend / distance;

    rows.push({ personne: p, firstKm, lastKm, distance, totalSpend, costPerKm });
  });

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 24px;">Pas assez de donnees (minimum 2 bons avec kilometrage par personne)</td></tr>';
    return;
  }

  rows.sort((a, b) => b.costPerKm - a.costPerKm);
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(r.personne)}</strong></td>
      <td>${r.firstKm.toLocaleString('fr-FR')} km</td>
      <td>${r.lastKm.toLocaleString('fr-FR')} km</td>
      <td>${r.distance.toLocaleString('fr-FR')} km</td>
      <td>${r.totalSpend.toFixed(2)} DH</td>
      <td><strong>${r.costPerKm.toFixed(2)} DH/km</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== MODULE CHARGES DIVERSES ====================
let chargeState = {
  records: [],
  filterRembourse: 'ALL',
  filterPersonne: 'ALL',
  filterDept: 'ALL',
  cameraStream: null,
  currentEditingId: null,
  tempImage: null,
  countdownTimer: null
};

async function loadChargeRecords() {
  try {
    const existing = await idbGet('charge_records');
    chargeState.records = (existing && Array.isArray(existing)) ? existing : [];
  } catch (e) {
    chargeState.records = [];
  }
}

async function saveChargeRecords() {
  try {
    await idbSet('charge_records', chargeState.records);
  } catch (e) {
    showToast('⚠️ Erreur de sauvegarde', 'warning');
  }
  updateChargeFilterDropdowns();
  renderChargeTable();
}

function getFilteredChargeRecords() {
  return chargeState.records.filter(r => {
    if (chargeState.filterRembourse !== 'ALL' && r.rembourse !== chargeState.filterRembourse) return false;
    if (chargeState.filterPersonne && chargeState.filterPersonne !== 'ALL' && r.personne !== chargeState.filterPersonne) return false;
    if (chargeState.filterDept && chargeState.filterDept !== 'ALL' && r.departement !== chargeState.filterDept) return false;
    return true;
  });
}

function updateChargeFilterDropdowns() {
  const personneSel = document.getElementById('filterChargePersonne');
  const deptSel = document.getElementById('filterChargeDept');
  const names = Array.from(new Set(chargeState.records.map(r => r.personne).filter(Boolean))).sort();
  const depts = Array.from(new Set(chargeState.records.map(r => r.departement).filter(Boolean))).sort();

  if (personneSel) {
    const curVal = personneSel.value;
    personneSel.innerHTML = '<option value="ALL">Toutes les personnes</option>';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      personneSel.appendChild(opt);
    });
    if (names.includes(curVal)) personneSel.value = curVal;
  }
  if (deptSel) {
    const curVal = deptSel.value;
    deptSel.innerHTML = '<option value="ALL">Tous les departements</option>';
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      deptSel.appendChild(opt);
    });
    if (depts.includes(curVal)) deptSel.value = curVal;
  }
}

function renderChargeTable() {
  const tbody = document.getElementById('chargeTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const filtered = getFilteredChargeRecords();

  if (filtered.length === 0) {
    document.getElementById('chargeEmptyState').style.display = 'block';
    return;
  }
  document.getElementById('chargeEmptyState').style.display = 'none';

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    const rembBadge = record.rembourse === 'YES'
      ? '<span style="color: var(--success);">✅ Oui</span>'
      : '<span style="color: var(--warning);">⏳ Non</span>';
    tr.innerHTML = `
      <td>${escapeHtml(record.personne || '-')}</td>
      <td>${escapeHtml(record.departement || '-')}</td>
      <td>${record.date}</td>
      <td>${escapeHtml(record.description || '-')}</td>
      <td><strong>${parseFloat(record.montant).toFixed(2)} DH</strong></td>
      <td>${rembBadge}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn" onclick="toggleChargeRembourse('${record.id}')">🔄</button>
          <button class="action-btn" onclick="editChargeRecord('${record.id}')">✏️</button>
          <button class="action-btn delete" onclick="deleteChargeRecord('${record.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleChargeRembourse(id) {
  const record = chargeState.records.find(r => r.id === id);
  if (record) {
    record.rembourse = record.rembourse === 'YES' ? 'NO' : 'YES';
    saveChargeRecords();
    showToast(record.rembourse === 'YES' ? '✅ Marque comme rembourse' : '⏳ Marque comme non rembourse', 'info');
  }
}

function deleteChargeRecord(id) {
  if (confirm('Supprimer cette charge ?')) {
    chargeState.records = chargeState.records.filter(r => r.id !== id);
    saveChargeRecords();
    showToast('Charge supprimee.', 'info');
  }
}

function editChargeRecord(id) {
  const record = chargeState.records.find(r => r.id === id);
  if (record) openEditChargeModalWithData(record);
}

async function openCameraModalCharge() {
  document.getElementById('cameraModalCharge').classList.add('active');
  const video = document.getElementById('scannerVideoCharge');
  try {
    chargeState.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = chargeState.cameraStream;
    video.onloadedmetadata = () => startChargeCountdown();
  } catch (err) {
    showToast("Impossible d'acceder a la camera.", "warning");
  }
}

function startChargeCountdown() {
  let count = 3;
  const el = document.getElementById('captureCountdownCharge');
  el.style.display = 'flex';
  el.textContent = count;
  chargeState.countdownTimer = setInterval(() => {
    count--;
    if (count <= 0) {
      cancelChargeCountdown();
      captureChargePhoto();
    } else {
      el.textContent = count;
    }
  }, 1000);
}

function cancelChargeCountdown() {
  if (chargeState.countdownTimer) {
    clearInterval(chargeState.countdownTimer);
    chargeState.countdownTimer = null;
  }
  document.getElementById('captureCountdownCharge').style.display = 'none';
}

function closeCameraModalCharge() {
  cancelChargeCountdown();
  document.getElementById('cameraModalCharge').classList.remove('active');
  if (chargeState.cameraStream) {
    chargeState.cameraStream.getTracks().forEach(track => track.stop());
    chargeState.cameraStream = null;
  }
}

function captureChargePhoto() {
  const video = document.getElementById('scannerVideoCharge');
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  closeCameraModalCharge();
  runChargeExtraction(imageDataUrl);
}

async function runChargeExtraction(imageDataUrl) {
  chargeState.tempImage = imageDataUrl;
  showToast("🧠 Lecture du recu en cours...", "info");

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extracted = await response.json();
    if (!response.ok) throw new Error(extracted.error || 'Erreur extraction');

    openEditChargeModalWithData({
      id: "CHG-" + Date.now().toString().slice(-6),
      date: extracted.date || '',
      description: extracted.description || '',
      montant: extracted.montant || '',
      rembourse: 'NO',
      image: imageDataUrl,
      personne: state.lastChargePersonne || '',
      departement: state.lastChargeDept || ''
    });

    showToast("✅ Recu lu automatiquement !", "success");
  } catch (error) {
    console.error("Erreur extraction charge:", error);
    showToast("⚠️ Extraction echouee, remplissez manuellement.", "warning");
    openEditChargeModalWithData({
      id: "CHG-" + Date.now().toString().slice(-6),
      image: imageDataUrl,
      rembourse: 'NO'
    });
  }
}

function updateChargeDeptDropdown(selectedVal) {
  const select = document.getElementById('chargeInputDepartement');
  if (!select) return;
  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();
  select.innerHTML = '<option value="">-- Departement --</option>';
  allDepts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  if (selectedVal) select.value = selectedVal;
}

function openEditChargeModalWithData(data) {
  chargeState.currentEditingId = data.id || null;
  chargeState.tempImage = data.image || null;

  document.getElementById('chargeInputPersonne').value = data.personne || '';
  updateChargeDeptDropdown(data.departement || '');
  document.getElementById('chargeInputDate').value = data.date || new Date().toISOString().split('T')[0];
  document.getElementById('chargeInputDescription').value = data.description || '';
  document.getElementById('chargeInputMontant').value = data.montant || '';
  document.getElementById('chargeInputRembourse').value = data.rembourse || 'NO';

  const previewBox = document.getElementById('editChargeImagePreview');
  if (data.image) {
    previewBox.src = data.image;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }

  document.getElementById('editChargeModal').classList.add('active');
}

function closeEditChargeModal() {
  document.getElementById('editChargeModal').classList.remove('active');
  chargeState.currentEditingId = null;
  chargeState.tempImage = null;
  document.getElementById('chargeInputPersonne').value = '';
  document.getElementById('chargeInputDate').value = '';
  document.getElementById('chargeInputDescription').value = '';
  document.getElementById('chargeInputMontant').value = '';
  const previewBox = document.getElementById('editChargeImagePreview');
  previewBox.src = '';
  previewBox.style.display = 'none';
}

function saveChargeForm(e) {
  e.preventDefault();
  const personne = document.getElementById('chargeInputPersonne').value.trim();
  const departement = document.getElementById('chargeInputDepartement').value;
  const date = document.getElementById('chargeInputDate').value;
  const description = document.getElementById('chargeInputDescription').value.trim();
  const montant = parseFloat(document.getElementById('chargeInputMontant').value) || 0;
  const rembourse = document.getElementById('chargeInputRembourse').value;

  if (!personne) {
    showToast("Veuillez renseigner le nom de la personne.", "warning");
    return;
  }

  const existingIndex = chargeState.records.findIndex(r => r.id === chargeState.currentEditingId);
  const recordObj = {
    id: chargeState.currentEditingId || ("CHG-" + Date.now().toString().slice(-6)),
    personne, departement, date, description, montant, rembourse,
    image: chargeState.tempImage
  };

  if (existingIndex >= 0) {
    chargeState.records[existingIndex] = recordObj;
  } else {
    chargeState.records.unshift(recordObj);
  }

  state.lastChargePersonne = personne;
  state.lastChargeDept = departement;
  saveChargeRecords();
  closeEditChargeModal();
  showToast("✅ Charge enregistree !", "success");
}

function exportChargeToExcel() {
  const filtered = getFilteredChargeRecords();
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
      <div style="font-size:16pt;font-weight:bold;margin-bottom:10px;">Rapport Charges Diverses</div>
      <table><thead><tr><th>Personne</th><th>Departement</th><th>Date</th><th>Description</th><th>Montant (MAD)</th><th>Rembourse</th></tr></thead><tbody>`;
  filtered.forEach(r => {
    html += `<tr><td>${escapeHtml(r.personne || '')}</td><td>${escapeHtml(r.departement || '')}</td><td>${r.date}</td><td>${escapeHtml(r.description || '')}</td><td class="num">${parseFloat(r.montant).toFixed(2)}</td><td>${r.rembourse === 'YES' ? 'Oui' : 'Non'}</td></tr>`;
  });
  html += `<tr style="background-color:#f1f5f9;font-weight:bold;"><td colspan="4" style="text-align:right;">TOTAL :</td><td class="num" style="color:#059669;"><b>${totalAmount.toFixed(2)}</b></td><td></td></tr></tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `charges_diverses_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Excel exporte !", "success");
}

function setupChargeEventListeners() {
  document.getElementById('btnOpenScannerCharge').addEventListener('click', openCameraModalCharge);
  document.getElementById('btnCloseCameraModalCharge').addEventListener('click', closeCameraModalCharge);
  document.getElementById('btnCapturePhotoCharge').addEventListener('click', () => {
    cancelChargeCountdown();
    captureChargePhoto();
  });

  document.getElementById('btnUploadCharge').addEventListener('click', () => {
    document.getElementById('fileInputCharge').click();
  });
  document.getElementById('fileInputCharge').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => runChargeExtraction(ev.target.result);
      reader.readAsDataURL(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.getElementById('chargeForm').addEventListener('submit', saveChargeForm);
  document.getElementById('btnCloseEditChargeModal').addEventListener('click', closeEditChargeModal);
  document.getElementById('btnCancelCharge').addEventListener('click', closeEditChargeModal);

  document.getElementById('filterChargeRemb').addEventListener('change', (e) => {
    chargeState.filterRembourse = e.target.value;
    renderChargeTable();
  });

  const filterChargePersonneEl = document.getElementById('filterChargePersonne');
  if (filterChargePersonneEl) {
    filterChargePersonneEl.addEventListener('change', (e) => {
      chargeState.filterPersonne = e.target.value;
      renderChargeTable();
    });
  }
  const filterChargeDeptEl = document.getElementById('filterChargeDept');
  if (filterChargeDeptEl) {
    filterChargeDeptEl.addEventListener('change', (e) => {
      chargeState.filterDept = e.target.value;
      renderChargeTable();
    });
  }

  document.getElementById('btnExportCharge').addEventListener('click', exportChargeToExcel);
}

// ==================== IMPRESSION FEUILLE DE PAIEMENT ====================
// ==================== FEUILLE DE REMBOURSEMENT ====================
function getAllNonGroupedEntries() {
  const gasoil = state.records.map(r => ({
    id: r.id, source: 'gasoil', nom: r.nomPrenom, dept: r.departement,
    charge: 'Gasoil', montant: parseFloat(r.montant) || 0, rembourse: r.rembourse === 'YES'
  }));
  const toll = tollState.records.map(r => ({
    id: r.id, source: 'toll', nom: r.personne, dept: r.departement,
    charge: 'Autoroute' + (r.trajet ? ' (' + r.trajet + ')' : ''), montant: parseFloat(r.montant) || 0, rembourse: r.rembourse === 'YES'
  }));
  const charges = chargeState.records.map(r => ({
    id: r.id, source: 'charge', nom: r.personne, dept: r.departement,
    charge: r.description || 'Charge diverse', montant: parseFloat(r.montant) || 0, rembourse: r.rembourse === 'YES'
  }));
  return [...gasoil, ...toll, ...charges].filter(r => r.nom && r.nom.trim());
}

function updatePaymentFilterDropdowns() {
  const all = getAllNonGroupedEntries();
  const names = Array.from(new Set(all.map(r => r.nom.trim()))).sort();
  const depts = Array.from(new Set(all.map(r => r.dept).filter(Boolean))).sort();

  const personneSel = document.getElementById('paymentFilterPersonne');
  const deptSel = document.getElementById('paymentFilterDept');
  if (personneSel) {
    const curVal = personneSel.value;
    personneSel.innerHTML = '<option value="ALL">Toutes les personnes</option>';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      personneSel.appendChild(opt);
    });
    if (names.includes(curVal)) personneSel.value = curVal;
  }
  if (deptSel) {
    const curVal = deptSel.value;
    deptSel.innerHTML = '<option value="ALL">Tous les departements</option>';
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      deptSel.appendChild(opt);
    });
    if (depts.includes(curVal)) deptSel.value = curVal;
  }
}

function getFilteredPaymentEntries() {
  const personneFilter = document.getElementById('paymentFilterPersonne').value;
  const deptFilter = document.getElementById('paymentFilterDept').value;
  const statutFilter = document.getElementById('paymentFilterStatut').value;

  return getAllNonGroupedEntries().filter(r => {
    if (personneFilter !== 'ALL' && r.nom.trim() !== personneFilter) return false;
    if (deptFilter !== 'ALL' && r.dept !== deptFilter) return false;
    if (statutFilter === 'NO' && r.rembourse) return false;
    if (statutFilter === 'YES' && !r.rembourse) return false;
    return true;
  });
}

function buildPaymentSheetDOM() {
  const filtered = getFilteredPaymentEntries();

  if (filtered.length === 0) {
    showToast("Aucune depense ne correspond a ces filtres.", "info");
    return null;
  }

  const grouped = {};
  filtered.forEach(r => {
    const key = r.nom.trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  const tbody = document.getElementById('printPaymentBody');
  tbody.innerHTML = '';
  let grandTotal = 0;

  Object.keys(grouped).sort().forEach(nom => {
    grouped[nom].forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx === 0 ? escapeHtml(nom) : ''}</td>
        <td>${escapeHtml(r.dept || '-')}</td>
        <td>${escapeHtml(r.charge)}</td>
        <td>${r.montant.toFixed(2)} DH</td>
        <td class="sig-cell"></td>
      `;
      tbody.appendChild(tr);
      grandTotal += r.montant;
    });
  });

  const totalRow = document.createElement('tr');
  totalRow.innerHTML = `<td colspan="3" style="text-align:right; font-weight:bold;">TOTAL :</td><td style="font-weight:bold;">${grandTotal.toFixed(2)} DH</td><td></td>`;
  tbody.appendChild(totalRow);

  const statutFilter = document.getElementById('paymentFilterStatut').value;
  const statutLabel = statutFilter === 'NO' ? 'Non rembourses' : statutFilter === 'YES' ? 'Rembourses' : 'Tous statuts';
  document.getElementById('printPaymentDate').textContent = 'Genere le ' + new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' - ' + statutLabel + ' - ' + Object.keys(grouped).length + ' personne(s)';

  return { grouped, grandTotal };
}

function printPaymentSheet() {
  const result = buildPaymentSheetDOM();
  if (!result) return;
  window.print();
}

function downloadPaymentSheetPDF() {
  const result = buildPaymentSheetDOM();
  if (!result) return;

  if (typeof window.jspdf === 'undefined') {
    showToast("Erreur: bibliotheque PDF non chargee.", "warning");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Feuille de Remboursement', 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(document.getElementById('printPaymentDate').textContent, 14, 25);

  const rows = [];
  const bodyRows = document.getElementById('printPaymentBody').querySelectorAll('tr');
  bodyRows.forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
    rows.push(cells);
  });

  let y = 34;
  const colX = [14, 70, 105, 150, 175];
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.setFillColor(31, 41, 55);
  doc.rect(14, y - 5, 182, 7, 'F');
  doc.setTextColor(255);
  doc.text('Nom', colX[0] + 1, y);
  doc.text('Departement', colX[1] + 1, y);
  doc.text('Charge', colX[2] + 1, y);
  doc.text('Montant', colX[3] + 1, y);
  doc.text('Signature', colX[4] + 1, y);
  y += 8;

  doc.setTextColor(20);
  rows.forEach((row, idx) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(220);
    doc.line(14, y + 2, 196, y + 2);
    doc.text(String(row[0] || ''), colX[0] + 1, y);
    doc.text(String(row[1] || ''), colX[1] + 1, y);
    doc.text(String(row[2] || ''), colX[2] + 1, y, { maxWidth: 43 });
    doc.text(String(row[3] || ''), colX[3] + 1, y);
    doc.rect(colX[4], y - 4, 20, 6);
    y += 8;
  });

  doc.save('feuille_remboursement_' + new Date().toISOString().split('T')[0] + '.pdf');
  showToast("📄 PDF telecharge !", "success");
}

// ==================== SCAN FEUILLE SIGNEE ====================
let signedSheetResults = [];

async function runSignedSheetExtraction(imageDataUrl) {
  document.getElementById('signedSheetModal').classList.add('active');
  document.getElementById('signedSheetStatusText').textContent = "Analyse de la feuille en cours...";
  document.getElementById('signedSheetList').innerHTML = '';
  document.getElementById('btnConfirmSignedSheet').style.display = 'none';

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract-signed-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extracted = await response.json();
    if (!response.ok) throw new Error(extracted.error || 'Erreur extraction');

    const allNames = Array.from(new Set(getAllNonGroupedEntries().map(r => r.nom.trim())));

    signedSheetResults = extracted.map(item => {
      const matched = allNames.find(n => n.toLowerCase() === (item.nom || '').trim().toLowerCase());
      return {
        nomDetecte: item.nom || '',
        nomMatched: matched || '',
        signe: !!item.signe
      };
    });

    if (signedSheetResults.length === 0) {
      document.getElementById('signedSheetStatusText').textContent = "Aucune ligne detectee. Reessayez avec une photo plus nette.";
      return;
    }

    document.getElementById('signedSheetStatusText').textContent = signedSheetResults.length + " ligne(s) detectee(s). Verifiez avant de confirmer.";
    renderSignedSheetList();
    document.getElementById('btnConfirmSignedSheet').style.display = 'block';
  } catch (error) {
    console.error("Erreur signed sheet:", error);
    document.getElementById('signedSheetStatusText').textContent = "Erreur d'extraction. Reessayez avec une photo plus nette.";
  }
}

function renderSignedSheetList() {
  const container = document.getElementById('signedSheetList');
  container.innerHTML = '';
  const allNames = Array.from(new Set(getAllNonGroupedEntries().map(r => r.nom.trim()))).sort();

  signedSheetResults.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'batch-item';
    const nameOptions = allNames.map(n => '<option value="' + escapeHtml(n) + '"' + (n === item.nomMatched ? ' selected' : '') + '>' + escapeHtml(n) + '</option>').join('');

    div.innerHTML = `
      <div class="batch-item-header">
        <span class="batch-item-title">${escapeHtml(item.nomDetecte || 'Nom non lu')}</span>
        <button type="button" class="batch-item-remove" onclick="removeSignedSheetItem(${idx})">🗑️</button>
      </div>
      <div class="batch-item-fields">
        <select class="full-width" onchange="updateSignedSheetField(${idx}, 'nomMatched', this.value)">
          <option value="">-- Associer a --</option>
          ${nameOptions}
        </select>
        <label style="display:flex; align-items:center; gap:8px; grid-column: 1 / -1; font-size: 13px;">
          <input type="checkbox" ${item.signe ? 'checked' : ''} onchange="updateSignedSheetField(${idx}, 'signe', this.checked)">
          Signe (marquer comme rembourse)
        </label>
      </div>
    `;
    container.appendChild(div);
  });
}

function updateSignedSheetField(idx, field, value) {
  signedSheetResults[idx][field] = value;
}

function removeSignedSheetItem(idx) {
  signedSheetResults.splice(idx, 1);
  renderSignedSheetList();
}

async function confirmSignedSheetUpdate() {
  let updatedCount = 0;

  signedSheetResults.forEach(item => {
    if (!item.signe || !item.nomMatched) return;
    const name = item.nomMatched.trim().toLowerCase();

    state.records.forEach(r => {
      if ((r.nomPrenom || '').trim().toLowerCase() === name && r.rembourse !== 'YES') {
        r.rembourse = 'YES';
        updatedCount++;
      }
    });
    tollState.records.forEach(r => {
      if ((r.personne || '').trim().toLowerCase() === name && r.rembourse !== 'YES') {
        r.rembourse = 'YES';
        updatedCount++;
      }
    });
    chargeState.records.forEach(r => {
      if ((r.personne || '').trim().toLowerCase() === name && r.rembourse !== 'YES') {
        r.rembourse = 'YES';
        updatedCount++;
      }
    });
  });

  await saveRecords();
  await saveTollRecords();
  await saveChargeRecords();

  closeSignedSheetModal();
  showToast("✅ " + updatedCount + " depense(s) marquee(s) comme remboursee(s) !", "success");
}

function closeSignedSheetModal() {
  document.getElementById('signedSheetModal').classList.remove('active');
  signedSheetResults = [];
}

// Init module Charges + feuille de remboursement + scan feuille signee
document.addEventListener('DOMContentLoaded', async () => {
  await loadChargeRecords();
  updateChargeFilterDropdowns();
  setupChargeEventListeners();
  renderChargeTable();

  const printBtn = document.getElementById('btnPrintPayment');
  if (printBtn) printBtn.addEventListener('click', printPaymentSheet);

  const downloadBtn = document.getElementById('btnDownloadPayment');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadPaymentSheetPDF);

  ['paymentFilterPersonne', 'paymentFilterDept', 'paymentFilterStatut'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updatePaymentFilterDropdowns);
  });

  const importSignedBtn = document.getElementById('btnImportSignedSheet');
  if (importSignedBtn) {
    importSignedBtn.addEventListener('click', () => {
      updatePaymentFilterDropdowns();
      document.getElementById('fileInputSignedSheet').click();
    });
  }
  const fileInputSigned = document.getElementById('fileInputSignedSheet');
  if (fileInputSigned) {
    fileInputSigned.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => runSignedSheetExtraction(ev.target.result);
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  const closeSignedBtn = document.getElementById('btnCloseSignedSheetModal');
  if (closeSignedBtn) closeSignedBtn.addEventListener('click', closeSignedSheetModal);
  const cancelSignedBtn = document.getElementById('btnCancelSignedSheet');
  if (cancelSignedBtn) cancelSignedBtn.addEventListener('click', closeSignedSheetModal);
  const confirmSignedBtn = document.getElementById('btnConfirmSignedSheet');
  if (confirmSignedBtn) confirmSignedBtn.addEventListener('click', confirmSignedSheetUpdate);

  // Initialiser les dropdowns de filtres au chargement de l'onglet stats
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'stats') {
      btn.addEventListener('click', () => {
        updatePaymentFilterDropdowns();
        updateStatsFilterDropdown();
      });
    }
  });

  const statsDeptEl = document.getElementById('statsFilterDept');
  if (statsDeptEl) statsDeptEl.addEventListener('change', renderStatsTab);
  const statsPeriodEl = document.getElementById('statsFilterPeriod');
  if (statsPeriodEl) statsPeriodEl.addEventListener('change', renderStatsTab);
  const statsSourceEl = document.getElementById('statsFilterSource');
  if (statsSourceEl) statsSourceEl.addEventListener('change', renderStatsTab);
});

// ==================== IMPORT FEUILLE MULTI-TICKETS AUTOROUTE ====================
let tollBatchResults = [];

async function runTollBatchExtraction(imageDataUrl) {
  document.getElementById('tollBatchReviewModal').classList.add('active');
  document.getElementById('tollBatchStatusText').textContent = "Analyse de la feuille en cours...";
  document.getElementById('tollBatchList').innerHTML = '';
  document.getElementById('btnSaveTollBatch').style.display = 'none';

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract-toll-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extractedList = await response.json();
    if (!response.ok) throw new Error(extractedList.error || 'Erreur extraction');

    tollBatchResults = extractedList.map((item, idx) => ({
      tempId: 'tollbatch-' + idx,
      personne: state.lastTollPersonne || '',
      departement: state.lastTollDept || '',
      date: item.date || '',
      trajet: item.trajet || '',
      montant: item.montant || ''
    }));

    if (tollBatchResults.length === 0) {
      document.getElementById('tollBatchStatusText').textContent = "Aucun ticket detecte. Reessayez avec une photo plus nette.";
      return;
    }

    document.getElementById('tollBatchStatusText').textContent = tollBatchResults.length + " ticket(s) detecte(s). Verifiez/corrigez avant d'enregistrer.";
    renderTollBatchList();
    document.getElementById('btnSaveTollBatch').style.display = 'block';
  } catch (error) {
    console.error("Erreur toll batch:", error);
    document.getElementById('tollBatchStatusText').textContent = "Erreur d'extraction. Reessayez avec une photo plus nette.";
  }
}

function renderTollBatchList() {
  const container = document.getElementById('tollBatchList');
  container.innerHTML = '';
  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();

  tollBatchResults.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'batch-item';
    const deptOptions = allDepts.map(d => '<option value="' + escapeHtml(d) + '"' + (d === item.departement ? ' selected' : '') + '>' + escapeHtml(d) + '</option>').join('');

    div.innerHTML = `
      <div class="batch-item-header">
        <span class="batch-item-title">Ticket #${idx + 1}</span>
        <button type="button" class="batch-item-remove" onclick="removeTollBatchItem(${idx})">🗑️</button>
      </div>
      <div class="batch-item-fields">
        <input type="text" class="full-width" placeholder="Personne" value="${escapeHtml(item.personne)}" oninput="updateTollBatchField(${idx}, 'personne', this.value)">
        <select onchange="updateTollBatchField(${idx}, 'departement', this.value)">
          <option value="">-- Departement --</option>
          ${deptOptions}
        </select>
        <input type="date" value="${item.date}" oninput="updateTollBatchField(${idx}, 'date', this.value)">
        <input type="number" placeholder="Montant" value="${item.montant}" oninput="updateTollBatchField(${idx}, 'montant', this.value)">
        <input type="text" class="full-width" placeholder="Trajet" value="${escapeHtml(item.trajet)}" oninput="updateTollBatchField(${idx}, 'trajet', this.value)">
      </div>
    `;
    container.appendChild(div);
  });
}

function updateTollBatchField(idx, field, value) {
  tollBatchResults[idx][field] = value;
}

function removeTollBatchItem(idx) {
  tollBatchResults.splice(idx, 1);
  renderTollBatchList();
  document.getElementById('tollBatchStatusText').textContent = tollBatchResults.length + " ticket(s) a enregistrer.";
}

async function saveTollBatchResults() {
  let savedCount = 0;
  for (const item of tollBatchResults) {
    if (!item.personne || !item.personne.trim()) continue;
    tollState.records.unshift({
      id: "TOLL-" + Date.now().toString().slice(-6) + "-" + savedCount,
      personne: item.personne.trim(),
      departement: item.departement || '',
      date: item.date || new Date().toISOString().split('T')[0],
      trajet: (item.trajet || '').trim(),
      montant: parseFloat(item.montant) || 0,
      rembourse: 'NO',
      image: null
    });
    savedCount++;
  }
  await saveTollRecords();
  closeTollBatchModal();
  showToast("🎉 " + savedCount + " ticket(s) enregistre(s) !", "success");
}

function closeTollBatchModal() {
  document.getElementById('tollBatchReviewModal').classList.remove('active');
  tollBatchResults = [];
}

// ==================== IMPORT FEUILLE MULTI-RECUS CHARGES ====================
let chargeBatchResults = [];

async function runChargeBatchExtraction(imageDataUrl) {
  document.getElementById('chargeBatchReviewModal').classList.add('active');
  document.getElementById('chargeBatchStatusText').textContent = "Analyse de la feuille en cours...";
  document.getElementById('chargeBatchList').innerHTML = '';
  document.getElementById('btnSaveChargeBatch').style.display = 'none';

  try {
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaType = header.match(/data:(.*?);/)[1];

    const response = await fetch('/api/extract-charge-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mediaType })
    });

    const extractedList = await response.json();
    if (!response.ok) throw new Error(extractedList.error || 'Erreur extraction');

    chargeBatchResults = extractedList.map((item, idx) => ({
      tempId: 'chargebatch-' + idx,
      personne: state.lastChargePersonne || '',
      departement: state.lastChargeDept || '',
      date: item.date || '',
      description: item.description || '',
      montant: item.montant || ''
    }));

    if (chargeBatchResults.length === 0) {
      document.getElementById('chargeBatchStatusText').textContent = "Aucun recu detecte. Reessayez avec une photo plus nette.";
      return;
    }

    document.getElementById('chargeBatchStatusText').textContent = chargeBatchResults.length + " recu(s) detecte(s). Verifiez/corrigez avant d'enregistrer.";
    renderChargeBatchList();
    document.getElementById('btnSaveChargeBatch').style.display = 'block';
  } catch (error) {
    console.error("Erreur charge batch:", error);
    document.getElementById('chargeBatchStatusText').textContent = "Erreur d'extraction. Reessayez avec une photo plus nette.";
  }
}

function renderChargeBatchList() {
  const container = document.getElementById('chargeBatchList');
  container.innerHTML = '';
  const allDepts = Array.from(new Set([...state.departments, ...state.records.map(r => r.departement).filter(Boolean)])).sort();

  chargeBatchResults.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'batch-item';
    const deptOptions = allDepts.map(d => '<option value="' + escapeHtml(d) + '"' + (d === item.departement ? ' selected' : '') + '>' + escapeHtml(d) + '</option>').join('');

    div.innerHTML = `
      <div class="batch-item-header">
        <span class="batch-item-title">Recu #${idx + 1}</span>
        <button type="button" class="batch-item-remove" onclick="removeChargeBatchItem(${idx})">🗑️</button>
      </div>
      <div class="batch-item-fields">
        <input type="text" class="full-width" placeholder="Personne" value="${escapeHtml(item.personne)}" oninput="updateChargeBatchField(${idx}, 'personne', this.value)">
        <select onchange="updateChargeBatchField(${idx}, 'departement', this.value)">
          <option value="">-- Departement --</option>
          ${deptOptions}
        </select>
        <input type="date" value="${item.date}" oninput="updateChargeBatchField(${idx}, 'date', this.value)">
        <input type="number" placeholder="Montant" value="${item.montant}" oninput="updateChargeBatchField(${idx}, 'montant', this.value)">
        <input type="text" class="full-width" placeholder="Description" value="${escapeHtml(item.description)}" oninput="updateChargeBatchField(${idx}, 'description', this.value)">
      </div>
    `;
    container.appendChild(div);
  });
}

function updateChargeBatchField(idx, field, value) {
  chargeBatchResults[idx][field] = value;
}

function removeChargeBatchItem(idx) {
  chargeBatchResults.splice(idx, 1);
  renderChargeBatchList();
  document.getElementById('chargeBatchStatusText').textContent = chargeBatchResults.length + " recu(s) a enregistrer.";
}

async function saveChargeBatchResults() {
  let savedCount = 0;
  for (const item of chargeBatchResults) {
    if (!item.personne || !item.personne.trim()) continue;
    chargeState.records.unshift({
      id: "CHG-" + Date.now().toString().slice(-6) + "-" + savedCount,
      personne: item.personne.trim(),
      departement: item.departement || '',
      date: item.date || new Date().toISOString().split('T')[0],
      description: (item.description || '').trim(),
      montant: parseFloat(item.montant) || 0,
      rembourse: 'NO',
      image: null
    });
    savedCount++;
  }
  await saveChargeRecords();
  closeChargeBatchModal();
  showToast("🎉 " + savedCount + " recu(s) enregistre(s) !", "success");
}

function closeChargeBatchModal() {
  document.getElementById('chargeBatchReviewModal').classList.remove('active');
  chargeBatchResults = [];
}

// Init evenements batch Autoroute + Charges
document.addEventListener('DOMContentLoaded', () => {
  const btnImportTollSheet = document.getElementById('btnImportSheetToll');
  if (btnImportTollSheet) {
    btnImportTollSheet.addEventListener('click', () => {
      document.getElementById('fileInputSheetToll').click();
    });
  }
  const fileInputSheetToll = document.getElementById('fileInputSheetToll');
  if (fileInputSheetToll) {
    fileInputSheetToll.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => runTollBatchExtraction(ev.target.result);
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
  const btnCloseTollBatch = document.getElementById('btnCloseTollBatchModal');
  if (btnCloseTollBatch) btnCloseTollBatch.addEventListener('click', closeTollBatchModal);
  const btnCancelTollBatch = document.getElementById('btnCancelTollBatch');
  if (btnCancelTollBatch) btnCancelTollBatch.addEventListener('click', closeTollBatchModal);
  const btnSaveTollBatch = document.getElementById('btnSaveTollBatch');
  if (btnSaveTollBatch) btnSaveTollBatch.addEventListener('click', saveTollBatchResults);

  const btnImportChargeSheet = document.getElementById('btnImportSheetCharge');
  if (btnImportChargeSheet) {
    btnImportChargeSheet.addEventListener('click', () => {
      document.getElementById('fileInputSheetCharge').click();
    });
  }
  const fileInputSheetCharge = document.getElementById('fileInputSheetCharge');
  if (fileInputSheetCharge) {
    fileInputSheetCharge.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => runChargeBatchExtraction(ev.target.result);
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
  const btnCloseChargeBatch = document.getElementById('btnCloseChargeBatchModal');
  if (btnCloseChargeBatch) btnCloseChargeBatch.addEventListener('click', closeChargeBatchModal);
  const btnCancelChargeBatch = document.getElementById('btnCancelChargeBatch');
  if (btnCancelChargeBatch) btnCancelChargeBatch.addEventListener('click', closeChargeBatchModal);
  const btnSaveChargeBatch = document.getElementById('btnSaveChargeBatch');
  if (btnSaveChargeBatch) btnSaveChargeBatch.addEventListener('click', saveChargeBatchResults);
});

// ==================== BOUTON FLOTTANT : AJOUT MANUEL CONTEXTUEL ====================
function openManualAddForActiveTab() {
  const activeTab = document.querySelector('.tab-btn.active');
  const tabName = activeTab ? activeTab.dataset.tab : 'gasoil';

  if (tabName === 'gasoil') {
    openEditModalWithData({ id: "BON-" + Date.now().toString().slice(-6) });
  } else if (tabName === 'autoroute') {
    openEditTollModalWithData({ id: "TOLL-" + Date.now().toString().slice(-6), rembourse: 'NO' });
  } else if (tabName === 'charges') {
    openEditChargeModalWithData({ id: "CHG-" + Date.now().toString().slice(-6), rembourse: 'NO' });
  } else {
    showToast("Passez sur un onglet Gasoil, Autoroute ou Charges pour ajouter une entree.", "info");
  }
}
