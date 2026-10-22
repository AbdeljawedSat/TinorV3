  // ---------- Client ----------
  function openClientModal(id) {
    document.getElementById('clientFormError').style.display = 'none';
    const c = id ? APP_DATA.clients.find(x => x.id === id) : null;
    document.getElementById('clientModalTitle').textContent = c ? `Modifier — ${c.nom}` : 'Nouveau client';
    document.getElementById('clientId').value = c ? c.id : '';
    document.getElementById('clientNom').value = c ? c.nom : '';
    document.getElementById('clientTel').value = c && c.tel ? c.tel : '';
    document.getElementById('clientVille').value = c && c.ville ? c.ville : '';
    document.getElementById('clientEmail').value = c && c.email ? c.email : '';
    document.getElementById('clientMatriculeFiscal').value = c && c.matricule_fiscal ? c.matricule_fiscal : '';
    document.getElementById('clientType').value = c ? c.type : 'particulier';
    populateSelect(document.getElementById('clientRemise'), REF_DATA.remises, 'id', 'nom', '— Aucune —');
    document.getElementById('clientRemise').value = c && c.remise_id ? c.remise_id : '';
    document.getElementById('clientNotes').value = c && c.notes ? c.notes : '';
    document.getElementById('clientModalOverlay').classList.add('open');
  }
  function closeClientModal() { document.getElementById('clientModalOverlay').classList.remove('open'); }

  async function saveClient() {
    const id = document.getElementById('clientId').value;
    const errEl = document.getElementById('clientFormError');
    errEl.style.display = 'none';
    const payload = {
      nom: document.getElementById('clientNom').value.trim(),
      tel: document.getElementById('clientTel').value.trim() || null,
      ville: document.getElementById('clientVille').value.trim() || null,
      email: document.getElementById('clientEmail').value.trim() || null,
      matricule_fiscal: document.getElementById('clientMatriculeFiscal').value.trim() || null,
      type: document.getElementById('clientType').value,
      remise_id: document.getElementById('clientRemise').value ? Number(document.getElementById('clientRemise').value) : null,
      notes: document.getElementById('clientNotes').value.trim() || null,
    };
    if (!payload.nom) { errEl.textContent = 'Le nom est requis.'; errEl.style.display = 'block'; return; }
    try {
      if (id) await apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/clients', { method: 'POST', body: JSON.stringify(payload) });
      closeClientModal();
      APP_DATA.clients = await apiFetch('/clients');
      renderClients();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }

