  // ---------- Bouton "＋ Nouveau" contextuel à l'écran affiché ----------
  // ============================================================================
  // RECHERCHE GLOBALE — cherche dans produits, clients, fournisseurs, lots,
  // commandes et factures en même temps ; cliquer un résultat navigue direct
  // vers l'écran concerné (et pré-remplit le filtre de recherche de cet écran
  // quand il existe, ex: Stock).
  // ============================================================================
  function normaliserRecherche(s) {
    return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  // Filtre générique texte + période, réutilisé par Presse/Filtration/
  // Conditionnement/Historique/Commandes — cherche les inputs
  // #{prefixe}FilterTexte / FilterDateDebut / FilterDateFin s'ils existent.
  function filtrerParTexteEtDate(items, prefixe, texteAccessor, dateAccessor) {
    let rows = items;
    const texteEl = document.getElementById(`${prefixe}FilterTexte`);
    const texte = texteEl ? normaliserRecherche(texteEl.value) : '';
    if (texte) rows = rows.filter(item => normaliserRecherche(texteAccessor(item)).includes(texte));
    const debut = document.getElementById(`${prefixe}FilterDateDebut`)?.value;
    const fin = document.getElementById(`${prefixe}FilterDateFin`)?.value;
    if (debut) rows = rows.filter(item => (dateAccessor(item) || '').slice(0, 10) >= debut);
    if (fin) rows = rows.filter(item => (dateAccessor(item) || '').slice(0, 10) <= fin);
    return rows;
  }
  // Câble les 3 champs de filtre + le bouton réinitialiser pour un préfixe
  // donné, en appelant renderFn à chaque changement.
  function cablerFiltresTexteEtDate(prefixe, renderFn) {
    ['FilterTexte', 'FilterDateDebut', 'FilterDateFin'].forEach(suffix => {
      const el = document.getElementById(`${prefixe}${suffix}`);
      if (el) el.addEventListener('input', renderFn);
    });
    const resetBtn = document.getElementById(`${prefixe}FilterResetBtn`);
    if (resetBtn) resetBtn.addEventListener('click', () => {
      ['FilterTexte', 'FilterDateDebut', 'FilterDateFin'].forEach(suffix => {
        const el = document.getElementById(`${prefixe}${suffix}`);
        if (el) el.value = '';
      });
      renderFn();
    });
  }
  function globalSearchResultats(terme) {
    const t = normaliserRecherche(terme.trim());
    if (t.length < 2) return [];
    const resultats = [];

    APP_DATA.produits.filter(p => normaliserRecherche(p.nom).includes(t) || normaliserRecherche(p.code).includes(t)).slice(0, 6)
      .forEach(p => resultats.push({ cat: 'Produit', label: p.nom, sousLabel: p.code, view: 'produits', action: () => openProduitModal(p.id) }));

    APP_DATA.clients.filter(c => normaliserRecherche(c.nom).includes(t)).slice(0, 6)
      .forEach(c => resultats.push({ cat: 'Client', label: c.nom, sousLabel: c.ville || '', view: 'clients', action: () => openClientModal(c.id) }));

    APP_DATA.fournisseurs.filter(f => normaliserRecherche(f.nom).includes(t)).slice(0, 6)
      .forEach(f => resultats.push({ cat: 'Fournisseur', label: f.nom, sousLabel: f.localisation || '', view: 'fournisseurs', action: () => openFournisseurModal(f.id) }));

    APP_DATA.lots.filter(l => normaliserRecherche(l.numero_lot).includes(t)).slice(0, 6)
      .forEach(l => resultats.push({
        cat: 'Lot', label: l.numero_lot, sousLabel: l.produit_nom || '', view: 'tracabilite',
        action: () => { document.getElementById('tracLot').value = l.numero_lot; tracRunSearch(); },
      }));

    APP_DATA.commandes.filter(c => normaliserRecherche(c.numero).includes(t) || normaliserRecherche(c.client_nom).includes(t)).slice(0, 6)
      .forEach(c => resultats.push({ cat: 'Commande', label: c.numero, sousLabel: c.client_nom || '', view: 'commandes', action: () => openCommandeModal(c.id) }));

    APP_DATA.factures.filter(f => normaliserRecherche(f.numero).includes(t) || normaliserRecherche(f.client_nom).includes(t)).slice(0, 6)
      .forEach(f => resultats.push({ cat: 'Facture', label: f.numero, sousLabel: f.client_nom || '', view: 'factures', action: null }));

    return resultats.slice(0, 20);
  }
  function renderGlobalSearchResults(resultats, terme) {
    const box = document.getElementById('globalSearchResults');
    if (!terme || terme.trim().length < 2) { box.style.display = 'none'; return; }
    if (!resultats.length) {
      box.innerHTML = `<div style="padding:14px; color:var(--text-soft); font-size:12.5px;">Aucun résultat pour "${terme}".</div>`;
      box.style.display = 'block';
      return;
    }
    let derniereCat = null;
    box.innerHTML = resultats.map((r, i) => {
      const enTeteCat = r.cat !== derniereCat
        ? `<div style="padding:6px 12px 2px; font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--text-soft);">${r.cat}</div>`
        : '';
      derniereCat = r.cat;
      return `${enTeteCat}<div class="globalSearchItem" data-idx="${i}" style="padding:8px 12px; cursor:pointer; border-radius:5px;">
        <div style="font-size:13px; font-weight:500;">${r.label}</div>
        ${r.sousLabel ? `<div style="font-size:11px; color:var(--text-soft);">${r.sousLabel}</div>` : ''}
      </div>`;
    }).join('');
    box.style.display = 'block';
    box.querySelectorAll('.globalSearchItem').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'var(--sand)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('click', () => {
        const r = resultats[Number(el.dataset.idx)];
        document.querySelector(`a[data-view="${r.view}"]`)?.dispatchEvent(new Event('click', { bubbles: true }));
        setTimeout(() => { if (r.action) r.action(); }, 150);
        document.getElementById('globalSearch').value = '';
        box.style.display = 'none';
      });
    });
  }
  let globalSearchTimeout = null;
  document.getElementById('globalSearch').addEventListener('input', (e) => {
    clearTimeout(globalSearchTimeout);
    const terme = e.target.value;
    globalSearchTimeout = setTimeout(() => renderGlobalSearchResults(globalSearchResultats(terme), terme), 120);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.searchWrap')) document.getElementById('globalSearchResults').style.display = 'none';
  });
  document.getElementById('globalSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; document.getElementById('globalSearchResults').style.display = 'none'; }
    // Entrée sur un n° de lot exact (saisi ou scanné depuis le QR d'une étiquette) :
    // ouverture directe de sa traçabilité.
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      const lot = APP_DATA.lots.find(l => l.numero_lot.toLowerCase() === code.toLowerCase());
      if (!lot) return;
      clearTimeout(globalSearchTimeout);
      document.querySelector('a[data-view="tracabilite"]')?.dispatchEvent(new Event('click', { bubbles: true }));
      setTimeout(() => { document.getElementById('tracLot').value = lot.numero_lot; tracRunSearch(); }, 150);
      e.target.value = '';
      document.getElementById('globalSearchResults').style.display = 'none';
    }
  });

  const NOUVEAU_HANDLERS = {
    produits: () => openProduitModal(null),
    clients: () => openClientModal(null),
    fournisseurs: () => openFournisseurModal(null),
    locaux: () => openLocalModal(null),
    employes: () => openEmployeModal(null),
    presse: () => openPresseModal(),
    filtration: () => openFiltrationModal(),
    melanges: () => openMelangeModal(),
    conditionnement: () => openConditionnementModal(),
    commandes: () => openCommandeModal(),
    utilisateurs: () => openUserModal(null),
    recettes: () => openRecetteModal(null),
    'historique-prod': () => openOrdreProdModal(),
    'grille-prix': () => openGrilleModal(null),
    remises: () => openRemiseModal(null),
    achats: () => openAchatModal(),
    receptions: () => openReceptionModal(),
    lots: () => openLotManuelModal(),
    inventaires: () => document.getElementById('invLocal').focus(),
    certificats: () => openCertificatModal(null),
  };
  // Actions rapides du Tableau de bord — navigue vers l'écran concerné PUIS
  // ouvre directement la modale de création, en un seul clic.
  function actionRapide(view) {
    document.querySelector(`a[data-view="${view}"]`)?.dispatchEvent(new Event('click', { bubbles: true }));
    setTimeout(() => NOUVEAU_HANDLERS[view]?.(), 150);
  }
  document.getElementById('qaCommande')?.addEventListener('click', () => actionRapide('commandes'));
  document.getElementById('qaReception')?.addEventListener('click', () => actionRapide('receptions'));
  document.getElementById('qaPresse')?.addEventListener('click', () => actionRapide('presse'));
  document.getElementById('qaConditionnement')?.addEventListener('click', () => actionRapide('conditionnement'));
  document.getElementById('qaClient')?.addEventListener('click', () => actionRapide('clients'));
  const GERANT_ONLY_VIEWS = new Set(['utilisateurs', 'remises', 'grille-prix', 'journal', 'qualite-parametres']);
  document.getElementById('btnNouveau').addEventListener('click', () => {
    if (GERANT_ONLY_VIEWS.has(CURRENT_VIEW_KEY) && !isGerant()) {
      notifier("Réservé au rôle Gérant.");
      return;
    }
    const handler = NOUVEAU_HANDLERS[CURRENT_VIEW_KEY];
    if (handler) handler();
    else notifier("La création n'est pas encore disponible pour cet écran.");
  });

  let COMMANDES_FILTER = '';
  // « Payée » n'est pas choisi à la main : il suit l'encaissement de la facture.
  const STATUTS_COMMANDE = { en_attente: 'En attente', confirmee: 'Confirmée', livree: 'Livrée' };
  function renderCommandes() {
    const body = document.getElementById('commandesBody');

    let rows = COMMANDES_FILTER ? APP_DATA.commandes.filter(c => c.statut === COMMANDES_FILTER) : APP_DATA.commandes;
    const texte = normaliserRecherche(document.getElementById('commandesFilterTexte')?.value || '');
    if (texte) rows = rows.filter(c => normaliserRecherche(c.client_nom).includes(texte) || normaliserRecherche(c.numero).includes(texte));
    const debut = document.getElementById('commandesFilterDateDebut')?.value;
    const fin = document.getElementById('commandesFilterDateFin')?.value;
    if (debut) rows = rows.filter(c => (c.date_iso || '').slice(0, 10) >= debut);
    if (fin) rows = rows.filter(c => (c.date_iso || '').slice(0, 10) <= fin);
    rows = filtreVue('commandes', rows);

    document.getElementById('commandesCount').textContent = `${rows.length} commande${rows.length > 1 ? 's' : ''}`;
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="videAction">${APP_DATA.commandes.length ? 'Aucune commande pour ce filtre.' : 'Aucune commande pour le moment.'}<br>
        ${APP_DATA.commandes.length ? `<button class="btnGhost" onclick="document.getElementById('commandesFilterResetBtn').click(); choisirVue('commandes', 'toutes');">Effacer les filtres</button>` : ''}
        <button class="btnPrimary" onclick="NOUVEAU_HANDLERS.commandes()">＋ Nouvelle commande</button></td></tr>`;
      return;
    }
    const statutLabel = { en_attente: ['warn', 'En attente'], confirmee: ['good', 'Confirmée'], livree: ['grey', 'Livrée'], payee: ['good', 'Payée'], annulee: ['danger', 'Annulée'] };
    const facturees = new Set(APP_DATA.factures.filter(f => f.statut === 'emise').map(f => f.commande_id));
    body.innerHTML = rows.map(c => {
      const partielle = livraisonPartielle(c);
      const [cls, label] = partielle ? ['warn', `Livrée ${partielle.liv}/${partielle.cmd}`] : (statutLabel[c.statut] || ['grey', c.statut]);
      const dejaFacturee = facturees.has(c.id);
      const etape = prochaineEtapeCommande(c);
      return `<tr data-id="${c.id}">
        <td class="lotCode">${esc(c.numero)}</td>
        <td>${esc(c.client_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(c.date_iso)}</td>
        <td><div class="statutCell">
          <span class="pill ${cls}">${label}</span>
          ${c.proforma_numero ? `<span class="rowMeta" title="Facture en attente">${esc(c.proforma_numero)}</span>` : ''}
        </div></td>
        <td class="num">${fmtDT(c.total)}</td>
        <td class="rowActions">
          ${etape ? `<button class="rowActionBtn principal" title="Prochaine étape" onclick="etapeCommande(${c.id})">${etape.court} →</button>`
            : `<span class="rowMeta">${c.statut === 'annulee' ? 'Annulée' : c.statut === 'payee' ? 'Payée' : dejaFacturee ? 'Facturée' : ''}</span>`}
          <button class="rowActionBtn plus" title="Plus d'actions" onclick="ouvrirMenuLigne(event, 'commandesBody', ${c.id})">⋯</button>
        </td>
      </tr>`;
    }).join('');
    cablerMenuContextuel('commandesBody', (id) => {
      const c = APP_DATA.commandes.find(x => x.id === id);
      if (!c) return [];
      const dejaFacturee = APP_DATA.factures.some(f => f.statut === 'emise' && f.commande_id === id);
      const items = [{ label: '✎ Voir / notes', action: () => openCommandeModal(id) }, { label: '🖨 Imprimer le bon de commande', action: () => imprimerBonCommande(id) },
        { label: '⬇ Bon de commande — Word (.docx)', action: () => imprimerBonCommande(id, 'docx') }, { label: '⬇ Bon de commande — Excel (.xlsx)', action: () => imprimerBonCommande(id, 'xlsx') }];
      if (c.statut === 'annulee') return items;
      const reste = Number(c.qte_commandee || 0) - Number(c.qte_livree || 0);
      items.push(null, dejaFacturee ? { label: '🚚 Livrer (bon de livraison)', desactive: 'Facturée : entièrement livrée' }
        : reste <= 0 ? { label: '🚚 Livrer (bon de livraison)', desactive: 'Tout est déjà livré' }
        : { label: '🚚 Livrer… (bon de livraison)', action: () => ouvrirLivraison(id) });
      if (livraisonPartielle(c) && !dejaFacturee) items.push({ label: '✂ Solder le reliquat…', action: () => solderCommande(id) });
      if (!dejaFacturee) {
        items.push({ label: c.proforma_id ? `📝 Facture en attente ${c.proforma_numero}` : '📝 Préparer une facture en attente (pro forma)', action: () => facturerEnAttente(id) });
        items.push({ label: '🧾 Émettre la facture', action: () => emettreFacture(id) });
      }
      // Une fois facturée, le statut suit les documents (facture, paiements) ;
      // après une livraison, impossible de revenir à « en attente » / « confirmée ».
      const dejaLivre = Number(c.qte_livree || 0) > 0;
      const statuts = Object.entries(STATUTS_COMMANDE).filter(([k]) => k !== c.statut
        && !(dejaLivre && (k === 'en_attente' || k === 'confirmee')));
      if (c.statut !== 'payee' && !dejaFacturee && statuts.length) {
        items.push(null);
        statuts.forEach(([k, libelle]) => items.push({ label: `Statut : ${libelle}`, action: () => changerStatutCommande(id, k) }));
      }
      // Toujours visible : grisée avec la raison quand l'annulation n'est pas possible.
      const fac = APP_DATA.factures.find(f => f.statut === 'emise' && f.commande_id === id);
      items.push(null, !isGerant()
        ? { label: 'Annuler la commande', desactive: 'Réservé au gérant' }
        : fac ? { label: 'Annuler la commande', desactive: `Facturée (${fac.numero}) : émettez un avoir sur la facture` }
        : Number(c.nb_bl) > 0 ? { label: 'Annuler la commande', desactive: 'Déjà livrée en partie : soldez le reliquat ou annulez le bon de livraison' }
        : { label: 'Annuler la commande…', danger: true, action: () => annulerCommande(id) });
      return items;
    });
  }
  document.querySelectorAll('#commandesFilterRow .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#commandesFilterRow .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      COMMANDES_FILTER = chip.dataset.filter;
      renderCommandes();
    });
  });
  ['commandesFilterTexte', 'commandesFilterDateDebut', 'commandesFilterDateFin'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderCommandes);
  });
  document.getElementById('commandesFilterResetBtn').addEventListener('click', () => {
    document.getElementById('commandesFilterTexte').value = '';
    document.getElementById('commandesFilterDateDebut').value = '';
    document.getElementById('commandesFilterDateFin').value = '';
    renderCommandes();
  });
  function etapeCommande(id) { const e = prochaineEtapeCommande(APP_DATA.commandes.find(x => x.id === id)); if (e) e.action(); }
  async function changerStatutCommande(id, statut) {
    try {
      await apiFetch(`/commandes/${id}/statut`, { method: 'PUT', body: JSON.stringify({ statut }) });
      APP_DATA.commandes = await apiFetch('/commandes');
      renderCommandes(); majBadgesMenu();
    } catch (err) { notifier(err.message, 'erreur'); renderCommandes(); }
  }

  // Étiquette de lot imprimable (format 70 × 40 mm) avec QR code. Le QR contient
  // le seul numéro de lot : scanné dans la recherche globale, il ouvre le lot.
  function imprimerEtiquetteLot(lotId) {
    const l = APP_DATA.lots.find(x => x.id === lotId);
    if (!l) return;
    const qr = qrcode(0, 'M');
    qr.addData(l.numero_lot);
    qr.make();
    const s = APP_DATA.settings || {};
    const bio = { BIO: 'Bio', EN_CONVERSION: 'En conversion' }[l.bio_status];
    const echapper = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const w = window.open('', '_blank', 'width=420,height=320');
    if (!w) { notifier("La fenêtre d'impression a été bloquée par le navigateur."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Étiquette ${echapper(l.numero_lot)}</title><style>
        @page { size: 70mm 40mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #000; }
        .etiquette { width: 70mm; height: 40mm; padding: 2.5mm; display: flex; gap: 2.5mm; align-items: center; }
        .qr svg { width: 26mm; height: 26mm; display: block; }
        .infos { flex: 1; min-width: 0; font-size: 7.5pt; line-height: 1.3; }
        .entreprise { font-size: 6.5pt; color: #444; text-transform: uppercase; letter-spacing: .3px; }
        .produit { font-weight: bold; font-size: 8.5pt; margin: 1mm 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .lot { font-family: 'Courier New', monospace; font-weight: bold; font-size: 11pt; }
        .bio { display: inline-block; border: 1px solid #000; border-radius: 2px; padding: 0 3px; font-size: 6.5pt; font-weight: bold; margin-top: 1mm; }
        .reste { font-weight: bold; margin-top: .6mm; } .reste small { font-weight: normal; font-size: 6pt; color: #444; }
      </style></head><body>
      <div class="etiquette">
        <div class="qr">${qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true })}</div>
        <div class="infos">
          ${s.entreprise_nom ? `<div class="entreprise">${echapper(s.entreprise_nom)}</div>` : ''}
          <div class="produit">${echapper(l.produit_nom || '')}</div>
          <div class="lot">${echapper(l.numero_lot)}</div>
          ${l.date_production ? `<div>Prod. ${fmtDate(l.date_production)}</div>` : ''}
          ${l.date_expiration ? `<div><b>À utiliser avant ${fmtDate(l.date_expiration)}</b></div>` : ''}
          <div class="reste">Reste : ${echapper(Number(l.quantite_actuelle || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 }))} ${echapper(l.unite_symbole || '')} <small>au ${new Date().toLocaleDateString('fr-FR')}</small></div>
          ${bio ? `<span class="bio">${bio}</span>` : ''}
        </div>
      </div>
      <script>window.onload = () => window.print();<\/script>
      </body></html>`);
    w.document.close();
  }

  // Date d'expiration sous la date de production — orange à 30 jours, rouge si dépassée.
  function celluleExpiration(l) {
    if (!l.date_expiration) return '';
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const j = Math.round((new Date(l.date_expiration) - aujourdhui) / 864e5);
    const actif = Number(l.quantite_actuelle) > 0 && !['EPUISE', 'CLOTURE', 'REJETE'].includes(l.statut);
    const couleur = !actif ? 'var(--text-soft)' : j < 0 ? 'var(--danger)' : j <= 30 ? 'var(--warn)' : 'var(--text-soft)';
    return `<div style="font-size:10.5px; color:${couleur}; ${actif && j <= 30 ? 'font-weight:600;' : ''}">Exp. ${fmtDate(l.date_expiration)}</div>`;
  }

  // Type de lot affiché dans le registre : seuls presse, filtration, mélange et
  // conditionnement y figurent (les entrées matière sont dans Réceptions/Stock).
  function typeLotRegistre(l) {
    if (estLotMelange(l)) return 'melange';
    if (l.origine === 'PRESSE') return 'presse';
    if (l.origine === 'FILTRATION') return 'filtration';
    if (l.origine === 'CONDITIONNEMENT' || l.origine === 'PRODUCTION_RECETTE') return 'conditionnement';
    return null;
  }
  // Tri du registre : par défaut l'ordre du serveur ; sinon une colonne, dans un sens. L'origine suit le déroulé de
  // la fabrication (presse → filtration → mélange → conditionnement) ; à égalité : date récente d'abord, puis n° de lot.
  const LOTS_TRI = { cle: '', sens: 1 };
  const ORDRE_ORIGINE = { presse: 1, filtration: 2, melange: 3, conditionnement: 4 };
  const LOTS_TRI_OPTIONS = [
    ['', 1, 'Ordre habituel'],
    ['origine', 1, 'Origine : presse → conditionnement'], ['origine', -1, 'Origine : conditionnement → presse'],
    ['date', -1, 'Date : récents d\'abord'], ['date', 1, 'Date : anciens d\'abord'],
    ['num', 1, 'N° de lot : A → Z'], ['num', -1, 'N° de lot : Z → A'],
    ['produit', 1, 'Produit : A → Z'], ['produit', -1, 'Produit : Z → A'],
    ['statut', 1, 'Statut : A → Z'],
    ['qte', -1, 'Quantité restante : décroissante'], ['qte', 1, 'Quantité restante : croissante'],
  ];
  const LOTS_TRI_LIBELLES = { num: 'N° Lot', produit: 'Produit', origine: 'Origine', date: 'Date', statut: 'Statut', qte: 'Qté restante' };
  function trierLotsRegistre(rows) {
    const { cle, sens } = LOTS_TRI;
    if (!cle) return rows;
    const texte = (a, b) => String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });
    const date = l => String(l.date_production || l.created_at || '');
    const valeur = {
      num: (a, b) => texte(a.numero_lot, b.numero_lot),
      produit: (a, b) => texte(a.produit_nom, b.produit_nom),
      origine: (a, b) => (ORDRE_ORIGINE[typeLotRegistre(a)] || 9) - (ORDRE_ORIGINE[typeLotRegistre(b)] || 9),
      date: (a, b) => date(a).localeCompare(date(b)),
      statut: (a, b) => texte(a.statut, b.statut),
      qte: (a, b) => Number(a.quantite_actuelle) - Number(b.quantite_actuelle),
    }[cle];
    return [...rows].sort((a, b) => (sens * valeur(a, b)) || date(b).localeCompare(date(a)) || texte(a.numero_lot, b.numero_lot));
  }
  function majEnTetesTriLots() {
    document.querySelectorAll('#lotsHead th[data-tri]').forEach(th => {
      const actif = th.dataset.tri === LOTS_TRI.cle;
      th.textContent = LOTS_TRI_LIBELLES[th.dataset.tri] + (actif ? (LOTS_TRI.sens === 1 ? ' ▲' : ' ▼') : '');
      th.style.cursor = 'pointer'; th.title = 'Cliquer pour trier';
    });
    const sel = document.getElementById('lotsTri');
    if (sel) sel.value = `${LOTS_TRI.cle}|${LOTS_TRI.sens}`;
  }
  (function initTriLots() {
    const sel = document.getElementById('lotsTri');
    sel.innerHTML = LOTS_TRI_OPTIONS.map(([c, s, l]) => `<option value="${c}|${s}">${c ? 'Tri : ' + l : 'Trier par… (ordre habituel)'}</option>`).join('');
    sel.addEventListener('change', () => { const [c, s] = sel.value.split('|'); LOTS_TRI.cle = c; LOTS_TRI.sens = Number(s); renderLotsRegistre(); });
    document.getElementById('lotsHead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-tri]'); if (!th) return;
      const cle = th.dataset.tri;
      // Même colonne : on inverse. Nouvelle colonne : sens naturel (date et quantité : du plus grand au plus petit).
      if (LOTS_TRI.cle === cle) LOTS_TRI.sens = -LOTS_TRI.sens; else { LOTS_TRI.cle = cle; LOTS_TRI.sens = (cle === 'date' || cle === 'qte') ? -1 : 1; }
      renderLotsRegistre();
    });
  })();
  function renderLotsRegistre() {
    const body = document.getElementById('lotsBody');
    const origineChoisie = document.getElementById('lotsFilterOrigine')?.value || '';
    const lotsTypes = APP_DATA.lots.filter(l => { const t = typeLotRegistre(l); return t && (!origineChoisie || t === origineChoisie); });
    const rows = trierLotsRegistre(filtreVue('lots', filtrerParTexteEtDate(lotsTypes, 'lots', l => `${l.produit_nom || ''} ${l.numero_lot}`, l => l.date_production || l.created_at)));
    majEnTetesTriLots();
    if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="rowMeta" style="text-align:center; padding:22px;">Aucun lot pour ce filtre.</td></tr>`; return; }
    const bioLabel = { BIO: '<span class="pill good">Bio</span>', NON_BIO: '<span class="pill grey">Non bio</span>', EN_CONVERSION: '<span class="pill warn">Conversion</span>', A_VERIFIER: '<span class="pill grey">À vérifier</span>', BLOQUE: '<span class="pill danger">Bloqué</span>' };
    body.innerHTML = rows.map(l => `
      <tr data-id="${l.id}">
        <td class="lotCode">${esc(l.numero_lot)}</td>
        <td>${esc(l.produit_nom || '—')}</td>
        <td class="rowMeta">${{ presse: 'Presse', filtration: 'Filtration', melange: 'Mélange', conditionnement: 'Conditionnement' }[typeLotRegistre(l)] || l.origine}</td>
        <td class="rowMeta num">${fmtDate(l.date_production || l.created_at)}${celluleExpiration(l)}</td>
        <td>${bioLabel[l.bio_status] || l.bio_status}</td>
        <td>${pillStatut(l.statut)}</td>
        <td class="num">${l.quantite_actuelle} ${l.unite_symbole || ''}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="openRepartitionModal('${attrJs(l.numero_lot)}')">Répartition</button> <button class="rowActionBtn" onclick="imprimerEtiquetteLot(${l.id})">Étiquette</button> <button class="rowActionBtn" onclick="ouvrirQualite('${attrJs(l.numero_lot)}')">Analyses</button></td>
      </tr>`).join('');
    cablerMenuContextuel('lotsBody', (id) => {
      const l = APP_DATA.lots.find(x => x.id === id);
      if (!l) return [];
      return [
        { label: '📊 Voir la répartition', action: () => openRepartitionModal(l.numero_lot) },
        { label: '🏷 Imprimer l\'étiquette', action: () => imprimerEtiquetteLot(l.id) },
        { label: '🧪 Analyses qualité', action: () => ouvrirQualite(l.numero_lot) },
        { label: '💰 Coût du lot', action: () => ouvrirCoutLot(l.numero_lot) },
        { label: '⚠ Rappel de lot (clients livrés)', action: () => ouvrirRappel(l.numero_lot) },
        { label: '⧉ Voir en Traçabilité', action: () => {
          document.querySelector('a[data-view="tracabilite"]').dispatchEvent(new Event('click', { bubbles: true }));
          setTimeout(() => { const sel = document.getElementById('tracLot'); if (sel) { sel.value = l.numero_lot; tracRunSearch(); } }, 300);
        } },
      ];
    });
  }

