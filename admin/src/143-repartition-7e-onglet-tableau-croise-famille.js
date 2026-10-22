  // ---------- Répartition (7e onglet) : tableau croisé famille × format ----------
  // Regroupement PAR RELATION (produits.produit_source_id) en priorité — fiable
  // même si les noms diffèrent ou sont renommés plus tard. Ne retombe sur
  // l'ancienne heuristique par nom que pour les produits créés sans source
  // renseignée (compatibilité avec les données existantes).
  function familleNameHeuristic(p) {
    let nom = p.nom;
    nom = nom.replace(/\s*[-—]\s*vrac\b/i, '').replace(/\bvrac\b/i, '');
    if (p.format_id) {
      const f = REF_DATA.formats.find(x => x.id === p.format_id);
      if (f && f.code) nom = nom.replace(new RegExp('\\b' + f.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '');
    }
    return nom.replace(/\s+/g, ' ').trim();
  }
  function familleKey(p) {
    if (p.produit_source_id) return 'src:' + p.produit_source_id;
    if (!p.format_id) return 'src:' + p.id; // ce produit est lui-même une source potentielle
    return 'name:' + familleNameHeuristic(p); // repli historique, sans relation déclarée
  }
  function familleDisplayName(p) {
    if (p.produit_source_id) {
      const source = APP_DATA.produits.find(x => x.id === p.produit_source_id);
      if (source) return familleNameHeuristic(source);
    }
    return familleNameHeuristic(p);
  }
  function formatLabel(p) {
    if (p.format_id) {
      const f = REF_DATA.formats.find(x => x.id === p.format_id);
      return f ? (f.code || f.nom) : 'Format';
    }
    return 'Vrac';
  }
  function formatSortKey(label) {
    if (/^vrac$/i.test(label)) return Number.MAX_SAFE_INTEGER; // Vrac toujours en dernière colonne avant Total
    const m = label.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }

  // Répartition : une ligne par huile ; Vrac (L) · Filtré (L) · chaque format conditionné
  // (unités et litres = unités × contenance) · Total conditionné · Total ; ligne Total en bas
  // et quatre totaux au-dessus. Litres pour les formats en ml, kg pour les formats en g.
  let REPARTITION = null; // dernière répartition calculée (exports, clic sur une case)
  const fmtQ = (n) => Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
  function contenanceLitres(p) {
    const f = p.format_id ? REF_DATA.formats.find(x => x.id === p.format_id) : null;
    if (!f) return null;
    if (f.volume) return Number(f.volume) / 1000;
    if (f.poids) return Number(f.poids) / 1000;
    return null;
  }
  const uniteFormat = (p) => { const f = p.format_id ? REF_DATA.formats.find(x => x.id === p.format_id) : null; return f && !f.volume && f.poids ? 'kg' : 'L'; };
  function renderStockRepartitionPivot() {
    const lots = stockFilteredLots().filter(l => ['vrac', 'filtre', 'conditionne'].includes(categorieStock(l)));
    const huiles = new Map(); // clé d'huile → { nom, vrac, filtre, formats: Map(label → {u, l, lots}), lotsVrac, lotsFiltre, unite }
    const formats = new Map(); // label → contenance (pour le tri)
    for (const l of lots) {
      const p = APP_DATA.produits.find(x => x.id === l.produit_id);
      if (!p) continue;
      const source = p.produit_source_id ? APP_DATA.produits.find(x => x.id === p.produit_source_id) : null;
      const huile = /huile/i.test(p.nom) || /huile/i.test(source?.nom || '');
      const cle = (huile ? '' : 'autre:') + (cleHuileGen(p.nom) || familleKey(p));
      if (!huiles.has(cle)) huiles.set(cle, { nom: '', huile, vrac: 0, filtre: 0, formats: new Map(), lotsVrac: [], lotsFiltre: [], unite: '' });
      const h = huiles.get(cle);
      const q = Number(l.quantite_actuelle);
      const cat = categorieStock(l);
      if (cat === 'conditionne') {
        const label = p.format_id ? formatLabel(p) : 'Sans format';
        const c = contenanceLitres(p);
        formats.set(label, c ?? 0);
        const cell = h.formats.get(label) || { u: 0, l: 0, convertible: true, lots: [], unite: uniteFormat(p) };
        cell.u += q; if (c == null) cell.convertible = false; else cell.l += q * c;
        cell.lots.push(l); h.formats.set(label, cell);
        if (!h.nom) h.nom = familleDisplayName(p);
      } else {
        if (cat === 'vrac') { h.vrac += q; h.lotsVrac.push(l); } else { h.filtre += q; h.lotsFiltre.push(l); }
        h.unite = h.unite || p.unite_symbole || 'L';
        if (!h.nom || cat === 'vrac') h.nom = baseNomHuile(p.nom) || familleDisplayName(p);
      }
    }
    const kpis = document.getElementById('stockRepartitionKpis');
    const head = document.getElementById('stockRepartitionHead');
    const body = document.getElementById('stockRepartitionBody');
    if (!huiles.size) {
      REPARTITION = null;
      kpis.innerHTML = '';
      head.innerHTML = '<th>Huile</th>';
      body.innerHTML = `<tr><td class="rowMeta" style="text-align:center; padding:22px;">Aucune donnée pour ce filtre.</td></tr>`;
      return;
    }
    const cols = [...formats.entries()].sort((x, y) => x[1] - y[1]).map(([label]) => label);
    const toutes = [...huiles.values()].sort((x, y) => x.nom.localeCompare(y.nom)).map(h => {
      const cond = cols.reduce((t, c) => t + (h.formats.get(c)?.l || 0), 0);
      return { ...h, cond, total: h.vrac + h.filtre + cond };
    });
    // Les produits qui ne sont pas de l'huile (savons, pâtes…) sont listés à part, hors totaux.
    const lignes = [...toutes.filter(h => h.huile), ...toutes.filter(h => !h.huile)];
    const tot = { vrac: 0, filtre: 0, cond: 0, total: 0, unites: 0, formats: Object.fromEntries(cols.map(c => [c, { u: 0, l: 0 }])) };
    for (const h of lignes.filter(h => h.huile)) {
      tot.vrac += h.vrac; tot.filtre += h.filtre; tot.cond += h.cond; tot.total += h.total;
      cols.forEach(c => { const x = h.formats.get(c); if (x) { tot.formats[c].u += x.u; tot.formats[c].l += x.l; tot.unites += x.u; } });
    }
    const u = lignes.find(h => h.huile && h.unite)?.unite || 'L';
    REPARTITION = { lignes, cols, tot, u };
    kpis.innerHTML = [['Total vrac', `${fmtQ(tot.vrac)} ${u}`, 'huile pressée, non filtrée'], ['Total filtré', `${fmtQ(tot.filtre)} ${u}`, 'prête à conditionner'],
      ['Total conditionné', `${fmtQ(tot.cond)} ${u}`, `${tot.unites.toLocaleString('fr-TN')} unité(s) en flacons`], ['Total huile', `${fmtQ(tot.total)} ${u}`, 'vrac + filtré + conditionné']]
      .map(([t, v, d]) => `<div class="repKpi"><small>${t}</small><b>${v}</b><span>${d}</span></div>`).join('');
    head.parentElement.innerHTML = `<tr id="stockRepartitionHead"><th rowspan="2">Huile</th><th class="num" rowspan="2">Vrac</th><th class="num" rowspan="2">Filtré</th>
        ${cols.length ? `<th class="grp" colspan="${cols.length + 1}">Conditionné — unités · ${u}</th>` : ''}<th class="num" rowspan="2">Total</th></tr>
      ${cols.length ? `<tr>${cols.map(c => `<th class="num">${esc(c)}</th>`).join('')}<th class="num">= Total cond.</th></tr>` : ''}`;
    const caseLots = (i, type, c) => ` class="num repCase" data-i="${i}" data-type="${type}"${c ? ` data-col="${esc(c)}"` : ''}`;
    const ligneHtml = (h, i) => { const uh = h.huile ? u : (h.unite || ''); const uf = (x) => h.huile ? u : x.unite; return `<tr${h.huile ? '' : ' class="repAutre"'}>
        <td><b>${esc(h.nom)}</b></td>
        <td${h.vrac ? caseLots(i, 'vrac') : ' class="num rowMeta"'}>${h.vrac ? `${fmtQ(h.vrac)} ${uh}` : '—'}</td>
        <td${h.filtre ? caseLots(i, 'filtre') : ' class="num rowMeta"'}>${h.filtre ? `${fmtQ(h.filtre)} ${uh}` : '—'}</td>
        ${cols.map(c => { const x = h.formats.get(c); return x ? `<td${caseLots(i, 'format', c)}>${x.u.toLocaleString('fr-TN')} u<small>${x.convertible ? `${fmtQ(x.l)} ${uf(x)}` : 'contenance inconnue'}</small></td>` : '<td class="num rowMeta">—</td>'; }).join('')}
        ${cols.length ? `<td class="num">${h.huile ? (h.cond ? `${fmtQ(h.cond)} ${u}` : '—') : '<span class="rowMeta">hors total</span>'}</td>` : ''}
        <td class="num">${h.huile ? `<b>${fmtQ(h.total)} ${u}</b>` : '<span class="rowMeta">hors total</span>'}</td></tr>`; };
    const nbHuiles = lignes.filter(h => h.huile).length;
    document.getElementById('stockRepartitionBody').innerHTML = lignes.slice(0, nbHuiles).map(ligneHtml).join('') + `
      <tr class="repTotal"><td>Total</td><td class="num">${fmtQ(tot.vrac)} ${u}</td><td class="num">${fmtQ(tot.filtre)} ${u}</td>
        ${cols.map(c => tot.formats[c].u ? `<td class="num">${tot.formats[c].u.toLocaleString('fr-TN')} u<small>${fmtQ(tot.formats[c].l)} ${u}</small></td>` : '<td class="num">—</td>').join('')}
        ${cols.length ? `<td class="num">${fmtQ(tot.cond)} ${u}</td>` : ''}<td class="num">${fmtQ(tot.total)} ${u}</td></tr>` +
      (lignes.length > nbHuiles ? `<tr class="repSection"><td colspan="${cols.length + (cols.length ? 5 : 4)}">Autres produits (pas de l'huile) — non comptés dans les totaux</td></tr>` +
        lignes.slice(nbHuiles).map((h, k) => ligneHtml(h, nbHuiles + k)).join('') : '');
  }
  // Clic sur une case : les lots qui la composent (→ répartition du lot par emplacement).
  document.getElementById('stockRepartitionTable').addEventListener('click', (e) => {
    const td = e.target.closest('td.repCase'); if (!td || !REPARTITION) return;
    e.stopPropagation();
    const h = REPARTITION.lignes[Number(td.dataset.i)];
    const lots = td.dataset.type === 'vrac' ? h.lotsVrac : td.dataset.type === 'filtre' ? h.lotsFiltre : (h.formats.get(td.dataset.col)?.lots || []);
    const r = td.getBoundingClientRect();
    afficherMenuContextuel({ preventDefault() {}, clientX: r.left, clientY: r.bottom + 4 },
      lots.map(l => ({ label: `${l.numero_lot} — ${fmtQ(l.quantite_actuelle)} ${l.unite_symbole || ''} · ${esc(l.produit_nom || '')}`, action: () => openRepartitionModal(l.numero_lot) })));
  });
  // Export de la répartition : colonnes à plat (unités et litres séparés), ligne Total comprise.
  function exportRepartition() {
    if (!REPARTITION) return { headers: [], rows: [] };
    const { lignes, cols, tot, u } = REPARTITION;
    const headers = [['huile', 'Huile'], ['vrac', `Vrac (${u})`], ['filtre', `Filtré (${u})`],
      ...cols.flatMap((c, k) => [[`fu${k}`, `${c} (u)`], [`fl${k}`, `${c} (${u})`]]), ['cond', `Total conditionné (${u})`], ['total', `Total (${u})`]].map(([key, label]) => ({ key, label }));
    const ligne = (nom, vrac, filtre, f, cond, total) => Object.assign({ huile: nom, vrac: fmtQ(vrac), filtre: fmtQ(filtre), cond: fmtQ(cond), total: fmtQ(total) },
      ...cols.map((c, k) => ({ [`fu${k}`]: f(c) ? f(c).u.toLocaleString('fr-TN') : '—', [`fl${k}`]: f(c) ? fmtQ(f(c).l) : '—' })));
    const rows = lignes.filter(h => h.huile).map(h => ligne(h.nom, h.vrac, h.filtre, (c) => h.formats.get(c), h.cond, h.total));
    rows.push(ligne('TOTAL HUILE', tot.vrac, tot.filtre, (c) => tot.formats[c], tot.cond, tot.total));
    for (const h of lignes.filter(h => !h.huile)) rows.push({ ...ligne(`${h.nom} (hors huile)`, h.vrac, h.filtre, (c) => h.formats.get(c), 0, 0), cond: 'hors total', total: 'hors total' });
    return { headers, rows };
  }

  function renderStockAll() {
    renderStockMatiere(); renderStockVrac(); renderStockFiltre(); renderStockConditionne();
    renderStockEmballage(); renderStockConsommables(); renderStockRepartitionPivot();
  }

