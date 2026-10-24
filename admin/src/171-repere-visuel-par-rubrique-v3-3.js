  // ---------- Repère visuel par rubrique (V3.3) ----------
  // Chaque écran porte le nom et la couleur de sa rubrique (Ventes, Production,
  // Stock, Achats, Réglages) : on voit d'un coup d'œil qu'on a changé d'écran.
  const RUBRIQUE_CLE = { 'Ventes': 'ventes', 'Production': 'production', 'Stock': 'stock', 'Achats': 'achats', 'Réglages': 'reglages', 'Modules': 'reglages' };
  function rubriqueDe(vue) {
    const lien = document.querySelector(`#navScroll a[data-view="${vue}"]`);
    const groupe = lien?.closest('.navGroup');
    return groupe ? { groupe, cle: RUBRIQUE_CLE[groupe.querySelector('.lbl').textContent] || 'accueil', nom: groupe.querySelector('.lbl').textContent,
      icone: groupe.querySelector('.navGroupBtn .code').innerHTML } : { groupe: null, cle: 'accueil', nom: 'Accueil', icone: document.querySelector('.navSingle[data-view="dashboard"] .code')?.innerHTML || '' };
  }
  function majRubrique(vue) {
    const r = rubriqueDe(vue);
    document.body.dataset.rubrique = r.cle;
    // Seule la rubrique de l'écran affiché reste dépliée : le menu reste court et lisible.
    document.querySelectorAll('#navScroll .navGroup').forEach(g => { g.classList.toggle('rubriqueActive', g === r.groupe); if (g !== r.groupe) g.classList.remove('open'); });
  }
  // Repère « VENTES › » au-dessus du titre de chaque écran.
  document.querySelectorAll('#navScroll a[data-view]').forEach(a => {
    const vue = document.getElementById(views[a.dataset.view] || '');
    const h1 = vue?.querySelector('.pageHead h1');
    if (!h1 || vue.querySelector('.rubriqueRepere')) return;
    const r = rubriqueDe(a.dataset.view);
    h1.insertAdjacentHTML('beforebegin', `<div class="rubriqueRepere">${r.icone}<span>${esc(r.nom)}</span></div>`);
  });

