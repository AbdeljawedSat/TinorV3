  // ---------- Fiche détaillée commande / facture (V3.3) ----------
  // Un clic sur une ligne ouvre sa fiche : tout le détail et toutes les
  // actions au même endroit (celles du menu « ⋯ »), les impossibles grisées
  // avec leur raison.
  function fermerFiche() { document.getElementById('fiche').classList.remove('open'); document.getElementById('ficheFond').classList.remove('open'); }
  function afficherFiche(type, titre, meta, corps, tbodyId, id) {
    document.getElementById('ficheTitre').innerHTML = `<div class="type">${type}</div><h2>${titre}</h2><div class="meta">${meta}</div>`;
    document.getElementById('ficheCorps').innerHTML = corps;
    const items = (MENUS_LIGNE[tbodyId] ? MENUS_LIGNE[tbodyId](id) : []).filter(Boolean);
    const zone = document.getElementById('ficheActions');
    zone.innerHTML = '';
    const raisons = [];
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label.replace(/…$/, '…');
      if (i === 0 && !it.desactive && !it.danger) b.className = 'principal';
      if (it.danger) b.className = 'danger';
      if (it.desactive) { b.disabled = true; b.title = it.desactive; raisons.push(`${it.label.replace(/…$/, '')} : ${it.desactive}`); }
      else b.addEventListener('click', () => { fermerFiche(); it.action(); });
      zone.appendChild(b);
    });
    if (raisons.length) zone.insertAdjacentHTML('beforeend', `<div class="raison">${raisons.map(esc).join(' · ')}</div>`);
    document.getElementById('fiche').classList.add('open');
    document.getElementById('ficheFond').classList.add('open');
    document.getElementById('ficheFermer').focus();
  }
  const pastilleVente = (s) => ({ en_attente: '<span class="pill warn">En attente</span>', confirmee: '<span class="pill good">Confirmée</span>',
    livree: '<span class="pill grey">Livrée</span>', payee: '<span class="pill good">Payée</span>', annulee: '<span class="pill danger">Annulée</span>',
    emise: '<span class="pill good">Émise</span>' }[s] || esc(s));
  async function ouvrirFicheCommande(id) {
    try {
      const c = await apiFetch(`/commandes/${id}`);
      const lignes = (c.lignes || []).map(l => `<tr><td>${esc(l.produit_nom)}${l.free_units ? ` <span class="rowMeta">(+${l.free_units} offert${l.free_units > 1 ? 's' : ''})</span>` : ''}
        <div class="rowMeta" style="font-size:11px;">${l.numero_lot ? 'Lot ' + esc(l.numero_lot) : '<span style="color:var(--warn);">En attente de conditionnement</span>'}${l.remise_nom ? ' · ' + esc(l.remise_nom) : ''}</div></td>
        <td class="num">${l.qty}</td><td class="num">${Number(l.qty_livree || 0)}</td><td class="num">${fmtDT(l.unit_price)}</td><td class="num">${fmtDT(l.total)}</td></tr>`).join('');
      const corps = `
        <div class="ficheBloc"><h3>Lignes</h3><table><thead><tr><th>Produit</th><th class="num">Qté</th><th class="num">Livré</th><th class="num">Prix TTC</th><th class="num">Total</th></tr></thead><tbody>${lignes}</tbody></table>
          <div class="ficheTotaux"><span class="fort">Total TTC</span><span class="fort num">${fmtDT(c.total)}</span></div></div>
        ${chaineDocumentsHtml(c, c.numero)}
        ${c.notes ? `<div class="ficheBloc"><h3>Notes</h3><div class="ficheNotes">${esc(c.notes)}</div></div>` : ''}`;
      afficherFiche('Commande', esc(c.numero), `${pastilleVente(c.statut)}<span>${esc(c.client_nom || '—')}</span><span>${fmtDate(c.date_iso)}</span>`, corps, 'commandesBody', id);
      const resume = APP_DATA.commandes.find(x => x.id === id) || c;
      actionsChaineFiche(prochaineEtapeCommande(resume), documentsImprimables(c));
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function ouvrirFicheFacture(id) {
    try {
      const f = await apiFetch(`/factures/${id}`);
      const cmd = f.commande_id ? await apiFetch(`/commandes/${f.commande_id}`).catch(() => null) : null;
      const lignes = (f.lignes || []).map(l => `<tr><td>${esc(l.designation)}${l.remise_nom ? `<div class="rowMeta" style="font-size:11px;">${esc(l.remise_nom)}</div>` : ''}</td><td class="num">${l.qty}</td><td class="num">${fmtDT(l.unit_price)}</td><td class="num">${fmtDT(l.total)}</td></tr>`).join('');
      const paiements = (f.paiements || []).map(p => `<tr${p.annule_le ? ' class="ligneAnnulee"' : ''}><td class="rowMeta num">${fmtDate(p.date_paiement)}</td><td>${esc(MODE_PAIEMENT_LABEL[p.mode] || p.mode)}${p.reference ? ' · ' + esc(p.reference) : ''}${p.annule_le ? `<div style="font-size:11px; color:var(--danger);">Annulé : ${esc(p.annule_motif || '')}</div>` : ''}</td><td class="num"><span class="montant">${fmtDT(p.montant)}</span></td></tr>`).join('');
      const corps = `
        <div class="ficheBloc"><h3>Lignes</h3><table><thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">Prix TTC</th><th class="num">Total</th></tr></thead><tbody>${lignes}</tbody></table>
          <div class="ficheTotaux">
            <span>Total HT</span><span class="num">${fmtDT(f.total_ht)}</span>
            ${Number(f.fodec_montant) ? `<span>FODEC</span><span class="num">${fmtDT(f.fodec_montant)}</span>` : ''}
            <span>TVA (${Number(f.tva_rate)} %)</span><span class="num">${fmtDT(f.montant_tva)}</span>
            ${Number(f.droit_timbre) ? `<span>Droit de timbre</span><span class="num">${fmtDT(f.droit_timbre)}</span>` : ''}
            <span class="fort">Total TTC</span><span class="fort num">${fmtDT(f.total_ttc)}</span>
          </div></div>
        ${(f.avoirs || []).length ? `<div class="ficheBloc"><h3>Avoirs</h3><table><tbody>${f.avoirs.map(a => `<tr><td><span class="ficheLien" onclick="imprimerAvoir(${a.id})">${esc(a.numero)}</span><div class="rowMeta" style="font-size:11px;">${esc(a.motif)}${a.remise_en_stock ? ' · remis en stock' : ''}</div></td><td class="rowMeta num">${fmtDate(a.date_emission)}</td><td class="num">−${fmtDT(a.total_ttc)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <div class="ficheBloc"><h3>Paiements</h3>${paiements ? `<table><tbody>${paiements}</tbody></table>` : '<span class="rowMeta">Aucun paiement.</span>'}
          <div class="ficheTotaux"><span>Payé</span><span class="num">${fmtDT(f.total_paye)}</span>
            ${Number(f.total_avoirs) ? `<span>Avoirs</span><span class="num">−${fmtDT(f.total_avoirs)}</span>` : ''}
            <span class="fort">${f.solde < -0.0005 ? 'Crédit client' : 'Reste dû'}</span><span class="fort num" style="color:${f.solde > 0.0005 && f.statut !== 'annulee' ? 'var(--warn)' : 'var(--good)'};">${fmtDT(f.statut === 'annulee' ? 0 : Math.abs(f.solde))}</span></div></div>
        ${cmd ? chaineDocumentsHtml(cmd, f.numero) : ''}`;
      afficherFiche('Facture', esc(f.numero), `${pastilleVente(f.statut)}<span>${esc(f.client_nom || '—')}</span><span>${fmtDate(f.date_emission)}</span>`, corps, 'facturesBody', id);
      const resumeFac = APP_DATA.factures.find(x => x.id === id) || f;
      actionsChaineFiche(factureAEncaisser(resumeFac) ? { label: '💰 Encaisser', action: () => openPaiementModal(id) } : null, cmd ? documentsImprimables(cmd) : null);
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  // ============================================================================
  // CHAÎNE DE VENTE (V3.3) : bon de commande → bon(s) de livraison → facture en
  // attente (pro forma) → facture. Le stock est retiré du disponible dès la
  // commande (réservé) ; le bon de livraison enregistre la sortie physique.
  // ============================================================================
  const STATUT_BL = { emis: ['good', 'Émis'], annule: ['danger', 'Annulé'] };
  const STATUT_PRO = { en_attente: ['warn', 'En attente'], validee: ['good', 'Validée'], annulee: ['danger', 'Annulée'] };
  const pastille = ([cls, txt]) => `<span class="pill ${cls}">${txt}</span>`;
  const commandeFacturee = id => APP_DATA.factures.some(f => f.statut === 'emise' && f.commande_id === id);
  // Livraison partielle : 80 livrés sur 100 commandés.
  function livraisonPartielle(c) {
    const cmd = Number(c.qte_commandee || 0), liv = Number(c.qte_livree || 0);
    return c.statut === 'confirmee' && liv > 0 && liv < cmd ? { liv, cmd } : null;
  }

