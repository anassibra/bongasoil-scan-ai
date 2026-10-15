async function apiGetRecords(type) {
  if (!window.currentProject) return [];
  const res = await fetch(`/api/records?projectId=${window.currentProject.id}&type=${type}`);
  if (!res.ok) return [];
  const rows = await res.json();
  return rows.map(r => ({
    id: String(r.id),
    ...r.data,
    createdByUsername: r.created_by_username,
    updatedByUsername: r.updated_by_username,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

async function apiCreateRecord(type, data) {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: window.currentProject.id, type, data })
  });
  if (!res.ok) throw new Error('Echec creation');
  return res.json();
}

async function apiUpdateRecord(id, data) {
  const res = await fetch(`/api/records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  if (!res.ok) throw new Error('Echec modification');
  return res.json();
}

async function apiDeleteRecord(id) {
  const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
  return res.ok;
}


function compressImageDataUrl(dataUrl, maxSize = 1280, quality = 0.7) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
