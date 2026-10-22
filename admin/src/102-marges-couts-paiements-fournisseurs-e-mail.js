  // ---------- Marges, coûts, paiements fournisseurs, e-mail ----------
  const fmtNum = (v, n = 3) => v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: n });
  async function chargerMarges() {
    const p = new URLSearchParams({ par: document.getElementById('mgPar').value });
    ['mgDu', 'mgAu'].forEach((id, i) => { const v = document.getElementById(id).value; if (v) p.set(i ? 'au' : 'du', v); });
    const r = await apiFetch('/couts/marges?' + p.toString());
    const t = r.total;
    document.getElementById('mgColNom').textContent = { produit: 'Produit', client: 'Client', mois: 'Mois' }[r.par];
    const tuile = (titre, val, sous = '') => `<div class="kpiCard"><div class="lbl">${titre}</div><div class="val num">${val}</div><div class="delta" style="${sous ? '' : 'display:none;'}">${sous}</div></div>`;
    document.getElementById('mgKpi').innerHTML = tuile("Chiffre d'affaires HT", fmtDT(t.ca_ht), t.avoirs_ht ? `dont avoirs à déduire : ${fmtDT(t.avoirs_ht)}` : '')
      + tuile('Coût des marchandises', fmtDT(t.cout)) + tuile('Marge', fmtDT(t.marge), t.marge_pct === null ? '' : `${fmtNum(t.marge_pct, 1)} % du CA à coût connu`)
      + tuile('Sans coût connu', fmtDT(t.ca_sans_cout), `${fmtNum(t.quantite_sans_cout, 2)} unité(s) — à renseigner`);
    document.getElementById('mgBody').innerHTML = r.groupes.map(g => `<tr><td>${esc(g.nom)}</td><td class="num">${fmtNum(g.quantite, 2)}</td><td class="num">${fmtDT(g.ca_ht)}</td>
      <td class="num">${fmtDT(g.cout)}</td><td class="num"><b>${fmtDT(g.marge)}</b></td><td class="num">${g.marge_pct === null ? '—' : fmtNum(g.marge_pct, 1) + ' %'}</td>
      <td>${g.quantite_sans_cout > 0 ? `<span class="pill warn">${fmtNum(g.quantite_sans_cout, 2)} sans coût</span>` : '<span class="pill good">oui</span>'}</td></tr>`).join('')
      || '<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucune livraison sur cette période.</td></tr>';
    document.getElementById('mgNote').textContent = r.note;
    const f = await apiFetch('/couts/frais');
    document.getElementById('frPresse').value = f.frais_presse; document.getElementById('frFiltration').value = f.frais_filtration;
    document.getElementById('frMelange').value = f.frais_melange; document.getElementById('frCond').value = f.frais_conditionnement;
    ['frPresse', 'frFiltration', 'frMelange', 'frCond', 'frEnregistrer'].forEach(id => { document.getElementById(id).disabled = !isGerant(); });
  }
  document.getElementById('mgGo').onclick = () => chargerMarges().catch(e => notifier(e.message, 'erreur'));
  document.getElementById('mgPar').onchange = () => chargerMarges().catch(e => notifier(e.message, 'erreur'));
  document.getElementById('frEnregistrer').onclick = async () => {
    try {
      await apiFetch('/couts/frais', { method: 'PUT', body: JSON.stringify({ frais_presse: document.getElementById('frPresse').value || 0, frais_filtration: document.getElementById('frFiltration').value || 0,
        frais_melange: document.getElementById('frMelange').value || 0, frais_conditionnement: document.getElementById('frCond').value || 0 }) });
      notifier("Frais d'étape enregistrés.", 'succes'); chargerMarges();
    } catch (e) { notifier(e.message, 'erreur'); }
  };

  let COUT_LOT = null;
  async function ouvrirCoutLot(numero) {
    try { COUT_LOT = await apiFetch(`/couts/lot/${encodeURIComponent(numero)}`); } catch (e) { notifier(e.message, 'erreur'); return; }
    const c = COUT_LOT, lot = APP_DATA.lots.find(l => l.numero_lot === numero);
    document.getElementById('coutModalTitle').textContent = `Coût — ${numero}`;
    const origine = { achat: "prix d'achat (ligne d'achat rattachée)", standard: 'coût standard du produit (fiche produit)', manuel: 'coût saisi à la main', compose: 'calculé à partir des lots utilisés', inconnu: 'inconnu' }[c.source];
    document.getElementById('coutResume').innerHTML = `<div class="numLegal ${c.cout === null ? 'ko' : ''}"><b>${esc(c.produit_nom || '')}</b> — coût unitaire : <b>${c.cout === null ? 'inconnu' : fmtNum(c.cout, 4) + ' DT'}</b> (${origine})${c.frais_unitaire ? ` · frais d'étape inclus : ${fmtNum(c.frais_unitaire, 4)} DT/unité` : ''}</div>`;
    document.getElementById('coutDetail').innerHTML = (c.detail || []).map(d => `<tr><td class="lotCode">${esc(d.numero_lot)}</td><td class="num">${fmtNum(d.quantite)}</td><td class="num">${d.cout_unitaire === null ? '<span class="pill warn">inconnu</span>' : fmtNum(d.cout_unitaire, 4)}</td><td class="num">${d.montant === null ? '—' : fmtDT(d.montant)}</td></tr>`).join('')
      || '<tr><td colspan="4" class="rowMeta">Lot de départ : pas de lot utilisé.</td></tr>';
    document.getElementById('coutManuel').value = c.cout_saisi === null ? '' : c.cout_saisi;
    document.getElementById('coutEnregistrer').dataset.id = lot ? lot.id : '';
    document.getElementById('coutEnregistrer').disabled = !lot;
    document.getElementById('coutModalOverlay').classList.add('open');
  }
  document.getElementById('coutModalCloseBtn').onclick = () => document.getElementById('coutModalOverlay').classList.remove('open');
  document.getElementById('coutEnregistrer').onclick = async (e) => {
    try {
      await apiFetch(`/couts/lot/${e.target.dataset.id}`, { method: 'PUT', body: JSON.stringify({ cout_unitaire: document.getElementById('coutManuel').value === '' ? null : document.getElementById('coutManuel').value }) });
      notifier('Coût enregistré.', 'succes'); ouvrirCoutLot(COUT_LOT.numero_lot);
    } catch (err) { notifier(err.message, 'erreur'); }
  };

  // Paiements fournisseurs
  let PF = { achat: null };
  async function chargerPaiementsFournisseurs() {
    const [sit, liste] = await Promise.all([apiFetch('/paiements-fournisseurs/situation'), apiFetch('/paiements-fournisseurs')]);
    document.getElementById('pfKpi').innerHTML = `<div class="kpiCard"><div class="lbl">Total à payer aux fournisseurs</div><div class="val num">${fmtDT(sit.total_du)}</div></div>`
      + `<div class="kpiCard"><div class="lbl">Achats avec reste à payer</div><div class="val num">${sit.achats.filter(a => a.reste > 0.0005).length}</div></div>`;
    document.getElementById('pfFournisseurs').innerHTML = sit.fournisseurs.map(f => `<tr><td>${esc(f.nom)}</td><td class="num">${fmtDT(f.total_ttc)}</td><td class="num">${fmtDT(f.paye)}</td><td class="num"><b>${fmtDT(f.reste)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="rowMeta">Aucun achat.</td></tr>';
    const lab = { commande: 'Commandé', partiel: 'Partiel', receptionne: 'Réceptionné', cloture: 'Clôturé' };
    document.getElementById('pfAchats').innerHTML = sit.achats.map(a => `<tr><td class="lotCode">${esc(a.numero)}</td><td>${esc(a.fournisseur_nom)}</td><td class="rowMeta">${fmtDate(a.date_achat)}</td><td>${lab[a.statut] || a.statut}</td>
      <td class="num">${fmtDT(a.total_ttc)}</td><td class="num">${fmtDT(a.paye)}</td><td class="num"><b>${fmtDT(a.reste)}</b></td>
      <td class="rowActions">${a.reste > 0.0005 ? `<button class="rowActionBtn" onclick="ouvrirPaiementFournisseur(${a.achat_id})">Payer</button>` : '<span class="pill good">Soldé</span>'}</td></tr>`).join('') || '<tr><td colspan="8" class="rowMeta">Aucun achat à payer.</td></tr>';
    PF.achats = sit.achats;
    document.getElementById('pfListe').innerHTML = liste.map(p => `<tr style="${p.annule_le ? 'opacity:.55; text-decoration:line-through;' : ''}"><td class="rowMeta">${fmtDate(p.date_paiement)}</td><td>${esc(p.fournisseur_nom)}</td><td>${esc(p.achat_numero || '')}</td>
      <td>${esc(p.mode)}${p.reference ? ' · ' + esc(p.reference) : ''}</td><td class="num">${fmtDT(p.montant)}</td>
      <td class="rowActions">${p.annule_le ? `<span class="rowMeta">annulé : ${esc(p.annule_motif || '')}</span>` : (isGerant() ? `<button class="rowActionBtn" onclick="annulerPaiementFournisseur(${p.id})">Annuler…</button>` : '')}</td></tr>`).join('') || '<tr><td colspan="6" class="rowMeta">Aucun paiement.</td></tr>';
  }
  function ouvrirPaiementFournisseur(achatId) {
    const a = (PF.achats || []).find(x => x.achat_id === achatId); if (!a) return;
    PF.achat = a;
    document.getElementById('pfModalTitle').textContent = `Payer ${a.fournisseur_nom}`;
    document.getElementById('pfModalSub').textContent = `Achat ${a.numero} — reste à payer ${fmtDT(a.reste)}`;
    document.getElementById('pfDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('pfMontant').value = a.reste; document.getElementById('pfRef').value = ''; document.getElementById('pfStatus').textContent = '';
    document.getElementById('pfModalOverlay').classList.add('open');
  }
  async function annulerPaiementFournisseur(id) {
    const motif = await confirmer('Le paiement reste visible, barré, avec son motif, et ne compte plus.', { titre: 'Annuler ce paiement ?', ok: 'Annuler le paiement', non: 'Garder', danger: true, saisie: { label: 'Motif (obligatoire)', placeholder: 'ex. erreur de saisie…' } });
    if (!motif) return;
    try { await apiFetch(`/paiements-fournisseurs/${id}/annuler`, { method: 'POST', body: JSON.stringify({ motif }) }); chargerPaiementsFournisseurs(); } catch (e) { notifier(e.message, 'erreur'); }
  }
  ['pfModalCloseBtn', 'pfAnnuler'].forEach(id => document.getElementById(id).onclick = () => document.getElementById('pfModalOverlay').classList.remove('open'));
  document.getElementById('pfEnregistrer').onclick = async () => {
    try {
      await apiFetch('/paiements-fournisseurs', { method: 'POST', body: JSON.stringify({ achat_id: PF.achat.achat_id, date_paiement: document.getElementById('pfDate').value, montant: document.getElementById('pfMontant').value,
        mode: document.getElementById('pfMode').value, reference: document.getElementById('pfRef').value }) });
      document.getElementById('pfModalOverlay').classList.remove('open'); notifier('Paiement enregistré.', 'succes'); chargerPaiementsFournisseurs();
    } catch (e) { document.getElementById('pfStatus').textContent = e.message; }
  };

  async function controlerMentionsFacture(id) {
    try {
      const r = await apiFetch(`/factures/${id}/conformite`);
      await confirmer(r.conforme ? 'Toutes les mentions obligatoires contrôlées sont présentes.\n\n' + r.facture_electronique : 'Mentions manquantes :\n• ' + r.manque.join('\n• ') + '\n\n' + r.facture_electronique,
        { titre: r.conforme ? 'Facture complète' : 'Facture incomplète', ok: 'OK', non: 'Fermer' });
    } catch (e) { notifier(e.message, 'erreur'); }
  }
  // Envoi d'une facture par e-mail (pièce jointe Word)
  async function envoyerFactureParEmail(factureId) {
    const f = await apiFetch(`/factures/${factureId}`);
    const client = APP_DATA.clients.find(c => c.id === f.client_id);
    const adresse = await confirmer(`La facture ${f.numero} sera envoyée en pièce jointe (Word).${client && client.email ? `\nE-mail enregistré du client : ${client.email}` : '\nAucun e-mail enregistré pour ce client : saisissez-le ici (et ajoutez-le sur sa fiche).'}`,
      { titre: 'Envoyer la facture par e-mail', ok: 'Envoyer', saisie: { label: 'Adresse e-mail (3 maximum, séparées par une virgule)', placeholder: client && client.email ? client.email : 'client@exemple.tn' } });
    if (!adresse) return;
    try {
      const spec = specFacture(f);
      const corps = { ...spec, lignes: spec.lignes.map(l => l.map(v => String(v ?? '').replace(/<[^>]+>/g, ''))) };
      const r = await apiFetch('/exports/envoyer-document', { method: 'POST', body: JSON.stringify({ spec: corps, a: adresse }) });
      notifier(`Facture ${f.numero} envoyée à ${r.destinataires.join(', ')}.`, 'succes');
    } catch (e) { notifier(e.message, 'erreur'); }
  }

