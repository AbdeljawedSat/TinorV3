  // ============================================================================
  // STATISTIQUES — calculées côté client depuis les commandes/factures réelles.
  // ============================================================================
  function renderStats() {
    if (!document.getElementById('statsCA')) return;
    const facturesEmises = APP_DATA.factures.filter(f => f.statut !== 'annulee');
    const ca = facturesEmises.reduce((s, f) => s + Number(f.total_ttc || 0) - Number(f.total_avoirs || 0), 0); // net des avoirs
    const encaisse = facturesEmises.reduce((s, f) => s + Number(f.total_paye || 0), 0);
    document.getElementById('statsCA').textContent = fmtDT(ca);
    document.getElementById('statsEncaisse').textContent = fmtDT(encaisse);
    document.getElementById('statsEnAttente').textContent = fmtDT(ca - encaisse);
    const commandesValides = APP_DATA.commandes.filter(c => c.statut !== 'annulee');
    document.getElementById('statsPanierMoyen').textContent = commandesValides.length
      ? fmtDT(commandesValides.reduce((s, c) => s + Number(c.total || 0), 0) / commandesValides.length)
      : fmtDT(0);

    // Meilleures ventes par produit / meilleurs clients — agrégés côté
    // serveur maintenant (l'ancienne version dépendait de lignes de commande
    // jamais chargées dans la liste, donc toujours vide).
    chargerTopVentesEtClients();

    // ---------- Chiffre d'affaires filtrable ----------
    const selClient = document.getElementById('caFilterClient');
    if (selClient && selClient.options.length <= 1) {
      APP_DATA.clients.slice().sort((a, b) => a.nom.localeCompare(b.nom)).forEach(c => {
        selClient.appendChild(new Option(c.nom, c.id));
      });
    }
    const selProduit = document.getElementById('caFilterProduit');
    if (selProduit && selProduit.options.length <= 1) {
      APP_DATA.produits.slice().sort((a, b) => a.nom.localeCompare(b.nom)).forEach(p => {
        selProduit.appendChild(new Option(p.nom, p.id));
      });
    }
    chargerChiffreAffairesFiltre();
  }
  async function chargerChiffreAffairesFiltre() {
    const debut = document.getElementById('caFilterDateDebut')?.value;
    const fin = document.getElementById('caFilterDateFin')?.value;
    const clientId = document.getElementById('caFilterClient')?.value;
    const produitId = document.getElementById('caFilterProduit')?.value;
    const params = new URLSearchParams();
    if (debut) params.set('date_debut', debut);
    if (fin) params.set('date_fin', fin);
    if (clientId) params.set('client_id', clientId);
    if (produitId) params.set('produit_id', produitId);
    try {
      const res = await apiFetch(`/stats/chiffre-affaires?${params.toString()}`);
      document.getElementById('caResultTotal').textContent = fmtDT(res.chiffre_affaires);
      document.getElementById('caResultNbCommandes').textContent = res.nb_commandes;
      document.getElementById('caResultQuantite').textContent = res.quantite_totale;
    } catch (err) { console.error('Erreur chiffre d\'affaires:', err.message); }

    try {
      const detail = await apiFetch(`/stats/chiffre-affaires-detail?${params.toString()}`);
      const body = document.getElementById('caDetailBody');
      body.innerHTML = detail.length
        ? detail.map(d => `
          <tr>
            <td class="lotCode">${d.commande_numero}</td>
            <td>${esc(d.client_nom)}</td>
            <td class="rowMeta num">${fmtDate(d.date_iso)}</td>
            <td class="num">${fmtDT(d.montant)}</td>
            <td>${d.facture_numero ? `<span class="lotCode">${d.facture_numero}</span>` : '<span class="rowMeta">Non facturée</span>'}</td>
            <td class="rowActions">
              ${d.facture_id
                ? `<button class="rowActionBtn" onclick="allerVersFacture(${d.facture_id})">Voir la facture</button>`
                : `<button class="rowActionBtn" onclick="allerVersCommande(${d.commande_id})">Voir la commande</button>`}
            </td>
          </tr>`).join('')
        : `<tr><td colspan="6" class="rowMeta" style="text-align:center; padding:16px;">Aucune vente pour ce filtre.</td></tr>`;
    } catch (err) { console.error('Erreur détail des ventes:', err.message); }
  }
  // Raccourcis utilisés par le tableau de détail des ventes.
  function allerVersFacture(factureId) {
    document.querySelector('a[data-view="factures"]').dispatchEvent(new Event('click', { bubbles: true }));
    setTimeout(() => imprimerFacture(factureId), 200);
  }
  function allerVersCommande(commandeId) {
    document.querySelector('a[data-view="commandes"]').dispatchEvent(new Event('click', { bubbles: true }));
    setTimeout(() => openCommandeModal(commandeId), 200);
  }
  ['caFilterDateDebut', 'caFilterDateFin', 'caFilterClient', 'caFilterProduit'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', chargerChiffreAffairesFiltre);
    document.getElementById(id)?.addEventListener('change', chargerChiffreAffairesFiltre);
  });
  document.getElementById('caFilterResetBtn')?.addEventListener('click', () => {
    ['caFilterDateDebut', 'caFilterDateFin', 'caFilterClient', 'caFilterProduit'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    chargerChiffreAffairesFiltre();
  });
  async function chargerTopVentesEtClients() {
    try {
      const [topProduits, topClients] = await Promise.all([
        apiFetch('/stats/top-produits?limit=10'),
        apiFetch('/stats/top-clients?limit=10'),
      ]);
      document.getElementById('statsTopProduitsBody').innerHTML = topProduits.length
        ? topProduits.map(p => `<tr><td>${esc(p.produit_nom)}</td><td class="num">${p.quantite_totale}</td><td class="num rowMeta">${p.nb_commandes}</td></tr>`).join('')
        : `<tr><td colspan="3" class="rowMeta" style="text-align:center; padding:16px;">Aucune vente pour l'instant.</td></tr>`;
      document.getElementById('statsTopClientsBody').innerHTML = topClients.length
        ? topClients.map(c => `<tr><td>${esc(c.client_nom)}</td><td class="num">${fmtDT(c.total)}</td><td class="num rowMeta">${c.nb_commandes}</td></tr>`).join('')
        : `<tr><td colspan="3" class="rowMeta" style="text-align:center; padding:16px;">Aucune commande.</td></tr>`;
    } catch (err) {
      console.error('Erreur chargement statistiques:', err.message);
    }
  }

