// Opérations simultanées : le stock ne devient jamais négatif et les numéros ne sont jamais en double.
// Prérequis : API démarrée sur une base de TEST avec les données de démonstration.
const { api, login, check } = require('./api');

(async () => {
  await login();
  const post = (u, b) => api(u, { method: 'POST', body: b || {} });
  const produits = (await api('/produits')).data, client = (await api('/clients')).data[0];
  const stockDe = async (id) => (await api('/lots')).data.filter(l => l.produit_id === id && l.statut === 'LIBERE').reduce((s, l) => s + Number(l.quantite_actuelle), 0);
  const lots = (await api('/lots')).data;
  const flacon = produits.find(p => p.produit_source_id && lots.some(l => l.produit_id === p.id && l.statut === 'LIBERE' && Number(l.quantite_actuelle) >= 3));

  console.log('CA. 12 commandes simultanées sur un stock limité');
  const avant = await stockDe(flacon.id);
  const reponses = await Promise.all(Array.from({ length: 12 }, () => post('/commandes', { client_id: client.id, lignes: [{ produit_id: flacon.id, qty: Math.max(1, Math.ceil(avant / 4)) }] })));
  const ok = reponses.filter(r => r.status === 201);
  const apres = await stockDe(flacon.id);
  const lotsApres = (await api('/lots')).data;
  check(lotsApres.every(l => Number(l.quantite_actuelle) >= 0), 'aucun lot en quantité négative');
  check(apres >= 0 && apres <= avant, `stock avant ${avant}, après ${apres} (${ok.length} commandes créées sur 12, dont ${ok.filter(r => r.data.statut === 'en_attente').length} en attente)`);
  const numeros = ok.map(r => r.data.numero);
  check(new Set(numeros).size === numeros.length, `numéros de commande tous différents (${numeros.length})`);

  console.log('CB. Mouvements : aucun doublon de numéro');
  const mvts = (await api('/stock-mouvements')).data.map(m => m.numero).filter(Boolean);
  check(new Set(mvts).size === mvts.length, `${mvts.length} mouvements, numéros uniques`);

  console.log('CC. Deux factures simultanées pour la même commande');
  const cmd = (await post('/commandes', { client_id: client.id, lignes: [{ produit_id: flacon.id, qty: 1 }] })).data;
  if (cmd.statut === 'en_attente') { console.log('  (commande en attente : étape ignorée)'); return; }
  const f = await Promise.all([post('/factures', { commande_id: cmd.id }), post('/factures', { commande_id: cmd.id }), post('/factures', { commande_id: cmd.id })]);
  check(f.filter(r => r.status === 201).length === 1, `une seule facture créée (${f.map(r => r.status).join(', ')})`);
  const fac = f.find(r => r.status === 201).data;

  console.log('CD. Paiements simultanés : jamais plus que le total');
  const moitie = Math.round(Number(fac.total_ttc) * 0.6 * 1000) / 1000;
  const p = await Promise.all([1, 2, 3].map(() => post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-04', montant: moitie })));
  check(p.filter(r => r.status === 201).length === 1, `un seul paiement de 60 % accepté (${p.map(r => r.status).join(', ')})`);
  const det = (await api(`/factures/${fac.id}`)).data;
  check(Number(det.total_paye) <= Number(fac.total_ttc) + 0.001, `total payé ${det.total_paye} ≤ ${fac.total_ttc}`);
})();
