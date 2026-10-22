  // ============================================================================
  // INVENTAIRES — comptage physique, écarts, clôture avec ajustement du stock
  // ============================================================================
  let INVENTAIRES = [];
  let INVENTAIRE_OUVERT = null;
  const fmtQte = v => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

  async function chargerInventaires() {
    document.getElementById('invLocal').innerHTML = APP_DATA.locaux.length
      ? APP_DATA.locaux.map(l => `<option value="${l.id}">${esc(l.nom)}</option>`).join('')
      : `<option value="">Aucun local — créez-en un dans Locaux & Zones</option>`;
    try {
      INVENTAIRES = await apiFetch('/inventaires');
      renderInventaires();
      if (INVENTAIRE_OUVERT) await ouvrirInventaire(INVENTAIRE_OUVERT.id);
    } catch (err) {
      document.getElementById('inventairesBody').innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">${esc(err.message)}</td></tr>`;
    }
  }

  function renderInventaires() {
    const body = document.getElementById('inventairesBody');
    if (!INVENTAIRES.length) {
      body.innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucun inventaire pour l'instant.</td></tr>`;
      return;
    }
    body.innerHTML = INVENTAIRES.map(i => `
      <tr>
        <td class="lotCode">${esc(i.numero)}</td>
        <td class="rowMeta num">${fmtDate(i.date)}</td>
        <td>${esc(i.local_nom || '—')}</td>
        <td class="num">${i.nb_lignes}</td>
        <td class="num" style="${Number(i.nb_ecarts) ? 'color:var(--warn); font-weight:600;' : ''}">${i.nb_ecarts}</td>
        <td>${i.statut === 'en_cours' ? '<span class="pill warn">En cours</span>' : '<span class="pill good">Clôturé</span>'}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="ouvrirInventaire(${i.id})">${i.statut === 'en_cours' ? 'Compter' : 'Voir'}</button></td>
      </tr>`).join('');
  }

  async function ouvrirInventaire(id) {
    try { INVENTAIRE_OUVERT = await apiFetch(`/inventaires/${id}`); }
    catch (err) { notifier(err.message, 'erreur'); return; }
    const inv = INVENTAIRE_OUVERT;
    const enCours = inv.statut === 'en_cours';
    document.getElementById('invDetailPanel').style.display = 'block';
    document.getElementById('invDetailTitre').textContent = `Inventaire ${inv.numero} — ${inv.local_nom || ''}`;
    document.getElementById('invDetailSub').textContent = enCours
      ? `Ouvert le ${fmtDate(inv.date)} — saisissez les quantités comptées, puis enregistrez ou clôturez.`
      : `Clôturé — ${inv.lignes.filter(l => Number(l.ecart) !== 0).length} écart(s) ajusté(s) dans le stock.`;
    document.getElementById('invDetailActions').innerHTML = enCours ? `
      <button class="btnGhost" onclick="abandonnerInventaire()">Abandonner</button>
      <button class="btnGhost" onclick="enregistrerComptage()">Enregistrer le comptage</button>
      <button class="btnPrimary" onclick="cloturerInventaire()">Clôturer et ajuster le stock</button>` : '';
    document.getElementById('invLignesBody').innerHTML = inv.lignes.map(l => `
      <tr data-ligne="${l.id}">
        <td class="lotCode">${esc(l.numero_lot || '—')}</td>
        <td>${esc(l.produit_nom || '—')}</td>
        <td class="rowMeta num">${l.date_expiration ? fmtDate(l.date_expiration) : '—'}</td>
        <td class="num">${fmtQte(l.quantite_theorique)} ${l.unite_symbole || ''}</td>
        <td class="num">${enCours
          ? `<input type="number" min="0" step="any" class="invCompte" data-theorique="${l.quantite_theorique}" value="${Number(l.quantite_physique)}" style="width:100px; padding:5px 8px; border:1px solid var(--line); border-radius:6px; text-align:right; font-family:inherit;">`
          : `${fmtQte(l.quantite_physique)} ${l.unite_symbole || ''}`}</td>
        <td class="num invEcart">${celluleEcart(Number(l.ecart))}</td>
      </tr>`).join('');
    document.querySelectorAll('#invLignesBody .invCompte').forEach(input => {
      input.addEventListener('input', () => {
        const ecart = Number(input.value || 0) - Number(input.dataset.theorique);
        input.closest('tr').querySelector('.invEcart').innerHTML = celluleEcart(ecart);
      });
    });
    document.getElementById('invDetailPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function celluleEcart(ecart) {
    const e = Math.round(ecart * 1000) / 1000;
    if (!e) return '<span class="rowMeta">—</span>';
    return `<b style="color:${e > 0 ? 'var(--good)' : 'var(--danger)'};">${e > 0 ? '+' : ''}${fmtQte(e)}</b>`;
  }

  function lignesSaisies() {
    return [...document.querySelectorAll('#invLignesBody tr[data-ligne]')].map(tr => ({
      id: Number(tr.dataset.ligne),
      quantite_physique: tr.querySelector('.invCompte').value === '' ? NaN : Number(tr.querySelector('.invCompte').value),
    }));
  }

  async function enregistrerComptage(silencieux) {
    const lignes = lignesSaisies();
    if (lignes.some(l => !Number.isFinite(l.quantite_physique) || l.quantite_physique < 0)) {
      notifier('Chaque quantité comptée doit être un nombre positif ou nul.');
      return false;
    }
    try {
      await apiFetch(`/inventaires/${INVENTAIRE_OUVERT.id}/lignes`, { method: 'PUT', body: JSON.stringify({ lignes }) });
      if (!silencieux) { await chargerInventaires(); }
      return true;
    } catch (err) { notifier(err.message, 'erreur'); return false; }
  }

  async function cloturerInventaire() {
    if (!(await enregistrerComptage(true))) return;
    const inv = await apiFetch(`/inventaires/${INVENTAIRE_OUVERT.id}`);
    const ecarts = inv.lignes.filter(l => Number(l.ecart) !== 0);
    const detail = ecarts.slice(0, 12).map(l => `• ${l.numero_lot} (${l.produit_nom}) : ${Number(l.ecart) > 0 ? '+' : ''}${fmtQte(l.ecart)}`).join('\n');
    const msg = ecarts.length
      ? `${ecarts.length} écart(s) seront appliqués au stock :\n${detail}${ecarts.length > 12 ? '\n…' : ''}\n\nCette opération est définitive.`
      : `Aucun écart : le stock ne sera pas modifié.`;
    if (!(await confirmer(msg, { titre: `Clôturer l'inventaire ${inv.numero} ?`, ok: 'Clôturer et ajuster le stock' }))) return;
    try {
      await apiFetch(`/inventaires/${inv.id}/cloturer`, { method: 'POST', body: JSON.stringify({ employe_id: CURRENT_USER && CURRENT_USER.employe_id }) });
      APP_DATA.lots = await apiFetch('/lots');
      renderLotsRegistre(); renderDashboard();
      await chargerInventaires();
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  async function abandonnerInventaire() {
    if (!(await confirmer("Le comptage saisi sera perdu ; le stock n'a pas été modifié.", { titre: `Abandonner l'inventaire ${INVENTAIRE_OUVERT.numero} ?`, ok: 'Abandonner', non: 'Continuer le comptage', danger: true }))) return;
    try {
      await apiFetch(`/inventaires/${INVENTAIRE_OUVERT.id}`, { method: 'DELETE' });
      INVENTAIRE_OUVERT = null;
      document.getElementById('invDetailPanel').style.display = 'none';
      await chargerInventaires();
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  document.getElementById('invOuvrirBtn').addEventListener('click', async () => {
    const localId = Number(document.getElementById('invLocal').value);
    if (!localId) { notifier('Choisissez un local.'); return; }
    try {
      const inv = await apiFetch('/inventaires', { method: 'POST', body: JSON.stringify({
        local_id: localId,
        inclure_sans_local: document.getElementById('invSansLocal').checked,
        employe_id: CURRENT_USER && CURRENT_USER.employe_id,
      }) });
      INVENTAIRE_OUVERT = inv;
      await chargerInventaires();
    } catch (err) { notifier(err.message, 'erreur'); }
  });

  const TYPE_MVT_LABEL = {
    ACHAT: 'Achat', RECEPTION: 'Réception', VENTE: 'Vente', PRODUCTION: 'Production',
    CONDITIONNEMENT: 'Conditionnement', CONSOMMATION: 'Consommation', TRANSFERT: 'Transfert',
    AJUSTEMENT: 'Ajustement', INVENTAIRE: 'Inventaire', RETOUR_CLIENT: 'Retour client',
    RETOUR_FOURNISSEUR: 'Retour fournisseur', PERTE: 'Perte', CASSE: 'Casse',
    DESTRUCTION: 'Destruction', AUTRE: 'Autre',
  };
  const SOURCE_TYPE_LABEL = {
    commande: 'Vente', achat: 'Achat', reception: 'Réception',
    lots_presse: 'Pressage', lots_filtration: 'Filtration',
    conditionnement: 'Conditionnement', ordre_production: 'Production', facture: 'Annulation facture',
  };

  async function openRepartitionModal(numero) {
    document.getElementById('repartitionModalTitle').textContent = `Répartition — ${numero}`;
    const lot = APP_DATA.lots.find(l => l.numero_lot === numero);
    document.getElementById('repartitionBanner').innerHTML = lot ? `
      <span class="lotCode" style="font-size:14px; padding:5px 10px;">${esc(lot.numero_lot)}</span>
      <span style="margin-left:8px; font-weight:600;">${esc(lot.produit_nom || '')}</span>
      <span class="rowMeta"> — reste ${lot.quantite_actuelle} ${lot.unite_symbole || ''}</span>` : '';

    const mouvements = await apiFetch(`/lots/${encodeURIComponent(numero)}/mouvements`);
    const body = document.getElementById('repartitionBody');
    const emptyEl = document.getElementById('repartitionEmpty');
    if (!mouvements.length) {
      body.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      body.innerHTML = mouvements.map(m => `
        <tr>
          <td class="rowMeta num" style="padding:7px 4px;">${fmtDate(m.date_mouvement)}</td>
          <td style="padding:7px 4px;">${TYPE_MVT_LABEL[m.type_mouvement] || m.type_mouvement}</td>
          <td style="padding:7px 4px;"><span class="pill ${m.sens === 'ENTREE' ? 'good' : 'warn'}">${m.sens === 'ENTREE' ? 'Entrée' : 'Sortie'}</span></td>
          <td class="num" style="padding:7px 4px;">${m.quantite}</td>
          <td class="rowMeta" style="padding:7px 4px;">${SOURCE_TYPE_LABEL[m.source_type] || m.source_type || '—'}</td>
        </tr>`).join('');
    }
    document.getElementById('repartitionModalOverlay').classList.add('open');
  }
  document.getElementById('repartitionModalCloseBtn').addEventListener('click', () => document.getElementById('repartitionModalOverlay').classList.remove('open'));
  document.getElementById('repartitionCloseFooterBtn').addEventListener('click', () => document.getElementById('repartitionModalOverlay').classList.remove('open'));

  function renderDashboard() {
    renderAFaire();
    renderGraphVentes();
    document.getElementById('dashboardDateSub').textContent = `Vue d'ensemble de l'activité — ${new Date().toLocaleDateString('fr-TN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    // ---------- KPI (compteurs simples) ----------
    const kpis = document.querySelectorAll('#view-dashboard .kpiCard .val');
    if (kpis[0]) kpis[0].textContent = `${APP_DATA.produits.length}`;
    if (kpis[1]) kpis[1].textContent = `${APP_DATA.commandes.filter(c => c.statut === 'en_attente').length}`;
    if (kpis[2]) kpis[2].textContent = `${APP_DATA.lots.filter(l => l.statut === 'BLOQUE' || l.statut === 'QUARANTAINE').length}`;
    if (kpis[3]) kpis[3].textContent = `${APP_DATA.commandes.length}`;

    // ---------- Alertes prioritaires — calculées, cliquables, pas juste des compteurs ----------
    const alertes = [];

    // Stock bas : deux cas distincts, volontairement séparés —
    // 1) rupture TOTALE (stock à zéro) : toujours signalée, même si aucun
    //    seuil "stock_min" n'a jamais été configuré sur la fiche produit.
    // 2) sous le seuil personnalisé : seulement pour les produits qui ont un
    //    stock_min explicitement défini.
    const stockParProduit = {};
    APP_DATA.lots.filter(l => l.statut === 'LIBERE').forEach(l => {
      stockParProduit[l.produit_id] = (stockParProduit[l.produit_id] || 0) + Number(l.quantite_actuelle);
    });
    const produitsRupture = APP_DATA.produits.filter(p =>
      (p.vendable || p.fabriquable) && (stockParProduit[p.id] || 0) === 0
    );
    const produitsSousSeuil = APP_DATA.produits.filter(p =>
      p.stock_min != null && (stockParProduit[p.id] || 0) > 0 && (stockParProduit[p.id] || 0) < Number(p.stock_min)
    );
    if (produitsRupture.length) {
      const ids = produitsRupture.map(p => p.id);
      alertes.push({
        gravite: 'danger',
        texte: `<b>${produitsRupture.length} produit${produitsRupture.length > 1 ? 's' : ''}</b> en rupture totale — ${produitsRupture.slice(0, 3).map(p => esc(p.nom)).join(', ')}${produitsRupture.length > 3 ? '…' : ''}`,
        action: () => allerVersProduitsFiltres(ids),
      });
    }
    if (produitsSousSeuil.length) {
      const ids = produitsSousSeuil.map(p => p.id);
      alertes.push({
        gravite: 'warn',
        texte: `<b>${produitsSousSeuil.length} produit${produitsSousSeuil.length > 1 ? 's' : ''}</b> sous son seuil de stock — ${produitsSousSeuil.slice(0, 3).map(p => esc(p.nom)).join(', ')}${produitsSousSeuil.length > 3 ? '…' : ''}`,
        action: () => allerVersProduitsFiltres(ids),
      });
    }

    // Commandes en attente depuis plus de 48h.
    const il_y_a_48h = Date.now() - 48 * 60 * 60 * 1000;
    const commandesEnRetard = APP_DATA.commandes.filter(c => c.statut === 'en_attente' && new Date(c.date_iso).getTime() < il_y_a_48h);
    if (commandesEnRetard.length) {
      alertes.push({
        gravite: 'warn',
        texte: `<b>${commandesEnRetard.length} commande${commandesEnRetard.length > 1 ? 's' : ''}</b> en attente depuis plus de 48h`,
        action: () => document.querySelector('a[data-view="commandes"]').dispatchEvent(new Event('click', { bubbles: true })),
      });
    }

    // Lots bloqués ou en quarantaine.
    const lotsBloques = APP_DATA.lots.filter(l => l.statut === 'BLOQUE' || l.statut === 'QUARANTAINE');
    if (lotsBloques.length) {
      alertes.push({
        gravite: 'danger',
        texte: `<b>${lotsBloques.length} lot${lotsBloques.length > 1 ? 's' : ''}</b> bloqué${lotsBloques.length > 1 ? 's' : ''} ou en quarantaine`,
        action: () => document.querySelector('a[data-view="lots"]').dispatchEvent(new Event('click', { bubbles: true })),
      });
    }

    // Péremption : lots encore actifs dont la date d'expiration est dépassée
    // (déjà exclus des ventes par l'API) ou atteinte dans les 30 jours.
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const joursAvantExpiration = l => Math.round((new Date(l.date_expiration) - aujourdhui) / 864e5);
    const lotsActifsDates = APP_DATA.lots.filter(l =>
      l.date_expiration && (l.statut === 'LIBERE' || l.statut === 'QUARANTAINE') && Number(l.quantite_actuelle) > 0
    );
    const lotsPerimes = lotsActifsDates.filter(l => joursAvantExpiration(l) < 0);
    const lotsBientotPerimes = lotsActifsDates.filter(l => joursAvantExpiration(l) >= 0 && joursAvantExpiration(l) <= 30);
    if (lotsPerimes.length) {
      alertes.push({
        gravite: 'danger',
        texte: `<b>${lotsPerimes.length} lot${lotsPerimes.length > 1 ? 's' : ''}</b> périmé${lotsPerimes.length > 1 ? 's' : ''} encore en stock — ${lotsPerimes.slice(0, 3).map(l => esc(l.numero_lot)).join(', ')}${lotsPerimes.length > 3 ? '…' : ''} (cliquer pour les passer au statut Expiré)`,
        action: () => expirerLotsPerimes(lotsPerimes),
      });
    }
    if (lotsBientotPerimes.length) {
      const prochain = lotsBientotPerimes.reduce((a, b) => joursAvantExpiration(a) <= joursAvantExpiration(b) ? a : b);
      const j = joursAvantExpiration(prochain);
      alertes.push({
        gravite: 'warn',
        texte: `<b>${lotsBientotPerimes.length} lot${lotsBientotPerimes.length > 1 ? 's' : ''}</b> expire${lotsBientotPerimes.length > 1 ? 'nt' : ''} dans les 30 jours — le plus proche : ${esc(prochain.numero_lot)} (${esc(prochain.produit_nom || '')}) ${j === 0 ? "aujourd'hui" : `dans ${j} jour${j > 1 ? 's' : ''}`}`,
        action: () => document.querySelector('a[data-view="lots"]').dispatchEvent(new Event('click', { bubbles: true })),
      });
    }

    // Factures avec solde impayé depuis plus de 15 jours.
    const il_y_a_15j = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const facturesEnRetard = APP_DATA.factures.filter(f => f.statut !== 'annulee' && Number(f.solde) > 0 && new Date(f.date_emission).getTime() < il_y_a_15j);
    if (facturesEnRetard.length) {
      const montant = facturesEnRetard.reduce((s, f) => s + Number(f.solde), 0);
      alertes.push({
        gravite: 'warn',
        texte: `<b>${facturesEnRetard.length} facture${facturesEnRetard.length > 1 ? 's' : ''}</b> impayée${facturesEnRetard.length > 1 ? 's' : ''} depuis plus de 15 jours — ${fmtDT(montant)} en attente`,
        action: () => document.querySelector('a[data-view="factures"]').dispatchEvent(new Event('click', { bubbles: true })),
      });
    }

    const panelAlertes = document.getElementById('dashboardAlertesPanel');
    const boxAlertes = document.getElementById('dashboardAlertes');
    if (alertes.length) {
      alertes.sort((a, b) => (a.gravite === 'danger' ? 0 : 1) - (b.gravite === 'danger' ? 0 : 1));
      panelAlertes.style.display = 'block';
      boxAlertes.innerHTML = alertes.map((a, i) => `
        <div class="alerteRow ${a.gravite === 'danger' ? 'danger' : ''}" data-idx="${i}">
          <span class="alerteBadge">${a.gravite === 'danger' ? 'Urgent' : 'Attention'}</span>
          <span class="alerteTexte">${a.texte}</span>
          <span class="alerteFleche">Voir →</span>
        </div>`).join('');
      boxAlertes.querySelectorAll('.alerteRow').forEach(el => {
        el.addEventListener('click', () => alertes[Number(el.dataset.idx)].action());
      });
    } else {
      panelAlertes.style.display = 'none';
    }

    // ---------- Stock par famille (catégorie) ----------
    const stockFamilleBox = document.getElementById('dashboardStockFamille');
    if (stockFamilleBox) {
      const parCategorie = {};
      APP_DATA.lots.filter(l => l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0).forEach(l => {
        const produit = APP_DATA.produits.find(p => p.id === l.produit_id);
        const cat = produit ? REF_DATA.categories.find(c => c.id === produit.categorie_id) : null;
        const nom = cat ? cat.nom : 'Autre';
        parCategorie[nom] = (parCategorie[nom] || 0) + 1;
      });
      const entries = Object.entries(parCategorie).sort((a, b) => b[1] - a[1]);
      stockFamilleBox.innerHTML = entries.length
        ? entries.map(([nom, n]) => `<div class="stockFamilleCard"><div class="nom">${nom}</div><div class="val">${n} lot${n > 1 ? 's' : ''}</div></div>`).join('')
        : `<div class="rowMeta">Aucun stock disponible pour l'instant.</div>`;
    }

    // ---------- Pipeline de production — où se trouve le stock, par étape ----------
    const pipelineBox = document.getElementById('dashboardPipeline');
    if (pipelineBox) {
      const ETAPES = [
        { origine: 'RECEPTION_MP', label: 'Matière première' },
        { origine: 'ACHAT', label: 'Achat direct' },
        { origine: 'PRESSE', label: 'Pressé (vrac)' },
        { origine: 'FILTRATION', label: 'Filtré (vrac)' },
        { origine: 'CONDITIONNEMENT', label: 'Conditionné' },
      ];
      const lotsLibres = APP_DATA.lots.filter(l => l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0);
      pipelineBox.innerHTML = ETAPES.map(e => {
        const n = lotsLibres.filter(l => l.origine === e.origine).length;
        return `<div style="flex:1; min-width:130px; background:var(--sand); border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:22px; font-weight:700; color:var(--brass);">${n}</div>
          <div style="font-size:11px; color:var(--text-soft); margin-top:2px;">${e.label}</div>
          <div style="font-size:10px; color:var(--text-soft);">lot${n > 1 ? 's' : ''}</div>
        </div>`;
      }).join('<div style="align-self:center; color:var(--text-soft); font-size:16px;">→</div>');
    }

    // ---------- Meilleures ventes (top 5, résumé) ----------
    apiFetch('/stats/top-produits?limit=5').then(top => {
      const body = document.getElementById('dashboardTopVentesBody');
      body.innerHTML = top.length
        ? top.map(p => `<tr><td>${esc(p.produit_nom)}</td><td class="num">${p.quantite_totale}</td></tr>`).join('')
        : `<tr><td colspan="2" class="rowMeta" style="text-align:center; padding:16px;">Aucune vente pour l'instant.</td></tr>`;
    }).catch(() => {});

    // ---------- Contrôle de cohérence du stock (quantité des lots = mouvements) ----------
    apiFetch('/controle-stock').then(ctrl => {
      if (ctrl.ok) return;
      const negatifs = ctrl.lots.filter(l => l.negatif).length;
      const row = document.createElement('div');
      document.querySelectorAll('#dashboardAlertes .alerteEcartStock').forEach(el => el.remove()); // appels rapprochés
      row.className = 'alerteRow danger alerteEcartStock';
      row.innerHTML = `
        <span class="alerteBadge">Urgent</span>
        <span class="alerteTexte"><b>${ctrl.nb_lots_en_ecart} lot${ctrl.nb_lots_en_ecart > 1 ? 's' : ''}</b> avec un écart de stock (quantité ≠ historique des mouvements)${negatifs ? ` dont ${negatifs} négatif${negatifs > 1 ? 's' : ''}` : ''} — ${ctrl.lots.slice(0, 3).map(l => esc(l.numero_lot)).join(', ')}${ctrl.lots.length > 3 ? '…' : ''} (cliquer pour régulariser)</span>
        <span class="alerteFleche">Voir →</span>`;
      row.addEventListener('click', () => regulariserEcartsStock(ctrl));
      document.getElementById('dashboardAlertesPanel').style.display = 'block';
      document.getElementById('dashboardAlertes').prepend(row);
    }).catch(() => {});

    // ---------- Alerte marge faible ----------
    apiFetch('/stats/marge-faible?seuil=15').then(produits => {
      const panel = document.getElementById('dashboardMargePanel');
      const body = document.getElementById('dashboardMargeBody');
      if (produits.length) {
        panel.style.display = 'block';
        body.innerHTML = produits.map(p => `
          <tr>
            <td>${esc(p.nom)}</td>
            <td class="num" style="color:${p.marge_pct < 0 ? 'var(--danger)' : 'var(--warn, #b8860b)'};">${p.marge_pct}%</td>
          </tr>`).join('');
      } else {
        panel.style.display = 'none';
      }
    }).catch(() => {});

    renderDashboardActivite();
    majBadgesMenu();
  }

  // Compteurs du menu, calculés à partir des données réelles (avant : valeurs
  // fixes de maquette). Masqués quand ils valent zéro.
  function majBadgesMenu() {
    const af = aFaireVente();
    const compteurs = {
      commandes: { n: af.confirmer, titre: 'commande(s) à confirmer' },
      livraisons: { n: af.livrer, titre: 'commande(s) à livrer' },
      proformas: { n: af.valider, titre: 'facture(s) en attente à valider' },
      factures: { n: af.facturer, titre: 'commande(s) à facturer' },
      paiements: { n: af.encaisser, titre: 'facture(s) à encaisser' },
      produits: { n: APP_DATA.produits.length, titre: 'produit(s) au catalogue' },
      lots: { n: APP_DATA.lots.filter(l => Number(l.quantite_actuelle) > 0 && !['EPUISE', 'CLOTURE', 'REJETE'].includes(l.statut)).length, titre: 'lot(s) en stock' },
      fournisseurs: { n: APP_DATA.fournisseurs.length, titre: 'fournisseur(s)' },
    };
    Object.entries(compteurs).forEach(([vue, { n, titre }]) => {
      const badge = document.querySelector(`.navChildren a[data-view="${vue}"] .cnt`);
      if (!badge) return;
      badge.textContent = n;
      badge.title = `${n} ${titre}`;
      badge.style.display = n ? '' : 'none';
    });
    majFilVente();
  }

  async function regulariserEcartsStock(ctrl) {
    const detail = ctrl.lots.slice(0, 12).map(l =>
      `• ${l.numero_lot} (${l.produit_nom || ''}) : en stock ${l.quantite_actuelle}, selon mouvements ${l.selon_mouvements}${l.negatif ? ' — NÉGATIF' : ''}`
    ).join('\n');
    if (!(await confirmer(`${detail}${ctrl.lots.length > 12 ? '\n…' : ''}\n\nUn mouvement « Ajustement » sera ajouté pour que l'historique corresponde à la quantité en stock (un lot négatif est ramené à zéro).\nPour connaître la quantité physique réelle, faites ensuite un inventaire de ces lots.`, { titre: `Régulariser ${ctrl.nb_lots_en_ecart} lot(s) en écart ?`, ok: 'Régulariser' }))) return;
    try {
      const r = await apiFetch('/controle-stock/regulariser', { method: 'POST', body: JSON.stringify({ employe_id: CURRENT_USER && CURRENT_USER.employe_id }) });
      const [lots, mouvements] = await Promise.all([apiFetch('/lots'), apiFetch('/stock-mouvements')]);
      APP_DATA.lots = lots; APP_DATA.stockMouvements = mouvements;
      renderLotsRegistre(); renderStockMouvements(); renderDashboard();
      notifier(`${r.regularises} lot(s) régularisé(s).`, 'succes');
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  async function expirerLotsPerimes(lots) {
    const liste = lots.slice(0, 10).map(l => `• ${l.numero_lot} — ${l.produit_nom || ''}`).join('\n');
    if (!(await confirmer(`${liste}${lots.length > 10 ? '\n…' : ''}\n\nIls ne sont déjà plus proposés à la vente ; ce changement est tracé dans l'historique de chaque lot.`, { titre: `Passer ${lots.length} lot(s) périmé(s) au statut « Expiré » ?`, ok: 'Passer en Expiré' }))) return;
    try {
      const r = await apiFetch('/alertes/peremption/expirer', { method: 'POST', body: JSON.stringify({ employe_id: CURRENT_USER && CURRENT_USER.employe_id }) });
      APP_DATA.lots = await apiFetch('/lots');
      renderLotsRegistre(); renderDashboard();
      notifier(`${r.expires} lot(s) passé(s) au statut Expiré.`, 'succes');
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  // Activité récente RÉELLE — combine les dernières opérations de tous les
  // modules (avant : table figée avec des données fictives jamais reliées).
  function renderDashboardActivite() {
    const body = document.getElementById('dashboardActiviteBody');
    if (!body) return;
    const items = [];
    (APP_DATA.commandes || []).forEach(c => items.push({
      date: c.date_iso, type: 'Vente', detail: `${c.numero} — ${c.client_nom || 'Client'}`, montant: c.total,
    }));
    (APP_DATA.receptions || []).forEach(r => items.push({
      date: r.date_reception, type: r.achat_id ? 'Réception (achat)' : 'Réception MP',
      detail: `${r.numero} — ${r.fournisseur_nom || 'Fournisseur'} (${r.nb_lignes || 0} ligne${r.nb_lignes > 1 ? 's' : ''})`, montant: null,
    }));
    (APP_DATA.lotsPresse || []).forEach(p => items.push({
      date: p.date, type: 'Presse', detail: `${p.produit_nom || ''} — lot ${p.numero_lot} (${p.quantite_produite} produits)`, montant: null,
    }));
    (APP_DATA.lotsFiltration || []).forEach(f => items.push({
      date: f.date, type: 'Filtration', detail: `${f.produit_nom || ''} — lot ${f.numero_lot} (${f.quantite_produite} produits)`, montant: null,
    }));
    (APP_DATA.conditionnements || []).forEach(c => items.push({
      date: c.date, type: 'Conditionnement', detail: `${c.produit_nom || ''} — lot ${c.numero_lot} (${c.qty} unités)`, montant: null,
    }));
    (APP_DATA.factures || []).forEach(f => items.push({
      date: f.date_emission, type: f.statut === 'annulee' ? 'Facture annulée' : 'Facture émise',
      detail: `${f.numero} — ${f.client_nom || ''}`, montant: f.total_ttc,
    }));

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = items.slice(0, 10);
    if (!recent.length) {
      body.innerHTML = `<tr><td colspan="4" class="rowMeta" style="text-align:center; padding:22px;">Aucune activité pour l'instant.</td></tr>`;
      return;
    }
    body.innerHTML = recent.map(it => `
      <tr>
        <td class="num rowMeta">${fmtDate(it.date)}</td>
        <td>${esc(it.type)}</td>
        <td class="rowMeta">${it.detail}</td>
        <td class="num">${it.montant != null ? fmtDT(it.montant) : '—'}</td>
      </tr>`).join('');
  }

  const pillFor = statut => `<span class="pill ${STATUT_PILL[statut]||'grey'}">${STATUT_LABEL[statut]||statut}</span>`;

  // Le menu "Type de lot" est dérivé des origines réellement présentes dans
  // /api/lots (plus fiable qu'une liste figée qui pourrait diverger du schéma).
  function tracPopulateTypes(){
    const types = ['Tous types', ...new Set(APP_DATA.lots.map(l => l.origine))];
    const sel = document.getElementById('tracType');
    const prev = sel.value;
    sel.innerHTML = types.map(t=>`<option value="${t}">${t}</option>`).join('');
    if (types.includes(prev)) sel.value = prev;
  }
  function tracPopulateLots(){
    const type = document.getElementById('tracType').value;
    const list = APP_DATA.lots.filter(l => type==='Tous types' || l.origine===type);
    const sel = document.getElementById('tracLot');
    sel.innerHTML = list.map(l=>`<option value="${esc(l.numero_lot)}">${esc(l.numero_lot)} — ${esc(l.produit_nom||'')}</option>`).join('');
  }
  // Niveau dans la chaîne (1 = lien direct) et lot voisin : « utilisé dans » (amont) / « issu de » (aval).
  function tracLien(r, amont) {
    if (!r.niveau) return '';
    return `<div style="font-size:11px;">${r.niveau > 1 ? `niveau ${r.niveau} · ` : ''}${amont ? 'utilisé dans' : 'issu de'} ${esc(r.lot_voisin || '')}</div>`;
  }
  function tracRenderTable(tbodyId, rows){
    const tbody = document.getElementById(tbodyId);
    const amont = tbodyId === 'tracAscendants';
    if(!rows.length){
      tbody.innerHTML = `<tr><td colspan="6" class="rowMeta" style="text-align:center; padding:22px;">Aucun lot dans cette direction — extrémité de la chaîne.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td class="lotCode">${esc(r.numero_lot)}</td>
        <td>${r.produit||'—'}</td>
        <td class="rowMeta">${esc(r.origine || r.type)}${tracLien(r, amont)}</td>
        <td class="num rowMeta">${fmtDate(r.date)}</td>
        <td class="num">${r.qte_utilisee ?? r.quantite ?? '—'}</td>
        <td class="num rowMeta">${r.qte_produite ?? '—'}</td>
      </tr>`).join('');
  }
  let TRAC_CURRENT_CHAIN = []; // dernière chaîne calculée, utilisée par les exports
  function tracRenderChaineComplete(lot, ascendants, descendants){
    // Du plus lointain (lots de graines) au plus proche, puis le lot choisi, puis l'aval.
    const amont = [...ascendants].sort((a, b) => (b.niveau || 1) - (a.niveau || 1));
    const aval = [...descendants].sort((a, b) => (a.niveau || 1) - (b.niveau || 1));
    const niv = (r) => (r.niveau > 1 ? ` · niv. ${r.niveau}` : '');
    const rows = [
      ...amont.map(r => ({direction:`↑ Ascendant${niv(r)}`, numero:r.numero_lot, produit:r.produit, origine:`${r.origine||r.type} → ${r.lot_voisin || ''}`, date:fmtDate(r.date), qte_utilisee:r.qte_utilisee ?? r.quantite, qte_produite:r.qte_produite})),
      { direction:'● Sélectionné', numero:lot.numero_lot, produit:lot.produit_nom, origine:lot.origine, date:fmtDate(lot.date_production||lot.created_at), qte_utilisee:'—', qte_produite:lot.quantite_initiale },
      ...aval.map(r => ({direction:`↓ Descendant${niv(r)}`, numero:r.numero_lot, produit:r.produit, origine:`${r.origine||r.type} ← ${r.lot_voisin || ''}`, date:fmtDate(r.date), qte_utilisee:r.qte_utilisee ?? r.quantite, qte_produite:r.qte_produite})),
    ];
    TRAC_CURRENT_CHAIN = rows;
    document.getElementById('tracChaineComplete').innerHTML = rows.map(r=>`
      <tr>
        <td class="rowMeta">${r.direction}</td>
        <td class="lotCode">${esc(r.numero)}</td>
        <td>${r.produit||'—'}</td>
        <td class="rowMeta">${esc(r.origine)}</td>
        <td class="num rowMeta">${r.date}</td>
        <td class="num">${r.qte_utilisee ?? '—'}</td>
        <td class="num rowMeta">${r.qte_produite ?? '—'}</td>
      </tr>`).join('');
  }
  async function tracRunSearch(){
    const numero = document.getElementById('tracLot').value;
    if (!numero) return;
    try {
      const data = await apiFetch(`/lots/${encodeURIComponent(numero)}/tracabilite`);
      const lot = data.lot;
      const champsPersoHtml = (() => {
        if (!lot.champs_perso) return '';
        const obj = typeof lot.champs_perso === 'string' ? JSON.parse(lot.champs_perso) : lot.champs_perso;
        const entries = Object.entries(obj).filter(([, v]) => v !== '' && v != null);
        if (!entries.length) return '';
        return `<div class="rowMeta" style="width:100%; margin-top:6px; padding-top:6px; border-top:1px dashed var(--line);">
          ${entries.map(([k, v]) => `<b>${k} :</b> ${v === true ? 'Oui' : v === false ? 'Non' : v}`).join(' &nbsp;•&nbsp; ')}
        </div>`;
      })();
      document.getElementById('tracSelectedBanner').innerHTML = `
        <span class="lotCode" style="font-size:14px; padding:5px 10px;">${esc(lot.numero_lot)}</span>
        <div style="flex:1; min-width:160px;">
          <div style="font-weight:600; font-size:13.5px;">${esc(lot.produit_nom||'')}</div>
          <div class="rowMeta">${esc(lot.origine)} — créé le ${fmtDate(lot.date_production||lot.created_at)}</div>
        </div>
        ${pillFor(lot.statut)}
        ${champsPersoHtml}`;
      tracRenderTable('tracAscendants', data.ascendants);
      tracRenderTable('tracDescendants', data.descendants);
      tracRenderChaineComplete(lot, data.ascendants, data.descendants);
    } catch (err) {
      document.getElementById('tracSelectedBanner').innerHTML = `<span class="rowMeta" style="color:var(--danger);">${esc(err.message)}</span>`;
    }
  }
  document.getElementById('tracType').addEventListener('change', tracPopulateLots);
  document.getElementById('tracSearchBtn').addEventListener('click', tracRunSearch);

