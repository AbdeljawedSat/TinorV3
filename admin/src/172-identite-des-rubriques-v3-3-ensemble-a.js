  // ---------- Identité des rubriques (V3.3, ensemble A) ----------
  // Une icône par écran (menu, titre, recherche Ctrl+K), le menu aux couleurs
  // des rubriques, un bandeau illustré en tête d'écran, des numéros colorés.
  const ICONE_ECRAN = {
    dashboard: 'accueil', notifications: 'cloche', synchro: 'mouvement',
    commandes: 'commande', factures: 'facture', avoirs: 'avoir', livraisons: 'camion', proformas: 'facture', paiements: 'paiement', stats: 'stats', clients: 'client', remises: 'remise', 'grille-prix': 'grille',
    presse: 'presse', filtration: 'filtre', melanges: 'filtre', conditionnement: 'flacon', recettes: 'recette', 'historique-prod': 'historique',
    lots: 'lot', stock: 'stock', inventaires: 'inventaire', reprise: 'inventaire', 'stock-mouvements': 'mouvement', tracabilite: 'trace', produits: 'produit',
    achats: 'achat', receptions: 'graine', fournisseurs: 'camion', certificats: 'bio',
    parametres: 'parametre', utilisateurs: 'utilisateur', employes: 'employe', locaux: 'local', numerotation: 'parametre', journal: 'parametre', 'qualite-parametres': 'parametre', marges: 'stats', 'paiements-fournisseurs': 'achat', apropos: 'parametre',
  };
  const iconeEcran = (vue, classe = 'ecranIc') => ICONE_ECRAN[vue] ? `<svg class="${classe}" aria-hidden="true"><use href="#e-${ICONE_ECRAN[vue]}"/></svg>` : '';
  document.querySelectorAll('#navScroll .navGroup').forEach(g => { g.dataset.rubrique = RUBRIQUE_CLE[g.querySelector('.lbl').textContent] || ''; });
  document.querySelectorAll('#navScroll .navChildren a[data-view]').forEach(a => {
    if (!a.querySelector('.ecranIc')) a.insertAdjacentHTML('afterbegin', iconeEcran(a.dataset.view));
  });
  document.querySelectorAll('#navScroll a[data-view]').forEach(a => {
    const vue = document.getElementById(views[a.dataset.view] || '');
    const tete = vue?.querySelector('.pageHead'), h1 = tete?.querySelector('h1');
    if (!h1 || tete.querySelector('.illuRubrique')) return;
    const cle = rubriqueDe(a.dataset.view).cle;
    h1.insertAdjacentHTML('afterbegin', `<span class="ecranPastille">${iconeEcran(a.dataset.view, '')}</span>`);
    tete.insertAdjacentHTML('beforeend', `<svg class="illuRubrique" aria-hidden="true"><use href="#illu-${cle}"/></svg>`);
  });
  // Numéros de document : la couleur dit le type (vente, avoir, production, stock, achat).
  function rubriqueDuNumero(t) {
    if (/^AV-\d/.test(t)) return 'avoir';
    if (/^(CMD|BC|BL|PRO|FAC)-\d/.test(t)) return 'ventes';
    if (/^(ACH|REC)-\d/.test(t) || /^\d+-(MP|A)-\d/.test(t)) return 'achats';
    if (/^\d+-(P|F)-\d/.test(t)) return 'production';
    if (/^INV-\d/.test(t) || /^\d+-[A-Z]+-\d/.test(t)) return 'stock';
    return '';
  }
  function colorerNumeros(racine) {
    racine.querySelectorAll('.lotCode').forEach(el => {
      const r = rubriqueDuNumero(el.textContent.trim());
      const voulu = r ? `doc-${r}` : '';
      if (el.dataset.doc === voulu) return;
      if (el.dataset.doc) el.classList.remove(el.dataset.doc);
      if (voulu) el.classList.add(voulu);
      el.dataset.doc = voulu;
    });
  }

