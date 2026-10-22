  // ============================================================================
  // ACHATS — bons de commande génériques (emballages, consommables...).
  // ============================================================================
  function renderAchats() {
    const body = document.getElementById('achatsBody');
    if (!APP_DATA.achats.length) { body.innerHTML = `<tr><td colspan="6" class="rowMeta" style="text-align:center; padding:22px;">Aucun achat — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    const statutLabel = { brouillon: ['grey', 'Brouillon'], commande: ['warn', 'Commandé'], partiel: ['warn', 'Partiel'], receptionne: ['good', 'Réceptionné'], annule: ['danger', 'Annulé'], cloture: ['grey', 'Clôturé'] };
    body.innerHTML = APP_DATA.achats.map(a => {
      const [cls, label] = statutLabel[a.statut] || ['grey', a.statut];
      return `<tr>
        <td class="lotCode">${esc(a.numero)}</td>
        <td>${esc(a.fournisseur_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(a.date_achat)}</td>
        <td><span class="pill ${cls}">${label}</span></td>
        <td class="num">${fmtDT(a.total_ttc)}</td>
        <td class="rowActions">${a.statut === 'receptionne' ? '' : `<button class="rowActionBtn" onclick="prepareReceptionFromAchat(${a.id})">Réceptionner</button>`}</td>
      </tr>`;
    }).join('');
  }

  // Correspondance type de fournisseur -> type(s) de produit plausibles —
  // affine la liste proposée dans les lignes d'achat/réception. Repli sur la
  // liste complète si le type ne restreint rien (externe/service/autre) ou
  // si le filtre ne laisserait aucun produit (sécurité anti-liste-vide).
  const TYPES_PRODUIT_PAR_FOURNISSEUR = {
    parcelle: ['MATIERE_PREMIERE'],
    emballage: ['EMBALLAGE'],
    consommable: ['CONSOMMABLE'],
    produit_revendu: ['PRODUIT_ACHETE', 'PRODUIT_REVENDE'],
    // fournisseur_externe, service, autre : pas de restriction, tout achetable est proposé
  };
  function produitsPourFournisseur(fournisseurId, ignorerFiltre) {
    const achetables = APP_DATA.produits.filter(p => p.achetable);
    const base = achetables.length ? achetables : APP_DATA.produits;
    if (ignorerFiltre || !fournisseurId) return base;
    const four = APP_DATA.fournisseurs.find(f => f.id === fournisseurId);
    const types = four ? TYPES_PRODUIT_PAR_FOURNISSEUR[four.type] : null;
    if (!types) return base;
    const filtres = base.filter(p => types.includes(p.type_article));
    return filtres.length ? filtres : base; // jamais de liste vide
  }

  function achatLigneRow() {
    const fournisseurId = Number(document.getElementById('achatFournisseur').value) || null;
    const ignorerFiltre = document.getElementById('achatToutesCategories').checked;
    const liste = produitsPourFournisseur(fournisseurId, ignorerFiltre);
    const options = optionsGroupedByCategorie(
      liste,
      p => `${p.nom} (${p.type_article})`,
      p => `data-unite="${p.unite_symbole || ''}" data-format="${p.format_id || ''}"`
    );
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'structRow';
    row.style.gridTemplateColumns = '1.4fr 70px 40px 100px 32px';
    row.innerHTML = `
      <select class="ligProduit formInput">${options}</select>
      <input type="number" step="1" class="ligQty formInput" placeholder="Qté" value="1">
      <span class="ligUnite rowMeta" style="align-self:center; text-align:center;"></span>
      <input type="number" step="0.001" class="ligPrix formInput" placeholder="Prix unit.">
      <button class="delField" type="button">✕</button>`;
    const contenanceEl = document.createElement('div');
    contenanceEl.className = 'rowMeta';
    contenanceEl.style.cssText = 'font-size:11px; margin:2px 0 6px 2px;';
    const selectEl = row.querySelector('.ligProduit');
    const uniteEl = row.querySelector('.ligUnite');
    const majUnite = () => {
      const opt = selectEl.options[selectEl.selectedIndex];
      uniteEl.textContent = opt?.dataset.unite || '';
      const formatId = opt?.dataset.format ? Number(opt.dataset.format) : null;
      const format = formatId ? REF_DATA.formats.find(f => f.id === formatId) : null;
      contenanceEl.textContent = format
        ? `Contenance : ${format.volume ? format.volume + ' ml' : format.poids + ' g'} / unité`
        : '';
    };
    selectEl.addEventListener('change', majUnite);
    majUnite();
    row.querySelector('.delField').addEventListener('click', () => { wrap.remove(); updateAchatTotalPreview(); });
    row.querySelector('.ligQty').addEventListener('input', updateAchatTotalPreview);
    row.querySelector('.ligPrix').addEventListener('input', updateAchatTotalPreview);
    wrap.appendChild(row);
    wrap.appendChild(contenanceEl);
    return wrap;
  }
  function updateAchatTotalPreview() {
    let total = 0;
    document.querySelectorAll('#achatLignesRows .structRow').forEach(row => {
      total += (Number(row.querySelector('.ligQty').value) || 0) * (Number(row.querySelector('.ligPrix').value) || 0);
    });
    document.getElementById('achatTotalPreview').textContent = fmtDT(total);
  }

  function openAchatModal() {
    document.getElementById('achatFormError').style.display = 'none';
    populateSelect(document.getElementById('achatFournisseur'), APP_DATA.fournisseurs, 'id', 'nom');
    document.getElementById('achatDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('achatStatut').value = 'brouillon';
    document.getElementById('achatTvaRate').value = '19';
    document.getElementById('achatNotes').value = '';
    document.getElementById('achatToutesCategories').checked = false;
    const rowsWrap = document.getElementById('achatLignesRows');
    rowsWrap.innerHTML = '';
    if (APP_DATA.produits.length) rowsWrap.appendChild(achatLigneRow());
    updateAchatTotalPreview();
    document.getElementById('achatModalOverlay').classList.add('open');
  }
  function closeAchatModal() { document.getElementById('achatModalOverlay').classList.remove('open'); }
  document.getElementById('achatAddLigneBtn').addEventListener('click', () => {
    document.getElementById('achatLignesRows').appendChild(achatLigneRow());
    updateAchatTotalPreview();
  });
  // Changer de fournisseur reconstruit les lignes déjà présentes (repart à
  // zéro, comme pour les autres formulaires) pour refléter le nouveau filtre.
  document.getElementById('achatFournisseur').addEventListener('change', () => {
    const rowsWrap = document.getElementById('achatLignesRows');
    rowsWrap.innerHTML = '';
    rowsWrap.appendChild(achatLigneRow());
    updateAchatTotalPreview();
  });
  document.getElementById('achatToutesCategories').addEventListener('change', () => {
    const rowsWrap = document.getElementById('achatLignesRows');
    rowsWrap.innerHTML = '';
    rowsWrap.appendChild(achatLigneRow());
    updateAchatTotalPreview();
  });

  async function saveAchat() {
    const errEl = document.getElementById('achatFormError');
    errEl.style.display = 'none';
    const lignes = [...document.querySelectorAll('#achatLignesRows .structRow')].map(row => ({
      produit_id: Number(row.querySelector('.ligProduit').value) || null,
      quantite: Number(row.querySelector('.ligQty').value) || null,
      prix_unitaire: Number(row.querySelector('.ligPrix').value) || 0,
    })).filter(l => l.produit_id && l.quantite);

    const payload = {
      fournisseur_id: Number(document.getElementById('achatFournisseur').value) || null,
      date_achat: document.getElementById('achatDate').value,
      statut: document.getElementById('achatStatut').value,
      tva_rate: Number(document.getElementById('achatTvaRate').value) || 0,
      notes: document.getElementById('achatNotes').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      lignes,
    };
    if (!payload.fournisseur_id || !payload.date_achat || !lignes.length) {
      errEl.textContent = 'Fournisseur, date et au moins une ligne valide sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/achats', { method: 'POST', body: JSON.stringify(payload) });
      closeAchatModal();
      APP_DATA.achats = await apiFetch('/achats');
      renderAchats();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('achatSaveBtn').addEventListener('click', saveAchat);
  document.getElementById('achatCancelBtn').addEventListener('click', closeAchatModal);
  document.getElementById('achatModalCloseBtn').addEventListener('click', closeAchatModal);

