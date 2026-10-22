  // ---------- Données en mémoire (rafraîchies après chaque connexion / action) ----------
  const APP_DATA = { produits: [], clients: [], fournisseurs: [], commandes: [], lots: [], locaux: [], employes: [], lotsPresse: [], lotsFiltration: [], conditionnements: [], factures: [], users: [], recettes: [], ordresProduction: [], grilles: [], settings: null, achats: [], receptions: [], stockMouvements: [], stockResume: [], notifications: [], paiements: [], certificats: [] };

  function fmtDT(n) { return Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT'; }

  // Convertit un nombre entier (0-999999) en toutes lettres françaises —
  // utilisé pour "Arrêtée la présente à la somme de..." sur la facture imprimée.
  function nombreEnLettres(n) {
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
      'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    function centaines(n) {
      if (n === 0) return '';
      if (n < 20) return unites[n];
      if (n < 70 || (n >= 80 && n < 100)) {
        const d = Math.floor(n / 10), u = n % 10;
        if (d === 7 || d === 9) {
          const base = dizaines[d - 1];
          return base + (u === 1 && d === 7 ? ' et onze' : '-' + unites[10 + u]);
        }
        return dizaines[d] + (u === 0 ? (d >= 8 ? 's' : '') : (u === 1 && d < 8 ? ' et un' : '-' + unites[u]));
      }
      if (n < 100) { // 70-79
        return dizaines[6] + (n === 71 ? ' et onze' : '-' + unites[n - 60]);
      }
      const c = Math.floor(n / 100), r = n % 100;
      return (c > 1 ? unites[c] + ' cent' : 'cent') + (r === 0 && c > 1 ? 's' : r === 0 ? '' : ' ' + centaines(r));
    }
    function milliers(n) {
      if (n === 0) return 'zéro';
      const m = Math.floor(n / 1000), r = n % 1000;
      let out = '';
      if (m > 0) out += (m === 1 ? 'mille' : centaines(m) + ' mille');
      if (r > 0) out += (out ? ' ' : '') + centaines(r);
      return out;
    }
    return milliers(Math.round(n));
  }
  function montantEnLettres(totalTTC) {
    const dinars = Math.floor(totalTTC);
    const millimes = Math.round((totalTTC - dinars) * 1000);
    let texte = nombreEnLettres(dinars) + ' dinar' + (dinars > 1 ? 's' : '');
    if (millimes > 0) texte += ' ' + nombreEnLettres(millimes) + ' millime' + (millimes > 1 ? 's' : '');
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }
  function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('fr-FR'); }

  const STATUT_PILL = { LIBERE: 'good', BLOQUE: 'warn', REJETE: 'danger', EXPIRE: 'danger', EPUISE: 'danger', CLOTURE: 'grey', QUARANTAINE: 'grey' };
  const STATUT_LABEL = { LIBERE: 'Libéré', BLOQUE: 'Bloqué', REJETE: 'Rejeté', EXPIRE: 'Expiré', EPUISE: 'Épuisé', CLOTURE: 'Clôturé', QUARANTAINE: 'Quarantaine' };
  function pillStatut(statut) { return `<span class="pill ${STATUT_PILL[statut] || 'grey'}">${STATUT_LABEL[statut] || statut}</span>`; }

  const REF_DATA = { categories: [], unites: [], formats: [], remises: [] };

  async function loadAllData() {
    const endpoints = [
      ['produits', '/produits'], ['clients', '/clients'], ['fournisseurs', '/fournisseurs'],
      ['commandes', '/commandes'], ['lots', '/lots'], ['categories', '/categories'], ['unites', '/unites'],
      ['formats', '/formats'], ['locaux', '/locaux'], ['employes', '/employes'], ['lotsPresse', '/presse'],
      ['lotsFiltration', '/filtration'], ['conditionnements', '/conditionnement'], ['factures', '/factures'],
      ['users', '/users'], ['remises', '/remises'], ['recettes', '/recettes'], ['ordresProduction', '/ordres-production'],
      ['grilles', '/grille-huiles'], ['settings', '/settings'], ['achats', '/achats'], ['receptions', '/receptions'],
      ['stockMouvements', '/stock-mouvements'], ['stockResume', '/stock-mouvements/resume'], ['notifications', '/notifications'],
      ['paiements', '/paiements'], ['avoirs', '/avoirs'], ['certificats', '/certificats'],
      ['livraisons', '/livraisons'], ['proformas', '/proformas'],
    ];
    const results = await Promise.allSettled(endpoints.map(([, path]) => apiFetch(path)));

    const echecs = [];
    results.forEach((r, i) => {
      const [key] = endpoints[i];
      if (r.status === 'fulfilled') {
        if (key === 'categories' || key === 'unites' || key === 'formats' || key === 'remises') REF_DATA[key] = r.value;
        else APP_DATA[key] = r.value;
      } else {
        echecs.push(endpoints[i][1]);
        console.error(`Échec de chargement pour ${endpoints[i][1]} :`, r.reason);
      }
    });

    // Chaque écran se rend indépendamment — un endpoint en échec n'empêche
    // plus les autres de s'afficher (avant : un seul échec bloquait tout).
    const renders = [
      renderProduits, renderClients, renderFournisseurs, renderCommandes, renderLotsRegistre, renderDashboard,
      renderLocaux, renderEmployes, renderPresse, renderFiltration, renderConditionnement,
      renderFactures, renderUtilisateurs, renderRecettes, renderOrdresProduction,
      renderGrillePrix, renderRemises, renderAchats, renderReceptions,
      renderStockMatiere, renderStockVrac, renderStockFiltre, renderStockConditionne, renderStockEmballage,
      renderStockConsommables, renderStockRepartitionPivot, renderStockMouvements, renderNotifications,
      renderPaiements, renderAvoirs, renderLivraisons, renderProformas, renderStats, renderCertificats, renderParametres,
      tracPopulateTypes, tracPopulateLots,
    ];
    renders.forEach(fn => { try { fn(); } catch (e) { console.error(`Erreur d'affichage (${fn.name}) :`, e); } });

    const banner = document.getElementById('loadErrorBanner');
    if (banner) {
      if (echecs.length) {
        document.getElementById('loadErrorTexte').textContent = `⚠ Certaines données n'ont pas pu être chargées (${echecs.join(', ')}) — vérifiez que votre serveur API est à jour et démarré.`;
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }

    // Opérations faites hors ligne (session précédente comprise) : envoi dès que possible.
    hlMajAffichage();
    if (!HL.horsLigne && !HL.synchroEnCours) hlOps().then(ops => { if (ops.some(o => o.statut === 'EN_ATTENTE')) hlSynchroniser(); });
  }

  document.getElementById('loadErrorFermer').addEventListener('click', () => { document.getElementById('loadErrorBanner').style.display = 'none'; });

  // Filtre par grande famille — heuristique sur le nom de catégorie (Huiles/
  // Savons.../Consommables/Emballages), faute d'un champ dédié structuré.
  let PRODUITS_FILTER = '';
  let PRODUITS_HIGHLIGHT_IDS = null; // drill-down depuis une alerte du tableau de bord — prioritaire sur PRODUITS_FILTER
  function allerVersProduitsFiltres(ids) {
    PRODUITS_HIGHLIGHT_IDS = ids;
    document.querySelector('a[data-view="produits"]').dispatchEvent(new Event('click', { bubbles: true }));
    renderProduits();
  }
  function matchesProduitFilter(p, filter) {
    const cat = (p.categorie_nom || '').toLowerCase();
    if (filter === 'huile') return cat.includes('huile');
    if (filter === 'compose') return cat.includes('savon') || cat.includes('compos');
    if (filter === 'consommable') return cat.includes('consommable') || cat.includes('emballage');
    return true;
  }
  function renderProduits() {
    const body = document.getElementById('produitsBody');
    let banniere = document.getElementById('produitsHighlightBanner');
    if (PRODUITS_HIGHLIGHT_IDS) {
      if (!banniere) {
        banniere = document.createElement('div');
        banniere.id = 'produitsHighlightBanner';
        banniere.style.cssText = 'background:#fdf6ec; border:1px solid var(--warn); border-radius:8px; padding:10px 14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; font-size:13px;';
        document.getElementById('produitsBody').closest('table').parentElement.insertBefore(banniere, document.getElementById('produitsBody').closest('table'));
      }
      banniere.style.display = 'flex';
      banniere.innerHTML = `<span>Filtré depuis une alerte — <b>${PRODUITS_HIGHLIGHT_IDS.length}</b> produit${PRODUITS_HIGHLIGHT_IDS.length > 1 ? 's' : ''} concerné${PRODUITS_HIGHLIGHT_IDS.length > 1 ? 's' : ''}</span><button class="btnGhost" id="produitsClearHighlightBtn">✕ Voir tous les produits</button>`;
      document.getElementById('produitsClearHighlightBtn').addEventListener('click', () => { PRODUITS_HIGHLIGHT_IDS = null; renderProduits(); });
    } else if (banniere) {
      banniere.style.display = 'none';
    }

    const rows = PRODUITS_HIGHLIGHT_IDS
      ? APP_DATA.produits.filter(p => PRODUITS_HIGHLIGHT_IDS.includes(p.id))
      : (PRODUITS_FILTER ? APP_DATA.produits.filter(p => matchesProduitFilter(p, PRODUITS_FILTER)) : APP_DATA.produits);
    if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="rowMeta" style="text-align:center; padding:22px;">Aucun produit dans cette catégorie.</td></tr>`; return; }
    body.innerHTML = rows.map(p => {
      // Alerte : un produit avec un format (conditionné, compté à la pièce)
      // mais dont l'unité n'est pas "unité" — source du bug kg/g déjà vu
      // plusieurs fois. Repéré ici pour être corrigé à la source par l'utilisateur.
      const uniteDuProduit = REF_DATA.unites.find(u => u.id === p.unite_id);
      const incoherent = p.format_id && uniteDuProduit && uniteDuProduit.code !== 'unite';
      const alerte = incoherent
        ? ` <span class="pill warn" title="Ce produit a un format mais son unité n'est pas 'Unité' — vérifiez sa fiche">⚠ unité</span>`
        : '';
      return `<tr data-id="${p.id}">
        <td class="lotCode">${esc(p.code)}</td>
        <td>${esc(p.nom)}${alerte}</td>
        <td class="rowMeta">${p.type_article}</td>
        <td class="num">${p.prix_vente != null ? fmtDT(p.prix_vente) : '—'}</td>
        <td class="num">${p.stock_actuel} ${p.unite_symbole || ''}</td>
        <td class="rowActions">
          <button class="rowActionBtn" onclick="openProduitModal(${p.id})">Modifier</button>
          ${estGraine(p) ? `<button class="rowActionBtn" onclick="openDerivesModal(${p.id})" title="Huile vrac, filtrée, flacons">🌱 Dérivés</button>` : ''}
          ${isGerant() ? `<button class="rowActionBtn danger" onclick="askDelete('produits', ${p.id}, '${attrJs(p.nom)}', renderProduits)">Supprimer</button>` : ''}
        </td>
      </tr>`;
    }).join('');
    cablerMenuContextuel('produitsBody', (id) => {
      const p = APP_DATA.produits.find(x => x.id === id);
      if (!p) return [];
      const items = [
        { label: '✎ Modifier', action: () => openProduitModal(id) },
        ...(estGraine(p) ? [{ label: '🌱 Ajouter des dérivés (huile vrac, filtrée, flacons)', action: () => openDerivesModal(id) }] : []),
        { label: '📦 Voir le stock', action: () => { document.querySelector('a[data-view="stock"]').dispatchEvent(new Event('click', { bubbles: true })); } },
      ];
      if (isGerant()) items.push(null, { label: '✕ Supprimer', danger: true, action: () => askDelete('produits', id, p.nom, renderProduits) });
      return items;
    });
  }
  document.querySelectorAll('#produitsFilterRow .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#produitsFilterRow .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      PRODUITS_FILTER = chip.dataset.filter;
      renderProduits();
    });
  });

  // « ＋ Commande » : ouvre une commande pour ce client (aussi pour un client créé hors ligne, pas encore envoyé).
  function nouvelleCommandePour(clientId) {
    openCommandeModal(null);
    setTimeout(() => { const sel = document.getElementById('commandeClient'); if (sel) sel.value = clientId; }, 100);
  }
  function renderClients() {
    const body = document.getElementById('clientsBody');
    document.getElementById('clientsCount').textContent = `${APP_DATA.clients.length} fiche${APP_DATA.clients.length > 1 ? 's' : ''} client`;
    if (!APP_DATA.clients.length) { body.innerHTML = `<tr><td colspan="8" class="rowMeta" style="text-align:center; padding:22px;">Aucun client — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    const clientsVus = filtreVue('clients', APP_DATA.clients);
    if (!clientsVus.length) { body.innerHTML = `<tr><td colspan="8" class="videAction">Aucun client dans cette vue.</td></tr>`; return; }
    body.innerHTML = clientsVus.map(c => `
      <tr data-id="${c.id}">
        <td>${esc(c.nom)}${c.en_attente_envoi ? ' <span class="pill warn" style="white-space:nowrap;" title="Créé hors ligne : il sera envoyé au retour du réseau">⏳ en attente</span>' : ''}</td>
        <td class="rowMeta">${esc(c.type)}</td>
        <td>${esc(c.ville || '—')}</td>
        <td class="rowMeta">${esc(c.matricule_fiscal || '—')}</td>
        <td class="rowMeta">${c.remise_nom || '—'}</td>
        <td class="num">${fmtDT(c.total_achete)}</td>
        <td class="num">${Number(c.solde) > 0.0005 ? `<b style="color:var(--warn);">${fmtDT(c.solde)}</b>` : Number(c.solde) < -0.0005 ? fmtSolde(c.solde) : '<span class="rowMeta">—</span>'}</td>
        <td class="rowActions">
          <button class="rowActionBtn" onclick="nouvelleCommandePour(${c.id})">＋ Commande</button>
          ${c.en_attente_envoi ? '' : `<button class="rowActionBtn" onclick="ouvrirReleve(${c.id})">Relevé</button>
          <button class="rowActionBtn" onclick="openClientModal(${c.id})">Modifier</button>`}
          ${isGerant() && !c.en_attente_envoi ? `<button class="rowActionBtn danger" onclick="askDelete('clients', ${c.id}, '${attrJs(c.nom)}', renderClients)">Supprimer</button>` : ''}
        </td>
      </tr>`).join('');
    cablerMenuContextuel('clientsBody', (id) => {
      const c = APP_DATA.clients.find(x => x.id === id);
      if (!c) return [];
      const items = [
        ...(c.en_attente_envoi ? [] : [{ label: '📄 Relevé de compte', action: () => ouvrirReleve(id) }, { label: '✎ Modifier', action: () => openClientModal(id) }]),
        { label: '＋ Nouvelle commande', action: () => nouvelleCommandePour(id) },
      ];
      if (isGerant() && !c.en_attente_envoi) items.push(null, { label: '✕ Supprimer', danger: true, action: () => askDelete('clients', id, c.nom, renderClients) });
      return items;
    });
  }

  // Relevé de compte client : factures (débit), paiements (crédit), solde.
  let RELEVE_COURANT = null;
  async function ouvrirReleve(clientId) {
    try {
      const r = await apiFetch(`/clients/${clientId}/releve`);
      RELEVE_COURANT = r;
      document.getElementById('releveTitre').textContent = `Relevé de compte — ${r.client.nom}`;
      document.getElementById('releveResume').innerHTML = `Facturé <b>${fmtDT(r.total_facture)}</b> · Payé <b>${fmtDT(r.total_paye)}</b> · ${r.solde < -0.0005 ? `<b>${fmtSolde(r.solde)}</b>` : `Reste dû <b style="color:${r.solde > 0.0005 ? 'var(--warn)' : 'var(--good)'};">${fmtDT(r.solde)}</b>`}`;
      document.getElementById('releveBody').innerHTML = r.operations.length ? r.operations.map(o => `
        <tr><td class="rowMeta num">${fmtDate(o.date)}</td><td>${esc(o.libelle)}</td>
          <td class="num">${o.debit ? fmtDT(o.debit) : ''}</td><td class="num">${o.credit ? fmtDT(o.credit) : ''}</td><td class="num"><b>${fmtDT(o.solde)}</b></td></tr>`).join('')
        : `<tr><td colspan="5" class="videAction">Aucune facture pour ce client.</td></tr>`;
      document.getElementById('releveOverlay').classList.add('open');
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  function imprimerReleve() {
    const r = RELEVE_COURANT; if (!r) return;
    const s = APP_DATA.settings || {};
    const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const w = window.open('', `releve_${r.client.id}_${Date.now()}`);
    if (!w) { notifier('Autorisez les pop-ups pour imprimer le relevé.'); return; }
    w.document.open();
    w.document.write(`<html><head><meta charset="UTF-8"><title>Relevé ${esc(r.client.nom)}</title><style>
      @page { size: A4; margin: 14mm; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
      h1 { font-size: 17px; margin: 0 0 4px; } .sous { color: #555; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #eef3ea; font-size: 11px; text-transform: uppercase; } .n { text-align: right; white-space: nowrap; }
      .tot { margin-top: 14px; font-size: 13px; text-align: right; }
    </style></head><body>
      <div><b>${esc(s.entreprise_nom || '')}</b></div>
      <h1>Relevé de compte — ${esc(r.client.nom)}</h1>
      <div class="sous">${r.client.matricule_fiscal ? 'MF ' + esc(r.client.matricule_fiscal) + ' · ' : ''}Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
      <table><thead><tr><th>Date</th><th>Opération</th><th class="n">Débit</th><th class="n">Crédit</th><th class="n">Solde</th></tr></thead><tbody>
      ${r.operations.map(o => `<tr><td>${fmtDate(o.date)}</td><td>${esc(o.libelle)}</td><td class="n">${o.debit ? fmtDT(o.debit) : ''}</td><td class="n">${o.credit ? fmtDT(o.credit) : ''}</td><td class="n">${fmtDT(o.solde)}</td></tr>`).join('')}
      </tbody></table>
      <div class="tot">Total débit ${fmtDT(r.total_facture)} · Total crédit ${fmtDT(r.total_paye)} · <b>${r.solde < -0.0005 ? 'Crédit en faveur du client ' + fmtDT(-r.solde) : 'Reste dû ' + fmtDT(r.solde)}</b></div>
      <script>window.onload = () => window.print();<\/script></body></html>`);
    w.document.close();
  }

  function renderFournisseurs() {
    const body = document.getElementById('fournisseursBody');
    if (!APP_DATA.fournisseurs.length) { body.innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucun fournisseur — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    const bioLabel = { certifie: '<span class="pill good">Certifié</span>', conversion: '<span class="pill warn">Conversion</span>', non_bio: '<span class="pill grey">Non bio</span>' };
    body.innerHTML = APP_DATA.fournisseurs.map(f => `
      <tr data-id="${f.id}">
        <td>${esc(f.nom)}${f.en_attente_envoi ? ' <span class="pill warn" style="white-space:nowrap;" title="Créé hors ligne : il sera envoyé au retour du réseau">⏳ en attente</span>' : ''}</td>
        <td class="rowMeta">${esc(f.type)}</td>
        <td class="rowMeta">${esc(f.matricule_fiscal || '—')}</td>
        <td>${esc(f.localisation || '—')}</td>
        <td>${bioLabel[f.statut_bio] || f.statut_bio}</td>
        <td class="${f.certificat_numero ? 'lotCode' : 'rowMeta'}">${f.certificat_numero || '—'}</td>
        <td class="rowActions">
          ${f.en_attente_envoi ? '' : `<button class="rowActionBtn" onclick="openFournisseurModal(${f.id})">Modifier</button>`}
          ${isGerant() && !f.en_attente_envoi ? `<button class="rowActionBtn danger" onclick="askDelete('fournisseurs', ${f.id}, '${attrJs(f.nom)}', renderFournisseurs)">Supprimer</button>` : ''}
        </td>
      </tr>`).join('');
    cablerMenuContextuel('fournisseursBody', (id) => {
      const f = APP_DATA.fournisseurs.find(x => x.id === id);
      if (!f) return [];
      if (f.en_attente_envoi) return [];
      const items = [{ label: '✎ Modifier', action: () => openFournisseurModal(id) }];
      if (isGerant()) items.push(null, { label: '✕ Supprimer', danger: true, action: () => askDelete('fournisseurs', id, f.nom, renderFournisseurs) });
      return items;
    });
  }

  // ============================================================================
  // FORMULAIRES — Produit / Client / Fournisseur, branchés sur l'API réelle.
  // Chaque «Modifier» pré-remplit le même formulaire que «＋ Nouveau» ; la
  // suppression passe par une confirmation générique unique pour les 3.
  // ============================================================================

  function populateSelect(sel, items, valueKey, labelKey, placeholder) {
    sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
      items.map(it => `<option value="${it[valueKey]}">${it[labelKey]}</option>`).join('');
  }
  // Formats avec leur contenance visible dans le libellé (ex: "30ml — 30 ml/unité")
  // — pour confirmer la valeur sans avoir à deviner ou ouvrir une autre fenêtre.
  function formatsAvecContenance() {
    return REF_DATA.formats.map(f => ({
      id: f.id,
      label: `${f.nom} — ${f.volume ? f.volume + ' ml' : f.poids ? f.poids + ' g' : '—'}/unité`,
    }));
  }

