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

  console.log('M. Conditionnement : vrac du produit, contenu ≤ vrac utilisé, quantité entière');
  const flaconS = P('Huile de Sésame — Flacon 30ml'), flaconN = P('Huile de Nigelle — Flacon 30ml');
  const conditionner = (produit, qty, q) => post('/conditionnement', { date: '2026-10-03', produit_id: produit.id, qty, sources: [{ lot_filtration_id: filt.data.id, quantite_utilisee: q }] });
  await refus(conditionner(flaconN, 100, 3), 'flacon de nigelle rempli avec de l\'huile de sésame');
  await refus(conditionner(flaconS, 200, 5), '200 × 30 ml = 6 L avec seulement 5 L de vrac');
  await refus(conditionner(flaconS, 10.5, 1), 'quantité de flacons non entière');
  await refus(conditionner(huileS, 1, 1), 'conditionnement en huile vrac (sans flacon)');
  await ok(conditionner(flaconS, 100, 3), '100 × 30 ml = 3 L avec 3 L de vrac');

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
