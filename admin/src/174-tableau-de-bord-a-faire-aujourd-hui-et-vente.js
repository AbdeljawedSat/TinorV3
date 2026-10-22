  // ---------- Tableau de bord : « À faire aujourd'hui » et ventes sur 6 mois (V3.3) ----------
  function allerVers(view, apres) {
    const lien = document.querySelector(`#navScroll a[data-view="${view}"]`);
    if (lien) setActive(view, lien);
    if (apres) setTimeout(apres, 120);
  }
  function filtrerCommandes(statut) {
    choisirVue('commandes', { en_attente: 'confirmer', confirmee: 'livrer' }[statut] || 'toutes');
  }
  function renderAFaire() {
    const box = document.getElementById('dashboardAFaire');
    if (!box) return;
    const auj = isoLocal(new Date());
    const dans30 = isoLocal(new Date(Date.now() + 30 * 86400000));
    const facturees = new Set(APP_DATA.factures.filter(f => f.statut === 'emise').map(f => f.commande_id));
    const aEncaisser = APP_DATA.factures.filter(f => f.statut !== 'annulee' && Number(f.solde) > 0.0005);
    const resteDu = aEncaisser.reduce((s, f) => s + Number(f.solde), 0);
    const perimes = APP_DATA.lots.filter(l => Number(l.quantite_actuelle) > 0 && l.statut !== 'EXPIRE' && l.date_expiration
      && String(l.date_expiration).slice(0, 10) <= dans30);
    const taches = [
      { nb: APP_DATA.commandes.filter(c => c.statut === 'en_attente').length, titre: 'Commandes à confirmer', detail: 'En attente de validation', go: () => allerVers('commandes', () => filtrerCommandes('en_attente')) },
      { nb: APP_DATA.commandes.filter(c => c.statut === 'confirmee').length, titre: 'Commandes à livrer', detail: 'Confirmées, pas encore livrées', go: () => allerVers('commandes', () => filtrerCommandes('confirmee')) },
      { nb: APP_DATA.commandes.filter(c => (c.statut === 'livree' || c.statut === 'confirmee') && !facturees.has(c.id)).length, titre: 'Commandes à facturer', detail: 'Confirmées ou livrées sans facture', go: () => allerVers('commandes', () => choisirVue('commandes', 'facturer')) },
      { nb: aEncaisser.length, titre: 'Factures à encaisser', detail: aEncaisser.length ? `Reste dû : ${fmtDT(resteDu)}` : 'Tout est encaissé', go: () => allerVers('factures', () => choisirVue('factures', 'encaisser')) },
      { nb: perimes.length, titre: 'Lots qui périment sous 30 jours', detail: perimes.some(l => String(l.date_expiration).slice(0, 10) < auj) ? 'Dont des lots déjà périmés' : 'À écouler en priorité (FEFO)', go: () => allerVers('lots', () => choisirVue('lots', 'peremption')) },
    ];
    box.innerHTML = taches.map((t, i) => `
      <button type="button" class="aFaire" data-idx="${i}">
        <span class="nb${t.nb ? '' : ' ok'}">${t.nb || '✓'}</span>
        <span class="txt">${esc(t.titre)}<small>${t.detail}</small></span>
        <span class="go">Ouvrir →</span>
      </button>`).join('');
    box.querySelectorAll('.aFaire').forEach(b => b.addEventListener('click', () => taches[Number(b.dataset.idx)].go()));
  }
  function renderGraphVentes() {
    const box = document.getElementById('dashboardGraphVentes');
    if (!box) return;
    const now = new Date();
    const mois = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    const totaux = mois.map(m => {
      const cle = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      return APP_DATA.factures.filter(f => f.statut !== 'annulee' && String(f.date_emission || '').slice(0, 7) === cle)
        .reduce((s, f) => s + Number(f.total_ttc || 0) - Number(f.total_avoirs || 0), 0);
    });
    const max = Math.max(...totaux, 1);
    const court = (n) => n >= 1000 ? `${(n / 1000).toLocaleString('fr-TN', { maximumFractionDigits: 1 })} k` : Math.round(n).toLocaleString('fr-TN');
    box.innerHTML = mois.map((m, i) => `
      <div class="barre${i === 5 ? ' actuel' : ''}" title="${fmtDT(totaux[i])}">
        <span class="v">${totaux[i] ? court(totaux[i]) : '—'}</span>
        <i style="height:${Math.round(totaux[i] / max * 120)}px"></i>
        <span>${m.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
      </div>`).join('');
  }

