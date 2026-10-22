  // ============================================================================
  // GRILLE DE PRIX — coût de revient + prix par format (huiles).
  // ============================================================================
  const FORMAT_KEYS = ['10ml', '30ml', '100ml', '250ml', '1000ml'];

  function renderGrillePrix() {
    const body = document.getElementById('grillePrixBody');
    if (!APP_DATA.grilles.length) { body.innerHTML = `<tr><td colspan="10" class="rowMeta" style="text-align:center; padding:22px;">Aucune grille — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = APP_DATA.grilles.map(g => `
      <tr>
        <td>${esc(g.produit_nom || '—')}</td>
        <td class="num">${fmtDT(g.matiere)}</td>
        <td class="num">${g.prod}</td>
        <td class="num">${fmtDT(g.coutRevient)}${g.coutOverride ? ' <span class="pill warn">forcé</span>' : ''}</td>
        ${FORMAT_KEYS.map(k => `<td class="num">${fmtDT(g.formats[k].prixDetail)}${g.formats[k].override ? ' <span class="pill warn">•</span>' : ''}</td>`).join('')}
        <td class="rowActions"><button class="rowActionBtn" onclick="openGrilleModal(${g.id})">Détail</button></td>
      </tr>`).join('');
  }

  async function openGrilleModal(id) {
    document.getElementById('grilleFormError').style.display = 'none';
    const nouvelle = !id;
    document.getElementById('grilleId').value = id || '';
    document.getElementById('grilleNouvelleSection').style.display = nouvelle ? 'block' : 'none';
    document.getElementById('grilleExistanteSection').style.display = nouvelle ? 'none' : 'block';
    document.getElementById('grilleSaveBtn').style.display = nouvelle ? 'inline-flex' : 'none';

    if (nouvelle) {
      document.getElementById('grilleModalTitle').textContent = 'Nouvelle grille de prix';
      const dejaGrilles = new Set(APP_DATA.grilles.map(g => g.produit_id));
      populateSelect(document.getElementById('grilleProduit'), APP_DATA.produits.filter(p => !dejaGrilles.has(p.id)), 'id', 'nom');
      document.getElementById('grilleMatiere').value = '';
      document.getElementById('grilleProd').value = '';
      document.getElementById('grilleAmortissement').value = '5';
      document.getElementById('grilleElectricite').value = '0';
    } else {
      const g = await apiFetch(`/grille-huiles/${id}`);
      document.getElementById('grilleModalTitle').textContent = `Grille — ${g.produit_nom}`;
      document.getElementById('grilleCoutRevientAffiche').textContent = fmtDT(g.coutRevient);
      document.getElementById('grilleCoutOverrideBadge').style.display = g.coutOverride ? 'inline' : 'none';
      document.getElementById('grilleCoutOverrideInput').value = g.coutOverride ? g.coutRevient : '';
      document.getElementById('grilleAmortissementEdit').value = g.amortissement;
      document.getElementById('grilleElectriciteEdit').value = g.electricite_par_litre;

      const rowsWrap = document.getElementById('grilleFormatsRows');
      rowsWrap.innerHTML = FORMAT_KEYS.map(k => `
        <div class="structRow" style="grid-template-columns:100px 1fr 32px; align-items:center;">
          <span class="rowMeta">${k}</span>
          <input type="number" step="0.001" class="formInput fmtOverride" data-format="${k}" placeholder="${fmtDT(g.formats[k].prixDetail)}" value="${g.formats[k].override ? g.formats[k].prixDetail : ''}">
          <span></span>
        </div>`).join('');

      const hist = await apiFetch(`/grille-huiles/${id}/historique`);
      document.getElementById('grilleHistoriqueList').innerHTML = hist.map(h =>
        `${fmtDate(h.date_effet)} — matière ${fmtDT(h.cout_matiere)}, rendement ${h.rendement_jour} L/j${h.note ? ' — ' + h.note : ''}`
      ).join('<br>');
      document.getElementById('grilleHistDate').value = new Date().toISOString().slice(0, 10);
      document.getElementById('grilleHistMatiere').value = '';
      document.getElementById('grilleHistProd').value = '';
      document.getElementById('grilleHistNote').value = '';
    }
    document.getElementById('grilleModalOverlay').classList.add('open');
  }
  function closeGrilleModal() { document.getElementById('grilleModalOverlay').classList.remove('open'); }

  async function saveGrille() {
    const errEl = document.getElementById('grilleFormError');
    errEl.style.display = 'none';
    const payload = {
      produit_id: Number(document.getElementById('grilleProduit').value) || null,
      matiere: document.getElementById('grilleMatiere').value ? Number(document.getElementById('grilleMatiere').value) : null,
      prod: document.getElementById('grilleProd').value ? Number(document.getElementById('grilleProd').value) : null,
      amortissement: document.getElementById('grilleAmortissement').value ? Number(document.getElementById('grilleAmortissement').value) : 5,
      electricite_par_litre: document.getElementById('grilleElectricite').value ? Number(document.getElementById('grilleElectricite').value) : 0,
    };
    if (!payload.produit_id || payload.matiere == null || !payload.prod) {
      errEl.textContent = 'Produit, coût matière et rendement sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/grille-huiles', { method: 'POST', body: JSON.stringify(payload) });
      closeGrilleModal();
      APP_DATA.grilles = await apiFetch('/grille-huiles');
      renderGrillePrix();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('grilleSaveBtn').addEventListener('click', saveGrille);
  document.getElementById('grilleCancelBtn').addEventListener('click', closeGrilleModal);
  document.getElementById('grilleModalCloseBtn').addEventListener('click', closeGrilleModal);

  document.getElementById('grilleMajCoutsBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('grilleFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('grilleId').value;
    const payload = {
      amortissement: document.getElementById('grilleAmortissementEdit').value ? Number(document.getElementById('grilleAmortissementEdit').value) : null,
      electricite_par_litre: document.getElementById('grilleElectriciteEdit').value ? Number(document.getElementById('grilleElectriciteEdit').value) : null,
    };
    try {
      await apiFetch(`/grille-huiles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      APP_DATA.grilles = await apiFetch('/grille-huiles');
      renderGrillePrix();
      await openGrilleModal(Number(id)); // rafraîchit l'affichage du coût de revient
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

  document.getElementById('grilleAjouterHistBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('grilleFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('grilleId').value;
    const payload = {
      date_effet: document.getElementById('grilleHistDate').value,
      cout_matiere: Number(document.getElementById('grilleHistMatiere').value) || null,
      rendement_jour: Number(document.getElementById('grilleHistProd').value) || null,
      note: document.getElementById('grilleHistNote').value.trim() || null,
    };
    if (!payload.date_effet || payload.cout_matiere == null || !payload.rendement_jour) {
      errEl.textContent = 'Date, coût matière et rendement sont requis pour ajouter une entrée.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch(`/grille-huiles/${id}/historique`, { method: 'POST', body: JSON.stringify(payload) });
      APP_DATA.grilles = await apiFetch('/grille-huiles');
      renderGrillePrix();
      await openGrilleModal(Number(id)); // rafraîchit l'affichage du détail avec la nouvelle entrée
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

  document.getElementById('grilleAppliquerOverridesBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('grilleFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('grilleId').value;
    try {
      const coutVal = document.getElementById('grilleCoutOverrideInput').value;
      if (coutVal) await apiFetch(`/grille-huiles/${id}/cout-override`, { method: 'POST', body: JSON.stringify({ valeur: Number(coutVal) }) });
      else await apiFetch(`/grille-huiles/${id}/cout-override`, { method: 'DELETE' });

      for (const input of document.querySelectorAll('.fmtOverride')) {
        const formatKey = input.dataset.format;
        if (input.value) {
          await apiFetch(`/grille-huiles/${id}/detail-override`, { method: 'POST', body: JSON.stringify({ format_key: formatKey, valeur: Number(input.value) }) });
        } else {
          await apiFetch(`/grille-huiles/${id}/detail-override/${formatKey}`, { method: 'DELETE' });
        }
      }
      APP_DATA.grilles = await apiFetch('/grille-huiles');
      renderGrillePrix();
      await openGrilleModal(Number(id));
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

