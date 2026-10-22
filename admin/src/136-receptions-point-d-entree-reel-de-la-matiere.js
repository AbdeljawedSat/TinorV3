  // ============================================================================
  // RÉCEPTIONS — point d'entrée réel de la matière, crée les lots automatiquement.
  // ============================================================================
  function renderReceptions() {
    const body = document.getElementById('receptionsBody');
    if (!APP_DATA.receptions.length) { body.innerHTML = `<tr><td colspan="6" class="rowMeta" style="text-align:center; padding:22px;">Aucune réception — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = APP_DATA.receptions.map(r => `
      <tr>
        <td class="lotCode">${esc(r.numero)}</td>
        <td>${esc(r.fournisseur_nom || '—')}</td>
        <td class="rowMeta">${esc(r.local_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(r.date_reception)}</td>
        <td class="rowMeta">${r.achat_id ? 'Sur achat' : 'Directe'}</td>
        <td class="num">${r.nb_lignes}</td>
      </tr>`).join('');
  }

  function receptionLigneRow(produitId, qte) {
    const fournisseurId = Number(document.getElementById('receptionFournisseur').value) || null;
    const ignorerFiltre = document.getElementById('receptionToutesCategories').checked;
    const liste = produitsPourFournisseur(fournisseurId, ignorerFiltre);
    const options = optionsGroupedByCategorie(
      liste,
      p => `${p.nom} (${p.type_article})`,
      p => `${produitId === p.id ? 'selected' : ''} data-unite="${p.unite_symbole || ''}" data-format="${p.format_id || ''}"`
    );
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'structRow';
    row.style.gridTemplateColumns = '1.7fr 1fr 70px 40px 32px';
    row.innerHTML = `
      <select class="recProduit formInput">${options}</select>
      <input type="text" maxlength="60" class="recLotFournisseur formInput" placeholder="Lot fournisseur (ex. GJ01/2023)" title="N° de lot du fournisseur — avec la numérotation Jardins de Jerba, c'est le n° du lot de graines">
      <input type="number" step="0.001" class="recQty formInput" placeholder="Qté" value="${qte != null ? qte : ''}">
      <span class="recUnite rowMeta" style="align-self:center; text-align:center;"></span>
      <button class="delField" type="button">✕</button>`;
    const contenanceEl = document.createElement('div');
    contenanceEl.className = 'rowMeta';
    contenanceEl.style.cssText = 'font-size:11px; margin:2px 0 6px 2px;';
    const selectEl = row.querySelector('.recProduit');
    const uniteEl = row.querySelector('.recUnite');
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
    row.querySelector('.delField').addEventListener('click', () => wrap.remove());
    wrap.appendChild(row);
    wrap.appendChild(contenanceEl);
    return wrap;
  }

  function resetReceptionLignes(prefill) {
    const rowsWrap = document.getElementById('receptionLignesRows');
    rowsWrap.innerHTML = '';
    if (prefill && prefill.length) {
      prefill.forEach(l => rowsWrap.appendChild(receptionLigneRow(l.produit_id, l.quantite)));
    } else if (APP_DATA.produits.length) {
      rowsWrap.appendChild(receptionLigneRow(null, null));
    }
  }

  async function openReceptionModal() {
    document.getElementById('receptionFormError').style.display = 'none';
    populateSelect(document.getElementById('receptionAchat'), APP_DATA.achats.filter(a => a.statut !== 'receptionne'), 'id', 'numero', '— Aucun (réception directe) —');
    populateSelect(document.getElementById('receptionFournisseur'), APP_DATA.fournisseurs, 'id', 'nom');
    populateSelect(document.getElementById('receptionLocal'), APP_DATA.locaux, 'id', 'nom');
    document.getElementById('receptionDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('receptionNotes').value = '';
    document.getElementById('receptionToutesCategories').checked = false;
    document.getElementById('receptionFournisseur').disabled = false;
    resetReceptionLignes(null);
    document.getElementById('receptionModalOverlay').classList.add('open');
  }
  document.getElementById('receptionToutesCategories').addEventListener('change', () => {
    if (document.getElementById('receptionAchat').value) return; // pré-rempli depuis un achat : ne pas toucher
    resetReceptionLignes(null);
  });
  // Changer de fournisseur (réception directe, hors pré-remplissage sur achat)
  // reconstruit les lignes pour refléter le nouveau filtre par type.
  document.getElementById('receptionFournisseur').addEventListener('change', () => {
    if (document.getElementById('receptionAchat').value) return; // pré-rempli depuis un achat : ne pas toucher
    resetReceptionLignes(null);
  });
  // Ouvre la modale pré-remplie depuis un achat précis (bouton "Réceptionner").
  async function prepareReceptionFromAchat(achatId) {
    await openReceptionModal();
    document.getElementById('receptionAchat').value = achatId;
    document.getElementById('receptionAchat').dispatchEvent(new Event('change'));
  }
  document.getElementById('receptionAchat').addEventListener('change', async (e) => {
    const achatId = e.target.value;
    if (!achatId) {
      document.getElementById('receptionFournisseur').disabled = false;
      resetReceptionLignes(null);
      return;
    }
    const detail = await apiFetch(`/achats/${achatId}`);
    document.getElementById('receptionFournisseur').value = detail.fournisseur_id;
    document.getElementById('receptionFournisseur').disabled = true;
    resetReceptionLignes((detail.lignes || []).map(l => ({ produit_id: l.produit_id, quantite: l.quantite })));
  });
  function closeReceptionModal() { document.getElementById('receptionModalOverlay').classList.remove('open'); }
  document.getElementById('receptionAddLigneBtn').addEventListener('click', () => {
    document.getElementById('receptionLignesRows').appendChild(receptionLigneRow(null, null));
  });

  // ============================================================================
  // HORS LIGNE (V3.3) — l'application continue de fonctionner sans connexion.
  //
  // 1. Copie locale : chaque lecture réussie (GET) est gardée sur l'appareil
  //    (IndexedDB) ; sans réseau, les écrans s'affichent depuis cette copie.
  // 2. Opérations hors ligne : commandes, réceptions, presse, filtration,
  //    conditionnement, encaissements et comptages d'inventaire sont mis en
  //    file avec un numéro provisoire ; le stock local en tient compte.
  // 3. Au retour du réseau : envoi dans l'ordre, chacune avec un identifiant
  //    unique (X-Operation-Id) — le serveur ne l'enregistre jamais deux fois —
  //    puis rechargement de tout (ce qui a été fait sur le PC arrive ici).
  // 4. Refus du serveur (stock insuffisant, lot épuisé…) : l'opération passe
  //    « À corriger » (jamais perdue), notification ici et au bureau.
  // Factures, avoirs, annulations et réglages restent en ligne seulement.
  // ============================================================================
  const HL_DB_NOM = 'tinor_hors_ligne';
  const HL_SESSION_CLE = 'tinor_session_hors_ligne';
  const HL_SESSION_JOURS = 7;
  const HL_OPERATIONS = [
    { type: 'client', methode: 'POST', motif: /^\/clients$/, prefixe: 'CLI', libelle: 'Client' },
    { type: 'fournisseur', methode: 'POST', motif: /^\/fournisseurs$/, prefixe: 'FRN', libelle: 'Fournisseur' },
    { type: 'commande', methode: 'POST', motif: /^\/commandes$/, prefixe: 'BC', libelle: 'Commande' },
    { type: 'livraison', methode: 'POST', motif: /^\/livraisons$/, prefixe: 'BL', libelle: 'Bon de livraison' },
    { type: 'proforma', methode: 'POST', motif: /^\/proformas$/, prefixe: 'PRO', libelle: 'Facture en attente' },
    { type: 'proforma_modif', methode: 'PUT', motif: /^\/proformas\/\d+$/, prefixe: 'PRO', libelle: 'Modification de facture en attente' },
    { type: 'reception', methode: 'POST', motif: /^\/receptions$/, prefixe: 'REC', libelle: 'Réception' },
    { type: 'presse', methode: 'POST', motif: /^\/presse$/, prefixe: 'PRS', libelle: 'Pressage' },
    { type: 'filtration', methode: 'POST', motif: /^\/filtration$/, prefixe: 'FLT', libelle: 'Filtration' },
    { type: 'melange', methode: 'POST', motif: /^\/melanges$/, prefixe: 'MEL', libelle: 'Mélange (lot fini)' },
    { type: 'conditionnement', methode: 'POST', motif: /^\/conditionnement$/, prefixe: 'CND', libelle: 'Conditionnement' },
    { type: 'paiement', methode: 'POST', motif: /^\/factures\/\d+\/paiements$/, prefixe: 'PAI', libelle: 'Encaissement' },
    { type: 'inventaire', methode: 'PUT', motif: /^\/inventaires\/\d+\/lignes$/, prefixe: 'INV', libelle: 'Comptage d\'inventaire' },
  ];
  const HL = { horsLigne: false, synchroEnCours: false, reconnexion: false, motDePasse: null, derniereSynchro: null, dbPromesse: null, force: false };
  // « Hors ligne » choisi par l'utilisateur (bouton) : mémorisé sur l'appareil ; TinOR n'appelle plus
  // le serveur (même si le réseau existe) jusqu'au retour sur « En ligne ».
  try { HL.force = localStorage.getItem('tinor_mode_hors_ligne') === '1'; } catch {}
  if (HL.force) HL.horsLigne = true;

  function hlDb() {
    if (!HL.dbPromesse) HL.dbPromesse = new Promise((resolve, reject) => {
      const req = indexedDB.open(HL_DB_NOM, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('cache', { keyPath: 'cle' });
        db.createObjectStore('ops', { keyPath: 'id' });
        db.createObjectStore('historique', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { HL.dbPromesse = null; reject(req.error); };
    });
    return HL.dbPromesse;
  }
  async function hlStore(nom, mode, action) {
    const db = await hlDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nom, mode);
      const req = action(tx.objectStore(nom));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  const hlCle = path => `${API_BASE}|${path}`;
  async function hlLireCache(path) {
    try { const r = await hlStore('cache', 'readonly', s => s.get(hlCle(path))); return r ? r : null; } catch { return null; }
  }
  async function hlEcrireCache(path, data) {
    try { await hlStore('cache', 'readwrite', s => s.put({ cle: hlCle(path), data, date: new Date().toISOString() })); } catch (e) { console.warn('Copie locale impossible :', e); }
  }
  async function hlOps() {
    try { return ((await hlStore('ops', 'readonly', s => s.getAll())) || []).sort((a, b) => a.cree_le.localeCompare(b.cree_le)); } catch { return []; }
  }
  const hlEcrireOp = op => hlStore('ops', 'readwrite', s => s.put(op));
  const hlSupprimerOp = id => hlStore('ops', 'readwrite', s => s.delete(id));
  async function hlHistorique() {
    try { return ((await hlStore('historique', 'readonly', s => s.getAll())) || []).sort((a, b) => b.envoye_le.localeCompare(a.envoye_le)); } catch { return []; }
  }
  async function hlAjouterHistorique(entree) {
    await hlStore('historique', 'readwrite', s => s.put(entree));
    const tout = await hlHistorique();
    for (const vieux of tout.slice(40)) await hlStore('historique', 'readwrite', s => s.delete(vieux.id));
  }

  // Identifiants : unique par opération ; numéro provisoire lisible par appareil (CMD-HL-K4P2-3).
  function hlUuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'op-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function hlAppareil() {
    let a = null;
    try { a = localStorage.getItem('tinor_appareil'); } catch {}
    if (!a) { a = Math.random().toString(36).slice(2, 6).toUpperCase(); try { localStorage.setItem('tinor_appareil', a); } catch {} }
    return a;
  }
  function hlNumeroProvisoire(prefixe) {
    let n = 0;
    try { n = Number(localStorage.getItem('tinor_compteur_hl') || 0) + 1; localStorage.setItem('tinor_compteur_hl', String(n)); } catch { n = Date.now() % 10000; }
    return `${prefixe}-HL-${hlAppareil()}-${n}`;
  }
  function hlIdProvisoire() {
    let n = 0;
    try { n = Number(localStorage.getItem('tinor_compteur_id_hl') || 0) + 1; localStorage.setItem('tinor_compteur_id_hl', String(n)); } catch { n = Date.now() % 100000000; }
    return -n;
  }
  const hlOperation = (methode, path) => HL_OPERATIONS.find(o => o.methode === methode && o.motif.test(path)) || null;

  // Résumé lisible d'une opération (écran Synchronisation, notifications).
  function hlNomProduit(id) { return APP_DATA.produits.find(p => p.id === Number(id))?.nom || `produit ${id}`; }
  function hlDescription(op) {
    const p = op.payload || {};
    const lot = id => APP_DATA.lots.find(l => l.id === Number(id))?.numero_lot || `lot ${id}`;
    switch (op.type) {
      case 'commande': {
        const client = APP_DATA.clients.find(c => c.id === Number(p.client_id));
        return `${client ? client.nom : (HL.noms && HL.noms['client:' + p.client_id]) || 'client ' + p.client_id} · ${(p.lignes || []).map(l => `${l.qty} × ${hlNomProduit(l.produit_id)}`).join(', ')}`;
      }
      case 'client': case 'fournisseur': return `${p.nom || ''}${p.ville ? ' · ' + p.ville : p.localisation ? ' · ' + p.localisation : ''}`;
      case 'reception': return (p.lignes || []).map(l => `${l.quantite} × ${hlNomProduit(l.produit_id)}`).join(', ');
      case 'presse': return `${(p.sources || []).map(s => `${s.quantite} de ${lot(s.lot_id)}`).join(' + ')} → ${(p.sorties || []).map(s => `${s.quantite_produite} ${hlNomProduit(s.produit_id)}`).join(', ')}`;
      case 'filtration': return `${hlNomProduit(p.produit_id)} : ${p.quantite_produite}`;
      case 'melange': return (p.sources || []).map(x => `${x.quantite} de ${lot(x.lot_id)}`).join(' + ');
      case 'conditionnement': return `${p.qty} × ${p.nouveau_produit ? p.nouveau_produit.nom : hlNomProduit(p.produit_id)}`;
      case 'paiement': { const f = APP_DATA.factures.find(x => `/factures/${x.id}/paiements` === op.path); return `${fmtDT(p.montant)}${f ? ' sur ' + f.numero : ''}`; }
      case 'inventaire': return `${(p.lignes || []).length} ligne(s) comptée(s)`;
      case 'livraison': case 'proforma': { const c = APP_DATA.commandes.find(x => x.id === Number(p.commande_id)); return `commande ${c ? c.numero : p.commande_id}${c && c.client_nom ? ' · ' + c.client_nom : ''}${op.type === 'livraison' && p.lignes ? ' · ' + p.lignes.reduce((t, l) => t + Number(l.qty || 0), 0) + ' unité(s)' : ''}`; }
      case 'proforma_modif': return `${(p.lignes || []).length} prix modifié(s)`;
      default: return '';
    }
  }

