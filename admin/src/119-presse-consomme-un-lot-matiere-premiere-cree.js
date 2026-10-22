  // ============================================================================
  // PRESSE — consomme un lot matière première, crée un lot d'huile pressée.
  // ============================================================================
  function renderPresse() {
    const body = document.getElementById('presseBody');
    const rows = filtrerParTexteEtDate(APP_DATA.lotsPresse, 'presse', p => `${p.produit_nom || ''} ${p.numero_lot}`, p => p.date);
    if (!rows.length) { body.innerHTML = `<tr><td colspan="9" class="rowMeta" style="text-align:center; padding:22px;">Aucun pressage pour ce filtre.</td></tr>`; return; }
    body.innerHTML = rows.map(p => `
      <tr>
        <td class="lotCode">${esc(p.numero_lot)}</td>
        <td>${esc(p.produit_nom || '—')}${p.lots_graines ? `<div class="rowMeta" style="font-size:10.5px;">Graines : ${p.lots_graines}</div>` : ''}</td>
        <td class="rowMeta num">${fmtDate(p.date)}</td>
        <td class="num">${p.quantite_matiere_utilisee ?? '—'}</td>
        <td class="num">${p.quantite_tourteau ?? '—'}</td>
        <td class="num">${p.quantite_produite}</td>
        <td class="num">${p.rendement_reel != null ? (p.rendement_reel * 100).toFixed(1) + ' %' : '—'}</td>
        <td class="rowMeta">${esc(p.employe_nom || '—')}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="openPresseModal(${p.id})">Modifier</button></td>
      </tr>`).join('');
  }

  // Remplit un <select> de lots sources en mettant EN PREMIER les lots du
  // produit déjà choisi (ex: si "Sésame" est sélectionné comme résultat, ses
  // propres lots apparaissent avant ceux des autres produits).
  function populateLotSourceSelect(selectEl, lots, produitIdPrioritaire, placeholder) {
    const tri = [...lots].sort((a, b) => {
      const aMatch = a.produit_id === produitIdPrioritaire ? 0 : 1;
      const bMatch = b.produit_id === produitIdPrioritaire ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.numero_lot.localeCompare(b.numero_lot);
    });
    selectEl.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
      tri.map(l => `<option value="${l.id}">${esc(l.numero_lot)} — ${esc(l.produit_nom)} (dispo: ${l.quantite_actuelle})</option>`).join('');
  }

  // Règle du pressage (identique à src/services/graines.js côté API) :
  // graines consommées → huile en vrac de la même graine, reconnue par le nom
  // (« Graines de Sésame » ↔ « Huile de Sésame — Vrac »), sans tenir compte des accents.
  function normaliserNomGraine(nom) {
    return String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  }
  // Graines et pépins désignent la même matière : « Pépins de figue de barbarie »
  // ↔ « Huile de pépins de figue de barbarie — Vrac » (clé : « figue de barbarie »).
  const sansPepins = cle => (cle ? cle.replace(/^pepins?\s*(?:de\s+|d')/, '').trim() : cle);
  function cleGraine(nom) {
    const m = normaliserNomGraine(nom).match(/^(?:graines?|pepins?)\s*(?:de\s+|d')(.+)$/);
    return m ? sansPepins(m[1].split(/\s+[-–—]\s+|\s*\(/)[0].trim()) : null;
  }
  function cleHuileVrac(nom) {
    const m = normaliserNomGraine(nom).match(/^huiles?\s*(?:de\s+|d')(.+)$/);
    return m ? sansPepins(m[1].split(/\s+[-–—]\s+|\s*\(/)[0].trim()) : null;
  }
  const estGraine = p => !!p && p.type_article === 'MATIERE_PREMIERE' && !!cleGraine(p.nom);
  // Trois étapes, trois produits : presse → « … — Vrac », filtration → « … — Filtrée »,
  // conditionnement → huile en flacon (10 ml, 30 ml, 100 ml, 1 L…). Même règle que src/services/graines.js.
  const nomFiltre = nom => /\bfiltre(e|es|s)?\b/.test(normaliserNomGraine(nom));
  const huileSansFormat = p => !!p && p.type_article !== 'MATIERE_PREMIERE' && !p.format_id && !!cleHuileVrac(p.nom);
  const estHuileVrac = p => huileSansFormat(p) && !nomFiltre(p.nom);
  const estHuileFiltree = p => huileSansFormat(p) && nomFiltre(p.nom) && !/\bmelange\b/.test(normaliserNomGraine(p.nom));
  const estNomMelange = nom => /^huiles?\b/.test(normaliserNomGraine(nom)) && /\bmelange\b/.test(normaliserNomGraine(nom));
  const estHuileMelangeVrac = p => !!p && p.type_article !== 'MATIERE_PREMIERE' && !p.format_id && estNomMelange(p.nom) && !nomFiltre(p.nom);
  const estHuileMelangeFiltree = p => !!p && p.type_article !== 'MATIERE_PREMIERE' && !p.format_id && estNomMelange(p.nom) && nomFiltre(p.nom);
  const estHuileConditionnee = p => !!p && !!p.format_id && (!!cleHuileVrac(p.nom) || estNomMelange(p.nom)) && !['MATIERE_PREMIERE', 'EMBALLAGE', 'CONSOMMABLE'].includes(p.type_article);
  // Liste d'un formulaire : les produits de l'étape, plus celui de la fiche ouverte (ancienne saisie).
  const produitsEtape = (filtre, idCourant) => APP_DATA.produits.filter(p => filtre(p) || p.id === idCourant);

