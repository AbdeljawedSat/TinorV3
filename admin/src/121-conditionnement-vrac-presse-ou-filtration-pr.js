  // ============================================================================
  // CONDITIONNEMENT — vrac (presse ou filtration) → produit fini.
  // ============================================================================
  function fmtTotalContenance(qty, format) {
    if (!format) return '—';
    if (format.volume) {
      const totalMl = qty * format.volume;
      return totalMl >= 1000 ? `${(totalMl / 1000).toLocaleString('fr-TN', {maximumFractionDigits:3})} L` : `${totalMl} ml`;
    }
    if (format.poids) {
      const totalG = qty * format.poids;
      return totalG >= 1000 ? `${(totalG / 1000).toLocaleString('fr-TN', {maximumFractionDigits:3})} kg` : `${totalG} g`;
    }
    return '—';
  }
  function renderConditionnement() {
    const body = document.getElementById('conditionnementBody');
    const huileAutre = document.querySelector('.conditionnementHuileToggle.active')?.dataset.val || 'toutes';
    let lignes = APP_DATA.conditionnements.filter(c => {
      if (huileAutre === 'toutes') return true;
      const cat = REF_DATA.categories.find(x => x.id === c.categorie_id);
      const huile = cat ? /huile/i.test(cat.code) || /huile/i.test(cat.nom) : false;
      return huileAutre === 'huile' ? huile : !huile;
    });
    lignes = filtrerParTexteEtDate(lignes, 'conditionnement', c => `${c.produit_nom || ''} ${c.numero_lot || ''}`, c => c.date);
    if (!lignes.length) { body.innerHTML = `<tr><td colspan="8" class="rowMeta" style="text-align:center; padding:22px;">Aucun conditionnement pour ce filtre.</td></tr>`; return; }
    body.innerHTML = lignes.map(c => {
      const format = c.format_id ? REF_DATA.formats.find(f => f.id === c.format_id) : null;
      const contenanceUnite = format ? (format.volume ? `${format.volume} ml` : format.poids ? `${format.poids} g` : '—') : '—';
      // "sources_restantes" = "numero_lot:quantite:produit_id||numero_lot:quantite:produit_id..."
      // — un lot source par presse/filtration utilisée pour CE conditionnement.
      const sourcesTxt = c.sources_restantes
        ? c.sources_restantes.split('||').map(s => {
            const [numero, qte, produitId] = s.split(':');
            const srcProduit = APP_DATA.produits.find(p => p.id === Number(produitId));
            return `${numero}: ${qte} ${srcProduit ? srcProduit.unite_symbole || '' : ''}`;
          }).join(', ')
        : '—';
      return `<tr>
        <td class="lotCode">${esc(c.numero_lot || '—')}</td>
        <td>${esc(c.produit_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(c.date)}</td>
        <td class="num">${c.qty} u</td>
        <td class="rowMeta num">${contenanceUnite}</td>
        <td class="num">${fmtTotalContenance(c.qty, format)}</td>
        <td class="rowMeta num" style="max-width:220px;">${sourcesTxt}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="openConditionnementModal(${c.id})">Modifier</button></td>
      </tr>`;
    }).join('');
  }
  document.querySelectorAll('.conditionnementHuileToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.conditionnementHuileToggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderConditionnement();
    });
  });

