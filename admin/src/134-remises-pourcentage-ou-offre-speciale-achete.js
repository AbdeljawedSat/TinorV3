  // ============================================================================
  // REMISES — pourcentage ou offre spéciale (achetés/offerts).
  // ============================================================================
  function renderRemises() {
    const body = document.getElementById('remisesBody');
    if (!REF_DATA.remises.length) { body.innerHTML = `<tr><td colspan="5" class="rowMeta" style="text-align:center; padding:22px;">Aucune remise — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = REF_DATA.remises.map(r => `
      <tr>
        <td>${esc(r.nom)}${r.protege ? ' <span class="pill grey">protégée</span>' : ''}</td>
        <td class="rowMeta">${r.type === 'pourcentage' ? 'Pourcentage' : 'Offre spéciale'}</td>
        <td class="rowMeta">${r.type === 'pourcentage' ? `−${r.pourcentage}%` : `${r.achete} achetées + ${r.gratuit} offerte${r.gratuit > 1 ? 's' : ''}`}</td>
        <td class="rowMeta">${r.categorie}</td>
        <td class="rowActions">
          ${r.protege || !isGerant() ? '' : `
            <button class="rowActionBtn" onclick="openRemiseModal(${r.id})">Modifier</button>
            <button class="rowActionBtn danger" onclick="askDelete('remises', ${r.id}, '${attrJs(r.nom)}', renderRemisesAfterDelete)">Supprimer</button>`}
        </td>
      </tr>`).join('');
  }
  async function renderRemisesAfterDelete() { REF_DATA.remises = await apiFetch('/remises'); renderRemises(); }

  function toggleRemiseTypeFields() {
    const isLot = document.getElementById('remiseType').value === 'lot';
    document.getElementById('remisePourcentageFields').style.display = isLot ? 'none' : 'block';
    document.getElementById('remiseLotFields').style.display = isLot ? 'block' : 'none';
  }
  document.getElementById('remiseType').addEventListener('change', toggleRemiseTypeFields);

  function openRemiseModal(id) {
    document.getElementById('remiseFormError').style.display = 'none';
    const r = id ? REF_DATA.remises.find(x => x.id === id) : null;
    document.getElementById('remiseModalTitle').textContent = r ? `Modifier — ${r.nom}` : 'Nouvelle remise';
    document.getElementById('remiseId').value = r ? r.id : '';
    document.getElementById('remiseNom').value = r ? r.nom : '';
    document.getElementById('remiseType').value = r ? r.type : 'pourcentage';
    document.getElementById('remisePourcentage').value = r && r.pourcentage ? r.pourcentage : '';
    document.getElementById('remiseAchete').value = r && r.achete ? r.achete : '';
    document.getElementById('remiseGratuit').value = r && r.gratuit ? r.gratuit : '';
    document.getElementById('remiseCategorie').value = r ? r.categorie : 'client';
    toggleRemiseTypeFields();
    document.getElementById('remiseModalOverlay').classList.add('open');
  }
  function closeRemiseModal() { document.getElementById('remiseModalOverlay').classList.remove('open'); }

  async function saveRemise() {
    const id = document.getElementById('remiseId').value;
    const errEl = document.getElementById('remiseFormError');
    errEl.style.display = 'none';
    const type = document.getElementById('remiseType').value;
    const payload = {
      nom: document.getElementById('remiseNom').value.trim(),
      type,
      pourcentage: type === 'pourcentage' ? Number(document.getElementById('remisePourcentage').value) || 0 : 0,
      achete: type === 'lot' ? Number(document.getElementById('remiseAchete').value) || null : null,
      gratuit: type === 'lot' ? Number(document.getElementById('remiseGratuit').value) || null : null,
      categorie: document.getElementById('remiseCategorie').value,
    };
    if (!payload.nom) { errEl.textContent = 'Le nom est requis.'; errEl.style.display = 'block'; return; }
    if (type === 'lot' && (!payload.achete || !payload.gratuit)) {
      errEl.textContent = 'Unités achetées et offertes sont requises pour une offre spéciale.'; errEl.style.display = 'block'; return;
    }
    try {
      if (id) await apiFetch(`/remises/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/remises', { method: 'POST', body: JSON.stringify(payload) });
      closeRemiseModal();
      REF_DATA.remises = await apiFetch('/remises');
      renderRemises();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('remiseSaveBtn').addEventListener('click', saveRemise);
  document.getElementById('remiseCancelBtn').addEventListener('click', closeRemiseModal);
  document.getElementById('remiseModalCloseBtn').addEventListener('click', closeRemiseModal);

