// Test de bout en bout (API démarrée). Usage : npm run test:stock
const { api, login, check } = require('./api');
(async () => {
  await login();
  const produits = (await api('/produits')).data;
  const clients = (await api('/clients')).data;
  // produit vendable dédié au test
  const cat = (await api('/categories')).data[0]; const unite = (await api('/unites')).data[0];
  const p = (await api('/produits', { method: 'POST', body: { nom: 'Test Péremption', categorie_id: cat.id, unite_id: unite.id, type_article: 'PRODUIT_FABRIQUE', vendable: true, prix_vente: 10, prix_detail: 10 } })).data;
  check(p.id, 'produit de test créé (' + (p.code || p.id) + ')');
  const d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const perime = (await api('/lots', { method: 'POST', body: { produit_id: p.id, origine: 'AUTRE', quantite_initiale: 100, date_expiration: d(-5) } })).data;
  const loin = (await api('/lots', { method: 'POST', body: { produit_id: p.id, origine: 'AUTRE', quantite_initiale: 50, date_expiration: d(200) } })).data;
  const proche = (await api('/lots', { method: 'POST', body: { produit_id: p.id, origine: 'AUTRE', quantite_initiale: 50, date_expiration: d(10) } })).data;
  console.log('  lots :', perime.numero_lot, '(périmé)', loin.numero_lot, '(+200 j)', proche.numero_lot, '(+10 j)');

  const al = (await api('/alertes/peremption?jours=30')).data;
  check(al.perimes.some(l => l.id === perime.id), 'alerte : lot périmé listé');
  check(al.bientot.some(l => l.id === proche.id) && !al.bientot.some(l => l.id === loin.id), 'alerte : seul le lot à +10 j est "bientôt"');

  const c1 = await api('/commandes', { method: 'POST', body: { client_id: clients[0].id, lignes: [{ produit_id: p.id, qty: 5 }] } });
  const l1 = c1.data.lignes ? c1.data.lignes[0] : null;
  const lotUtilise = async () => (await api('/lots?produit_id=' + p.id)).data;
  let lots = await lotUtilise();
  const q = id => Number(lots.find(l => l.id === id).quantite_actuelle);
  check(c1.status < 300, 'commande de 5 acceptée (HTTP ' + c1.status + ')');
  check(q(perime.id) === 100, 'lot périmé non prélevé (reste ' + q(perime.id) + ')');
  check(q(proche.id) === 45, 'FEFO : lot le plus proche de l\'expiration prélevé (reste ' + q(proche.id) + ')');
  check(q(loin.id) === 50, 'lot lointain intact');

  const c2 = await api('/commandes', { method: 'POST', body: { client_id: clients[0].id, lignes: [{ produit_id: p.id, qty: 80 }] } });
  check(c2.status === 409, 'commande de 80 refusée : seul le périmé couvrirait (HTTP ' + c2.status + ')');
  if (c2.status === 409) console.log('   ', c2.data.error.slice(0, 110));

  const ex = (await api('/alertes/peremption/expirer', { method: 'POST', body: {} })).data;
  check(ex.lots.includes(perime.numero_lot), 'passage EXPIRE : ' + ex.expires + ' lot(s)');
  const hist = (await api('/lots/' + encodeURIComponent(perime.numero_lot) + '/historique-statuts')).data;
  check(hist.at(-1).statut === 'EXPIRE', 'historique : ' + hist.map(h => h.statut).join(' → '));
  const al2 = (await api('/alertes/peremption')).data;
  check(!al2.perimes.some(l => l.id === perime.id), 'plus d\'alerte pour ce lot');
})();
