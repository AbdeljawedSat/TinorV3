  // ---------- Stock — exporte exactement l'onglet actuellement affiché ----------
  function stockExporter(format) {
    const ongletActif = document.querySelector('.stockTab.active')?.dataset.tab || 'matiere';
    const nomOnglet = { matiere: 'Matière première', vrac: 'Vrac', filtre: 'Filtré', conditionne: 'Conditionné', emballage: 'Emballage', consommables: 'Consommable', repartition: 'Répartition' }[ongletActif] || ongletActif;
    const { headers, rows } = ongletActif === 'repartition' ? exportRepartition() : extraireTableauVisible(`#stockPanel-${ongletActif}`);
    telechargerExportGenerique(`Stock — ${nomOnglet}`, `Onglet : ${nomOnglet}`, headers, rows, format, `stock_${ongletActif}`);
  }
  document.getElementById('stockExportDocxBtn').addEventListener('click', () => stockExporter('docx'));
  document.getElementById('stockExportXlsxBtn').addEventListener('click', () => stockExporter('xlsx'));
  document.getElementById('stockExportPdfBtn').addEventListener('click', () => stockExporter('pdf'));

  // ============================================================================
  // Structure des lots — connectée à /api/lot-type-champs (persistée en base,
  // plus un objet JS local).
  // ============================================================================
  const STRUCT_TYPES = [
    ['ACHAT', 'Achat'], ['RECEPTION_MP', 'Réception matière première'], ['PRESSE', 'Presse'],
    ['FILTRATION', 'Filtration'], ['CONDITIONNEMENT', 'Conditionnement'],
    ['PRODUCTION_RECETTE', 'Production (recette)'], ['INVENTAIRE', 'Inventaire'], ['AUTRE', 'Autre'],
  ];
  const FIELD_TYPE_API = ['texte', 'nombre', 'date', 'liste', 'case_a_cocher'];
  const FIELD_TYPE_LABEL = { texte: 'Texte', nombre: 'Nombre', date: 'Date', liste: 'Liste déroulante', case_a_cocher: 'Case à cocher' };
  let structSelectedType = STRUCT_TYPES[0][0];
  const structCache = {}; // type_lot -> [champs]

  async function structFetchType(type) {
    structCache[type] = await apiFetch(`/lot-type-champs/${type}`);
    return structCache[type];
  }

  function structRenderTypeList() {
    const el = document.getElementById('structTypeList');
    el.innerHTML = STRUCT_TYPES.map(([type, label]) => {
      const n = (structCache[type] || []).length;
      return `<button data-type="${type}" class="${type === structSelectedType ? 'active' : ''}">
        ${label}<span class="cnt">${n} champ${n > 1 ? 's' : ''}</span>
      </button>`;
    }).join('');
    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        structSelectedType = btn.dataset.type;
        if (!structCache[structSelectedType]) await structFetchType(structSelectedType);
        structRenderTypeList();
        structRenderFields();
      });
    });
  }

  function structRenderFields() {
    document.getElementById('structLockedNote').textContent =
      `Les champs N° de lot, Produit et Date sont communs à tous les types et non modifiables.`;
    const fields = structCache[structSelectedType] || [];
    const wrap = document.getElementById('structFieldRows');
    wrap.innerHTML = fields.map((f) => `
      <div class="structRow" data-id="${f.id}">
        <input type="text" class="fNom" value="${esc(f.nom)}" ${f.verrouille ? 'disabled' : ''}>
        <select class="fType" ${f.verrouille ? 'disabled' : ''}>
          ${FIELD_TYPE_API.map(t => `<option value="${t}" ${t === f.type_champ ? 'selected' : ''}>${FIELD_TYPE_LABEL[t]}</option>`).join('')}
        </select>
        <label class="reqToggle"><input type="checkbox" class="fReq" ${f.obligatoire ? 'checked' : ''} ${f.verrouille ? 'disabled' : ''}> requis</label>
        <button class="delField" title="Supprimer ce champ" ${f.verrouille ? 'disabled style="opacity:.25; cursor:not-allowed;"' : ''}>✕</button>
      </div>`).join('');

    wrap.querySelectorAll('.structRow').forEach(row => {
      const id = row.dataset.id;
      const field = fields.find(f => String(f.id) === id);
      row.dataset.persistFn = ''; // marqueur, la vraie fonction est attachée ci-dessous via closure
      const persist = async () => {
        try {
          await apiFetch(`/lot-type-champs/champs/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ nom: field.nom, type_champ: field.type_champ, obligatoire: field.obligatoire }),
          });
        } catch (err) { notifier(err.message, 'erreur'); }
      };
      row._persist = persist; // exposé pour "Enregistrer" (force la sauvegarde même sans blur)
      row.querySelector('.fNom').addEventListener('change', e => { field.nom = e.target.value; persist(); });
      row.querySelector('.fType').addEventListener('change', e => { field.type_champ = e.target.value; persist(); });
      row.querySelector('.fReq').addEventListener('change', e => { field.obligatoire = e.target.checked; persist(); });
      const del = row.querySelector('.delField');
      if (!field.verrouille) {
        del.addEventListener('click', async () => {
          try {
            await apiFetch(`/lot-type-champs/champs/${id}`, { method: 'DELETE' });
            await structFetchType(structSelectedType);
            structRenderTypeList();
            structRenderFields();
          } catch (err) { notifier(err.message, 'erreur'); }
        });
      }
    });
  }

  // ============================================================================
  // CHAMPS PERSONNALISÉS PAR TYPE DE LOT — rend "Structure des lots" active :
  // les champs ajoutés dans Traçabilité → Structure des lots apparaissent
  // désormais réellement dans les formulaires de Presse/Filtration/Conditionnement.
  // ============================================================================
  async function chargerChampsPerso(typeLot) {
    const champs = await apiFetch(`/lot-type-champs/${typeLot}`);
    return champs.filter(c => !c.verrouille); // les 3 champs de base sont déjà dans le formulaire, pas dupliqués ici
  }
  function renderChampPersoInput(champ, valeur) {
    const val = valeur != null ? valeur : '';
    const label = `<label class="formLbl">${esc(champ.nom)}${champ.obligatoire ? ' *' : ''}</label>`;
    if (champ.type_champ === 'nombre') return `${label}<input type="number" step="any" class="champPersoInput formInput" data-nom="${esc(champ.nom)}" data-obligatoire="${!!champ.obligatoire}" value="${esc(val)}">`;
    if (champ.type_champ === 'date') return `${label}<input type="date" class="champPersoInput formInput" data-nom="${esc(champ.nom)}" data-obligatoire="${!!champ.obligatoire}" value="${esc(val)}">`;
    if (champ.type_champ === 'case_a_cocher') return `<label class="chkLbl" style="margin-top:8px;"><input type="checkbox" class="champPersoInput" data-nom="${esc(champ.nom)}" data-type="case" ${val ? 'checked' : ''}> ${esc(champ.nom)}</label>`;
    return `${label}<input type="text" class="champPersoInput formInput" data-nom="${esc(champ.nom)}" data-obligatoire="${!!champ.obligatoire}" value="${esc(val)}">`;
  }
  async function afficherChampsPerso(containerId, typeLot, valeurs = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const champs = await chargerChampsPerso(typeLot);
    container.innerHTML = champs.length
      ? `<div class="rowMeta" style="margin:4px 0 8px; font-weight:600;">Champs personnalisés (Structure des lots)</div>` + champs.map(c => renderChampPersoInput(c, valeurs[c.nom])).join('')
      : '';
  }
  // Renvoie null si un champ obligatoire est vide (et affiche une erreur), sinon l'objet des valeurs.
  function collecterChampsPerso(containerId, errElId) {
    const container = document.getElementById(containerId);
    if (!container) return {};
    const result = {};
    let manquant = null;
    container.querySelectorAll('.champPersoInput').forEach(el => {
      const nom = el.dataset.nom;
      const valeur = el.dataset.type === 'case' ? el.checked : el.value;
      if (el.dataset.obligatoire === 'true' && (valeur === '' || valeur == null)) manquant = nom;
      result[nom] = valeur;
    });
    if (manquant && errElId) {
      const errEl = document.getElementById(errElId);
      errEl.textContent = `Le champ personnalisé "${manquant}" est obligatoire.`;
      errEl.style.display = 'block';
      return null;
    }
    return result;
  }

  async function structOpen() {
    document.getElementById('structOverlay').classList.add('open');
    await Promise.all(STRUCT_TYPES.map(([type]) => structFetchType(type)));
    structRenderTypeList();
    structRenderFields();
  }
  function structClose() {
    document.getElementById('structOverlay').classList.remove('open');
  }

  document.getElementById('openLotStructureBtn').addEventListener('click', structOpen);
  document.getElementById('structCloseBtn').addEventListener('click', structClose);
  document.getElementById('structCancelBtn').addEventListener('click', structClose);
  document.getElementById('structOverlay').addEventListener('click', e => {
    if (e.target.id === 'structOverlay') structClose();
  });
  document.getElementById('addStructFieldBtn').addEventListener('click', async () => {
    try {
      // Un nom vide est rejeté par le serveur (à raison) — on démarre avec un
      // nom par défaut modifiable immédiatement, plutôt que d'échouer silencieusement.
      await apiFetch(`/lot-type-champs/${structSelectedType}/champs`, {
        method: 'POST', body: JSON.stringify({ nom: 'Nouveau champ', type_champ: 'texte', obligatoire: false }),
      });
      await structFetchType(structSelectedType);
      structRenderTypeList();
      structRenderFields();
      const inputs = document.querySelectorAll('#structFieldRows .fNom');
      if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
    } catch (err) { notifier(err.message, 'erreur'); }
  });
  document.getElementById('structSaveBtn').addEventListener('click', async () => {
    const status = document.getElementById('structStatus');
    // Force la sauvegarde de toutes les lignes modifiables à partir de leur
    // valeur ACTUELLE à l'écran — couvre le cas où l'utilisateur tape puis
    // clique directement sur Enregistrer sans quitter le champ (pas de
    // "change" déclenché sinon).
    const rows = [...document.querySelectorAll('#structFieldRows .structRow')];
    try {
      await Promise.all(rows.map(row => {
        const nomEl = row.querySelector('.fNom');
        if (nomEl.disabled) return null; // champ verrouillé, rien à sauvegarder
        return apiFetch(`/lot-type-champs/champs/${row.dataset.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            nom: nomEl.value,
            type_champ: row.querySelector('.fType').value,
            obligatoire: row.querySelector('.fReq').checked,
          }),
        });
      }));
      await structFetchType(structSelectedType);
      structRenderTypeList();
      structRenderFields();
      status.classList.add('show');
      setTimeout(() => status.classList.remove('show'), 1800);
    } catch (err) { notifier(err.message, 'erreur'); }
  });

  const views = {
    dashboard:'view-dashboard', commandes:'view-commandes', clients:'view-clients',
    produits:'view-produits', lots:'view-lots', fournisseurs:'view-fournisseurs',
    tracabilite:'view-tracabilite', locaux:'view-locaux', employes:'view-employes',
    presse:'view-presse', filtration:'view-filtration', melanges:'view-melanges', conditionnement:'view-conditionnement',
    factures:'view-factures', utilisateurs:'view-utilisateurs',
    recettes:'view-recettes', 'historique-prod':'view-historique-prod',
    'grille-prix':'view-grille-prix', remises:'view-remises',
    achats:'view-achats', receptions:'view-receptions',
    'stock':'view-stock',
    'stock-mouvements':'view-stock-mouvements', inventaires:'view-inventaires', reprise:'view-reprise',
    notifications:'view-notifications', synchro:'view-synchro', paiements:'view-paiements', livraisons:'view-livraisons', proformas:'view-proformas', avoirs:'view-avoirs', stats:'view-stats',
    certificats:'view-certificats', parametres:'view-parametres', numerotation:'view-numerotation', journal:'view-journal', 'qualite-parametres':'view-qualite-parametres', marges:'view-marges', 'paiements-fournisseurs':'view-paiements-fournisseurs', apropos:'view-apropos'
  };
  const titles = {
    dashboard:['Tableau de bord',null], notifications:['Notifications',null], synchro:['Synchronisation',null],
    commandes:['Commerce','Commandes'], factures:['Commerce','Factures'],
    paiements:['Commerce','Paiements'], avoirs:['Commerce','Avoirs'], livraisons:['Commerce','Bons de livraison'], proformas:['Commerce','Factures en attente'], stats:['Commerce','Statistiques'], clients:['Commerce','Clients'],
    'grille-prix':['Commerce','Grille de prix'], remises:['Commerce','Remises'],
    produits:['Catalogue & Stock','Produits'], recettes:['Catalogue & Stock','Recettes'],
    lots:['Catalogue & Stock','Registre des lots'], tracabilite:['Catalogue & Stock','Traçabilité'],
    'stock':['Catalogue & Stock','Stock'], 'stock-mouvements':['Catalogue & Stock','Mouvements'], inventaires:['Catalogue & Stock','Inventaires'], reprise:['Catalogue & Stock','Reprise du stock'],
    presse:['Production','Lots de presse'], filtration:['Production','Filtration'], melanges:['Production','Mélange (lot fini)'],
    'conditionnement':['Production','Conditionnement'], 'historique-prod':['Production','Historique'],
    achats:['Achats & Système','Achats'], receptions:['Achats & Système','Réceptions MP'],
    fournisseurs:['Achats & Système','Fournisseurs'], certificats:['Achats & Système','Certificats Bio'],
    locaux:['Achats & Système','Locaux & Zones'], employes:['Achats & Système','Employés'],
    utilisateurs:['Achats & Système','Utilisateurs'], parametres:['Achats & Système','Paramètres'], numerotation:['Achats & Système','Numérotation'], journal:['Achats & Système','Journal d\'audit'], 'qualite-parametres':['Achats & Système','Paramètres qualité'], marges:['Ventes','Marges & coûts'], 'paiements-fournisseurs':['Achats & Système','Paiements fournisseurs'], apropos:['Achats & Système','À propos']
  };

  document.querySelectorAll('#navScroll .navGroup').forEach(g => {
    const rubrique = g.querySelector('.lbl').textContent;
    g.querySelectorAll('a[data-view]').forEach(a => { if (titles[a.dataset.view]) titles[a.dataset.view][0] = rubrique; });
  });
  let CURRENT_VIEW_KEY = 'dashboard';
  function setActive(key, el){
    CURRENT_VIEW_KEY = key;
    document.querySelectorAll('.navChildren a, .navSingle').forEach(a=>a.classList.remove('active'));
    el.classList.add('active');
    el.closest('.navGroup')?.classList.add('open');

    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const viewId = views[key] || 'view-placeholder';
    if(viewId === 'view-placeholder'){
      document.getElementById('phTitle').textContent = (titles[key] && titles[key][1]) || key;
    }
    document.getElementById(viewId).classList.add('active');
    if (key === 'synchro') renderSynchro();

    const [group, leaf] = titles[key] || [key, null];
    document.getElementById('crumbs').innerHTML = leaf
      ? `<b>${group}</b> <span class="sep">›</span> ${leaf}`
      : `<b>${group}</b>`;

    // Le bouton "+ Nouveau" n'a de sens que sur les écrans qui savent créer
    // quelque chose — grisé ailleurs (ex: Mouvements, historique en lecture
    // seule généré automatiquement) plutôt que d'afficher une alerte après coup.
    const btnNouveau = document.getElementById('btnNouveau');
    const creationPossible = !!NOUVEAU_HANDLERS[key] && !(GERANT_ONLY_VIEWS.has(key) && !isGerant());
    btnNouveau.disabled = !creationPossible;
    btnNouveau.style.opacity = creationPossible ? '1' : '0.4';
    btnNouveau.style.cursor = creationPossible ? 'pointer' : 'not-allowed';
    btnNouveau.title = creationPossible ? '' : (NOUVEAU_HANDLERS[key] ? 'Réservé au rôle Gérant' : "Écran en lecture seule — rien à créer ici");

    // La traçabilité dépend de la liste de lots la plus fraîche possible —
    // on la recharge à chaque arrivée sur cet écran plutôt que de se fier au
    // chargement initial du login (les lots changent constamment ailleurs :
    // presse, filtration, conditionnement, ventes...).
    if (key === 'tracabilite' && TOKEN) {
      apiFetch('/lots').then(lots => { APP_DATA.lots = lots; tracPopulateTypes(); tracPopulateLots(); });
    }
    if (key === 'stock' && TOKEN) {
      apiFetch('/lots').then(lots => { APP_DATA.lots = lots; renderStockAll(); });
    }
    if (key === 'inventaires' && TOKEN) chargerInventaires();
    if (key === 'reprise' && TOKEN) chargerReprises();
    if (key === 'melanges' && TOKEN) chargerMelanges();
    if (TOKEN) majBadgesMenu(); // les compteurs suivent les créations faites depuis n'importe quel écran
    if (key === 'stock-mouvements' && TOKEN) {
      apiFetch('/stock-mouvements').then(m => { APP_DATA.stockMouvements = m; renderStockMouvements(); });
    }
    if (key === 'notifications' && TOKEN) {
      apiFetch('/notifications').then(n => { APP_DATA.notifications = n; renderNotifications(); });
    }
    if (key === 'parametres' && TOKEN) {
      chargerListeBackups();
    }
    if (key === 'apropos') chargerApropos();
    if (key === 'marges' && TOKEN) chargerMarges().catch(e => notifier(e.message, 'erreur'));
    if (key === 'paiements-fournisseurs' && TOKEN) chargerPaiementsFournisseurs().catch(e => notifier(e.message, 'erreur'));
    if (key === 'qualite-parametres' && TOKEN) chargerParametresQualite().catch(e => notifier(e.message, 'erreur'));
    if (key === 'journal' && TOKEN) chargerJournal().catch(e => notifier(e.message, 'erreur'));
    if (key === 'numerotation' && TOKEN) chargerNumerotation().catch(e => notifier(e.message, 'error'));

    if(window.innerWidth <= 880) document.getElementById('sidebar').classList.remove('open');
    majOngletsMobile(key);
    if (typeof majRubrique === 'function') majRubrique(key);
  }

  document.querySelectorAll('.navChildren a, .navSingle').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      setActive(a.dataset.view, a);
    });
  });

  document.querySelectorAll('.navGroupBtn').forEach(btn=>{
    // Une seule rubrique dépliée : en ouvrir une referme la précédente.
    btn.addEventListener('click', ()=> {
      const groupe = btn.closest('.navGroup'), ouvrir = !groupe.classList.contains('open');
      document.querySelectorAll('#navScroll .navGroup.open').forEach(g => g.classList.remove('open'));
      groupe.classList.toggle('open', ouvrir);
    });
  });

