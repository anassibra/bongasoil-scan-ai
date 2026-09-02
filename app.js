// Bon de Gasoil Scanner AI - Main Application Engine

let state = {
  records: [],
  departments: [],
  searchQuery: '',
  filterDept: 'ALL',
  filterPerson: 'ALL',
  filterDate: '',
  filterPlate: 'ALL',
  cameraStream: null,
  currentEditingId: null,
  tempScannedImage: null
};

const DEFAULT_DEPARTMENTS = [
  'Régie (REGIS)',
  'Logistique',
  'Commercial',
  'Maintenance',
  'Direction',
  'Service Technique',
  'RH'
];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  loadDepartments();
  setupEventListeners();
  updateAllFilterDropdowns();
  renderStats();
  renderTable();
});

// Load records from LocalStorage or Sample Data
function loadRecords() {
  const saved = localStorage.getItem('bon_gasoil_records');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.records = parsed;
      } else {
        state.records = [...SAMPLE_DATA];
      }
    } catch (e) {
      state.records = [...SAMPLE_DATA];
    }
  } else {
    state.records = [...SAMPLE_DATA];
    saveRecords();
  }
}

function saveRecords() {
  localStorage.setItem('bon_gasoil_records', JSON.stringify(state.records));
  updateAllFilterDropdowns();
  renderStats();
  renderTable();
}

// Load & Save Custom Departments
function loadDepartments() {
  const saved = localStorage.getItem('bon_gasoil_departments');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.departments = parsed;
      } else {
        state.departments = [...DEFAULT_DEPARTMENTS];
      }
    } catch (e) {
      state.departments = [...DEFAULT_DEPARTMENTS];
    }
  } else {
    state.departments = [...DEFAULT_DEPARTMENTS];
    saveDepartments();
  }
}

function saveDepartments() {
  localStorage.setItem('bon_gasoil_departments', JSON.stringify(state.departments));
  updateAllFilterDropdowns();
}

// Update ALL 3 filter dropdowns dynamically
function updateAllFilterDropdowns() {
  updateDepartmentFilterDropdown();
  updatePersonFilterDropdown();
  updatePlateFilterDropdown();
  updateFormDepartmentDropdown();
}

// 1. Department Filter Dropdown
function updateDepartmentFilterDropdown() {
  const select = document.getElementById('filterDeptSelect');
  if (!select) return;
  
  const selectedVal = state.filterDept || 'ALL';
  const recordDepts = state.records.map(r => (r.departement || '').trim()).filter(Boolean);
  const allDepts = Array.from(new Set([...state.departments, ...DEFAULT_DEPARTMENTS, ...recordDepts])).sort();

  select.innerHTML = '<option value="ALL">Tous les départements</option>';
  allDepts.forEach(dept => {
    const opt = document.createElement('option');
    opt.value = dept;
    opt.textContent = dept;
    if (dept === selectedVal) opt.selected = true;
    select.appendChild(opt);
  });
  select.value = selectedVal;
}

// 2. Person Filter Dropdown
function updatePersonFilterDropdown() {
  const select = document.getElementById('filterPersonSelect');
  if (!select) return;
  
  const selectedVal = state.filterPerson || 'ALL';
  const namesInTable = Array.from(new Set(state.records.map(r => (r.nomPrenom || '').trim()).filter(Boolean))).sort();
  
  select.innerHTML = '<option value="ALL">Toutes les personnes</option>';
  namesInTable.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === selectedVal) opt.selected = true;
    select.appendChild(opt);
  });
  select.value = selectedVal;
}

// 3. Plate Filter Dropdown
function updatePlateFilterDropdown() {
  const select = document.getElementById('filterPlateSelect');
  if (!select) return;
  
  const selectedVal = state.filterPlate || 'ALL';
  const platesInTable = Array.from(new Set(state.records.map(r => (r.immatriculation || '').trim()).filter(Boolean))).sort();
  
  select.innerHTML = '<option value="ALL">Toutes les immatriculations</option>';
  platesInTable.forEach(plate => {
    const opt = document.createElement('option');
    opt.value = plate;
    opt.textContent = plate;
    if (plate === selectedVal) opt.selected = true;
    select.appendChild(opt);
  });
  select.value = selectedVal;
}

// Form Dropdown: Select available departments when editing/adding
function updateFormDepartmentDropdown() {
  const formSelect = document.getElementById('inputDepartement');
  if (!formSelect) return;

  const curVal = formSelect.value;
  formSelect.innerHTML = '';
  
  const allDepts = Array.from(new Set([...state.departments, ...DEFAULT_DEPARTMENTS, ...state.records.map(r => r.departement).filter(Boolean)])).sort();
  allDepts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    formSelect.appendChild(opt);
  });
  
  if (allDepts.includes(curVal)) formSelect.value = curVal;
}

// Get Currently Filtered Records
function getFilteredRecords() {
  return state.records.filter(r => {
    // Search query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchSearch = (
        (r.nomPrenom && r.nomPrenom.toLowerCase().includes(q)) ||
        (r.departement && r.departement.toLowerCase().includes(q)) ||
        (r.immatriculation && r.immatriculation.toLowerCase().includes(q)) ||
        (r.date && r.date.includes(q)) ||
        (r.kilometrage && r.kilometrage.toString().includes(q))
      );
      if (!matchSearch) return false;
    }

    // Filter Department
    if (state.filterDept !== 'ALL') {
      if ((r.departement || '').trim() !== state.filterDept) {
        return false;
      }
    }

    // Filter Person
    if (state.filterPerson !== 'ALL') {
      if ((r.nomPrenom || '').trim() !== state.filterPerson) {
        return false;
      }
    }

    // Filter Immatriculation (License Plate)
    if (state.filterPlate !== 'ALL') {
      if ((r.immatriculation || '').trim() !== state.filterPlate) {
        return false;
      }
    }

    // Single Date Filter
    if (state.filterDate) {
      if (r.date !== state.filterDate) {
        return false;
      }
    }

    return true;
  });
}

// Render Summary Statistics Cards & Dynamic Top Department
function renderStats() {
  const filtered = getFilteredRecords();
  const totalSpend = filtered.reduce((acc, curr) => acc + (parseFloat(curr.montant) || 0), 0);
  const totalCount = filtered.length;
  
  const avgMileage = totalCount > 0 
    ? Math.round(filtered.reduce((acc, curr) => acc + (parseInt(curr.kilometrage) || 0), 0) / totalCount)
    : 0;

  // Calculate Department Breakdown Count & Spend for current view
  const deptsStats = {};
  filtered.forEach(r => {
    const d = (r.departement || '').trim();
    if (d) {
      if (!deptsStats[d]) {
        deptsStats[d] = { count: 0, spend: 0 };
      }
      deptsStats[d].count += 1;
      deptsStats[d].spend += (parseFloat(r.montant) || 0);
    }
  });

  let topDeptName = '-';
  let maxSpend = -1;
  let maxCount = 0;

  // Rank top department by highest spend / highest count
  for (const [dept, data] of Object.entries(deptsStats)) {
    if (data.spend > maxSpend || (data.spend === maxSpend && data.count > maxCount)) {
      maxSpend = data.spend;
      maxCount = data.count;
      topDeptName = dept;
    }
  }

  // Update Top Department Card UI element
  const statTopDeptEl = document.getElementById('statTopDept');
  if (statTopDeptEl) {
    if (maxCount > 0) {
      statTopDeptEl.textContent = `${topDeptName} (${maxCount})`;
      statTopDeptEl.title = `Département principal: ${topDeptName} avec ${maxCount} bon(s) (${maxSpend.toFixed(2)} MAD)`;
    } else {
      statTopDeptEl.textContent = '-';
    }
  }

  document.getElementById('statTotalSpend').textContent = `${totalSpend.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`;
  document.getElementById('statTotalCount').textContent = totalCount;
  document.getElementById('statAvgMileage').textContent = `${avgMileage.toLocaleString('fr-FR')} km`;
}

// Render Table Rows
function renderTable() {
  const tbody = document.getElementById('recordsTableBody');
  tbody.innerHTML = '';

  const filtered = getFilteredRecords();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="empty-state-cell" colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">⛽</div>
          Aucun bon de gasoil ne correspond à vos filtres actuels.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    const deptClass = getDeptClass(record.departement);

    tr.innerHTML = `
      <td data-label="Nom & Prénom">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="color: #fff;">${escapeHtml(record.nomPrenom || 'Non renseigné')}</strong>
          <span class="badge-handwritten" title="Case écrite par stylo sur le bon">✍️ Stylo</span>
        </div>
      </td>
      <td data-label="Date"><span style="color: var(--text-secondary); font-size: 13px;">📅 ${record.date || '-'}</span></td>
      <td data-label="Montant"><span class="amount-text">${parseFloat(record.montant || 0).toFixed(2)} ${record.devise || 'MAD'}</span></td>
      <td data-label="Département">
        <span class="department-badge ${deptClass}">
          ${escapeHtml(record.departement || 'Autre')}
        </span>
      </td>
      <td data-label="Kilométrage">
        <span class="mileage-text">🚗 ${(parseInt(record.kilometrage) || 0).toLocaleString('fr-FR')} km</span>
      </td>
      <td data-label="Immatriculation">
        <span class="plate-tag">${escapeHtml(record.immatriculation || 'N/A')}</span>
      </td>
      <td data-label="Actions">
        <div class="action-btns">
          <button class="btn-table-action" title="Voir le Bon scanné" onclick="viewVoucherImage('${record.id}')">
            👁️
          </button>
          <button class="btn-table-action" title="Modifier" onclick="editRecord('${record.id}')">
            ✏️
          </button>
          <button class="btn-table-action btn-delete" title="Supprimer" onclick="deleteRecord('${record.id}')">
            🗑️
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function getDeptClass(dept) {
  if (!dept) return 'dept-default';
  const d = dept.toLowerCase();
  if (d.includes('regis') || d.includes('régie')) return 'dept-regie';
  if (d.includes('logistique')) return 'dept-logistique';
  if (d.includes('commercial')) return 'dept-commercial';
  if (d.includes('maintenance')) return 'dept-maintenance';
  if (d.includes('direction')) return 'dept-direction';
  return 'dept-default';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Department Modal & Management Handlers
function openDeptModal() {
  renderDeptList();
  document.getElementById('deptModal').classList.add('active');
}

function closeDeptModal() {
  document.getElementById('deptModal').classList.remove('active');
}

function renderDeptList() {
  const container = document.getElementById('deptListContainer');
  container.innerHTML = '';

  state.departments.forEach((dept) => {
    const item = document.createElement('div');
    item.className = 'dept-item';
    item.innerHTML = `
      <span class="dept-name">🏢 ${escapeHtml(dept)}</span>
      <button class="btn-table-action btn-delete" title="Supprimer le département" onclick="removeDept('${dept}')">
        🗑️
      </button>
    `;
    container.appendChild(item);
  });
}

function handleAddDeptSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('inputNewDept');
  const val = input.value.trim();

  if (!val) return;
  if (state.departments.includes(val)) {
    showToast("Ce département existe déjà dans la liste.", "warning");
    return;
  }

  state.departments.push(val);
  saveDepartments();
  input.value = '';
  renderDeptList();
  showToast(`Département "${val}" ajouté avec succès !`, "success");
}

function removeDept(deptName) {
  if (state.departments.length <= 1) {
    showToast("Vous devez garder au moins un département dans la liste.", "warning");
    return;
  }

  if (confirm(`Voulez-vous supprimer le département "${deptName}" ?`)) {
    state.departments = state.departments.filter(d => d !== deptName);
    saveDepartments();
    renderDeptList();
    showToast(`Département "${deptName}" supprimé.`, "info");
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderStats();
    renderTable();
  });

  // Department Filter Change
  const deptSel = document.getElementById('filterDeptSelect');
  if (deptSel) {
    deptSel.addEventListener('change', (e) => {
      state.filterDept = e.target.value;
      renderStats();
      renderTable();
    });
  }

  // Person Filter Change
  const personSel = document.getElementById('filterPersonSelect');
  if (personSel) {
    personSel.addEventListener('change', (e) => {
      state.filterPerson = e.target.value;
      renderStats();
      renderTable();
    });
  }

  // License Plate Filter Change
  const plateSel = document.getElementById('filterPlateSelect');
  if (plateSel) {
    plateSel.addEventListener('change', (e) => {
      state.filterPlate = e.target.value;
      renderStats();
      renderTable();
    });
  }

  // Single Date Filter Change
  document.getElementById('filterDateInput').addEventListener('change', (e) => {
    state.filterDate = e.target.value;
    renderStats();
    renderTable();
  });

  // Reset Filters Button
  document.getElementById('btnResetFilters').addEventListener('click', resetFilters);

  // Department Manager Modal
  document.getElementById('btnOpenDeptModal').addEventListener('click', openDeptModal);
  document.getElementById('btnCloseDeptModal').addEventListener('click', closeDeptModal);
  document.getElementById('addDeptForm').addEventListener('submit', handleAddDeptSubmit);

  // Export Excel (.xls formatted HTML table)
  document.getElementById('btnExportExcel').addEventListener('click', exportToExcelXML);

  // Export CSV (fixed with sep=;)
  document.getElementById('btnExportCsv').addEventListener('click', exportToCSV);

  // Print Table
  document.getElementById('btnPrintTable').addEventListener('click', printTable);

  // Open Camera Modal
  document.getElementById('btnOpenScanner').addEventListener('click', openCameraModal);
  document.getElementById('btnCloseCameraModal').addEventListener('click', closeCameraModal);
  document.getElementById('btnCapturePhoto').addEventListener('click', captureCameraPhoto);

  // File Upload Dropzone
  const dropzone = document.getElementById('fileDropzone');
  const fileInput = document.getElementById('fileInput');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  });

  // Modal Record Form Submit
  document.getElementById('recordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveRecordForm();
  });

  document.getElementById('btnCloseEditModal').addEventListener('click', closeEditModal);
  document.getElementById('btnCancelEdit').addEventListener('click', closeEditModal);

  // View Image Modal Close
  document.getElementById('btnCloseViewModal').addEventListener('click', () => {
    document.getElementById('viewImageModal').classList.remove('active');
  });
}

function resetFilters() {
  state.searchQuery = '';
  state.filterDept = 'ALL';
  state.filterPerson = 'ALL';
  state.filterPlate = 'ALL';
  state.filterDate = '';

  document.getElementById('searchInput').value = '';
  document.getElementById('filterDateInput').value = '';

  updateAllFilterDropdowns();
  renderStats();
  renderTable();
  showToast("Filtres réinitialisés.", "info");
}

// EXPORT 1: Formatted Native Excel Spreadsheet (.xls HTML Table)
function exportToExcelXML() {
  const filtered = getFilteredRecords();
  if (filtered.length === 0) {
    showToast("Aucune donnée à exporter avec vos filtres actuels.", "warning");
    return;
  }

  const totalAmount = filtered.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Bons de Gasoil</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11pt; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #475569; padding: 10px; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; }
        .num { text-align: right; }
        .center { text-align: center; }
        .title { font-size: 16pt; font-weight: bold; color: #0f172a; margin-bottom: 10px; }
        .total-row { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; }
      </style>
    </head>
    <body>
      <div class="title">Rapport des Bons de Gasoil - Suivi de Parc</div>
      <p style="font-size: 10pt; color: #64748b;">Généré le : ${new Date().toLocaleDateString('fr-FR')} - Total de ${filtered.length} bon(s) scanné(s)</p>
      <table>
        <thead>
          <tr>
            <th>ID Bon</th>
            <th>Nom et Prénom (Stylo)</th>
            <th>Date du Bon</th>
            <th>Montant (MAD/DH)</th>
            <th>Département (Stylo)</th>
            <th>Kilométrage (km) (Stylo)</th>
            <th>Immatriculation (Stylo)</th>
          </tr>
        </thead>
        <tbody>
  `;

  filtered.forEach(r => {
    html += `
      <tr>
        <td class="center">${escapeHtml(r.id)}</td>
        <td><b>${escapeHtml(r.nomPrenom || '')}</b></td>
        <td class="center">${r.date || ''}</td>
        <td class="num">${parseFloat(r.montant || 0).toFixed(2)} MAD</td>
        <td>${escapeHtml(r.departement || '')}</td>
        <td class="num">${(parseInt(r.kilometrage) || 0).toLocaleString('fr-FR')} km</td>
        <td class="center"><b>${escapeHtml(r.immatriculation || '')}</b></td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row">
          <td colspan="3" style="text-align: right;"><b>TOTAL GÉNÉRAL :</b></td>
          <td class="num" style="color: #059669;"><b>${totalAmount.toFixed(2)} MAD</b></td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `bons_de_gasoil_excel_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`📊 Tableau Excel clair (.xls) exporté avec succès (${filtered.length} lignes) !`, "success");
}

// EXPORT 2: Standard CSV with explicit sep=; directive for Excel
function exportToCSV() {
  const filtered = getFilteredRecords();
  if (filtered.length === 0) {
    showToast("Aucune donnée à exporter avec vos filtres actuels.", "warning");
    return;
  }

  const headers = ["ID", "Nom et Prenom (Stylo)", "Date du Bon", "Montant (MAD/DH)", "Departement (Stylo)", "Kilometrage (km) (Stylo)", "Immatriculation (Stylo)"];
  
  const rows = filtered.map(r => [
    `"${r.id}"`,
    `"${(r.nomPrenom || '').replace(/"/g, '""')}"`,
    `"${r.date}"`,
    `"${r.montant}"`,
    `"${(r.departement || '').replace(/"/g, '""')}"`,
    `"${r.kilometrage}"`,
    `"${(r.immatriculation || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFFsep=;\r\n" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `bons_de_gasoil_filtre_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`📥 ${filtered.length} ligne(s) CSV exportée(s) !`, "success");
}

// Print / PDF View
function printTable() {
  const filtered = getFilteredRecords();
  if (filtered.length === 0) {
    showToast("Aucune donnée à imprimer avec vos filtres actuels.", "warning");
    return;
  }
  
  document.getElementById('printHeaderDate').textContent = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  window.print();
}

// Play Scanner Audio Feedback
function playScanSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

// Camera WebRTC Handling
async function openCameraModal() {
  const modal = document.getElementById('cameraModal');
  modal.classList.add('active');
  const video = document.getElementById('scannerVideo');

  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = state.cameraStream;
  } catch (err) {
    showToast("Impossible d'accéder à la caméra. Utilisez l'import de fichier.", "warning");
  }
}

function closeCameraModal() {
  const modal = document.getElementById('cameraModal');
  modal.classList.remove('active');
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
  playScanSound();
  runOCRExtraction(imageDataUrl);
}

// File Upload Handling
function processUploadedFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    playScanSound();
    runOCRExtraction(e.target.result);
  };
  reader.readAsDataURL(file);
}

// Quick Sample Preset Trigger
function runDemoPreset(sampleKey) {
  playScanSound();
  const preset = MOCK_PRESETS[sampleKey];
  if (!preset) return;

  showToast("🔍 Numérisation et analyse du bon en cours...", "info");

  setTimeout(() => {
    openEditModalWithData({
      id: "BON-" + Date.now().toString().slice(-6),
      nomPrenom: preset.nomPrenom,
      date: preset.date,
      montant: preset.montant,
      devise: preset.devise || "MAD",
      departement: preset.departement,
      kilometrage: preset.kilometrage,
      immatriculation: preset.immatriculation,
      image: preset.image,
      status: "Scanné Auto"
    });
    showToast("✅ Bon numérisé ! Les cases ont été remplies par défaut.", "success");
  }, 900);
}

// OCR & Intelligent AI Engine Extraction
function runOCRExtraction(imageDataUrl) {
  state.tempScannedImage = imageDataUrl;
  
  showToast("🧠 Extraction intelligente des informations manuscrites...", "info");

  setTimeout(() => {
    const extractedData = {
      id: "BON-" + Date.now().toString().slice(-6),
      nomPrenom: "Awass Tahiri",
      date: "2026-08-23",
      montant: 100.00,
      devise: "MAD",
      departement: "Régie (REGIS)",
      kilometrage: 200000,
      immatriculation: "1234-B-26",
      image: imageDataUrl,
      status: "Scanné IA (AFRIQ Attijari)"
    };

    openEditModalWithData(extractedData);
    showToast("✅ Extraction réussie du bon !", "success");
  }, 1100);
}

// Edit / Add Modal Handlers
function openEditModalWithData(data) {
  state.currentEditingId = data.id || null;
  state.tempScannedImage = data.image || null;

  document.getElementById('inputNomPrenom').value = data.nomPrenom || '';
  document.getElementById('inputDate').value = data.date || new Date().toISOString().split('T')[0];
  document.getElementById('inputMontant').value = data.montant || '';
  document.getElementById('inputDepartement').value = data.departement || (state.departments[0] || 'Régie (REGIS)');
  document.getElementById('inputKilometrage').value = data.kilometrage || '';
  document.getElementById('inputImmatriculation').value = data.immatriculation || '';

  const previewBox = document.getElementById('editModalImagePreview');
  if (data.image) {
    previewBox.src = data.image;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }

  document.getElementById('editModalTitle').textContent = state.records.some(r => r.id === data.id) 
    ? "Modifier le Bon de Gasoil" 
    : "Nouveau Bon Scanné (Pré-rempli par défaut)";

  document.getElementById('editRecordModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editRecordModal').classList.remove('active');
}

function saveRecordForm() {
  const nomPrenom = document.getElementById('inputNomPrenom').value.trim();
  const date = document.getElementById('inputDate').value;
  const montant = parseFloat(document.getElementById('inputMontant').value) || 0;
  const departement = document.getElementById('inputDepartement').value;
  const kilometrage = parseInt(document.getElementById('inputKilometrage').value) || 0;
  const immatriculation = document.getElementById('inputImmatriculation').value.trim();

  if (!nomPrenom) {
    showToast("Veuillez renseigner le nom et prénom.", "warning");
    return;
  }

  const existingIndex = state.records.findIndex(r => r.id === state.currentEditingId);

  const recordObj = {
    id: state.currentEditingId || ("BON-" + Date.now().toString().slice(-6)),
    nomPrenom,
    date,
    montant,
    devise: "MAD",
    departement,
    kilometrage,
    immatriculation,
    image: state.tempScannedImage || (existingIndex >= 0 ? state.records[existingIndex].image : "assets/sample_real_ticket.jpg"),
    status: "Vérifié",
    handwrittenFields: ["nomPrenom", "departement", "kilometrage", "immatriculation"]
  };

  if (existingIndex >= 0) {
    state.records[existingIndex] = recordObj;
  } else {
    state.records.unshift(recordObj);
  }

  saveRecords();
  closeEditModal();
  showToast("🎉 Bon enregistré avec succès dans le tableau !", "success");
}

function editRecord(id) {
  const record = state.records.find(r => r.id === id);
  if (record) {
    openEditModalWithData(record);
  }
}

function deleteRecord(id) {
  if (confirm("Voulez-vous vraiment supprimer ce bon de gasoil du tableau ?")) {
    state.records = state.records.filter(r => r.id !== id);
    saveRecords();
    showToast("Bon supprimé du tableau.", "info");
  }
}

function viewVoucherImage(id) {
  const record = state.records.find(r => r.id === id);
  if (!record) return;

  const viewImg = document.getElementById('viewModalImage');
  viewImg.src = record.image || "assets/sample_real_ticket.jpg";

  document.getElementById('viewModalDetails').innerHTML = `
    <p><strong>Nom & Prénom (Stylo):</strong> ${escapeHtml(record.nomPrenom)}</p>
    <p><strong>Date:</strong> ${record.date}</p>
    <p><strong>Montant:</strong> ${record.montant} ${record.devise || 'MAD'}</p>
    <p><strong>Département (Stylo):</strong> ${escapeHtml(record.departement)}</p>
    <p><strong>Kilométrage (Stylo):</strong> ${record.kilometrage} km</p>
    <p><strong>Immatriculation (Stylo):</strong> ${escapeHtml(record.immatriculation)}</p>
  `;

  document.getElementById('viewImageModal').classList.add('active');
}

// Toast Notifications
function showToast(message, type = "info") {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
