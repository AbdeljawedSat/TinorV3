  // ---------- Affichage : bandeau + écran Synchronisation ----------
  async function hlMajAffichage() {
    const ops = await hlOps();
    const attente = ops.filter(o => o.statut === 'EN_ATTENTE').length;
    const aCorriger = ops.filter(o => o.statut === 'A_CORRIGER').length;
    const ban = document.getElementById('offlineBanner');
    const texte = document.getElementById('offlineBannerTexte');
    const compteur = document.getElementById('offlineQueueCount');
    if (ban && texte && compteur) {
      let etat = '';
      if (HL.synchroEnCours) etat = 'synchro';
      else if (aCorriger) etat = 'corriger';
      else if (HL.horsLigne) etat = 'horsligne';
      else if (HL.reconnexion && attente) etat = 'reconnexion';
      else if (attente) etat = 'attente';
      ban.dataset.etat = etat;
      ban.style.display = etat ? 'flex' : 'none';
      const dateCopie = HL.donneesDu ? ` — données du ${new Date(HL.donneesDu).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : '';
      texte.textContent = {
        synchro: '🔄 Synchronisation en cours…',
        corriger: `⚠ ${aCorriger} opération(s) hors ligne à corriger`,
        horsligne: HL.force ? `📴 Non connecté (choisi) — travail sur la copie de cet appareil${dateCopie}` : `📡 Hors ligne — vous pouvez continuer à travailler${dateCopie}`,
        reconnexion: '🔑 Reconnectez-vous pour envoyer les opérations en attente',
        attente: '⏳ Opérations en attente d\'envoi',
      }[etat] || '';
      compteur.textContent = attente ? `${attente} en attente d'envoi · Voir ›` : 'Voir ›';
    }
    majBoutonMode();
    const badge = document.getElementById('syncBadge');
    if (badge) { badge.textContent = aCorriger || attente || ''; badge.style.display = (aCorriger || attente) ? '' : 'none'; badge.style.background = aCorriger ? 'var(--danger)' : 'var(--warn)'; }
    if (document.getElementById('view-synchro')?.classList.contains('active')) renderSynchro();
  }

  const HL_CHAMPS_QTE = { qty: 'Quantité', quantite: 'Quantité', quantite_utilisee: 'Quantité utilisée', quantite_produite: 'Quantité obtenue', quantite_tourteau: 'Tourteau', quantite_dechet: 'Déchet', montant: 'Montant', quantite_physique: 'Quantité comptée', unit_price: 'Prix TTC' };
  // Champs de quantité modifiables d'une opération (lignes, sources, sorties…).
  function hlChampsModifiables(op) {
    const champs = [];
    const lot = id => APP_DATA.lots.find(l => l.id === Number(id))?.numero_lot;
    const etiquette = (o) => o.produit_id ? hlNomProduit(o.produit_id)
      : o.lot_id ? (lot(o.lot_id) || 'lot ' + o.lot_id)
      : o.lot_presse_id ? (APP_DATA.lotsPresse.find(l => l.id === Number(o.lot_presse_id))?.numero_lot || 'lot de presse')
      : o.lot_filtration_id ? (APP_DATA.lotsFiltration.find(l => l.id === Number(o.lot_filtration_id))?.numero_lot || 'lot filtré') : '';
    const parcourir = (obj, chemin, contexte) => {
      Object.entries(obj || {}).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach((el, i) => el && typeof el === 'object' && parcourir(el, [...chemin, k, i], etiquette(el)));
        else if (HL_CHAMPS_QTE[k] && typeof v === 'number') champs.push({ chemin: [...chemin, k], libelle: `${contexte ? contexte + ' — ' : ''}${HL_CHAMPS_QTE[k]}`, valeur: v });
      });
    };
    parcourir(op.payload, [], op.type === 'conditionnement' ? (op.payload.nouveau_produit?.nom || hlNomProduit(op.payload.produit_id)) : '');
    return champs;
  }
  function hlDefinir(obj, chemin, valeur) {
    let o = obj;
    for (let i = 0; i < chemin.length - 1; i++) o = o[chemin[i]];
    o[chemin[chemin.length - 1]] = valeur;
  }

  async function renderSynchro() {
    const ops = await hlOps();
    const hist = await hlHistorique();
    const aCorriger = ops.filter(o => o.statut === 'A_CORRIGER');
    const attente = ops.filter(o => o.statut === 'EN_ATTENTE');
    const fmt = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    document.getElementById('synchroEtat').innerHTML = `
      <div class="hlEtat ${HL.horsLigne ? 'off' : 'on'}"><b>${HL.horsLigne ? '📡 Hors ligne' : '✓ En ligne'}</b>
        <span>Serveur : ${esc(API_BASE)}</span><span>Dernière synchronisation : ${fmt(HL.derniereSynchro)}</span>
        <span>Appareil : ${hlAppareil()}</span></div>`;
    document.getElementById('synchroCorrigerTitre').textContent = `À corriger (${aCorriger.length})`;
    document.getElementById('synchroCorriger').innerHTML = aCorriger.length ? aCorriger.map(op => {
      const champs = hlChampsModifiables(op);
      const stock = /stock|insuffisant|disponible|épuis/i.test(op.erreur || '');
      return `<div class="hlOp ko" data-op="${op.id}">
        <div class="hlTete"><b>${esc(op.libelle)} ${esc(op.numero_provisoire)}</b><span class="rowMeta">${fmt(op.cree_le)}</span></div>
        <div class="hlDesc">${esc(hlDescription(op))}</div>
        <div class="hlErreur">⚠ ${esc(op.erreur)}</div>
        ${champs.length ? `<div class="hlChamps">${champs.map((c, i) => `<label>${esc(c.libelle)}<input type="number" step="0.001" min="0" class="formInput" data-champ="${i}" value="${c.valeur}"></label>`).join('')}</div>` : ''}
        <div class="hlActions">
          ${op.type === 'commande' && stock ? `<button class="rowActionBtn" data-action="ajuster">Ramener au stock disponible</button><button class="rowActionBtn" data-action="attente">Mettre en attente de production</button>` : ''}
          <button class="rowActionBtn principal" data-action="renvoyer">Renvoyer${champs.length ? ' (quantités ci-dessus)' : ''}</button>
          <button class="rowActionBtn danger" data-action="abandonner">Abandonner</button>
        </div></div>`;
    }).join('') : '<div class="rowMeta hlVide">Rien à corriger.</div>';
    document.getElementById('synchroAttenteTitre').textContent = `En attente d'envoi (${attente.length})`;
    document.getElementById('synchroAttente').innerHTML = attente.length ? attente.map(op => `
      <div class="hlOp" data-op="${op.id}"><div class="hlTete"><b>${esc(op.libelle)} ${esc(op.numero_provisoire)}</b><span class="rowMeta">${fmt(op.cree_le)}</span></div>
        <div class="hlDesc">${esc(hlDescription(op))}</div>
        <div class="hlActions"><button class="rowActionBtn danger" data-action="abandonner">Supprimer</button></div></div>`).join('')
      : '<div class="rowMeta hlVide">Aucune opération en attente.</div>';
    document.getElementById('synchroHistorique').innerHTML = hist.length ? `<table><thead><tr><th>Opération</th><th>N° provisoire</th><th>N° définitif</th><th>Envoyée le</th></tr></thead><tbody>${hist.map(h => `
      <tr><td>${esc(h.libelle)}<div class="rowMeta">${esc(h.description)}</div></td><td class="rowMeta">${esc(h.numero_provisoire)}</td><td class="lotCode">${esc(h.numero || '—')}</td><td class="rowMeta">${fmt(h.envoye_le)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="rowMeta hlVide">Aucun envoi récent.</div>';
  }

  // Actions de l'écran Synchronisation.
  document.addEventListener('click', async (e) => {
    const bouton = e.target.closest('#view-synchro [data-action]');
    if (!bouton) return;
    const carte = bouton.closest('[data-op]');
    const op = (await hlOps()).find(o => o.id === carte?.dataset.op);
    if (!op) return;
    const action = bouton.dataset.action;
    if (action === 'abandonner') {
      const ok = await confirmer(`${op.libelle} ${op.numero_provisoire} : ${hlDescription(op)}. Elle ne sera jamais envoyée au serveur.`,
        { titre: 'Abandonner cette opération ?', ok: 'Abandonner', non: 'Garder', danger: true });
      if (!ok) return;
      await hlSupprimerOp(op.id);
      if (op.signale) apiFetch('/sync/conflits/resolus', { method: 'POST', body: JSON.stringify({ numero_provisoire: op.numero_provisoire }) }).catch(() => {});
      notifier(`${op.numero_provisoire} abandonnée.`, 'info');
      await hlMajAffichage(); await renderSynchro();
      return;
    }
    // Quantités saisies dans la carte (Renvoyer)
    const champs = hlChampsModifiables(op);
    carte.querySelectorAll('[data-champ]').forEach(input => {
      const c = champs[Number(input.dataset.champ)];
      const v = Number(input.value);
      if (c && Number.isFinite(v)) hlDefinir(op.payload, c.chemin, v);
    });
    if (action === 'ajuster' && op.type === 'commande') {
      // Stock actuel du serveur (données fraîches) pour chaque produit de la commande.
      try { APP_DATA.lots = await apiFetch('/lots'); } catch {}
      const dispo = pid => APP_DATA.lots.filter(l => l.produit_id === Number(pid) && l.statut === 'LIBERE').reduce((t, l) => Math.max(t, Number(l.quantite_actuelle)), 0);
      op.payload.lignes = (op.payload.lignes || []).map(l => ({ ...l, qty: Math.min(Number(l.qty), Math.floor(dispo(l.produit_id))) })).filter(l => l.qty > 0);
      if (!op.payload.lignes.length) { notifier('Plus aucun stock pour ces produits : mettez la commande en attente de production ou abandonnez-la.', 'erreur'); await hlEcrireOp(op); await renderSynchro(); return; }
    }
    if (action === 'attente') op.payload.accepter_attente = true;
    op.statut = 'EN_ATTENTE'; op.erreur = null;
    await hlEcrireOp(op);
    await hlSynchroniser({ manuel: true });
    await renderSynchro();
  });
  document.getElementById('synchroMaintenant').addEventListener('click', () => hlSynchroniser({ recharger: true, manuel: true }));
  document.getElementById('synchroEffacer').addEventListener('click', async () => {
    const ops = await hlOps();
    const ok = await confirmer(ops.length
      ? `${ops.length} opération(s) n'ont pas encore été envoyées et seront PERDUES. Les données de ce téléphone (copie locale, session hors ligne) seront effacées.`
      : 'La copie locale des données et la session hors ligne de ce téléphone seront effacées (utile avant de prêter ou changer d\'appareil).',
      { titre: 'Effacer les données de cet appareil ?', ok: 'Effacer', danger: true });
    if (!ok) return;
    try { await hlStore('cache', 'readwrite', s => s.clear()); await hlStore('ops', 'readwrite', s => s.clear()); await hlStore('historique', 'readwrite', s => s.clear()); } catch {}
    try { localStorage.removeItem(HL_SESSION_CLE); localStorage.removeItem('tinor_derniere_synchro'); } catch {}
    HL.motDePasse = null;
    notifier('Données de cet appareil effacées.', 'succes');
    await hlMajAffichage(); await renderSynchro();
  });
  document.getElementById('offlineBanner').addEventListener('click', async () => {
    if (HL.horsLigne && TOKEN && !HL.synchroEnCours) {
      // Essai immédiat (sans attendre la vérification automatique toutes les 20 s).
      if (await hlServeurJoignable()) {
        if (!HL.reconnexion || await hlReconnexionSilencieuse()) { HL.horsLigne = false; hlSynchroniser({ recharger: true, manuel: true }); }
        else notifier('Serveur joignable, mais la reconnexion a échoué : déconnectez-vous puis reconnectez-vous.', 'erreur');
      } else notifier(await diagnostiquerServeur(API_BASE) || 'Serveur injoignable.', 'erreur');
    } else if (HL.reconnexion && !HL.horsLigne) { hlSynchroniser({ manuel: true }); }
    const lien = document.querySelector('#navScroll a[data-view="synchro"]');
    if (lien) setActive('synchro', lien);
  });

  // Ancienne file d'attente (réceptions hors ligne, version précédente) : reprise dans la nouvelle.
  async function hlReprendreAncienneFile() {
    try {
      if (!indexedDB.databases) return;
      const bases = await indexedDB.databases();
      if (!bases.some(b => b.name === 'tinor_file_attente')) return;
      const anciennes = await new Promise((resolve) => {
        const req = indexedDB.open('tinor_file_attente', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('file', { keyPath: 'id', autoIncrement: true });
        req.onsuccess = () => { const tx = req.result.transaction('file', 'readonly'); const r = tx.objectStore('file').getAll(); r.onsuccess = () => { resolve(r.result || []); req.result.close(); }; r.onerror = () => resolve([]); };
        req.onerror = () => resolve([]);
      });
      for (const a of anciennes) {
        const def = hlOperation('POST', a.path);
        if (def) await hlEcrireOp({ id: hlUuid(), type: def.type, libelle: def.libelle, methode: 'POST', path: a.path, payload: a.payload, numero_provisoire: hlNumeroProvisoire(def.prefixe), cree_le: a.dateCreation || new Date().toISOString(), statut: 'EN_ATTENTE', erreur: null, tentatives: 0 });
      }
      indexedDB.deleteDatabase('tinor_file_attente');
    } catch {}
  }

  // Retour du réseau : signal du navigateur + vérification régulière (le signal n'est pas fiable sur téléphone).
  window.addEventListener('online', () => { if (TOKEN && !HL.force) hlSynchroniser({ recharger: true }); });
  window.addEventListener('offline', () => hlPasserHorsLigne());
  setInterval(async () => {
    if (!TOKEN || HL.synchroEnCours || HL.force) return;
    const ops = await hlOps();
    if (HL.horsLigne || ops.some(o => o.statut === 'EN_ATTENTE')) {
      if (await hlServeurJoignable()) {
        if (HL.reconnexion && !(await hlReconnexionSilencieuse())) { HL.horsLigne = false; hlMajAffichage(); return; }
        HL.horsLigne = false;
        hlSynchroniser({ recharger: true });
      }
    }
  }, 20000);
  try { HL.derniereSynchro = localStorage.getItem('tinor_derniere_synchro'); } catch {}
  hlReprendreAncienneFile().then(hlMajAffichage);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {}); // silencieux : fonctionne en ligne même si le SW échoue (ex: http non sécurisé)
  }

  async function saveReception() {
    const errEl = document.getElementById('receptionFormError');
    errEl.style.display = 'none';
    const lignes = [...document.querySelectorAll('#receptionLignesRows .structRow')].map(row => ({
      produit_id: Number(row.querySelector('.recProduit').value) || null,
      quantite: Number(row.querySelector('.recQty').value) || null,
      lot_fournisseur: row.querySelector('.recLotFournisseur')?.value.trim() || null,
    })).filter(l => l.produit_id && l.quantite);

    const payload = {
      achat_id: document.getElementById('receptionAchat').value ? Number(document.getElementById('receptionAchat').value) : null,
      fournisseur_id: Number(document.getElementById('receptionFournisseur').value) || null,
      local_id: Number(document.getElementById('receptionLocal').value) || null,
      date_reception: document.getElementById('receptionDate').value,
      notes: document.getElementById('receptionNotes').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      lignes,
    };
    if (!payload.fournisseur_id || !payload.local_id || !payload.date_reception || !lignes.length) {
      errEl.textContent = 'Fournisseur, local, date et au moins une ligne valide sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/receptions', { method: 'POST', body: JSON.stringify(payload) });
      closeReceptionModal();
      const [receptions, achats, lots, produits] = await Promise.all([apiFetch('/receptions'), apiFetch('/achats'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.receptions = receptions; APP_DATA.achats = achats; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderReceptions(); renderAchats(); renderLotsRegistre(); renderProduits();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('receptionSaveBtn').addEventListener('click', saveReception);
  document.getElementById('receptionCancelBtn').addEventListener('click', closeReceptionModal);
  document.getElementById('receptionModalCloseBtn').addEventListener('click', closeReceptionModal);

  // ============================================================================
  // STOCK — 6 catégories déterminées par l'ORIGINE du lot (cohérent avec le
  // préfixe du n° de lot : MP/P/F/PF/A) — pas seulement le type de produit,
  // car un même produit (ex: huile Sésame) traverse plusieurs étapes.
  // ============================================================================
  function categorieStock(lot) {
    const p = APP_DATA.produits.find(x => x.id === lot.produit_id);
    if (!p) return null;
    if (p.type_article === 'EMBALLAGE') return 'emballage';
    if (p.type_article === 'CONSOMMABLE') return 'consommable';
    if (lot.origine === 'RECEPTION_MP') return 'matiere';
    if (lot.origine === 'PRESSE') return 'vrac';
    if (lot.origine === 'FILTRATION') return 'filtre';
    if (lot.origine === 'CONDITIONNEMENT' || lot.origine === 'PRODUCTION_RECETTE') return 'conditionne';
    if (lot.origine === 'REPRISE') { // stock repris à la mise en route : classé selon son étape d'origine
      let etape = null;
      try { etape = (typeof lot.champs_perso === 'string' ? JSON.parse(lot.champs_perso) : lot.champs_perso || {}).etape_reprise; } catch {}
      const parEtape = { MP: 'matiere', PRESSE: 'vrac', FILTRATION: 'filtre', CONDITIONNEMENT: 'conditionne' }[etape];
      if (parEtape) return parEtape;
      if (p.type_article === 'MATIERE_PREMIERE') return 'matiere';
      if (p.format_id) return 'conditionne';
      return nomFiltre(p.nom) ? 'filtre' : 'vrac';
    }
    if (lot.origine === 'AUTRE') { // ex. lot fini en vrac issu d'un mélange (import des registres)
      if (p.type_article === 'MATIERE_PREMIERE') return 'matiere';
      if (p.format_id) return 'conditionne';
      return nomFiltre(p.nom) ? 'filtre' : 'vrac';
    }
    if (lot.origine === 'ACHAT') {
      if (p.type_article === 'MATIERE_PREMIERE') return 'matiere';
      return p.format_id ? 'conditionne' : 'vrac'; // acheté déjà conditionné vs acheté en gros
    }
    return null;
  }
  function estHuile(produit) {
    const cat = REF_DATA.categories.find(c => c.id === produit.categorie_id);
    return cat ? /huile/i.test(cat.code) || /huile/i.test(cat.nom) : false;
  }

  // Filtre commun à tous les onglets : recherche libre (nom produit OU n° de
  // lot), plage de dates, et catégorie Huile/Autre/Toutes.
  function stockFilteredLots() {
    const recherche = document.getElementById('stockSearch').value.trim().toLowerCase();
    const debut = document.getElementById('stockFilterDateDebut').value;
    const fin = document.getElementById('stockFilterDateFin').value;
    const huileAutre = document.querySelector('.stockHuileToggle.active')?.dataset.val || 'toutes';
    return APP_DATA.lots.filter(l => {
      if (Number(l.quantite_actuelle) <= 0) return false;
      const p = APP_DATA.produits.find(x => x.id === l.produit_id);
      if (!p) return false;
      if (recherche && !l.numero_lot.toLowerCase().includes(recherche) && !p.nom.toLowerCase().includes(recherche)) return false;
      const dateRef = (l.date_production || l.created_at || '').slice(0, 10);
      if (debut && dateRef && dateRef < debut) return false;
      if (fin && dateRef && dateRef > fin) return false;
      if (huileAutre === 'huile' && !estHuile(p)) return false;
      if (huileAutre === 'autre' && estHuile(p)) return false;
      return true;
    });
  }

  function renderStockSimpleTable(bodyId, categorie, emptyMsg) {
    const body = document.getElementById(bodyId);
    const lots = stockFilteredLots().filter(l => categorieStock(l) === categorie);
    if (!lots.length) { body.innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">${emptyMsg}</td></tr>`; return; }
    body.innerHTML = lots.map(l => {
      const p = APP_DATA.produits.find(x => x.id === l.produit_id) || {};
      const local = APP_DATA.locaux.find(x => x.id === l.local_id);
      const format = p.format_id ? REF_DATA.formats.find(f => f.id === p.format_id) : null;
      // Contenance : pour un produit conditionné/emballage avec un format,
      // affiche la taille de chaque unité (ex: "30 ml / unité").
      let contenance = '—';
      if (format) {
        if (format.volume) contenance = `${format.volume} ml / unité`;
        else if (format.poids) contenance = `${format.poids} g / unité`;
      }
      return `<tr>
        <td class="lotCode">${esc(p.code || '—')}</td>
        <td>${esc(p.nom || '—')}</td>
        <td class="lotCode">${esc(l.numero_lot)}</td>
        <td class="rowMeta">${esc(local ? local.nom : '—')}</td>
        <td>${pillStatut(l.statut)}</td>
        <td class="num">${l.quantite_actuelle} ${format ? 'u' : (p.unite_symbole || '')}</td>
        <td class="rowMeta num">${contenance}</td>
      </tr>`;
    }).join('');
  }
  function renderStockMatiere() { renderStockSimpleTable('stockMatiereBody', 'matiere', 'Aucune matière première en stock pour ce filtre.'); }
  function renderStockVrac() { renderStockSimpleTable('stockVracBody', 'vrac', 'Aucun vrac (non traité) en stock pour ce filtre.'); }
  function renderStockFiltre() { renderStockSimpleTable('stockFiltreBody', 'filtre', 'Aucun vrac filtré en stock pour ce filtre.'); }
  function renderStockConditionne() { renderStockSimpleTable('stockConditionneBody', 'conditionne', 'Aucun produit conditionné en stock pour ce filtre.'); }
  function renderStockEmballage() { renderStockSimpleTable('stockEmballageBody', 'emballage', 'Aucun emballage en stock pour ce filtre.'); }
  function renderStockConsommables() { renderStockSimpleTable('stockConsommablesBody', 'consommable', 'Aucun consommable en stock pour ce filtre.'); }

