  // ---------- Vues rapides en onglets (V3.3, proposition 5) ----------
  // Les recherches de tous les jours en un clic, avec leur nombre (calculé sur
  // la recherche et la période en cours). La barre compacte affine dessous.
  const VUES = {};
  function definirVues(cle, conteneur, liste, rendre) {
    if (!conteneur || VUES[cle]) return;
    VUES[cle] = { liste, actif: liste[0][0], rendre };
    const barre = document.createElement('div');
    barre.className = 'vuesRapides'; barre.setAttribute('role', 'tablist'); barre.id = `vues-${cle}`;
    barre.innerHTML = liste.map(([k, l]) => `<button type="button" role="tab" class="vueRapide" data-vue="${k}" aria-selected="${k === liste[0][0]}">${l}<span class="nbVue"></span></button>`).join('');
    barre.addEventListener('click', (e) => { const b = e.target.closest('[data-vue]'); if (b) choisirVue(cle, b.dataset.vue); });
    conteneur.insertBefore(barre, conteneur.firstChild);
  }
  function choisirVue(cle, k) {
    const v = VUES[cle]; if (!v || !v.liste.some(x => x[0] === k)) return;
    v.actif = k;
    document.querySelectorAll(`#vues-${cle} .vueRapide`).forEach(b => b.setAttribute('aria-selected', String(b.dataset.vue === k)));
    v.rendre();
  }
  // Applique la vue active à des lignes déjà filtrées (texte, période) et met les compteurs à jour.
  function filtreVue(cle, rows) {
    const v = VUES[cle]; if (!v) return rows;
    v.liste.forEach(([k, , pred]) => {
      const n = pred ? rows.filter(pred).length : rows.length;
      const el = document.querySelector(`#vues-${cle} [data-vue="${k}"] .nbVue`);
      if (el) el.textContent = n;
    });
    const pred = v.liste.find(x => x[0] === v.actif)?.[2];
    return pred ? rows.filter(pred) : rows;
  }
  const ceMois = (d) => String(d || '').slice(0, 7) === isoLocal(new Date()).slice(0, 7);
  const dans30j = (l) => l.date_expiration && Number(l.quantite_actuelle) > 0 && l.statut !== 'EXPIRE' && l.statut !== 'EPUISE'
    && String(l.date_expiration).slice(0, 10) <= isoLocal(new Date(Date.now() + 30 * 86400000));
  const premierPanel = (vue) => document.querySelector(`#view-${vue} .panel`);
  definirVues('commandes', premierPanel('commandes'), [
    ['toutes', 'Toutes'], ['confirmer', 'À confirmer', c => c.statut === 'en_attente'], ['livrer', 'À livrer', c => c.statut === 'confirmee'],
    ['facturer', 'À facturer', c => (c.statut === 'confirmee' || c.statut === 'livree') && !APP_DATA.factures.some(f => f.statut === 'emise' && f.commande_id === c.id)],
    ['payees', 'Payées', c => c.statut === 'payee'], ['annulees', 'Annulées', c => c.statut === 'annulee'],
  ], renderCommandes);
  document.getElementById('commandesFilterRow')?.closest('.panelHead')?.classList.add('periodeCachee');
  definirVues('factures', premierPanel('factures'), [
    ['toutes', 'Toutes'], ['encaisser', 'À encaisser', f => factureAEncaisser(f)], ['mois', 'Ce mois', f => ceMois(f.date_emission)],
    ['payees', 'Payées', f => f.statut !== 'annulee' && Number(f.total_paye) > 0 && Number(f.solde) <= 0.0005], ['avoir', 'Avec avoir', f => Number(f.total_avoirs) > 0],
  ], renderFactures);
  definirVues('lots', premierPanel('lots'), [
    ['tous', 'Tous'], ['liberes', 'Libérés', l => l.statut === 'LIBERE'], ['peremption', 'Périment sous 30 jours', dans30j],
    ['epuises', 'Épuisés', l => l.statut === 'EPUISE'], ['bloques', 'Bloqués / périmés', l => ['BLOQUE', 'QUARANTAINE', 'EXPIRE'].includes(l.statut)],
  ], renderLotsRegistre);
  definirVues('clients', premierPanel('clients'), [
    ['tous', 'Tous'], ['du', 'Avec reste dû', c => Number(c.solde) > 0.0005], ['credit', 'Avec crédit', c => Number(c.solde) < -0.0005],
  ], renderClients);
  definirVues('paiements', premierPanel('paiements'), [
    ['tous', 'Tous'], ['mois', 'Ce mois', p => ceMois(p.date_paiement)], ['annules', 'Annulés', p => !!p.annule_le],
  ], renderPaiements);


