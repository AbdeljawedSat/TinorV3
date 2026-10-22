  // ---------- Pressage : plusieurs lots de graines → une huile en vrac par graine ----------
  const arrondiQte = x => Math.round(Number(x) * 1000) / 1000;
  let PRESSE_LOTS_GRAINES = []; // lots de graines disponibles à l'ouverture du formulaire
  const PRESSE_SAISIES_SORTIES = new Map(); // clé de graine → { produit_id, huile, tourteau } (conservé entre deux rafraîchissements)

  function lotGraine(id) { return PRESSE_LOTS_GRAINES.find(l => l.id === Number(id)); }
  function lignesSourcesPresse() {
    return [...document.querySelectorAll('#presseSources .presseSource')].map(row => ({
      lot_id: Number(row.querySelector('select').value) || null,
      quantite: row.querySelector('input').value === '' ? null : Number(row.querySelector('input').value),
    }));
  }

  function ajouterLigneSourcePresse(lotId) {
    const row = document.createElement('div');
    row.className = 'presseSource';
    row.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:6px;';
    row.innerHTML = `
      <select class="formInput" style="flex:1; margin:0;"><option value="">— Choisir un lot de graines —</option>
        ${PRESSE_LOTS_GRAINES.map(l => `<option value="${l.id}">${esc(l.numero_lot)} — ${esc(l.produit_nom)} (dispo : ${Number(l.quantite_actuelle)} ${l.unite_symbole || ''})</option>`).join('')}</select>
      <input type="number" step="0.001" min="0" class="formInput" placeholder="Quantité" style="width:110px; margin:0;">
      <button type="button" class="rowActionBtn" title="Retirer ce lot">✕</button>`;
    row.querySelector('select').value = lotId ? String(lotId) : '';
    row.querySelector('select').addEventListener('change', majSortiesPresse);
    row.querySelector('input').addEventListener('input', verifierBilanPresse);
    row.querySelector('button').addEventListener('click', () => { row.remove(); majSortiesPresse(); });
    document.getElementById('presseSources').appendChild(row);
    majSortiesPresse();
  }

  // Une ligne « huile obtenue » par graine présente dans les lots choisis ;
  // sans lot de graines, une seule ligne avec toutes les huiles en vrac.
  function majSortiesPresse() {
    const zone = document.getElementById('presseSorties');
    zone.querySelectorAll('.presseSortie').forEach(row => {
      PRESSE_SAISIES_SORTIES.set(row.dataset.cle, {
        produit_id: row.querySelector('select').value, huile: row.querySelector('.qHuile').value, tourteau: row.querySelector('.qTourteau').value,
      });
    });
    const sources = lignesSourcesPresse().filter(l => l.lot_id);
    // Un lot déjà choisi sur une ligne n'est plus proposé sur les autres.
    const choisis = sources.map(l => String(l.lot_id));
    document.querySelectorAll('#presseSources select').forEach(sel => {
      [...sel.options].forEach(o => { o.disabled = !!o.value && o.value !== sel.value && choisis.includes(o.value); });
    });
    const groupes = new Map();
    sources.forEach(l => { const lot = lotGraine(l.lot_id); if (!lot) return; const cle = cleGraine(lot.produit_nom); if (!groupes.has(cle)) groupes.set(cle, lot.produit_nom); });
    const melange = document.getElementById('presseMelange').checked;
    document.getElementById('presseCreerMelange').style.display = melange ? 'inline-block' : 'none';
    document.getElementById('presseSortiesTitre').textContent = melange ? 'Huile mélange obtenue (une seule pour toutes les graines)' : 'Huiles en vrac obtenues (une par graine)';
    const huilesVrac = APP_DATA.produits.filter(estHuileVrac);
    // Mélange : toutes les graines → UNE huile « Huile Mélange … — Vrac ».
    const lignes = melange ? [{ cle: '__melange', nomGraine: null, melange: true, huiles: APP_DATA.produits.filter(estHuileMelangeVrac) }]
      : groupes.size ? [...groupes].map(([cle, nomGraine]) => ({ cle, nomGraine, huiles: huilesVrac.filter(h => cleHuileVrac(h.nom) === cle) }))
                     : [{ cle: '*', nomGraine: null, huiles: huilesVrac }];
    const entete = lignes.some(l => l.huiles.length)
      ? `<div class="rowMeta" style="display:flex; gap:8px; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; padding:0 11px 3px;">
           <span style="flex:1;">Huile en vrac</span><span style="width:95px;">Huile</span><span style="width:95px;">Tourteau</span></div>` : '';
    zone.innerHTML = entete + lignes.map(l => {
      if (!l.huiles.length && l.melange) {
        return `<div class="presseSortie" data-cle="${l.cle}" style="color:var(--danger); font-size:11.5px; margin-bottom:4px;">
          Aucune huile mélange en vrac au catalogue : cliquez « Créer un produit Huile Mélange … — Vrac » ci-dessous.
          <select style="display:none"></select><input class="qHuile" type="hidden"><input class="qTourteau" type="hidden"></div>`;
      }
      if (!l.huiles.length) {
        return `<div class="presseSortie" data-cle="${l.cle}" style="color:var(--danger); font-size:11.5px; margin-bottom:8px;">
          Aucune huile en vrac pour « ${l.nomGraine} » au catalogue : créez d'abord « Huile de ${l.nomGraine.replace(/^graines?\s*(de\s+|d')/i, '')} — Vrac » (Produits).
          <select style="display:none"></select><input class="qHuile" type="hidden"><input class="qTourteau" type="hidden"></div>`;
      }
      return `<div class="presseSortie" data-cle="${l.cle}" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px; margin-bottom:8px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select class="formInput" style="flex:1; min-width:180px; margin:0;">${l.huiles.map(h => `<option value="${h.id}">${esc(h.nom)}</option>`).join('')}</select>
          <input type="number" step="0.001" min="0" class="formInput qHuile" placeholder="Huile" title="Quantité d'huile obtenue" style="width:95px; margin:0;">
          <input type="number" step="0.001" min="0" class="formInput qTourteau" placeholder="Tourteau" title="Quantité de tourteau (optionnel)" style="width:95px; margin:0;">
        </div>
        <div class="presseBilanGraine" style="font-size:11px; margin-top:4px;"></div>
      </div>`;
    }).join('');
    zone.querySelectorAll('.presseSortie').forEach(row => {
      const saisie = PRESSE_SAISIES_SORTIES.get(row.dataset.cle) || {};
      const sel = row.querySelector('select');
      if (saisie.produit_id && [...sel.options].some(o => o.value === saisie.produit_id)) sel.value = saisie.produit_id;
      row.querySelector('.qHuile').value = saisie.huile || '';
      row.querySelector('.qTourteau').value = saisie.tourteau || '';
      row.querySelectorAll('input').forEach(i => i.addEventListener('input', verifierBilanPresse));
    });
    verifierBilanPresse();
  }

  // Bilan par graine et total : graines utilisées ≥ huile + tourteau.
  // Renvoie un message d'erreur (enregistrement bloqué) ou null.
  function verifierBilanPresse() {
    const zone = document.getElementById('presseBilan');
    zone.style.color = '';
    const sources = lignesSourcesPresse();
    const parGraine = new Map(), compoGraines = new Map();
    for (const s of sources) {
      if (!s.lot_id) continue;
      if (s.quantite != null && !(s.quantite > 0)) return (zone.textContent = '', 'Chaque quantité de graines doit être supérieure à 0.');
      const lot = lotGraine(s.lot_id);
      if (s.quantite > Number(lot.quantite_actuelle)) return (zone.textContent = '', `Le lot ${lot.numero_lot} ne contient que ${Number(lot.quantite_actuelle)}.`);
      const cle = document.getElementById('presseMelange').checked ? '__melange' : cleGraine(lot.produit_nom);
      parGraine.set(cle, arrondiQte((parGraine.get(cle) || 0) + (s.quantite || 0)));
      const nomG = lot.produit_nom.replace(/^graines?\s*(de\s+|d')/i, '');
      compoGraines.set(nomG, arrondiQte((compoGraines.get(nomG) || 0) + (s.quantite || 0)));
    }
    let totalGraines = 0, totalSorties = 0, erreur = null;
    document.querySelectorAll('#presseSorties .presseSortie').forEach(row => {
      const info = row.querySelector('.presseBilanGraine');
      const huile = row.querySelector('.qHuile').value === '' ? null : Number(row.querySelector('.qHuile').value);
      const tourteau = Number(row.querySelector('.qTourteau').value || 0);
      if (huile != null && !(huile > 0)) erreur = erreur || "Chaque quantité d'huile obtenue doit être supérieure à 0.";
      if (tourteau < 0) erreur = erreur || 'La quantité de tourteau ne peut pas être négative.';
      if (!info) return;
      info.style.color = '';
      const graines = parGraine.get(row.dataset.cle);
      if (graines == null || huile == null) { info.textContent = graines != null ? `Graines : ${graines}` : ''; return; }
      const sortie = arrondiQte(huile + tourteau), pertes = arrondiQte(graines - sortie);
      totalGraines += graines; totalSorties += sortie;
      if (pertes < 0) {
        info.textContent = `⚠ Impossible : huile ${huile} + tourteau ${tourteau} = ${sortie}, plus que les graines (${graines}).`;
        info.style.color = 'var(--danger)';
        erreur = erreur || `Bilan impossible : huile + tourteau (${sortie}) dépasse les graines utilisées (${graines}).`;
      } else {
        info.textContent = `${graines} graines = ${huile} huile + ${tourteau} tourteau + ${pertes} pertes — rendement ${(huile / graines * 100).toFixed(1)} %`;
      }
    });
    if (parGraine.size > 1 || sources.filter(s => s.lot_id).length > 1) {
      zone.textContent = `Total de l'opération : ${arrondiQte(totalGraines)} graines → ${arrondiQte(totalSorties)} huile + tourteau, ${arrondiQte(totalGraines - totalSorties)} pertes.`;
    } else {
      zone.textContent = 'Règle : graines utilisées ≥ huile + tourteau.';
    }
    if (document.getElementById('presseMelange').checked) {
      const total = [...compoGraines.values()].reduce((a, b) => a + b, 0);
      if (compoGraines.size < 2) erreur = erreur || 'Un mélange demande au moins deux graines différentes.';
      if (total) zone.textContent += ` Composition : ${[...compoGraines].map(([n, q]) => `${n} ${Math.round(q / total * 1000) / 10} %`).join(' · ')}.`;
    }
    if (erreur) zone.style.color = 'var(--danger)';
    return erreur;
  }
  document.getElementById('presseMelange').addEventListener('change', majSortiesPresse);
  document.getElementById('presseCreerMelange').addEventListener('click', async () => {
    const noms = [...new Set(lignesSourcesPresse().map(l => lotGraine(l.lot_id)).filter(Boolean).map(l => l.produit_nom.replace(/^graines?\s*(de\s+|d')/i, '')))];
    const id = await creerProduitMelange(noms, 'Vrac', APP_DATA.produits.find(estHuileVrac));
    if (id) { PRESSE_SAISIES_SORTIES.set('__melange', { ...(PRESSE_SAISIES_SORTIES.get('__melange') || {}), produit_id: String(id) }); majSortiesPresse(); }
  });

  async function openPresseModal(id) {
    document.getElementById('presseFormError').style.display = 'none';
    const p = id ? APP_DATA.lotsPresse.find(x => x.id === id) : null;
    document.getElementById('presseModalId').value = p ? p.id : '';
    document.querySelector('#presseModalOverlay .modalHead h2').textContent = p ? `Modifier — ${p.numero_lot}` : 'Nouveau lot de presse';
    document.getElementById('presseDate').value = p ? p.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    document.getElementById('presseNotes').value = p && p.notes ? p.notes : '';
    // Lot existant : quantités et sources figées (déjà répercutées sur le stock) — seuls date/notes modifiables.
    document.getElementById('presseSaisie').style.display = p ? 'none' : 'block';
    document.getElementById('presseResume').style.display = p ? 'block' : 'none';
    document.getElementById('presseQuantitesLockedNote').style.display = p ? 'block' : 'none';
    if (p) {
      document.getElementById('presseResume').innerHTML = `<b>${esc(p.produit_nom || '')}</b><br>
        Graines utilisées : ${p.quantite_matiere_utilisee ?? '—'}${p.lots_graines ? ` (${p.lots_graines})` : ''}<br>
        Huile obtenue : ${p.quantite_produite} · Tourteau : ${p.quantite_tourteau ?? '—'}`;
    } else {
      APP_DATA.lots = await apiFetch('/lots'); // stock le plus frais avant de proposer les lots
      const produitsParId = new Map(APP_DATA.produits.map(pr => [pr.id, pr]));
      PRESSE_LOTS_GRAINES = APP_DATA.lots
        .filter(l => l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0 && estGraine(produitsParId.get(l.produit_id)))
        .sort((a, b) => a.numero_lot.localeCompare(b.numero_lot));
      PRESSE_SAISIES_SORTIES.clear();
      document.getElementById('presseMelange').checked = false;
      document.getElementById('presseSources').innerHTML = '';
      document.getElementById('presseSorties').innerHTML = '';
      ajouterLigneSourcePresse(PRESSE_LOTS_GRAINES[0] ? PRESSE_LOTS_GRAINES[0].id : null);
    }
    await afficherChampsPerso('presseChampsPerso', 'PRESSE', p && p.champs_perso ? p.champs_perso : {});
    document.getElementById('presseModalOverlay').classList.add('open');
  }
  function closePresseModal() { document.getElementById('presseModalOverlay').classList.remove('open'); }

  async function savePresse() {
    const errEl = document.getElementById('presseFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('presseModalId').value;
    const erreur = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

    if (id) {
      // Édition : champs sûrs uniquement
      const payload = {
        date: document.getElementById('presseDate').value,
        notes: document.getElementById('presseNotes').value.trim() || null,
        employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      };
      try {
        await apiFetch(`/presse/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        closePresseModal();
        APP_DATA.lotsPresse = await apiFetch('/presse');
        renderPresse();
      } catch (err) { erreur(err.message); }
      return;
    }

    const champsPerso = collecterChampsPerso('presseChampsPerso', 'presseFormError');
    if (champsPerso === null) return; // champ obligatoire manquant, erreur déjà affichée

    const sources = lignesSourcesPresse().filter(l => l.lot_id);
    if (sources.some(l => l.quantite == null)) return erreur('Indiquez la quantité de graines utilisée pour chaque lot.');
    const sorties = [...document.querySelectorAll('#presseSorties .presseSortie')].map(row => ({
      produit_id: Number(row.querySelector('select').value) || null,
      quantite_produite: row.querySelector('.qHuile').value === '' ? null : Number(row.querySelector('.qHuile').value),
      quantite_tourteau: row.querySelector('.qTourteau').value === '' ? null : Number(row.querySelector('.qTourteau').value),
    }));
    if (!document.getElementById('presseDate').value) return erreur('La date est requise.');
    if (sorties.some(so => !so.produit_id)) return erreur("Il manque l'huile en vrac correspondant à une des graines (voir ci-dessus).");
    if (sorties.some(so => so.quantite_produite == null)) return erreur("Indiquez la quantité d'huile obtenue pour chaque graine.");
    const erreurBilan = verifierBilanPresse();
    if (erreurBilan) return erreur(erreurBilan);
    const payload = {
      date: document.getElementById('presseDate').value, sources: sources.map(l => ({ lot_id: l.lot_id, quantite: l.quantite })), sorties,
      melange: document.getElementById('presseMelange').checked,
      notes: document.getElementById('presseNotes').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      champs_perso: champsPerso,
    };
    try {
      await apiFetch('/presse', { method: 'POST', body: JSON.stringify(payload) });
      closePresseModal();
      const [lotsPresse, lots, produits] = await Promise.all([apiFetch('/presse'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.lotsPresse = lotsPresse; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderPresse(); renderLotsRegistre(); renderProduits();
    } catch (err) { erreur(err.message); }
  }
  document.getElementById('presseSaveBtn').addEventListener('click', savePresse);
  document.getElementById('presseAjoutSource').addEventListener('click', () => ajouterLigneSourcePresse(null));
  document.getElementById('presseCancelBtn').addEventListener('click', closePresseModal);
  document.getElementById('presseModalCloseBtn').addEventListener('click', closePresseModal);

  // ============================================================================
  // FILTRATION — combine un ou plusieurs lots de presse.

  // ============================================================================
  function renderFiltration() {
    const body = document.getElementById('filtrationBody');
    const rows = filtrerParTexteEtDate(APP_DATA.lotsFiltration, 'filtration', f => `${f.produit_nom || ''} ${f.numero_lot}`, f => f.date);
    if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="rowMeta" style="text-align:center; padding:22px;">Aucune filtration pour ce filtre.</td></tr>`; return; }
    body.innerHTML = rows.map(f => `
      <tr>
        <td class="lotCode">${esc(f.numero_lot)}</td>
        <td>${esc(f.produit_nom || '—')}${(f.composition || []).length > 1 ? `<div class="compoListe">${f.composition.map(c => `${nomCourtHuile(c.huile)} ${c.pourcentage} %`).join(' · ')}</div>` : ''}</td>
        <td class="rowMeta num">${fmtDate(f.date)}</td>
        <td class="rowMeta">${f.filtre_utilise || '—'}</td>
        <td class="num">${f.quantite_dechet ?? '—'}</td>
        <td class="num">${f.quantite_produite}</td>
        <td class="num">${f.rendement_reel != null ? (f.rendement_reel * 100).toFixed(1) + ' %' : '—'}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="openFiltrationModal(${f.id})">Modifier</button></td>
      </tr>`).join('');
  }

  // Par défaut, ne propose que les lots de presse de la MÊME matière que le
  // produit obtenu (ex: on ne filtre pas du Sésame avec un lot d'Amande) —
  // sauf si la case "plusieurs types de matière" est cochée, pour les cas
  // volontaires de mélange.
  function getFiltrationLotsDisponibles() {
    const disponible = l => Number(l.quantite_actuelle) > 0 && l.lot_statut === 'LIBERE';
    const multiMatiere = document.getElementById('filtrationMultiMatiere').checked;
    if (multiMatiere) return APP_DATA.lotsPresse.filter(disponible);
    const produit = APP_DATA.produits.find(p => p.id === Number(document.getElementById('filtrationProduit').value));
    if (!produit) return APP_DATA.lotsPresse.filter(disponible); // pas encore de produit : tous les lots, le produit suivra
    // Huile de sésame filtrée ← lots pressés d'huile de sésame ; huile mélange filtrée ← huile mélange pressée.
    const cle = cleHuileGen(produit.nom);
    return APP_DATA.lotsPresse.filter(p => cleHuileGen(p.produit_nom) === cle && disponible(p));
  }
  function filtrationSourceRow() {
    const lots = getFiltrationLotsDisponibles();
    const options = lots.length
      ? lots.map(p => `<option value="${p.id}">${esc(p.numero_lot)} — ${esc(p.produit_nom || '')}</option>`).join('')
      : '';
    const row = document.createElement('div');
    row.className = 'structRow';
    row.style.gridTemplateColumns = '1fr 110px 46px 32px';
    row.innerHTML = `
      <select class="srcLotPresse formInput">${options || '<option value="">— Aucun lot de cette matière —</option>'}</select>
      <input type="number" step="0.001" class="srcQte formInput" placeholder="Qté">
      <span class="srcPart"></span>
      <button class="delField" type="button">✕</button>`;
    row.querySelector('.delField').addEventListener('click', () => { row.remove(); majCompositionFiltration(); });
    row.querySelector('.srcQte').addEventListener('input', majCompositionFiltration);
    row.querySelector('.srcLotPresse').addEventListener('change', () => {
      if (row === document.querySelector('#filtrationSourcesRows .structRow')) synchroniserProduitFiltration();
      majCompositionFiltration();
    });
    return row;
  }
  // Reconstruit les lignes source depuis zéro (évite de gérer un
  // ré-filtrage partiel des sélections déjà faites, plus simple et plus sûr).
  function resetFiltrationSourcesRows() {
    const rowsWrap = document.getElementById('filtrationSourcesRows');
    rowsWrap.innerHTML = '';
    if (getFiltrationLotsDisponibles().length) rowsWrap.appendChild(filtrationSourceRow());
    majCompositionFiltration();
  }
  // Mélange : part de chaque huile (d'après les quantités saisies) + nom proposé pour le produit.
  const nomCourtHuile = nom => (String(nom || '').match(/^huiles?\s*(?:de\s+|d')(.+?)(?:\s+[-–—]\s+.*|\s*\(.*)?$/i) || [])[1] || nom;
  function compositionFiltration() {
    const parHuile = new Map();
    document.querySelectorAll('#filtrationSourcesRows .structRow').forEach(row => {
      const lot = APP_DATA.lotsPresse.find(l => String(l.id) === row.querySelector('.srcLotPresse')?.value);
      const q = Number(row.querySelector('.srcQte')?.value) || 0;
      if (!lot) return;
      const huile = nomCourtHuile(lot.produit_nom);
      parHuile.set(huile, (parHuile.get(huile) || 0) + q);
    });
    const total = [...parHuile.values()].reduce((a, b) => a + b, 0);
    return { total, huiles: [...parHuile].map(([huile, q]) => ({ huile, q, pct: total ? Math.round(q / total * 1000) / 10 : 0 })) };
  }
  const COULEURS_COMPO = ['#C8902E', '#3B4A3F', '#1C6FA6', '#5B7F23', '#BF532F', '#5A6773'];
  function majCompositionFiltration() {
    const melange = document.getElementById('filtrationMultiMatiere').checked;
    const { total, huiles } = compositionFiltration();
    document.querySelectorAll('#filtrationSourcesRows .structRow').forEach(row => {
      const q = Number(row.querySelector('.srcQte')?.value) || 0;
      const part = row.querySelector('.srcPart');
      if (part) part.textContent = melange && total && q ? `${Math.round(q / total * 1000) / 10} %` : '';
    });
    const el = document.getElementById('filtrationComposition');
    el.style.display = melange && total ? 'block' : 'none';
    if (melange && total) el.innerHTML = `<div class="barreCompo">${huiles.map((h, i) => `<i style="width:${h.pct}%; background:${COULEURS_COMPO[i % COULEURS_COMPO.length]}"></i>`).join('')}</div>
      <div class="txt">Composition : ${huiles.map(h => `${h.huile} ${h.pct} %`).join(' · ')} — enregistrée avec le lot (traçabilité)</div>`;
  }
  // Le produit obtenu suit la source : lot pressé d'huile de sésame → « Huile de Sésame — Filtrée ».
  const lotsPresseDisponibles = () => APP_DATA.lotsPresse.filter(l => Number(l.quantite_actuelle) > 0 && l.lot_statut === 'LIBERE');
  const filtreeDe = cle => APP_DATA.produits.find(p => (estHuileFiltree(p) || estHuileMelangeFiltree(p)) && cleHuileGen(p.nom) === cle);
  function synchroniserProduitFiltration() {
    if (document.getElementById('filtrationModalId').value || document.getElementById('filtrationMultiMatiere').checked) return;
    const lot = APP_DATA.lotsPresse.find(l => String(l.id) === document.querySelector('#filtrationSourcesRows .srcLotPresse')?.value);
    const sel = document.getElementById('filtrationProduit');
    const lien = document.getElementById('filtrationCreerFiltree');
    lien.style.display = 'none';
    if (!lot) return;
    const produit = filtreeDe(cleHuileGen(lot.produit_nom));
    if (produit) { sel.value = String(produit.id); return; }
    // Pas encore de fiche « … — Filtrée » pour cette huile : on propose de la créer.
    if (![...sel.options].some(o => o.value === '')) sel.insertAdjacentHTML('afterbegin', '<option value="">— Choisir —</option>');
    sel.value = '';
    lien.textContent = `＋ Créer « ${baseNomHuile(lot.produit_nom)} — Filtrée »`;
    lien.dataset.lot = lot.id;
    lien.style.display = 'inline-block';
  }
  document.getElementById('filtrationCreerFiltree').addEventListener('click', async () => {
    const lot = APP_DATA.lotsPresse.find(l => String(l.id) === document.getElementById('filtrationCreerFiltree').dataset.lot);
    const vrac = APP_DATA.produits.find(p => p.id === lot?.produit_id);
    if (!vrac) return;
    const nom = `${baseNomHuile(vrac.nom)} — Filtrée`;
    if (!(await confirmer(`Créer le produit « ${nom} » ? Catégorie, unité, prix et TVA repris de « ${vrac.nom} ».`, { titre: 'Nouvelle huile filtrée', ok: 'Créer et choisir' }))) return;
    try {
      const cree = await apiFetch('/produits', { method: 'POST', body: JSON.stringify({
        nom, categorie_id: vrac.categorie_id, unite_id: vrac.unite_id, type_article: 'PRODUIT_FABRIQUE', produit_source_id: vrac.id,
        fabriquable: true, stockable: true, vendable: !!vrac.vendable, prix_vente: vrac.prix_vente, tva: vrac.tva, bio_eligible: !!vrac.bio_eligible }) });
      APP_DATA.produits = await apiFetch('/produits');
      remplirProduitsFiltration(null, cree.id);
      synchroniserProduitFiltration();
      notifier(`Produit « ${nom} » créé et choisi.`, 'succes');
    } catch (err) { notifier(err.message, 'erreur'); }
  });
  // Liste « Produit obtenu » : huiles filtrées d'une graine, ou huiles mélange si la case est cochée.
  function remplirProduitsFiltration(idCourant, idASelectionner) {
    const melange = document.getElementById('filtrationMultiMatiere').checked;
    const liste = produitsEtape(melange ? estHuileMelangeFiltree : p => estHuileFiltree(p) || estHuileMelangeFiltree(p), idCourant);
    const vide = melange ? '— Aucune huile mélange : cliquez « Créer un autre produit mélange » —' : '— Aucune huile filtrée : créez « Huile de … — Filtrée » dans Produits —';
    const sel = document.getElementById('filtrationProduit');
    populateSelect(sel, liste, 'id', 'nom', liste.length ? null : vide);
    if (idASelectionner && liste.some(p => p.id === idASelectionner)) sel.value = idASelectionner;
    else if (!idCourant && !melange) {
      // Par défaut : l'huile filtrée qui a des lots pressés disponibles (le plus récent d'abord).
      const avecStock = lotsPresseDisponibles().map(l => filtreeDe(cleHuileGen(l.produit_nom))).find(Boolean);
      if (avecStock) sel.value = String(avecStock.id);
      else if (lotsPresseDisponibles().length) {
        // Des lots pressés existent mais sans fiche « … — Filtrée » : on part de la source (lien de création proposé).
        if (![...sel.options].some(o => o.value === '')) sel.insertAdjacentHTML('afterbegin', '<option value="">— Choisir —</option>');
        sel.value = '';
      }
    }
    document.getElementById('filtrationCreerMelange').style.display = melange && !document.getElementById('filtrationModalId').value ? 'inline-block' : 'none';
  }
  // Création rapide d'un produit « Huile Mélange … » (presse : — Vrac, filtration : — Filtrée).
  async function creerProduitMelange(noms, suffixe, modele) {
    const propose = `Huile Mélange ${noms.length ? noms.join('-') : 'Sésame-Nigelle'} — ${suffixe}`;
    const attente = confirmer(`Catégorie, unité et TVA reprises de ${modele ? '« ' + modele.nom + ' »' : 'l\'huile en vrac'}. Le prix de vente se règle ensuite dans Produits.`,
      { titre: 'Nouveau produit mélange', ok: 'Créer et choisir', saisie: { label: 'Nom du produit (modifiable)', placeholder: propose } });
    document.getElementById('confirmSaisie').value = propose; document.getElementById('confirmOui').disabled = false;
    let nom = await attente;
    if (!nom) return null;
    if (!/m[ée]lange/i.test(nom)) nom = `Huile Mélange ${nom}`;
    if (!new RegExp(suffixe.slice(0, 5), 'i').test(nom)) nom += ` — ${suffixe}`;
    modele = modele || APP_DATA.produits.find(estHuileVrac);
    if (!modele) { notifier('Aucune huile en vrac de référence pour la catégorie et l\'unité.', 'erreur'); return null; }
    try {
      const cree = await apiFetch('/produits', { method: 'POST', body: JSON.stringify({
        nom, categorie_id: modele.categorie_id, unite_id: modele.unite_id, type_article: 'PRODUIT_FABRIQUE',
        fabriquable: true, stockable: true, vendable: !!modele.vendable, tva: modele.tva, bio_eligible: !!modele.bio_eligible }) });
      APP_DATA.produits = await apiFetch('/produits');
      notifier(`Produit « ${nom} » créé et choisi.`, 'succes');
      return cree.id;
    } catch (err) { notifier(err.message, 'erreur'); return null; }
  }
  document.getElementById('filtrationCreerMelange').addEventListener('click', async () => {
    const premierLot = APP_DATA.lotsPresse.find(l => String(l.id) === document.querySelector('#filtrationSourcesRows .srcLotPresse')?.value);
    const id = await creerProduitMelange(compositionFiltration().huiles.map(h => h.huile), 'Filtrée', APP_DATA.produits.find(p => p.id === premierLot?.produit_id));
    if (id) remplirProduitsFiltration(null, id);
  });
  document.getElementById('filtrationProduit').addEventListener('change', () => {
    if (!document.getElementById('filtrationModalId').value) resetFiltrationSourcesRows(); // pas en mode édition
  });
  document.getElementById('filtrationMultiMatiere').addEventListener('change', () => {
    remplirProduitsFiltration();
    document.getElementById('filtrationCreerFiltree').style.display = 'none';
    if (!document.getElementById('filtrationModalId').value) { resetFiltrationSourcesRows(); synchroniserProduitFiltration(); }
  });

  async function openFiltrationModal(id) {
    document.getElementById('filtrationFormError').style.display = 'none';
    APP_DATA.lotsPresse = await apiFetch('/presse'); // liste la plus fraîche des lots pressés disponibles

    const f = id ? APP_DATA.lotsFiltration.find(x => x.id === id) : null;
    document.getElementById('filtrationModalId').value = f ? f.id : '';
    document.getElementById('filtrationMultiMatiere').checked = false;
    remplirProduitsFiltration(f?.produit_id);
    document.querySelector('#filtrationModalOverlay .modalHead h2').textContent = f ? `Modifier — ${f.numero_lot}` : 'Nouvelle filtration';
    document.getElementById('filtrationDate').value = f ? f.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    document.getElementById('filtrationProduit').value = f ? f.produit_id : document.getElementById('filtrationProduit').value;
    document.getElementById('filtrationFiltre').value = f && f.filtre_utilise ? f.filtre_utilise : '';
    document.getElementById('filtrationQteDechet').value = f ? (f.quantite_dechet ?? '') : '';
    document.getElementById('filtrationQteProduite').value = f ? f.quantite_produite : '';
    document.getElementById('filtrationNotes').value = f && f.notes ? f.notes : '';
    document.getElementById('filtrationMultiMatiere').checked = false;

    ['filtrationProduit', 'filtrationQteDechet', 'filtrationQteProduite'].forEach(fid => {
      document.getElementById(fid).disabled = !!f;
    });
    document.getElementById('filtrationLockedNote').style.display = f ? 'block' : 'none';
    document.getElementById('filtrationAddSourceBtn').style.display = f ? 'none' : 'inline-flex';
    document.getElementById('filtrationMultiMatiere').closest('label').style.display = f ? 'none' : 'flex';
    document.getElementById('filtrationComposition').style.display = 'none';

    const rowsWrap = document.getElementById('filtrationSourcesRows');
    rowsWrap.innerHTML = '';
    if (f) {
      rowsWrap.innerHTML = `<div class="rowMeta" style="padding:6px 0;">Sources déjà consommées — non modifiables (voir le Registre des lots pour le détail de traçabilité).</div>`;
    } else {
      resetFiltrationSourcesRows();
      synchroniserProduitFiltration();
    }
    document.getElementById('filtrationCreerFiltree').style.display = f ? 'none' : document.getElementById('filtrationCreerFiltree').style.display;
    await afficherChampsPerso('filtrationChampsPerso', 'FILTRATION', f && f.champs_perso ? f.champs_perso : {});
    document.getElementById('filtrationModalOverlay').classList.add('open');
  }
  function closeFiltrationModal() { document.getElementById('filtrationModalOverlay').classList.remove('open'); }
  document.getElementById('filtrationAddSourceBtn').addEventListener('click', () => {
    document.getElementById('filtrationSourcesRows').appendChild(filtrationSourceRow());
    majCompositionFiltration();
  });

  async function saveFiltration() {
    const errEl = document.getElementById('filtrationFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('filtrationModalId').value;

    if (id) {
      const payload = {
        date: document.getElementById('filtrationDate').value,
        filtre_utilise: document.getElementById('filtrationFiltre').value.trim() || null,
        notes: document.getElementById('filtrationNotes').value.trim() || null,
        employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      };
      try {
        await apiFetch(`/filtration/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        closeFiltrationModal();
        APP_DATA.lotsFiltration = await apiFetch('/filtration');
        renderFiltration();
      } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      return;
    }

    const sources = [...document.querySelectorAll('#filtrationSourcesRows .structRow')].map(row => ({
      lot_presse_id: Number(row.querySelector('.srcLotPresse').value),
      quantite_utilisee: Number(row.querySelector('.srcQte').value),
    })).filter(s => s.lot_presse_id && s.quantite_utilisee);

    const champsPerso = collecterChampsPerso('filtrationChampsPerso', 'filtrationFormError');
    if (champsPerso === null) return;

    const payload = {
      date: document.getElementById('filtrationDate').value,
      produit_id: Number(document.getElementById('filtrationProduit').value) || null,
      filtre_utilise: document.getElementById('filtrationFiltre').value.trim() || null,
      quantite_dechet: document.getElementById('filtrationQteDechet').value ? Number(document.getElementById('filtrationQteDechet').value) : null,
      quantite_produite: document.getElementById('filtrationQteProduite').value ? Number(document.getElementById('filtrationQteProduite').value) : null,
      notes: document.getElementById('filtrationNotes').value.trim() || null,
      employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
      sources,
      champs_perso: champsPerso,
      melange: document.getElementById('filtrationMultiMatiere').checked,
    };
    if (!payload.date || !payload.produit_id || !payload.quantite_produite || !sources.length) {
      errEl.textContent = 'Date, produit, quantité produite et au moins une source valide sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch('/filtration', { method: 'POST', body: JSON.stringify(payload) });
      closeFiltrationModal();
      const [lotsFiltration, lots, produits] = await Promise.all([apiFetch('/filtration'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.lotsFiltration = lotsFiltration; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderFiltration(); renderLotsRegistre(); renderProduits();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('filtrationSaveBtn').addEventListener('click', saveFiltration);
  document.getElementById('filtrationCancelBtn').addEventListener('click', closeFiltrationModal);
  document.getElementById('filtrationModalCloseBtn').addEventListener('click', closeFiltrationModal);

