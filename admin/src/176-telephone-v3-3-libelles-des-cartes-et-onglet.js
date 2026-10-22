  // ---------- Téléphone (V3.3) : libellés des cartes et onglets du bas ----------
  // Chaque cellule reçoit le titre de sa colonne (affiché devant la valeur quand
  // le tableau devient une liste de cartes sur petit écran).
  function etiqueterTableau(table){
    const titres = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    if (!titres.length) return;
    table.querySelectorAll('tbody tr').forEach(tr => {
      let col = 0;
      Array.from(tr.children).forEach(td => {
        const n = Number(td.getAttribute('colspan')) || 1;
        const label = n > 1 ? '' : (titres[col] || '');
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
        col += n;
      });
    });
  }
  const etiqueterTout = () => { document.querySelectorAll('#content table').forEach(etiqueterTableau); colorerNumeros(document.getElementById('content')); };
  let etiquetageEnAttente = false;
  new MutationObserver(() => {
    if (etiquetageEnAttente) return;
    etiquetageEnAttente = true;
    requestAnimationFrame(() => { etiquetageEnAttente = false; etiqueterTout(); });
  }).observe(document.getElementById('content'), { childList: true, subtree: true });

  const ONGLET_DE_VUE = {
    dashboard: 'dashboard',
    commandes: 'commandes', factures: 'commandes', avoirs: 'commandes', paiements: 'commandes', clients: 'commandes', remises: 'commandes', 'grille-prix': 'commandes',
    presse: 'presse', filtration: 'presse', melanges: 'presse', conditionnement: 'presse', recettes: 'presse', 'historique-prod': 'presse',
    lots: 'lots', stock: 'lots', 'stock-mouvements': 'lots', inventaires: 'lots', reprise: 'lots', tracabilite: 'lots', produits: 'lots'
  };
  function majOngletsMobile(vue){
    const actif = ONGLET_DE_VUE[vue] || 'plus';
    document.querySelectorAll('#ongletsMobile button').forEach(b => b.classList.toggle('actif', b.dataset.onglet === actif));
  }
  document.querySelectorAll('#ongletsMobile button').forEach(b => {
    b.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (b.dataset.onglet === 'plus') { sidebar.classList.toggle('open'); return; }
      const lien = document.querySelector(`.navChildren a[data-view="${b.dataset.onglet}"], .navSingle[data-view="${b.dataset.onglet}"]`);
      if (lien) setActive(lien.dataset.view, lien);
      sidebar.classList.remove('open');
      document.getElementById('content').scrollTop = 0;
    });
  });

  document.getElementById('menuToggle').addEventListener('click', ()=>{
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Activer le Tableau de bord par défaut au chargement (rien ne le faisait avant)
  setActive('dashboard', document.querySelector('.navSingle[data-view="dashboard"]'));
</script>
