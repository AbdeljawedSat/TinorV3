  // ---------- Recherche universelle Ctrl+K (V3.3) ----------
  // Écrans du menu, créations courantes et données (clients, lots, factures…)
  // dans une seule liste au clavier.
  const PALETTE_CREATIONS = [
    ['commandes', 'Nouvelle commande'], ['receptions', 'Nouvelle réception de matière'], ['presse', 'Nouveau pressage'],
    ['filtration', 'Nouvelle filtration'], ['conditionnement', 'Nouveau conditionnement'], ['clients', 'Nouveau client'],
    ['produits', 'Nouveau produit'], ['achats', 'Nouvel achat'], ['inventaires', 'Nouvel inventaire'],
  ];
  let PALETTE_RESULTATS = [], PALETTE_SEL = 0;
  function paletteEcrans() {
    return Array.from(document.querySelectorAll('#navScroll a[data-view]'))
      .filter(a => a.style.display !== 'none')
      .map(a => ({ cat: 'Aller à', label: a.querySelector('span:not(.code):not(.cnt)')?.textContent.trim() || a.dataset.view,
        sousLabel: a.closest('.navGroup')?.querySelector('.lbl')?.textContent || '', view: a.dataset.view, action: null }));
  }
  function paletteCalculer(terme) {
    const t = normaliserRecherche(terme.trim());
    const ok = (txt) => !t || normaliserRecherche(txt).includes(t);
    const ecrans = paletteEcrans().filter(r => ok(r.label + ' ' + r.sousLabel));
    const creations = PALETTE_CREATIONS.filter(([v, l]) => NOUVEAU_HANDLERS[v] && ok(l))
      .map(([v, l]) => ({ cat: 'Créer', label: l, sousLabel: '', view: v, action: () => NOUVEAU_HANDLERS[v]() }));
    const donnees = t.length >= 2 ? globalSearchResultats(terme) : [];
    return [...creations.slice(0, t ? 5 : 3), ...ecrans.slice(0, t ? 8 : 6), ...donnees];
  }
  function paletteAfficher() {
    const liste = document.getElementById('paletteListe');
    if (!PALETTE_RESULTATS.length) { liste.innerHTML = '<div class="vide">Aucun résultat.</div>'; return; }
    let cat = null;
    liste.innerHTML = PALETTE_RESULTATS.map((r, i) => {
      const entete = r.cat !== cat ? `<div class="cat">${r.cat}</div>` : '';
      cat = r.cat;
      return `${entete}<div class="item${i === PALETTE_SEL ? ' sel' : ''}" data-idx="${i}"><span>${iconeEcran(r.view)}${r.label}</span><span class="sous">${r.sousLabel || ''}</span></div>`;
    }).join('');
    liste.querySelector('.item.sel')?.scrollIntoView({ block: 'nearest' });
  }
  function paletteOuvrir() {
    if (!TOKEN) return;
    const p = document.getElementById('palette'), input = document.getElementById('paletteInput');
    p.classList.add('open'); input.value = '';
    PALETTE_RESULTATS = paletteCalculer(''); PALETTE_SEL = 0; paletteAfficher();
    setTimeout(() => input.focus(), 0);
  }
  function paletteFermer() { document.getElementById('palette').classList.remove('open'); }
  function paletteExecuter(i) {
    const r = PALETTE_RESULTATS[i];
    if (!r) return;
    paletteFermer();
    const lien = document.querySelector(`#navScroll a[data-view="${r.view}"]`);
    if (lien) setActive(r.view, lien);
    if (r.action) setTimeout(r.action, 150);
  }
  document.getElementById('paletteInput').addEventListener('input', (e) => { PALETTE_RESULTATS = paletteCalculer(e.target.value); PALETTE_SEL = 0; paletteAfficher(); });
  document.getElementById('paletteInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); PALETTE_SEL = Math.min(PALETTE_SEL + 1, PALETTE_RESULTATS.length - 1); paletteAfficher(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); PALETTE_SEL = Math.max(PALETTE_SEL - 1, 0); paletteAfficher(); }
    if (e.key === 'Enter') { e.preventDefault(); paletteExecuter(PALETTE_SEL); }
    if (e.key === 'Escape') paletteFermer();
  });
  document.getElementById('paletteListe').addEventListener('click', (e) => { const it = e.target.closest('.item'); if (it) paletteExecuter(Number(it.dataset.idx)); });
  document.getElementById('palette').addEventListener('click', (e) => { if (e.target.id === 'palette') paletteFermer(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paletteOuvrir(); }
  });

