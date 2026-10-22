  // ============================================================================
  // LOCAUX & ZONES
  // ============================================================================
  const TYPE_LOCAL_LABEL = { MP:'Matière première', EMBALLAGE:'Emballage', PRODUCTION:'Production', PRODUITS_FINIS:'Produits finis', QUARANTAINE:'Quarantaine', CONSOMMABLE:'Consommable', BOUTIQUE:'Boutique', AUTRE:'Autre' };

  function renderLocaux() {
    const body = document.getElementById('locauxBody');
    if (!APP_DATA.locaux.length) { body.innerHTML = `<tr><td colspan="5" class="rowMeta" style="text-align:center; padding:22px;">Aucun local — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = APP_DATA.locaux.map(l => `
      <tr>
        <td class="lotCode">${esc(l.code)}</td>
        <td>${esc(l.nom)}</td>
        <td class="rowMeta">${TYPE_LOCAL_LABEL[l.type_local] || l.type_local}</td>
        <td class="rowMeta">${l.nb_zones} zone${l.nb_zones > 1 ? 's' : ''} — <a href="#" class="link" onclick="openZonesModal(${l.id}); return false;">gérer</a></td>
        <td class="rowActions">
          <button class="rowActionBtn" onclick="openLocalModal(${l.id})">Modifier</button>
        </td>
      </tr>`).join('');
  }

  function openLocalModal(id) {
    document.getElementById('localFormError').style.display = 'none';
    const l = id ? APP_DATA.locaux.find(x => x.id === id) : null;
    document.getElementById('localModalTitle').textContent = l ? `Modifier — ${l.nom}` : 'Nouveau local';
    document.getElementById('localId').value = l ? l.id : '';
    document.getElementById('localCode').value = l ? l.code : '';
    document.getElementById('localNom').value = l ? l.nom : '';
    document.getElementById('localType').value = l ? l.type_local : 'AUTRE';
    document.getElementById('localAdresse').value = l && l.adresse ? l.adresse : '';
    document.getElementById('localModalOverlay').classList.add('open');
  }
  function closeLocalModal() { document.getElementById('localModalOverlay').classList.remove('open'); }

  async function saveLocal() {
    const id = document.getElementById('localId').value;
    const errEl = document.getElementById('localFormError');
    errEl.style.display = 'none';
    const payload = {
      code: document.getElementById('localCode').value.trim(),
      nom: document.getElementById('localNom').value.trim(),
      type_local: document.getElementById('localType').value,
      adresse: document.getElementById('localAdresse').value.trim() || null,
    };
    if (!payload.code || !payload.nom) { errEl.textContent = 'Code et nom sont requis.'; errEl.style.display = 'block'; return; }
    try {
      if (id) await apiFetch(`/locaux/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/locaux', { method: 'POST', body: JSON.stringify(payload) });
      closeLocalModal();
      APP_DATA.locaux = await apiFetch('/locaux');
      renderLocaux();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }

