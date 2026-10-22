  // ---------- Conditionnement en 4 étapes : source → format + quantité → produit fini → consommables ----------
  // Lots utilisables comme source : huile en vrac (presse), huile filtrée (filtration), vrac acheté.
  function sourcesConditionnement() {
    const dispoLot = l => Number(l.quantite_actuelle) > 0 && l.lot_statut === 'LIBERE';
    const produit = id => APP_DATA.produits.find(p => p.id === id);
    const unite = id => produit(id)?.unite_symbole || 'L';
    const presse = APP_DATA.lotsPresse.filter(dispoLot).map(l => ({ cle: `presse:${l.id}`, type: 'presse', id: l.id, produit_id: l.produit_id, numero_lot: l.numero_lot, nom: l.produit_nom, dispo: Number(l.quantite_actuelle), tag: 'Vrac' }));
    const filtration = APP_DATA.lotsFiltration.filter(dispoLot).map(l => ({ cle: `filtration:${l.id}`, type: 'filtration', id: l.id, produit_id: l.produit_id, numero_lot: l.numero_lot, nom: l.produit_nom, dispo: Number(l.quantite_actuelle), tag: 'Filtrée' }));
    const direct = APP_DATA.lots.filter(l => (l.origine === 'ACHAT' || l.origine === 'RECEPTION_MP') && l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0
        && cleHuileGen(produit(l.produit_id)?.nom) && !produit(l.produit_id)?.format_id)
      .map(l => ({ cle: `direct:${l.id}`, type: 'direct', id: l.id, produit_id: l.produit_id, numero_lot: l.numero_lot, nom: produit(l.produit_id)?.nom || '', dispo: Number(l.quantite_actuelle), tag: 'Achat' }));
    const finis = APP_DATA.lots.filter(l => estLotMelange(l) && l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0)
      .map(l => ({ cle: `direct:${l.id}`, type: 'direct', id: l.id, produit_id: l.produit_id, numero_lot: l.numero_lot, nom: produit(l.produit_id)?.nom || '', dispo: Number(l.quantite_actuelle), tag: 'Lot fini' }));
    return [...finis, ...filtration, ...presse, ...direct].map(s => ({ ...s, unite: unite(s.produit_id) }));
  }
  // Clé d'une huile à toutes les étapes : « Huile de Sésame — Flacon 30ml » → « sesame ».
  function cleHuileGen(nom) {
    const m = normaliserNomGraine(nom).match(/^huiles?\s*(?:de\s+|d')?(.+)$/);
    return m ? sansPepins(m[1].split(/\s+[-–—]\s+|\s*\(/)[0].trim()) : null;
  }
  // « Huile de Sésame — Filtrée » → « Huile de Sésame »
  const baseNomHuile = nom => String(nom || '').split(/\s+[-–—]\s+|\s*\(/)[0].trim();
  let COND_SOURCES = [];
  function lignesSourcesCond() {
    return [...document.querySelectorAll('#conditionnementSourcesRows .srcCond')].map(row => ({
      row, src: COND_SOURCES.find(s => s.cle === row.querySelector('.srcLot').value) || null,
      q: Number(row.querySelector('.srcQte').value) || 0,
    }));
  }
  function ligneSourceCond(cle) {
    const row = document.createElement('div');
    row.className = 'srcCond';
    const groupe = (tag, titre) => {
      const l = COND_SOURCES.filter(s => s.tag === tag);
      return l.length ? `<optgroup label="${titre}">${l.map(s => `<option value="${s.cle}">${esc(s.numero_lot)} — ${esc(s.nom)}</option>`).join('')}</optgroup>` : '';
    };
    row.innerHTML = `
      <select class="srcLot formInput" style="margin:0;"><option value="">— Choisir un lot —</option>${groupe('Lot fini', 'Lot fini (mélange) — flacons au n° du mélange')}${groupe('Filtrée', 'Huile filtrée (filtration)')}${groupe('Vrac', 'Huile en vrac (presse)')}${groupe('Achat', 'Vrac acheté')}</select>
      <input type="number" step="0.001" min="0" class="srcQte formInput" placeholder="Qté" style="margin:0;">
      <span class="srcPart"></span>
      <button class="delField" type="button" title="Retirer">✕</button>
      <div class="dispo"></div>`;
    row.querySelector('.srcLot').value = cle || '';
    row.querySelector('.srcLot').addEventListener('change', () => { row.querySelector('.srcQte').dataset.auto = '1'; majConditionnement('source'); });
    row.querySelector('.srcQte').addEventListener('input', () => { delete row.querySelector('.srcQte').dataset.auto; majConditionnement('qte'); });
    row.querySelector('.delField').addEventListener('click', () => { row.remove(); majConditionnement('source'); });
    row.querySelector('.srcQte').dataset.auto = '1';
    return row;
  }
  function formatCond() { return REF_DATA.formats.find(f => f.id === Number(document.getElementById('conditionnementFormat').value)) || null; }
  const libFormat = f => !f ? '' : Number(f.volume) >= 1000 ? `${Number(f.volume) / 1000} L` : f.volume ? `${Number(f.volume)} ml` : f.poids ? `${Number(f.poids)} g` : f.nom;
  // Contenance d'une unité dans l'unité du vrac (L ou kg).
  const contenanceBase = f => !f ? null : f.volume ? Number(f.volume) / 1000 : f.poids ? Number(f.poids) / 1000 : null;
  // Nom proposé pour un nouveau produit fini : « Huile de Sésame — Flacon 100ml » / « Huile Mélange Sésame-Nigelle — Flacon 30ml ».
  function nomProduitPropose() {
    const srcs = lignesSourcesCond().filter(l => l.src);
    const f = formatCond();
    const suffixe = f ? ` — Flacon ${f.volume ? (Number(f.volume) >= 1000 ? Number(f.volume) / 1000 + 'L' : Number(f.volume) + 'ml') : libFormat(f)}` : ' — Flacon';
    if (!srcs.length) return '';
    if (document.getElementById('conditionnementMelange').checked) {
      // Une source déjà « mélange » apporte ses propres huiles : Sésame + (Sésame-Nigelle) → Sésame-Nigelle.
      const noms = [...new Set(srcs.flatMap(l => {
        const base = baseNomHuile(l.src.nom);
        return /^huiles?\s+m[ée]lange\s+/i.test(base) ? base.replace(/^huiles?\s+m[ée]lange\s+/i, '').split('-') : [nomCourtHuile(base)];
      }))];
      return `Huile Mélange ${noms.join('-')}${suffixe}`;
    }
    return `${baseNomHuile(srcs[0].src.nom)}${suffixe}`;
  }
  const estProduitFini = p => !!p && !!p.format_id && !['MATIERE_PREMIERE', 'EMBALLAGE', 'CONSOMMABLE'].includes(p.type_article);
  function remplirProduitsCond() {
    const sel = document.getElementById('conditionnementProduit');
    const avant = sel.value;
    const melange = document.getElementById('conditionnementMelange').checked;
    const tous = document.getElementById('conditionnementTous').checked;
    const nouveau = document.getElementById('conditionnementNouveau').checked;
    sel.style.display = nouveau ? 'none' : 'block';
    document.getElementById('conditionnementNouveauBloc').style.display = nouveau ? 'block' : 'none';
    const f = formatCond();
    const srcs = lignesSourcesCond().filter(l => l.src);
    const cle = srcs.length ? cleHuileGen(srcs[0].src.nom) : null;
    let liste;
    if (tous) liste = APP_DATA.produits.filter(estProduitFini);
    else liste = APP_DATA.produits.filter(p => estHuileConditionnee(p)
      && (melange ? estNomMelange(p.nom) : !cle || cleHuileGen(p.nom) === cle)
      && (!f || p.format_id === f.id));
    liste.sort((a, b) => a.nom.localeCompare(b.nom));
    const quoi = melange ? 'mélange' : srcs.length ? `« ${baseNomHuile(srcs[0].src.nom)} »` : 'huile';
    populateSelect(sel, liste, 'id', 'nom', liste.length ? null : `— Aucun produit ${quoi}${f ? ' en ' + libFormat(f) : ''} : cochez « Nouveau produit fini » ou « Afficher tous » —`);
    if (liste.some(p => String(p.id) === avant)) sel.value = avant;
    const nomInput = document.getElementById('conditionnementNouveauNom');
    if (!nomInput.dataset.modifie) nomInput.value = nomProduitPropose();
  }
  // Consommables proposés : le flacon du format choisi + l'étiquette, autant que d'unités.
  function ligneConsommableCond(produitId, qte) {
    const consommables = APP_DATA.produits.filter(p => p.type_article === 'CONSOMMABLE' || p.type_article === 'EMBALLAGE');
    const row = document.createElement('div');
    row.className = 'structRow';
    row.style.gridTemplateColumns = '1.5fr 100px 32px';
    row.innerHTML = `
      <select class="consProduit formInput">${optionsGroupedByCategorie(consommables.length ? consommables : APP_DATA.produits)}</select>
      <input type="number" step="1" class="consQte formInput" placeholder="Qté">
      <button class="delField" type="button">✕</button>`;
    if (produitId) row.querySelector('.consProduit').value = String(produitId);
    row.querySelector('.consQte').value = qte || '';
    const manuel = () => { document.getElementById('conditionnementConsommablesRows').dataset.manuel = '1'; };
    row.querySelector('.consProduit').addEventListener('change', manuel);
    row.querySelector('.consQte').addEventListener('input', manuel);
    row.querySelector('.delField').addEventListener('click', () => { manuel(); row.remove(); });
    return row;
  }
  function proposerConsommables() {
    const zone = document.getElementById('conditionnementConsommablesRows');
    if (zone.dataset.manuel) return;
    const f = formatCond(), qty = Number(document.getElementById('conditionnementQty').value) || '';
    zone.innerHTML = '';
    if (!f) return;
    const flacon = APP_DATA.produits.find(p => p.type_article === 'EMBALLAGE' && p.format_id === f.id);
    const etiquette = APP_DATA.produits.find(p => p.type_article === 'CONSOMMABLE' && /tiquette/i.test(p.nom));
    if (flacon) zone.appendChild(ligneConsommableCond(flacon.id, qty));
    if (etiquette) zone.appendChild(ligneConsommableCond(etiquette.id, qty));
  }
  // Recalcule tout : huile nécessaire, report dans la source, parts du mélange, produits, consommables, bilan.
  function majConditionnement(origine) {
    if (document.getElementById('conditionnementModalId').value) return; // mode édition : rien à recalculer
    const melange = document.getElementById('conditionnementMelange').checked;
    const f = formatCond(), qty = Number(document.getElementById('conditionnementQty').value) || 0;
    const unite = contenanceBase(f);
    const lignes = lignesSourcesCond();
    const symbole = f && f.poids ? 'kg' : 'L';
    const besoin = unite && qty ? Math.round(qty * unite * 1000) / 1000 : null;
    // Une seule source : on y reporte l'huile nécessaire (tant que l'utilisateur n'a pas saisi lui-même).
    if (besoin != null && lignes.length === 1 && lignes[0].row.querySelector('.srcQte').dataset.auto) {
      lignes[0].row.querySelector('.srcQte').value = besoin; lignes[0].q = besoin;
    }
    const total = lignes.reduce((t, l) => t + l.q, 0);
    lignes.forEach(l => {
      l.row.querySelector('.srcPart').textContent = melange && total && l.q ? `${Math.round(l.q / total * 1000) / 10} %` : '';
      l.row.querySelector('.dispo').innerHTML = l.src ? `<span class="pill">${l.src.tag}</span> disponible : ${l.src.dispo} ${l.src.unite}${l.q > l.src.dispo ? ' — <b style="color:var(--danger)">insuffisant</b>' : ''}` : '';
    });
    const calc = document.getElementById('conditionnementCalcul');
    calc.style.display = f ? 'block' : 'none';
    if (f) calc.innerHTML = `Contenance : <b>${libFormat(f)} par unité</b> (repris du format)` + (besoin != null ? ` · Huile nécessaire : ${qty} × ${libFormat(f)} = <b>${besoin.toLocaleString('fr-TN', { maximumFractionDigits: 3 })} ${symbole}</b>` : '');
    if (origine !== 'produit') remplirProduitsCond();
    if (origine === 'format' || origine === 'qty' || origine === 'init') proposerConsommables();
    // Bilan
    const bilan = document.getElementById('conditionnementBilan');
    const erreurs = [];
    if (lignes.some(l => l.src && l.q > l.src.dispo)) erreurs.push('une source n\'a pas assez de stock');
    if (besoin != null && total && besoin > Math.round(total * 1000) / 1000) erreurs.push(`il faut ${besoin} ${symbole} mais les sources ne totalisent que ${Math.round(total * 1000) / 1000} ${symbole}`);
    const huiles = new Set(lignes.filter(l => l.src).map(l => cleHuileGen(l.src.nom)));
    if (melange && huiles.size < 2) erreurs.push('un mélange demande au moins deux huiles différentes');
    if (!melange && huiles.size > 1) erreurs.push('plusieurs huiles différentes : cochez « Mélange »');
    bilan.style.display = lignes.some(l => l.src) || qty ? 'block' : 'none';
    bilan.classList.toggle('ko', erreurs.length > 0);
    const srcTxt = lignes.filter(l => l.src && l.q).map(l => `${l.q} ${l.src.unite} pris sur ${l.src.numero_lot} (reste ${Math.round((l.src.dispo - l.q) * 1000) / 1000} ${l.src.unite})`).join(' · ');
    bilan.textContent = erreurs.length ? `⚠ ${erreurs.join(' ; ')}.` : `Bilan : ${srcTxt || 'source à choisir'}${qty ? ` · ${qty} unité(s) créée(s)` : ''}`;
    return erreurs[0] || null;
  }
  async function openConditionnementModal(id) {
    document.getElementById('conditionnementFormError').style.display = 'none';
    [APP_DATA.lotsPresse, APP_DATA.lotsFiltration, APP_DATA.lots] = await Promise.all([apiFetch('/presse'), apiFetch('/filtration'), apiFetch('/lots')]);
    COND_SOURCES = sourcesConditionnement();
    const c = id ? APP_DATA.conditionnements.find(x => x.id === id) : null;
    document.getElementById('conditionnementModalId').value = c ? c.id : '';
    document.querySelector('#conditionnementModalOverlay .modalHead h2').textContent = c ? `Modifier — ${c.numero_lot}` : 'Nouveau conditionnement';
    document.getElementById('conditionnementDate').value = c ? c.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    document.getElementById('conditionnementNote').value = c && c.note ? c.note : '';
    ['conditionnementMelange', 'conditionnementTous', 'conditionnementNouveau'].forEach(i => { document.getElementById(i).checked = false; });
    const nomInput = document.getElementById('conditionnementNouveauNom');
    nomInput.value = ''; delete nomInput.dataset.modifie;
    // Formats : en volume (huiles) du plus petit au plus grand, puis les poids.
    const formats = [...REF_DATA.formats].sort((a, b) => (!!a.poids - !!b.poids) || (Number(a.volume || a.poids) - Number(b.volume || b.poids)))
      .map(f => ({ id: f.id, nom: libFormat(f) }));
    populateSelect(document.getElementById('conditionnementFormat'), formats, 'id', 'nom', '— Choisir le format —');
    document.querySelectorAll('#conditionnementModalOverlay [data-saisie]').forEach(el => { el.style.display = c ? 'none' : ''; });
    document.getElementById('conditionnementLockedNote').style.display = c ? 'block' : 'none';
    document.getElementById('conditionnementAddSourceBtn').style.display = c ? 'none' : 'inline-flex';
    document.getElementById('conditionnementAddConsommableBtn').style.display = c ? 'none' : 'inline-flex';
    ['conditionnementFormat', 'conditionnementQty', 'conditionnementProduit'].forEach(i => { document.getElementById(i).disabled = !!c; });
    const rowsWrap = document.getElementById('conditionnementSourcesRows');
    const consWrap = document.getElementById('conditionnementConsommablesRows');
    delete consWrap.dataset.manuel;
    document.getElementById('conditionnementBilan').style.display = 'none';
    document.getElementById('conditionnementCalcul').style.display = 'none';
    if (c) {
      const produit = APP_DATA.produits.find(p => p.id === c.produit_id);
      populateSelect(document.getElementById('conditionnementProduit'), produit ? [produit] : [], 'id', 'nom');
      document.getElementById('conditionnementProduit').style.display = 'block';
      document.getElementById('conditionnementNouveauBloc').style.display = 'none';
      document.getElementById('conditionnementFormat').value = c.format_id || '';
      document.getElementById('conditionnementQty').value = c.qty;
      rowsWrap.innerHTML = `<div class="rowMeta" style="padding:6px 0;">Sources déjà consommées — non modifiables (voir le Registre des lots pour le détail de traçabilité).</div>`;
      consWrap.innerHTML = `<div class="rowMeta" style="padding:6px 0;">Consommables déjà consommés — non modifiables.</div>`;
    } else {
      document.getElementById('conditionnementQty').value = '';
      rowsWrap.innerHTML = '';
      consWrap.innerHTML = '';
      rowsWrap.appendChild(ligneSourceCond(COND_SOURCES[0]?.cle));
      majConditionnement('init');
      // Format pré-rempli d'après le premier produit proposé.
      const premier = APP_DATA.produits.find(p => String(p.id) === document.getElementById('conditionnementProduit').value);
      if (premier?.format_id) { document.getElementById('conditionnementFormat').value = premier.format_id; majConditionnement('format'); }
    }
    await afficherChampsPerso('conditionnementChampsPerso', 'CONDITIONNEMENT', c && c.champs_perso ? c.champs_perso : {});
    document.getElementById('conditionnementModalOverlay').classList.add('open');
  }
  function closeConditionnementModal() { document.getElementById('conditionnementModalOverlay').classList.remove('open'); }
  document.getElementById('conditionnementAddSourceBtn').addEventListener('click', () => {
    document.getElementById('conditionnementSourcesRows').appendChild(ligneSourceCond(null));
    majConditionnement('source');
  });
  document.getElementById('conditionnementAddConsommableBtn').addEventListener('click', () => {
    document.getElementById('conditionnementConsommablesRows').dataset.manuel = '1';
    document.getElementById('conditionnementConsommablesRows').appendChild(ligneConsommableCond(null, Number(document.getElementById('conditionnementQty').value) || ''));
  });
  document.getElementById('conditionnementFormat').addEventListener('change', () => majConditionnement('format'));
  document.getElementById('conditionnementQty').addEventListener('input', () => {
    const zone = document.getElementById('conditionnementConsommablesRows');
    // Quantités des consommables proposés : suivent le nombre d'unités.
    if (!zone.dataset.manuel) zone.querySelectorAll('.consQte').forEach(i => { i.value = document.getElementById('conditionnementQty').value; });
    majConditionnement('qty-saisie');
  });
  ['conditionnementMelange', 'conditionnementTous', 'conditionnementNouveau'].forEach(i =>
    document.getElementById(i).addEventListener('change', () => majConditionnement('source')));
  document.getElementById('conditionnementNouveauNom').addEventListener('input', e => { e.target.dataset.modifie = '1'; });
  // Choisir un produit fini sans format choisi : on reprend son format.
  document.getElementById('conditionnementProduit').addEventListener('change', () => {
    const p = APP_DATA.produits.find(x => String(x.id) === document.getElementById('conditionnementProduit').value);
    if (p?.format_id && !document.getElementById('conditionnementFormat').value) { document.getElementById('conditionnementFormat').value = p.format_id; majConditionnement('format'); }
  });

  async function saveConditionnement() {
    const errEl = document.getElementById('conditionnementFormError');
    errEl.style.display = 'none';
    const erreur = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    const id = document.getElementById('conditionnementModalId').value;

    if (id) {
      const payload = {
        date: document.getElementById('conditionnementDate').value,
        note: document.getElementById('conditionnementNote').value.trim() || null,
        employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      };
      try {
        await apiFetch(`/conditionnement/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        closeConditionnementModal();
        APP_DATA.conditionnements = await apiFetch('/conditionnement');
        renderConditionnement();
      } catch (err) { erreur(err.message); }
      return;
    }

    const sources = lignesSourcesCond().filter(l => l.src && l.q).map(l => {
      const s = { quantite_utilisee: l.q };
      if (l.src.type === 'presse') s.lot_presse_id = l.src.id;
      else if (l.src.type === 'filtration') s.lot_filtration_id = l.src.id;
      else s.lot_id = l.src.id;
      return s;
    });
    const consommables = [...document.querySelectorAll('#conditionnementConsommablesRows .structRow')].map(row => ({
      produit_id: Number(row.querySelector('.consProduit').value) || null,
      quantite: Number(row.querySelector('.consQte').value) || null,
    })).filter(c => c.produit_id && c.quantite);
    const champsPerso = collecterChampsPerso('conditionnementChampsPerso', 'conditionnementFormError');
    if (champsPerso === null) return;
    const nouveau = document.getElementById('conditionnementNouveau').checked;
    const nomNouveau = document.getElementById('conditionnementNouveauNom').value.trim();
    const payload = {
      date: document.getElementById('conditionnementDate').value,
      format_id: Number(document.getElementById('conditionnementFormat').value) || null,
      qty: Number(document.getElementById('conditionnementQty').value) || null,
      note: document.getElementById('conditionnementNote').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      melange: document.getElementById('conditionnementMelange').checked,
      sources, consommables, champs_perso: champsPerso,
    };
    if (nouveau) payload.nouveau_produit = { nom: nomNouveau };
    else payload.produit_id = Number(document.getElementById('conditionnementProduit').value) || null;
    if (!payload.date || !sources.length) return erreur('Choisissez au moins une source avec sa quantité.');
    if (!payload.format_id) return erreur('Choisissez le format (contenance d\'une unité).');
    if (!payload.qty) return erreur('Indiquez le nombre d\'unités.');
    if (nouveau && !nomNouveau) return erreur('Indiquez le nom du nouveau produit fini.');
    if (!nouveau && !payload.produit_id) return erreur('Choisissez le produit fini (ou cochez « Nouveau produit fini »).');
    const bloquant = majConditionnement('produit');
    if (bloquant) return erreur(`Impossible : ${bloquant}.`);
    try {
      await apiFetch('/conditionnement', { method: 'POST', body: JSON.stringify(payload) });
      closeConditionnementModal();
      const [conditionnements, lots, produits] = await Promise.all([apiFetch('/conditionnement'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.conditionnements = conditionnements; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderConditionnement(); renderLotsRegistre(); renderProduits();
      if (nouveau) notifier(`Produit fini « ${nomNouveau} » créé (prix à régler dans Produits).`, 'succes');
    } catch (err) { erreur(err.message); }
  }
  document.getElementById('conditionnementSaveBtn').addEventListener('click', saveConditionnement);
  document.getElementById('conditionnementCancelBtn').addEventListener('click', closeConditionnementModal);
  document.getElementById('conditionnementModalCloseBtn').addEventListener('click', closeConditionnementModal);

