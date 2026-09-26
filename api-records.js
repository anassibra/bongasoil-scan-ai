async function apiGetRecords(type) {
  if (!window.currentProject) return [];
  const res = await fetch(`/api/records?projectId=${window.currentProject.id}&type=${type}`);
  if (!res.ok) return [];
  const rows = await res.json();
  return rows.map(r => ({
    id: r.id,
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
