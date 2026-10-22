  // ============================================================================
  // NOUVEAU LOT (MANUEL) — stock initial ou correction, hors flux dédiés.
  // ============================================================================
  function openLotManuelModal() {
    document.getElementById('lotManuelFormError').style.display = 'none';
    populateSelect(document.getElementById('lotManuelProduit'), APP_DATA.produits, 'id', 'nom');
    populateSelect(document.getElementById('lotManuelLocal'), APP_DATA.locaux, 'id', 'nom', '— Non précisé —');
    document.getElementById('lotManuelOrigine').value = 'INVENTAIRE';
    document.getElementById('lotManuelQuantite').value = '';
    document.getElementById('lotManuelDateProduction').value = '';
    document.getElementById('lotManuelDateExpiration').value = '';
    document.getElementById('lotManuelNotes').value = '';
    document.getElementById('lotManuelModalOverlay').classList.add('open');
  }
  function closeLotManuelModal() { document.getElementById('lotManuelModalOverlay').classList.remove('open'); }

  async function saveLotManuel() {
    const errEl = document.getElementById('lotManuelFormError');
    errEl.style.display = 'none';
    const payload = {
      produit_id: Number(document.getElementById('lotManuelProduit').value) || null,
      origine: document.getElementById('lotManuelOrigine').value,
      quantite_initiale: document.getElementById('lotManuelQuantite').value ? Number(document.getElementById('lotManuelQuantite').value) : null,
      local_id: document.getElementById('lotManuelLocal').value ? Number(document.getElementById('lotManuelLocal').value) : null,
      date_production: document.getElementById('lotManuelDateProduction').value || null,
      date_expiration: document.getElementById('lotManuelDateExpiration').value || null,
      notes: document.getElementById('lotManuelNotes').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
    };
    if (!payload.produit_id || !payload.quantite_initiale) {
      errEl.textContent = 'Produit et quantité initiale sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/lots', { method: 'POST', body: JSON.stringify(payload) });
      closeLotManuelModal();
      const [lots, produits] = await Promise.all([apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderLotsRegistre(); renderProduits();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('lotManuelSaveBtn').addEventListener('click', saveLotManuel);
  document.getElementById('lotManuelCancelBtn').addEventListener('click', closeLotManuelModal);
  document.getElementById('lotManuelModalCloseBtn').addEventListener('click', closeLotManuelModal);

