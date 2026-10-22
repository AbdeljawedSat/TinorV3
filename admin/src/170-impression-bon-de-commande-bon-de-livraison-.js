  // ---------- Impression : bon de commande, bon de livraison, facture en attente ----------
  // BC, BL, pro forma : même spec que la facture → PDF, Word ou Excel de même forme.
  function specDocumentVente({ titre, numero, date, refs, client, entetes, lignes, totaux, mentions, signatures, montant }) {
    const e = enteteSociete();
    const net = (totaux || []).find(t => t[2]);
    return {
      couleur: e.couleur, logo: e.logo, societe: { nom: e.nom, lignes: e.lignes },
      numero, titre, refs: [['N°', esc(numero)], ['Date', fmtDate(date)], ...(refs || [])],
      client: clientSpec(client.id, client.nom),
      colonnes: entetes.map(([label, num]) => ({ label, num: !!num })), lignes,
      piedLignes: [`${lignes.length} ligne${lignes.length > 1 ? 's' : ''}`, ''],
      bas: totaux ? { mentions: mentions || '', totaux: totaux.filter(t => !t[2]), net: net ? [net[0], net[1]] : null } : { mentions: mentions || '' },
      lettres: montant != null ? { intro: 'Arrêté le présent document à la somme de :', texte: montantEnLettres(montant) } : null,
      signatures: signatures || null,
      piedPage: `${titre} N° ${numero} pour ${client.nom || ''}`,
    };
  }
  function imprimerDocumentVente(args, format = 'pdf') {
    const spec = specDocumentVente(args);
    if (format !== 'pdf') return exporterDocument(spec, format);
    const w = window.open('', `doc_${args.numero}_${Date.now()}`);
    if (!w) { notifier('Autorisez les pop-ups pour imprimer.'); return; }
    w.document.open();
    w.document.write(`<html><head><meta charset="UTF-8"><title>${esc(args.titre)} ${esc(args.numero)}</title><style>${cssDocumentVente()}
      .factureDoc { --couleur: ${spec.couleur}; }</style></head><body>
      ${args.filigrane ? `<div class="filigrane">${esc(args.filigrane)}</div>` : ''}${htmlDepuisSpec(spec)}
    </body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
  }
  async function imprimerBonCommande(id, format = 'pdf') {
    try {
      const c = await apiFetch(`/commandes/${id}`);
      imprimerDocumentVente({ titre: 'Bon de commande', numero: c.numero, date: c.date_iso, refs: [], client: { id: c.client_id, nom: c.client_nom },
        entetes: [['Produit'], ['Qté', 1], ['Prix TTC', 1], ['Remise', 1], ['Total TTC', 1]],
        lignes: (c.lignes || []).map(l => [esc(l.produit_nom) + (l.free_units ? ` (+${l.free_units} offert${l.free_units > 1 ? 's' : ''})` : ''), Number(l.qty), fmtDT(l.unit_price).replace(' DT', ''), l.remise_pct ? `${Number(l.remise_pct)} %` : '—', fmtDT(l.total).replace(' DT', '')]),
        totaux: [['Net à payer', fmtDT(c.total).replace(' DT', ''), true]], montant: c.total, mentions: c.notes ? esc(c.notes) : 'Remarques',
        signatures: ['Pour Les Jardins de Jerba', 'Bon pour accord — le client (date, signature)'] }, format);
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function imprimerLivraison(id, format = 'pdf') {
    try {
      const b = await apiFetch(`/livraisons/${id}`);
      imprimerDocumentVente({ titre: 'Bon de livraison', numero: b.numero, date: b.date_livraison, refs: [['Commande', esc(b.commande_numero)]], client: { id: b.client_id, nom: b.client_nom },
        entetes: [['Produit'], ['Lot'], ['Commandé', 1], ['Livré', 1], ['Reste à livrer', 1]],
        lignes: b.lignes.map(l => [esc(l.produit_nom) + (l.free_units && Number(l.qty_livree) >= Number(l.qty_commandee) ? ` (+${l.free_units} offert${l.free_units > 1 ? 's' : ''})` : ''), esc(l.numero_lot || '—'),
          Number(l.qty_commandee), `<b>${Number(l.qty)}</b> ${esc(l.unite || '')}`, Math.max(0, Math.round((Number(l.qty_commandee) - Number(l.qty_livree)) * 100) / 100)]),
        mentions: `Document de transport, sans prix.${b.statut === 'annule' ? '\nBON ANNULÉ : ' + esc(b.annule_motif || '') : ''}${b.notes ? '\n' + esc(b.notes) : ''}`,
        filigrane: b.statut === 'annule' ? 'ANNULÉ' : '', signatures: ['Livré par (nom, signature)', 'Reçu par — nom, date, signature, cachet'] }, format);
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function imprimerProforma(id, format = 'pdf') {
    try {
      const p = await apiFetch(`/proformas/${id}`);
      imprimerDocumentVente({ titre: 'Facture pro forma', numero: p.numero, date: p.date_proforma, refs: [['Commande', esc(p.commande_numero)]], client: { id: p.client_id, nom: p.client_nom },
        entetes: [['Désignation'], ['Qté', 1], ['Prix TTC', 1], ['Total TTC', 1]],
        lignes: p.lignes.map(l => [esc(l.designation), Number(l.qty), fmtDT(l.unit_price).replace(' DT', ''), fmtDT(l.total).replace(' DT', '')]),
        totaux: [['Total HT', fmtDT(p.total_ht).replace(' DT', '')], ['FODEC', fmtDT(p.fodec_montant).replace(' DT', '')], ['Total TVA', fmtDT(p.montant_tva).replace(' DT', '')],
          ['Timbre', fmtDT(p.droit_timbre).replace(' DT', '')], ['Net à payer', fmtDT(p.total_ttc).replace(' DT', ''), true]], montant: p.total_ttc,
        mentions: `FACTURE EN ATTENTE — PRO FORMA, SANS VALEUR COMPTABLE.\nLa facture définitive (numéro FAC-…) sera émise à la validation.${p.notes ? '\n' + esc(p.notes) : ''}`,
        filigrane: p.statut === 'validee' ? '' : 'PRO FORMA' }, format);
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  document.getElementById('ficheFermer').addEventListener('click', fermerFiche);
  document.getElementById('ficheFond').addEventListener('click', fermerFiche);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('fiche').classList.contains('open')) fermerFiche(); });
  [['commandesBody', ouvrirFicheCommande], ['facturesBody', ouvrirFicheFacture]].forEach(([tbody, ouvrir]) => {
    document.getElementById(tbody).addEventListener('click', (e) => {
      if (e.target.closest('button, a, select, input')) return; // les boutons de la ligne gardent leur rôle
      const tr = e.target.closest('tr[data-id]');
      if (tr) ouvrir(Number(tr.dataset.id));
    });
  });

