  // ---------- Suppression générique ----------
  let PENDING_DELETE = null;
  function askDelete(resource, id, label, onSuccess) {
    PENDING_DELETE = { resource, id, onSuccess };
    document.getElementById('confirmDeleteText').textContent = `Supprimer «${label}» ? Cette action est définitive.`;
    document.getElementById('confirmDeleteOverlay').classList.add('open');
  }
  document.getElementById('confirmDeleteCancelBtn').addEventListener('click', () => {
    document.getElementById('confirmDeleteOverlay').classList.remove('open');
    PENDING_DELETE = null;
  });
  document.getElementById('confirmDeleteOkBtn').addEventListener('click', async () => {
    if (!PENDING_DELETE) return;
    const { resource, id, onSuccess } = PENDING_DELETE;
    try {
      await apiFetch(`/${resource}/${id}`, { method: 'DELETE' });
      document.getElementById('confirmDeleteOverlay').classList.remove('open');
      APP_DATA[resource] = await apiFetch(`/${resource}`);
      if (onSuccess) onSuccess();
    } catch (err) {
      notifier(err.message, 'erreur');
    }
    PENDING_DELETE = null;
  });

