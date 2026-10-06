// Contraintes de cohérence (bilans matière, quantités, montants, dates).
// Prérequis : API démarrée sur une base de TEST contenant les données de
// démonstration (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const produits = (await api('/produits')).data;
  const P = (debut) => produits.find(p => p.nom.startsWith(debut));
  const fourn = (await api('/fournisseurs')).data[0], local = (await api('/locaux')).data[0], client = (await api('/clients')).data[0];
  const refus = async (promesse, libelle) => { const r = await promesse; check(r.status === 400 || r.status === 409, `${libelle} → refusé : ${r.data.error || r.status}`); return r; };
  const ok = async (promesse, libelle) => { const r = await promesse; check(r.status < 300, `${libelle} (HTTP ${r.status}${r.data.error ? ' ' + r.data.error : ''})`); return r; };
  const post = (url, body) => api(url, { method: 'POST', body });
  const graineS = P('Graines de Sésame'), graineN = P('Graines de Nigelle'), huileS = P('Huile de Sésame — Vrac'), huileN = P('Huile de Nigelle — Vrac');
  const recevoir = async (lignes) => (await post('/receptions', { fournisseur_id: fourn.id, date_reception: '2026-10-03', local_id: local.id, lignes })).data.lignes.map(l => l.lot_id);

  console.log('K. Pressage de plusieurs lots / plusieurs graines en une opération');
  const [s1, s2, n1] = await recevoir([{ produit_id: graineS.id, quantite: 60 }, { produit_id: graineS.id, quantite: 40 }, { produit_id: graineN.id, quantite: 30 }]);
  const presse = (sources, sorties) => post('/presse', { date: '2026-10-03', sources, sorties });
  await refus(presse([{ lot_id: s1, quantite: 60 }, { lot_id: n1, quantite: 30 }],
    [{ produit_id: huileS.id, quantite_produite: 30, quantite_tourteau: 20 }, { produit_id: huileN.id, quantite_produite: 15, quantite_tourteau: 16 }]),
    'nigelle : 15 + 16 > 30 graines (même si le total 81 ≤ 90)');
  await refus(presse([{ lot_id: s1, quantite: 60 }, { lot_id: n1, quantite: 30 }], [{ produit_id: huileS.id, quantite_produite: 30 }]), 'graines de nigelle sans huile obtenue');
  await refus(presse([{ lot_id: s1, quantite: 10 }, { lot_id: s1, quantite: 10 }], [{ produit_id: huileS.id, quantite_produite: 5 }]), 'même lot saisi deux fois');
  await refus(presse([{ lot_id: s1, quantite: 5 }], [{ produit_id: P('Huile de Sésame — Filtrée').id, quantite_produite: 1 }]), 'pressage qui donnerait une huile filtrée');
  const op = await ok(presse([{ lot_id: s1, quantite: 60 }, { lot_id: s2, quantite: 40 }, { lot_id: n1, quantite: 30 }],
    [{ produit_id: huileS.id, quantite_produite: 35, quantite_tourteau: 60 }, { produit_id: huileN.id, quantite_produite: 9, quantite_tourteau: 20 }]),
    '2 lots de sésame + 1 de nigelle → 2 huiles');
  check(op.data.lots_presse.length === 2 && op.data.bilan.graines === 130 && op.data.bilan.pertes === 6, `bilan de l'opération : ${JSON.stringify(op.data.bilan)}`);
  const lotPresseS = op.data.lots_presse.find(l => l.produit_id === huileS.id);

  console.log('L. Filtration : huile filtrée + déchet ≤ huile pressée utilisée');
  const filtreeS = P('Huile de Sésame — Filtrée'), filtreeN = P('Huile de Nigelle — Filtrée');
  const filtrer = (q, filtre, dechet, produit = filtreeS.id) => post('/filtration', { date: '2026-10-03', produit_id: produit, quantite_produite: filtre, quantite_dechet: dechet, sources: [{ lot_presse_id: lotPresseS.id, quantite_utilisee: q }] });
  await refus(filtrer(20, 19, 2), 'filtré 19 + déchet 2 > 20 utilisés');
  await refus(filtrer(-5, 1, 0), 'quantité utilisée négative');
  await refus(filtrer(10, 9, 0, P('Huile de Sésame — Flacon 30ml').id), 'produit obtenu qui n\'est pas une huile filtrée (flacon)');
  await refus(filtrer(10, 9, 0, huileS.id), 'produit obtenu = huile vrac de presse (doit être « Filtrée »)');
  await refus(filtrer(10, 9, 0, filtreeN.id), 'huile de nigelle filtrée à partir d\'huile de sésame pressée');
  const filt = await ok(filtrer(20, 18, 2), 'filtré 18 + déchet 2 = 20 utilisés');

  console.log('L2. Filtration d\'un mélange de plusieurs huiles');
  const lotPresseN = op.data.lots_presse.find(l => l.produit_id === huileN.id);
  const melange = (produit, sources, q) => post('/filtration', { date: '2026-10-03', produit_id: produit, quantite_produite: q, melange: true, sources });
  const deuxHuiles = [{ lot_presse_id: lotPresseS.id, quantite_utilisee: 3 }, { lot_presse_id: lotPresseN.id, quantite_utilisee: 2 }];
  await refus(melange(filtreeS.id, deuxHuiles, 5), 'mélange déclaré en « Huile de Sésame — Filtrée »');
  const prodMelange = (await post('/produits', { nom: 'Huile Mélange Sésame-Nigelle — Filtrée', categorie_id: huileS.categorie_id, unite_id: huileS.unite_id, type_article: 'PRODUIT_FABRIQUE', fabriquable: true, stockable: true })).data;
  await refus(melange(prodMelange.id, [{ lot_presse_id: lotPresseS.id, quantite_utilisee: 3 }], 3), 'mélange avec une seule huile');
  await refus(filtrer(5, 5, 0, prodMelange.id), 'produit mélange sans cocher « mélange »');
  const filtM = await ok(melange(prodMelange.id, deuxHuiles, 5), 'sésame 3 L + nigelle 2 L → 5 L de mélange filtré');
  const compo = (await api('/filtration')).data.find(f => f.id === filtM.data.id).composition;
  check(compo.length === 2 && compo.some(c => c.pourcentage === 60) && compo.some(c => c.pourcentage === 40), `composition enregistrée : ${compo.map(c => c.huile + ' ' + c.pourcentage + ' %').join(', ')}`);
  const flaconM = (await post('/produits', { nom: 'Huile Mélange Sésame-Nigelle — Flacon 30ml', categorie_id: huileS.categorie_id, unite_id: P('Huile de Sésame — Flacon 30ml').unite_id, format_id: P('Huile de Sésame — Flacon 30ml').format_id, produit_source_id: prodMelange.id, type_article: 'PRODUIT_FABRIQUE', vendable: true, stockable: true })).data;
  await ok(post('/conditionnement', { date: '2026-10-03', produit_id: flaconM.id, qty: 100, sources: [{ lot_filtration_id: filtM.data.id, quantite_utilisee: 3 }] }), 'flacons de mélange remplis avec le mélange filtré');

  console.log('M. Conditionnement : vrac du produit, contenu ≤ vrac utilisé, quantité entière');
  const flaconS = P('Huile de Sésame — Flacon 30ml'), flaconN = P('Huile de Nigelle — Flacon 30ml');
  const conditionner = (produit, qty, q) => post('/conditionnement', { date: '2026-10-03', produit_id: produit.id, qty, sources: [{ lot_filtration_id: filt.data.id, quantite_utilisee: q }] });
  await refus(conditionner(flaconN, 100, 3), 'flacon de nigelle rempli avec de l\'huile de sésame');
  await refus(conditionner(flaconS, 200, 5), '200 × 30 ml = 6 L avec seulement 5 L de vrac');
  await refus(conditionner(flaconS, 10.5, 1), 'quantité de flacons non entière');
  await refus(conditionner(huileS, 1, 1), 'conditionnement en huile vrac (sans flacon)');
  await ok(conditionner(flaconS, 100, 3), '100 × 30 ml = 3 L avec 3 L de vrac');

  console.log('M2. Mélange dans les 3 étapes + nouveau produit fini au conditionnement');
  const [gs, gn] = await recevoir([{ produit_id: graineS.id, quantite: 50 }, { produit_id: graineN.id, quantite: 50 }]);
  const cat = huileS.categorie_id, lit = huileS.unite_id;
  const vracM = (await post('/produits', { nom: 'Huile Mélange Sésame-Nigelle — Vrac', categorie_id: cat, unite_id: lit, type_article: 'PRODUIT_FABRIQUE', fabriquable: true, stockable: true })).data;
  const presseM = (srcs, sorties) => post('/presse', { date: '2026-10-03', melange: true, sources: srcs, sorties });
  await refus(presseM([{ lot_id: gs, quantite: 10 }], [{ produit_id: vracM.id, quantite_produite: 3 }]), 'presse mélange avec une seule graine');
  await refus(presseM([{ lot_id: gs, quantite: 10 }, { lot_id: gn, quantite: 10 }], [{ produit_id: huileS.id, quantite_produite: 3 }]), 'presse mélange vers « Huile de Sésame — Vrac »');
  await refus(presseM([{ lot_id: gs, quantite: 10 }, { lot_id: gn, quantite: 10 }], [{ produit_id: vracM.id, quantite_produite: 15, quantite_tourteau: 6 }]), 'presse mélange : 15 + 6 > 20 graines');
  const pM = await ok(presseM([{ lot_id: gs, quantite: 30 }, { lot_id: gn, quantite: 20 }], [{ produit_id: vracM.id, quantite_produite: 15, quantite_tourteau: 30 }]), 'sésame 30 + nigelle 20 → 15 L de mélange vrac');
  const compoP = (await api('/presse')).data.find(l => l.id === pM.data.id).composition;
  check(compoP.length === 2 && compoP.some(c => c.pourcentage === 60), `composition du pressage : ${compoP.map(c => c.matiere + ' ' + c.pourcentage + ' %').join(', ')}`);
  const filtM2 = await ok(post('/filtration', { date: '2026-10-03', produit_id: prodMelange.id, quantite_produite: 9, quantite_dechet: 1, sources: [{ lot_presse_id: pM.data.id, quantite_utilisee: 10 }] }),
    'mélange vrac → mélange filtré sans cocher (même huile mélange)');
  const condM = (body) => post('/conditionnement', { date: '2026-10-03', ...body });
  await refus(condM({ produit_id: flaconS.id, qty: 10, sources: [{ lot_filtration_id: filtM2.data.id, quantite_utilisee: 0.3 }] }), 'flacon de sésame rempli avec le mélange');
  await ok(condM({ produit_id: flaconM.id, qty: 10, sources: [{ lot_filtration_id: filtM2.data.id, quantite_utilisee: 0.3 }] }), 'mélange filtré → flacon mélange (sans cocher)');
  await refus(condM({ melange: true, produit_id: flaconS.id, qty: 10, sources: [{ lot_presse_id: lotPresseS.id, quantite_utilisee: 0.2 }, { lot_presse_id: lotPresseN.id, quantite_utilisee: 0.1 }] }), 'mélange au conditionnement vers un flacon de sésame');
  await refus(condM({ melange: true, produit_id: flaconM.id, qty: 10, sources: [{ lot_presse_id: lotPresseS.id, quantite_utilisee: 0.3 }] }), 'mélange au conditionnement avec une seule huile');
  await ok(condM({ melange: true, produit_id: flaconM.id, qty: 10, sources: [{ lot_presse_id: lotPresseS.id, quantite_utilisee: 0.2 }, { lot_presse_id: lotPresseN.id, quantite_utilisee: 0.1 }] }), 'sésame vrac + nigelle vrac → 10 flacons mélange');
  const f100 = (await api('/formats').catch(() => null))?.data;
  const format100 = Array.isArray(f100) ? f100.find(f => Number(f.volume) === 100) : null;
  if (format100) {
    await refus(condM({ nouveau_produit: { nom: 'Huile de Sésame — Flacon 100ml' }, qty: 5, sources: [{ lot_filtration_id: filt.data.id, quantite_utilisee: 0.5 }] }), 'nouveau produit fini sans format');
    const nv = await ok(condM({ nouveau_produit: { nom: 'Huile de Sésame — Flacon 100ml' }, format_id: format100.id, qty: 5, sources: [{ lot_filtration_id: filt.data.id, quantite_utilisee: 0.5 }] }), 'nouveau produit fini « Huile de Sésame — Flacon 100ml » créé au conditionnement');
    const cree = (await api('/produits')).data.find(p => p.id === nv.data.produit_id);
    check(cree && cree.format_id === format100.id && cree.produit_source_id === huileS.id, `fiche créée : format 100 ml, source « Huile de Sésame — Vrac » (${cree && cree.nom})`);
    await refus(condM({ nouveau_produit: { nom: 'Huile de Sésame — Flacon 100ml' }, format_id: format100.id, qty: 1, sources: [{ lot_filtration_id: filt.data.id, quantite_utilisee: 0.1 }] }), 'nouveau produit au nom déjà existant');
  } else check(false, 'format 100 ml introuvable via /formats');

  console.log('M3. Recette : nouveau produit fini et changement de produit');
  const etiq = P('Étiquette adhésive'), catSavon = P('Savon Olive').categorie_id, uniteU = P('Savon Olive').unite_id;
  const rec = await ok(post('/recettes', { nouveau_produit: { nom: 'Savon Test Recette — 100g', categorie_id: catSavon, unite_id: uniteU, prix_vente: 7.5 }, ingredients: [{ ingredient_id: etiq.id, quantite_par_unite: 1 }] }), 'recette créée avec un nouveau produit fini');
  const prodRec = (await api('/produits')).data.find(p => p.id === rec.data.produit_id);
  check(prodRec && prodRec.nom === 'Savon Test Recette — 100g' && Number(prodRec.prix_vente) === 7.5, `produit créé avec la recette : ${prodRec && prodRec.nom}`);
  await refus(post('/recettes', { nouveau_produit: { nom: 'Savon Test Recette — 100g', categorie_id: catSavon, unite_id: uniteU }, ingredients: [{ ingredient_id: etiq.id, quantite_par_unite: 1 }] }), 'nouveau produit au nom déjà existant');
  const nbAvant = (await api('/produits')).data.length;
  await refus(post('/recettes', { nouveau_produit: { nom: 'Savon Sans Ingrédient', categorie_id: catSavon, unite_id: uniteU }, ingredients: [] }), 'recette sans ingrédient');
  check((await api('/produits')).data.length === nbAvant, 'recette refusée : aucun produit créé');
  const put = (body) => api(`/recettes/${rec.data.id}`, { method: 'PUT', body });
  await ok(put({ nouveau_produit: { nom: 'Savon Test Recette — 150g', categorie_id: catSavon, unite_id: uniteU }, ingredients: [{ ingredient_id: etiq.id, quantite_par_unite: 1 }] }), 'produit de la recette changé pour un nouveau produit');
  await ok(post('/ordres-production', { recette_id: rec.data.id, date: '2026-10-03', qty_produite: 2 }), 'production avec la recette');
  await refus(put({ produit_id: prodRec.id, ingredients: [{ ingredient_id: etiq.id, quantite_par_unite: 1 }] }), 'changer le produit d\'une recette déjà utilisée');

  console.log('N. Commandes, paiements, remises');
  await refus(post('/commandes', { client_id: client.id, lignes: [{ produit_id: flaconS.id, qty: -5 }] }), 'quantité commandée négative (ferait entrer du stock)');
  await refus(post('/commandes', { client_id: client.id, lignes: [{ produit_id: flaconS.id, qty: 1.5 }] }), 'demi-flacon commandé');
  await refus(post('/commandes', { client_id: client.id, lignes: [{ produit_id: flaconS.id, qty: 1, prix_detail: -10 }] }), 'prix négatif');
  const cmd = await ok(post('/commandes', { client_id: client.id, lignes: [{ produit_id: flaconS.id, qty: 2 }] }), 'commande de 2 flacons');
  const fac = (await post('/factures', { commande_id: cmd.data.id })).data;
  await refus(post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-03', montant: -1 }), 'paiement négatif');
  await refus(post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-03', montant: Number(fac.total_ttc) + 1 }), 'paiement supérieur au reste à payer');
  await ok(post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-03', montant: Number(fac.total_ttc) }), 'paiement du montant exact');
  await refus(post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-03', montant: 0.5 }), 'paiement d\'une facture déjà soldée');
  await refus(post('/remises', { nom: 'Trop', type: 'pourcentage', pourcentage: 150 }), 'remise de 150 %');
  await refus(post('/remises', { nom: 'Lot', type: 'lot', achete: 0, gratuit: 1 }), 'remise « 0 acheté + 1 offert »');

  console.log('O. Réceptions, lots, produits');
  await refus(post('/receptions', { fournisseur_id: fourn.id, date_reception: '2026-10-03', local_id: local.id, lignes: [{ produit_id: graineS.id, quantite: -10 }] }), 'réception négative');
  await refus(post('/receptions', { fournisseur_id: fourn.id, date_reception: '2026-10-03', local_id: local.id, lignes: [{ produit_id: graineS.id, quantite: 10, date_expiration: '2026-01-01' }] }), 'lot déjà périmé à la réception');
  await refus(post('/lots', { produit_id: graineS.id, origine: 'AUTRE', quantite_initiale: 5, date_production: '2026-10-01', date_expiration: '2026-09-01' }), 'expiration avant production');
  await refus(post('/produits', { nom: 'Test prix', categorie_id: graineS.categorie_id, unite_id: graineS.unite_id, type_article: 'PRODUIT_REVENDE', prix_vente: -3 }), 'prix de vente négatif');
  await refus(post('/produits', { nom: 'Test TVA', categorie_id: graineS.categorie_id, unite_id: graineS.unite_id, type_article: 'PRODUIT_REVENDE', tva: 120 }), 'TVA de 120 %');

  check((await api('/controle-stock')).data.ok, 'stock cohérent après tous ces essais (refus : rien consommé)');
})();
