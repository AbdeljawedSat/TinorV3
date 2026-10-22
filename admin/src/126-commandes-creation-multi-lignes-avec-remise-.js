  // ============================================================================
  // COMMANDES — création multi-lignes avec remise optionnelle par ligne.
  // ============================================================================
  // Regroupe les options d'un select par catégorie — plus facile à parcourir
  // qu'une liste plate quand le catalogue grandit. attrsFn optionnel pour
  // ajouter des attributs (ex: data-prix) sur chaque <option>.
  function optionsGroupedByCategorie(produits, labelFn, attrsFn) {
    const groups = {};
    produits.forEach(p => { (groups[p.categorie_nom || 'Autres'] = groups[p.categorie_nom || 'Autres'] || []).push(p); });
    return Object.keys(groups).sort().map(cat =>
      `<optgroup label="${cat}">${groups[cat].map(p => `<option value="${p.id}" ${attrsFn ? attrsFn(p) : ''}>${esc(labelFn ? labelFn(p) : p.nom)}</option>`).join('')}</optgroup>`
    ).join('');
  }

  // Stock total disponible (tous lots LIBERE confondus) pour un produit —
  // affiché dans la colonne Stock du tableau de commande.
  function stockDisponiblePourProduit(produitId) {
    return APP_DATA.lots
      .filter(l => l.produit_id === produitId && l.statut === 'LIBERE')
      .reduce((s, l) => s + Number(l.quantite_actuelle), 0);
  }
  // Ajoute une ligne au tableau (ou augmente la quantité de 1 si le produit
  // est déjà présent) — comportement panier, comme demandé.
  function commandeAjouterLigne(produit, qty = 1, remiseId = '') {
    const rowsWrap = document.getElementById('commandeLignesRows');
    const emptyRow = document.getElementById('commandeLignesEmptyRow');
    if (emptyRow) emptyRow.remove();

    const existante = rowsWrap.querySelector(`tr[data-produit-id="${produit.id}"]`);
    if (existante) {
      const qtyInput = existante.querySelector('.ligneQty');
      qtyInput.value = Number(qtyInput.value || 0) + qty;
      if (remiseId) existante.querySelector('.ligneRemise').value = remiseId;
      updateCommandeTotalPreview();
      return;
    }

    const remiseOpts = REF_DATA.remises.map(r => `<option value="${r.id}">${esc(r.nom)}</option>`).join('');
    const stockDispo = stockDisponiblePourProduit(produit.id);
    const tr = document.createElement('tr');
    tr.dataset.produitId = produit.id;
    tr.innerHTML = `
      <td class="refCell">${esc(produit.code || '')}</td>
      <td>${esc(produit.nom)}</td>
      <td class="num"><input type="number" step="1" min="1" class="ligneQty" value="${qty}"></td>
      <td class="num stockCell${stockDispo <= 0 ? ' low' : ''}">${stockDispo}</td>
      <td class="num" data-col="puht">—</td>
      <td><select class="ligneRemise"><option value="">Sans remise</option>${remiseOpts}</select></td>
      <td class="num" data-col="totalht">—</td>
      <td class="num" data-col="totalttc">—</td>
      <td><button type="button" class="delRowBtn" title="Retirer">🗑️</button></td>`;
    tr.querySelector('.ligneQty').addEventListener('input', updateCommandeTotalPreview);
    tr.querySelector('.ligneRemise').addEventListener('change', updateCommandeTotalPreview);
    tr.querySelector('.delRowBtn').addEventListener('click', () => {
      tr.remove();
      if (!rowsWrap.querySelector('tr')) rowsWrap.innerHTML = `<tr id="commandeLignesEmptyRow"><td colspan="9" class="rowMeta" style="text-align:center; padding:14px;">Configurez une ligne ci-dessus puis cliquez "＋ Ajouter au tableau".</td></tr>`;
      updateCommandeTotalPreview();
    });

    const client = APP_DATA.clients.find(c => c.id === Number(document.getElementById('commandeClient').value));
    if (remiseId) tr.querySelector('.ligneRemise').value = remiseId;
    else if (client && client.remise_id) tr.querySelector('.ligneRemise').value = client.remise_id;

    rowsWrap.appendChild(tr);
    updateCommandeTotalPreview();
  }
  // Recherche produit réutilisable — insensible aux accents, filtre en direct.
  // onSelect(produit) est appelé au clic sur un résultat.
  function attacherRechercheProduit(searchEl, resultsEl, onSelect) {
    function rendreResultats(terme) {
      const vendables = APP_DATA.produits.filter(p => p.vendable);
      const liste = vendables.length ? vendables : APP_DATA.produits;
      const t = normaliserRecherche(terme);
      const matches = liste.filter(p => normaliserRecherche(p.nom).includes(t)).slice(0, 25);
      resultsEl.innerHTML = matches.length
        ? matches.map(p => `
          <div class="comboItem" data-id="${p.id}">
            ${esc(p.nom)}
            <div class="comboSub">${p.prix_vente != null ? fmtDT(p.prix_vente) : 'sans prix'} — ${esc(p.code || '')} — stock ${stockDisponiblePourProduit(p.id)}</div>
          </div>`).join('')
        : `<div class="comboEmpty">Aucun produit trouvé.</div>`;
      resultsEl.style.display = 'block';
      resultsEl.querySelectorAll('.comboItem').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const produit = APP_DATA.produits.find(p => String(p.id) === el.dataset.id);
          if (produit) onSelect(produit);
        });
      });
    }
    searchEl.addEventListener('input', () => rendreResultats(searchEl.value));
    searchEl.addEventListener('focus', () => { if (searchEl.value.trim()) rendreResultats(searchEl.value); });
    searchEl.addEventListener('blur', () => setTimeout(() => { resultsEl.style.display = 'none'; }, 120));
  }
  // Ligne de configuration unique — on choisit le produit, on ajuste
  // Qté/Remise, PU HT/Prix TTC/Total se calculent en direct, puis "＋ Ajouter
  // au tableau" pousse cette ligne dans le tableau cumulatif et réinitialise
  // la ligne de configuration pour la suivante.
  function commandeStageProduit() {
    const id = Number(document.getElementById('commandeStageProduitId').value) || null;
    return id ? APP_DATA.produits.find(p => p.id === id) : null;
  }
  function updateCommandeStagePreview() {
    const produit = commandeStageProduit();
    const qty = Number(document.getElementById('commandeStageQty').value) || 0;
    const remiseId = document.getElementById('commandeStageRemise').value;
    const prixTtcCatalogue = produit ? Number(produit.prix_vente || 0) : 0;
    let prixTtcFacture = prixTtcCatalogue;
    if (remiseId) {
      const remise = REF_DATA.remises.find(r => String(r.id) === remiseId);
      if (remise && remise.type === 'pourcentage') prixTtcFacture = prixTtcCatalogue * (1 - remise.pourcentage / 100);
    }
    const tauxTva = (produit && produit.tva != null ? Number(produit.tva) : (APP_DATA.settings?.tva ?? 19)) / 100;
    const puHt = prixTtcFacture / (1 + tauxTva);
    document.getElementById('commandeStagePuht').textContent = produit ? fmtDT(puHt).replace(' DT', '') : '—';
    document.getElementById('commandeStageTtc').textContent = produit ? fmtDT(prixTtcFacture).replace(' DT', '') : '—';
    document.getElementById('commandeStageTotal').textContent = produit ? fmtDT(prixTtcFacture * qty).replace(' DT', '') : '—';
    const info = document.getElementById('commandeStageInfo');
    if (produit) {
      const deja = Number(document.querySelector(`#commandeLignesRows tr[data-produit-id="${produit.id}"] .ligneQty`)?.value || 0);
      const dispo = stockDisponiblePourProduit(produit.id);
      const manque = qty + deja > dispo;
      info.className = 'stageInfo' + (manque ? ' alerte' : '');
      info.textContent = `Stock disponible : ${dispo}` + (deja ? ` · déjà ${deja} dans la commande` : '') + (manque ? ' — quantité supérieure au stock' : '');
    } else {
      info.className = 'stageInfo';
      info.textContent = 'Tapez un nom de produit, Entrée pour choisir, puis la quantité et Entrée pour ajouter.';
    }
  }
  function commandeStageReset() {
    document.getElementById('commandeStageSearch').value = '';
    document.getElementById('commandeStageProduitId').value = '';
    document.getElementById('commandeStageQty').value = '1';
    document.getElementById('commandeStageRemise').value = '';
    updateCommandeStagePreview();
  }
  function initCommandeStageRow() {
    const searchEl = document.getElementById('commandeStageSearch');
    if (searchEl.dataset.wired) {
      // Déjà câblé (ré-ouverture de la modale) — juste rafraîchir la liste des remises.
      populateSelect(document.getElementById('commandeStageRemise'), REF_DATA.remises, 'id', 'nom', 'Sans remise');
      commandeStageReset();
      return;
    }
    searchEl.dataset.wired = '1';
    const resultsEl = document.getElementById('commandeStageResults');
    populateSelect(document.getElementById('commandeStageRemise'), REF_DATA.remises, 'id', 'nom', 'Sans remise');

    attacherRechercheProduit(searchEl, resultsEl, (produit) => {
      document.getElementById('commandeStageProduitId').value = produit.id;
      searchEl.value = produit.nom;
      resultsEl.style.display = 'none';
      // Reprend automatiquement la remise du client si une est déjà définie sur la ligne de configuration.
      updateCommandeStagePreview();
      const qtyEl = document.getElementById('commandeStageQty');
      qtyEl.focus(); qtyEl.select();
    });
    // Entrée dans la recherche : choisit le premier produit proposé.
    searchEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const premier = resultsEl.querySelector('.comboItem');
      if (premier && resultsEl.style.display !== 'none') premier.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      else if (commandeStageProduit()) document.getElementById('commandeStageAddBtn').click();
    });
    // Entrée dans la quantité : ajoute la ligne et revient à la recherche.
    document.getElementById('commandeStageQty').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('commandeStageAddBtn').click(); }
    });
    document.getElementById('commandeStageQty').addEventListener('input', updateCommandeStagePreview);
    document.getElementById('commandeStageRemise').addEventListener('change', updateCommandeStagePreview);
    document.getElementById('commandeStageClearBtn').addEventListener('click', commandeStageReset);
    document.getElementById('commandeStageAddBtn').addEventListener('click', () => {
      const produit = commandeStageProduit();
      const qty = Number(document.getElementById('commandeStageQty').value) || 0;
      if (!produit || qty <= 0) { notifier('Choisissez un produit et une quantité valide avant d\'ajouter.'); return; }
      const remiseId = document.getElementById('commandeStageRemise').value;
      commandeAjouterLigne(produit, qty, remiseId);
      commandeStageReset();
      searchEl.focus();
    });
    commandeStageReset();
  }
  document.getElementById('commandeAddLigneInlineBtn')?.addEventListener('click', commandeAjouterLigneVide);
  function updateCommandeTotalPreview() {
    let total = 0;
    document.querySelectorAll('#commandeLignesRows tr[data-produit-id]').forEach(row => {
      const produitId = Number(row.dataset.produitId);
      const produit = APP_DATA.produits.find(p => p.id === produitId);
      const prixTtcCatalogue = produit ? Number(produit.prix_vente || 0) : 0;
      const qty = Number(row.querySelector('.ligneQty').value) || 0;
      const remiseId = row.querySelector('.ligneRemise').value;
      let prixTtcFacture = prixTtcCatalogue;
      let remisePct = 0;
      if (remiseId) {
        const remise = REF_DATA.remises.find(r => String(r.id) === remiseId);
        if (remise && remise.type === 'pourcentage') { prixTtcFacture = prixTtcCatalogue * (1 - remise.pourcentage / 100); remisePct = remise.pourcentage; }
      }
      const tauxTva = (produit && produit.tva != null ? Number(produit.tva) : (APP_DATA.settings?.tva ?? 19)) / 100;
      const puHt = prixTtcFacture / (1 + tauxTva);
      const totalTtc = prixTtcFacture * qty;
      const totalHt = puHt * qty;

      row.querySelector('[data-col="puht"]').textContent = fmtDT(puHt).replace(' DT', '');
      row.querySelector('[data-col="totalht"]').textContent = fmtDT(totalHt).replace(' DT', '');
      row.querySelector('[data-col="totalttc"]').textContent = fmtDT(totalTtc).replace(' DT', '');
      total += totalTtc;
    });
    document.getElementById('commandeTotalPreview').textContent = fmtDT(total);
  }

  function openCommandeModal(id) {
    document.getElementById('commandeFormError').style.display = 'none';
    populateSelect(document.getElementById('commandeClient'), APP_DATA.clients, 'id', 'nom');
    const rowsWrap = document.getElementById('commandeLignesRows');
    rowsWrap.innerHTML = '';

    const c = id ? APP_DATA.commandes.find(x => x.id === id) : null;
    document.getElementById('commandeId').value = c ? c.id : '';
    document.querySelector('#commandeModalOverlay .modalHead h2').textContent = c ? `Modifier — ${c.numero}` : 'Nouvelle commande';
    document.getElementById('commandeNotes').value = c && c.notes ? c.notes : '';
    document.getElementById('commandeStageRow').style.display = c ? 'none' : 'grid';
    document.getElementById('commandeStageAddBtn').style.display = c ? 'none' : 'inline-flex';
    document.getElementById('commandeLignesLockedNote').style.display = c ? 'block' : 'none';
    document.getElementById('commandeClient').disabled = !!c;
    document.getElementById('commandeStatutInitial').previousElementSibling.style.display = c ? 'none' : 'block';
    document.getElementById('commandeStatutInitial').style.display = c ? 'none' : 'block';
    document.getElementById('commandeStatutInitial').value = 'confirmee';

    if (c) {
      document.getElementById('commandeClient').value = c.client_id || '';
      // Lignes affichées à titre indicatif seulement (non modifiables) — le
      // détail exact vient de l'API, pas reconstruit ici pour rester simple.
      apiFetch(`/commandes/${id}`).then(detail => {
        rowsWrap.innerHTML = (detail.lignes || []).map(l => {
          const tauxTva = (APP_DATA.settings?.tva ?? 19) / 100;
          const puHt = Number(l.unit_price) / (1 + tauxTva);
          const produit = APP_DATA.produits.find(p => p.id === l.produit_id);
          return `
          <tr>
            <td class="refCell">${esc(produit?.code || '')}</td>
            <td>${esc(l.produit_nom || l.produit_id)}</td>
            <td class="num">${l.qty}</td>
            <td class="num">—</td>
            <td class="num">${fmtDT(puHt).replace(' DT', '')}</td>
            <td style="font-size:11.5px;">${l.remise_nom || '—'}</td>
            <td class="num">${fmtDT(puHt * l.qty).replace(' DT', '')}</td>
            <td class="num">${fmtDT(l.total).replace(' DT', '')}</td>
            <td></td>
          </tr>`;
        }).join('') || `<tr><td colspan="9" class="rowMeta" style="text-align:center; padding:14px;">Aucune ligne.</td></tr>`;
      });
      document.getElementById('commandeTotalPreview').textContent = fmtDT(c.total);
    } else {
      rowsWrap.innerHTML = `<tr id="commandeLignesEmptyRow"><td colspan="9" class="rowMeta" style="text-align:center; padding:14px;">Configurez une ligne ci-dessus puis cliquez "＋ Ajouter au tableau".</td></tr>`;
      initCommandeStageRow();
      updateCommandeTotalPreview();
    }
    document.getElementById('commandeModalOverlay').classList.add('open');
  }
  function closeCommandeModal() { document.getElementById('commandeModalOverlay').classList.remove('open'); }
  // Choisir un client applique automatiquement sa remise par défaut (fiche
  // client) sur les lignes déjà présentes — reste modifiable ligne par ligne.
  document.getElementById('commandeClient').addEventListener('change', () => {
    if (document.getElementById('commandeId').value) return; // pas en mode édition
    const client = APP_DATA.clients.find(c => c.id === Number(document.getElementById('commandeClient').value));
    if (!client || !client.remise_id) return;
    document.querySelectorAll('#commandeLignesRows .ligneRemise').forEach(sel => {
      sel.value = client.remise_id;
    });
    updateCommandeTotalPreview();
  });

  async function saveCommande() {
    const errEl = document.getElementById('commandeFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('commandeId').value;

    if (id) {
      try {
        await apiFetch(`/commandes/${id}`, { method: 'PUT', body: JSON.stringify({ notes: document.getElementById('commandeNotes').value.trim() || null }) });
        closeCommandeModal();
        APP_DATA.commandes = await apiFetch('/commandes');
        renderCommandes();
      } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      return;
    }

    const clientId = Number(document.getElementById('commandeClient').value) || null;
    const lignes = [...document.querySelectorAll('#commandeLignesRows tr[data-produit-id]')].map(row => ({
      produit_id: Number(row.dataset.produitId) || null,
      qty: Number(row.querySelector('.ligneQty').value) || null,
      remise_id: row.querySelector('.ligneRemise').value ? Number(row.querySelector('.ligneRemise').value) : null,
    })).filter(l => l.produit_id && l.qty);

    if (!clientId || !lignes.length) {
      errEl.textContent = 'Client et au moins une ligne valide sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/commandes', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, lignes, statut: document.getElementById('commandeStatutInitial').value, notes: document.getElementById('commandeNotes').value.trim() || null, employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null }),
      });
      closeCommandeModal();
      const [commandes, lots, produits] = await Promise.all([apiFetch('/commandes'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.commandes = commandes; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderCommandes(); renderLotsRegistre(); renderProduits(); renderDashboard();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('commandeSaveBtn').addEventListener('click', saveCommande);
  document.getElementById('commandeCancelBtn').addEventListener('click', closeCommandeModal);
  document.getElementById('commandeModalCloseBtn').addEventListener('click', closeCommandeModal);

