  // ============================================================================
  // EMPLOYÉS
  // ============================================================================
  function renderEmployes() {
    const body = document.getElementById('employesBody');
    if (!APP_DATA.employes.length) { body.innerHTML = `<tr><td colspan="6" class="rowMeta" style="text-align:center; padding:22px;">Aucun employé — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = APP_DATA.employes.map(e => `
      <tr>
        <td class="lotCode">${e.matricule}</td>
        <td>${esc(e.nom)} ${e.prenom || ''}</td>
        <td class="rowMeta">${esc(e.fonction || '—')}</td>
        <td class="rowMeta">${esc(e.telephone || '—')}</td>
        <td>${e.actif ? '<span class="pill good">Actif</span>' : '<span class="pill grey">Inactif</span>'}</td>
        <td class="rowActions">
          <button class="rowActionBtn" onclick="openEmployeModal(${e.id})">Modifier</button>
        </td>
      </tr>`).join('');
  }

  function openEmployeModal(id) {
    document.getElementById('employeFormError').style.display = 'none';
    const e = id ? APP_DATA.employes.find(x => x.id === id) : null;
    document.getElementById('employeModalTitle').textContent = e ? `Modifier — ${e.nom}` : 'Nouvel employé';
    document.getElementById('employeId').value = e ? e.id : '';
    document.getElementById('employeMatricule').value = e ? e.matricule : '';
    document.getElementById('employeNom').value = e ? e.nom : '';
    document.getElementById('employePrenom').value = e ? e.prenom : '';
    document.getElementById('employeFonction').value = e && e.fonction ? e.fonction : '';
    document.getElementById('employeTelephone').value = e && e.telephone ? e.telephone : '';
    document.getElementById('employeActif').checked = e ? !!e.actif : true;
    document.getElementById('employeModalOverlay').classList.add('open');
  }
  function closeEmployeModal() { document.getElementById('employeModalOverlay').classList.remove('open'); }

  async function saveEmploye() {
    const id = document.getElementById('employeId').value;
    const errEl = document.getElementById('employeFormError');
    errEl.style.display = 'none';
    const payload = {
      matricule: document.getElementById('employeMatricule').value.trim(),
      nom: document.getElementById('employeNom').value.trim(),
      prenom: document.getElementById('employePrenom').value.trim(),
      fonction: document.getElementById('employeFonction').value.trim() || null,
      telephone: document.getElementById('employeTelephone').value.trim() || null,
      actif: document.getElementById('employeActif').checked,
    };
    if (!payload.matricule || !payload.nom || !payload.prenom) {
      errEl.textContent = 'Matricule, nom et prénom sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      if (id) await apiFetch(`/employes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/employes', { method: 'POST', body: JSON.stringify(payload) });
      closeEmployeModal();
      APP_DATA.employes = await apiFetch('/employes');
      renderEmployes();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }

  document.getElementById('localSaveBtn').addEventListener('click', saveLocal);
  document.getElementById('localCancelBtn').addEventListener('click', closeLocalModal);
  document.getElementById('localModalCloseBtn').addEventListener('click', closeLocalModal);
  document.getElementById('employeSaveBtn').addEventListener('click', saveEmploye);
  document.getElementById('employeCancelBtn').addEventListener('click', closeEmployeModal);
  document.getElementById('employeModalCloseBtn').addEventListener('click', closeEmployeModal);

