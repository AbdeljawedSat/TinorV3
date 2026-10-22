// Gestion : coût réel par lot, marges, achats (réceptions partielles), paiements fournisseurs, e-mail des documents.
// Prérequis : API démarrée sur une base de TEST avec les données de démonstration (SMTP_HOST=json pour l'étape e-mail).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const post = (u, b) => api(u, { method: 'POST', body: b || {} });
  const put = (u, b) => api(u, { method: 'PUT', body: b || {} });
  const jour = new Date().toISOString().slice(0, 10);
  const fournisseur = (await api('/fournisseurs')).data[0];
  const local = (await api('/locaux')).data[0];
  const mp = (await api('/produits')).data.find(p => p.type_article === 'MATIERE_PREMIERE');

  console.log('GA. Achat, réception partielle puis complète');
  const achat = (await post('/achats', { fournisseur_id: fournisseur.id, date_achat: jour, statut: 'commande', tva_rate: 19, lignes: [{ produit_id: mp.id, quantite: 100, prix_unitaire: 4.5 }] })).data;
  check(!!achat.id, `achat ${achat.numero} créé (100 × 4,5 = 450 HT)`);
  const rec1 = await post('/receptions', { fournisseur_id: fournisseur.id, achat_id: achat.id, date_reception: jour, local_id: local.id, lignes: [{ produit_id: mp.id, quantite: 60, lot_fournisseur: `T${Date.now()}` }] });
  check(rec1.status === 201, 'réception de 60 sur 100');
  let det = (await api(`/achats/${achat.id}`)).data;
  check(det.statut === 'partiel' && Number(det.lignes[0].reste_a_recevoir) === 40 && Number(det.lignes[0].qte_recue) === 60, `achat « partiel », reliquat ${det.lignes[0].reste_a_recevoir}`);
  const lot1 = rec1.data.lignes[0];
  const rec2 = await post('/receptions', { fournisseur_id: fournisseur.id, achat_id: achat.id, date_reception: jour, local_id: local.id, lignes: [{ produit_id: mp.id, quantite: 40, lot_fournisseur: `U${Date.now()}` }] });
  det = (await api(`/achats/${achat.id}`)).data;
  check(rec2.status === 201 && det.statut === 'receptionne', 'après le reliquat : achat « réceptionné »');

  console.log('GB. Coût réel par lot');
  let c = (await api(`/couts/lot/${encodeURIComponent(lot1.numero_lot)}`)).data;
  check(c.source === 'achat' && Math.abs(c.cout - 4.5) < 1e-9, `coût du lot reçu = prix d'achat HT (${c.cout})`);
  const lots = (await api('/lots')).data;
  const presse = lots.find(l => l.origine === 'PRESSE' && l.numero_lot);
  const trac = (await api(`/lots/${encodeURIComponent(presse.numero_lot)}/tracabilite`)).data;
  const src = trac.ascendants[0];
  if (src) {
    const srcLot = lots.find(l => l.numero_lot === src.numero_lot);
    await put(`/couts/lot/${srcLot.id}`, { cout_unitaire: 6 });
    await put('/couts/frais', { frais_presse: 0, frais_filtration: 0, frais_melange: 0, frais_conditionnement: 0 });
    const cp = (await api(`/couts/lot/${encodeURIComponent(presse.numero_lot)}`)).data;
    const attendu = trac.ascendants.length === 1 ? Number(src.qte_utilisee) * 6 / Number(presse.quantite_initiale) : null;
    check(cp.source === 'compose' && (attendu === null || Math.abs(cp.cout - attendu) < 1e-3), `coût d'un lot pressé = matière utilisée × coût / quantité produite (${cp.cout})`);
    await put('/couts/frais', { frais_presse: 0.5, frais_filtration: 0, frais_melange: 0, frais_conditionnement: 0 });
    const cf = (await api(`/couts/lot/${encodeURIComponent(presse.numero_lot)}`)).data;
    check(attendu === null || Math.abs(cf.cout - (attendu + 0.5)) < 1e-3, `+ 0,5 de frais de presse par unité (${cf.cout})`);
    await put('/couts/frais', { frais_presse: 0, frais_filtration: 0, frais_melange: 0, frais_conditionnement: 0 });
    await put(`/couts/lot/${srcLot.id}`, { cout_unitaire: null });
  }
  check((await put('/couts/frais', { frais_presse: -1 })).status === 400, 'frais négatifs refusés');

  console.log('GC. Marges');
  const clientNeuf = (await post('/clients', { nom: `Client marge ${Date.now()}`, tel: '1' })).data;
  const flacon = (await api('/produits')).data.find(p => p.produit_source_id && lots.some(l => l.produit_id === p.id && l.statut === 'LIBERE' && Number(l.quantite_actuelle) >= 3));
  const cmd = (await post('/commandes', { client_id: clientNeuf.id, lignes: [{ produit_id: flacon.id, qty: 2 }] })).data;
  const cmdDet = (await api(`/commandes/${cmd.id}`)).data;
  const lg = cmdDet.lignes[0];
  const bl = await post('/livraisons', { commande_id: cmd.id, lignes: [{ commande_ligne_id: lg.id, qty: 2 }] });
  check(bl.status === 201, `livraison de 2 flacons au client de test (${bl.status})`);
  const lotVendu = (await api('/lots')).data.find(l => l.id === lg.lot_id);
  let mc = (await api('/couts/marges?par=client')).data.groupes.find(g => g.nom === clientNeuf.nom);
  check(mc && mc.quantite_sans_cout === 2 || mc && mc.cout > 0, 'sans coût connu : la ligne est signalée (ou calculée si le lot a déjà un coût)');
  await put(`/couts/lot/${lotVendu.id}`, { cout_unitaire: 1.5 });
  mc = (await api('/couts/marges?par=client')).data.groupes.find(g => g.nom === clientNeuf.nom);
  const caAttendu = 2 * Number(lg.unit_price) / (1 + Number(flacon.tva ?? 19) / 100);
  check(mc && Math.abs(mc.ca_ht - caAttendu) < 0.01 && Math.abs(mc.cout - 3) < 0.001 && Math.abs(mc.marge - (caAttendu - 3)) < 0.01 && mc.quantite_sans_cout === 0,
    `marge exacte : CA HT ${mc && mc.ca_ht} − coût ${mc && mc.cout} = ${mc && mc.marge} (${mc && mc.marge_pct} %)`);
  await put(`/couts/lot/${lotVendu.id}`, { cout_unitaire: null });

  const m = (await api('/couts/marges')).data;
  const somme = m.groupes.reduce((t, g) => t + g.ca_ht, 0);
  check(Array.isArray(m.groupes) && Math.abs(somme - m.total.ca_ht) < 0.01, `marges par produit : ${m.groupes.length} lignes, CA HT ${m.total.ca_ht} = somme des lignes`);
  check((await api('/couts/marges?par=client')).status === 200 && (await api('/couts/marges?par=mois')).status === 200, 'regroupement par client et par mois');
  const mm = (await api('/couts/marges?par=mois&du=2000-01-01&au=2000-01-02')).data;
  check(mm.total.ca_ht === 0, 'période sans vente : zéro');

  console.log('GD. Paiements fournisseurs');
  const sit = (await api('/paiements-fournisseurs/situation')).data;
  const ligne = sit.achats.find(a => a.achat_id === achat.id);
  check(ligne && Math.abs(ligne.reste - Number(det.total_ttc)) < 0.001, `reste à payer = total TTC ${ligne && ligne.reste}`);
  const trop = await post('/paiements-fournisseurs', { achat_id: achat.id, date_paiement: jour, montant: Number(det.total_ttc) + 1 });
  check(trop.status === 400, `paiement supérieur au reste refusé : ${trop.data.error}`);
  const p1 = await post('/paiements-fournisseurs', { achat_id: achat.id, date_paiement: jour, montant: 100, mode: 'virement', reference: 'V-1' });
  check(p1.status === 201 && Math.abs(p1.data.reste_apres - (Number(det.total_ttc) - 100)) < 0.001, `paiement de 100 : reste ${p1.data.reste_apres}`);
  const simultanes = await Promise.all([1, 2, 3].map(() => post('/paiements-fournisseurs', { achat_id: achat.id, date_paiement: jour, montant: Number(det.total_ttc) - 100 })));
  check(simultanes.filter(r => r.status === 201).length === 1, `3 paiements simultanés du solde : un seul accepté (${simultanes.map(r => r.status).join(', ')})`);
  check((await post('/paiements-fournisseurs', { achat_id: achat.id, date_paiement: jour, montant: 1 })).status === 400, 'achat soldé : plus rien à payer');
  const apres = (await api('/paiements-fournisseurs/situation')).data.achats.find(a => a.achat_id === achat.id);
  check(Math.abs(apres.reste) < 0.001, 'reste à payer = 0');
  check((await post(`/paiements-fournisseurs/${p1.data.id}/annuler`, {})).status === 400, 'annulation sans motif refusée');
  check((await post(`/paiements-fournisseurs/${p1.data.id}/annuler`, { motif: 'Erreur de saisie' })).status === 200, 'annulation avec motif');
  const apres2 = (await api('/paiements-fournisseurs/situation')).data.achats.find(a => a.achat_id === achat.id);
  check(Math.abs(apres2.reste - 100) < 0.001, `le paiement annulé ne compte plus : reste ${apres2.reste}`);
  check((await post('/paiements-fournisseurs', { achat_id: achat.id, date_paiement: jour, montant: 0 })).status === 400, 'montant nul refusé');

  console.log('GE. Envoi d\'un document par e-mail');
  const spec = { titre: 'Facture', numero: 'FAC-TEST', societe: { nom: 'Jardins de Jerba', lignes: [] }, refs: [['N°', 'FAC-TEST']], client: { nom: 'Client' },
    colonnes: [{ label: 'Désignation' }, { label: 'Qté', num: 1 }], lignes: [['Huile de sésame', 2]], piedLignes: ['1', '', '', '10'], bas: { tva: { entetes: [], lignes: [] }, totaux: [['Total HT', '10']], net: ['Net à payer', '10'] }, lettres: { intro: '', texte: '' }, piedPage: 'x' };
  const mauvais = await post('/exports/envoyer-document', { spec, a: 'pas-une-adresse' });
  check(mauvais.status === 400, `adresse invalide refusée : ${mauvais.data.error}`);
  const trois = await post('/exports/envoyer-document', { spec, a: 'a@x.tn, b@x.tn, c@x.tn, d@x.tn' });
  check(trois.status === 400, '4 destinataires refusés (3 maximum)');
  const ok = await post('/exports/envoyer-document', { spec, a: 'client@exemple.tn', message: 'Bonjour' });
  check(ok.status === 200 || ok.status === 503, `envoi : ${ok.status === 200 ? 'message construit avec la pièce jointe' : 'SMTP non configuré (503) — ' + ok.data.error}`);
})();
