  // ============================================================================
  // ORDRES DE PRODUCTION — lance une production à partir d'une recette.
  // ============================================================================
  function renderOrdresProduction() {
    const body = document.getElementById('ordresProductionBody');
    const rows = filtrerParTexteEtDate(APP_DATA.ordresProduction, 'historique', o => `${o.produit_nom || ''} ${o.numero_lot || ''}`, o => o.date);
    if (!rows.length) { body.innerHTML = `<tr><td colspan="5" class="rowMeta" style="text-align:center; padding:22px;">Aucune production pour ce filtre.</td></tr>`; return; }
    body.innerHTML = rows.map(o => `
      <tr>
        <td class="lotCode">${esc(o.numero_lot || '—')}</td>
        <td>${esc(o.produit_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(o.date)}</td>
        <td class="num">${o.qty_produite}</td>
        <td class="rowMeta">${esc(o.employe_nom || '—')}</td>
      </tr>`).join('');
  }

  function openOrdreProdModal() {
    document.getElementById('ordreProdFormError').style.display = 'none';
    populateSelect(document.getElementById('ordreProdRecette'), APP_DATA.recettes.map(r => ({ id: r.id, label: r.produit_nom })), 'id', 'label');
    document.getElementById('ordreProdDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('ordreProdQty').value = '';
    document.getElementById('ordreProdNotes').value = '';
    document.getElementById('ordreProdModalOverlay').classList.add('open');
  }
  function closeOrdreProdModal() { document.getElementById('ordreProdModalOverlay').classList.remove('open'); }

  async function saveOrdreProd() {
    const errEl = document.getElementById('ordreProdFormError');
    errEl.style.display = 'none';
    const payload = {
      recette_id: Number(document.getElementById('ordreProdRecette').value) || null,
      date: document.getElementById('ordreProdDate').value,
      qty_produite: Number(document.getElementById('ordreProdQty').value) || null,
      notes: document.getElementById('ordreProdNotes').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
    };
    if (!payload.recette_id || !payload.date || !payload.qty_produite) {
      errEl.textContent = 'Recette, date et quantité sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/ordres-production', { method: 'POST', body: JSON.stringify(payload) });
      closeOrdreProdModal();
      const [ordresProduction, lots, produits] = await Promise.all([apiFetch('/ordres-production'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.ordresProduction = ordresProduction; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderOrdresProduction(); renderLotsRegistre(); renderProduits();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('ordreProdSaveBtn').addEventListener('click', saveOrdreProd);
  document.getElementById('ordreProdCancelBtn').addEventListener('click', closeOrdreProdModal);
  document.getElementById('ordreProdModalCloseBtn').addEventListener('click', closeOrdreProdModal);

