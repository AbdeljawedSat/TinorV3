// Chaîne de vente : bon de commande → bons de livraison (partiels) → facture en attente → facture.
const { api, login, check } = require('./api');

(async () => {
  await login();
  const produits = (await api('/produits')).data;
  const P = (debut) => produits.find(p => p.nom.startsWith(debut));
  const client = (await api('/clients')).data[0];
  const flacon = P('Huile de Sésame — Flacon 30ml');
  const stockLot = async (lotId) => Number((await api('/lots')).data.find(l => l.id === lotId).quantite_actuelle);
  const post = (url, body) => api(url, { method: 'POST', body });
  const commande = async (qty) => (await post('/commandes', { client_id: client.id, lignes: [{ produit_id: flacon.id, qty }] })).data;
  const detail = async (id) => (await api(`/commandes/${id}`)).data;

  console.log('AA. Bon de commande et livraison partielle');
  const c1 = await commande(100);
  check(/^BC-\d{4}$/.test(c1.numero), `nouvelle commande numérotée ${c1.numero}`);
  const d1 = await detail(c1.id);
  const ligne = d1.lignes[0];
  const lotAvant = await stockLot(ligne.lot_id);
  const bl1 = await post('/livraisons', { commande_id: c1.id, lignes: [{ commande_ligne_id: ligne.id, qty: 80 }] });
  check(bl1.status === 201 && /^BL-\d{4}$/.test(bl1.data.numero), `bon de livraison ${bl1.data.numero} (80 sur 100)`);
  const apres1 = await detail(c1.id);
  check(Number(apres1.lignes[0].qty_livree) === 80 && apres1.statut === 'confirmee', 'commande partiellement livrée (80/100, statut confirmée)');
  check(await stockLot(ligne.lot_id) === lotAvant, 'stock inchangé à la livraison (déjà réservé à la commande)');
  check((await post('/livraisons', { commande_id: c1.id, lignes: [{ commande_ligne_id: ligne.id, qty: 30 }] })).status === 409, 'livrer plus que le reste (30 > 20) refusé');
  const blDetail = (await api(`/livraisons/${bl1.data.id}`)).data;
  check(blDetail.lignes.length === 1 && blDetail.lignes[0].numero_lot && blDetail.commande_numero === c1.numero, `détail du BL : lot ${blDetail.lignes[0].numero_lot}, commande ${blDetail.commande_numero}`);

  console.log('AB. Facture : le reste est livré automatiquement');
  check((await post(`/commandes/${c1.id}/annuler`, { motif: 'test' })).status === 409, 'annuler une commande déjà livrée en partie : refusé (solder ou annuler le BL)');
  const f1 = await post('/factures', { commande_id: c1.id });
  check(f1.status === 201, `facture ${f1.data.numero} émise`);
  const apresF = await detail(c1.id);
  check(apresF.bons_livraison.length === 2 && Number(apresF.lignes[0].qty_livree) === 100 && apresF.statut === 'livree', '2e BL automatique pour les 20 restants, commande livrée');
  check((await post('/livraisons', { commande_id: c1.id })).status === 409, 'plus de livraison après facture');
  check((await post(`/livraisons/${bl1.data.id}/annuler`, { motif: 'x' })).status === 409, 'BL d\'une commande facturée : non annulable');

  console.log('AC. Solder le reliquat');
  const c2 = await commande(10);
  const l2 = (await detail(c2.id)).lignes[0];
  const lot2Avant = await stockLot(l2.lot_id);
  check((await post(`/commandes/${c2.id}/solder`, { motif: 'rien livré' })).status === 409, 'solder sans aucune livraison : refusé (annuler plutôt)');
  await post('/livraisons', { commande_id: c2.id, lignes: [{ commande_ligne_id: l2.id, qty: 6 }] });
  check((await post(`/commandes/${c2.id}/solder`, {})).status === 400, 'solder sans motif refusé');
  const s2 = await post(`/commandes/${c2.id}/solder`, { motif: 'Client ne prend que 6' });
  const d2 = await detail(c2.id);
  check(s2.status === 200 && Number(d2.lignes[0].qty) === 6 && d2.statut === 'livree', `reliquat soldé : ligne ramenée à 6, commande livrée`);
  check(await stockLot(l2.lot_id) === lot2Avant + 4, `les 4 non livrés reviennent en stock (${lot2Avant} → ${lot2Avant + 4})`);
  check(Math.abs(Number(d2.total) - 6 * Number(l2.unit_price)) < 0.01, `total de la commande recalculé (${d2.total})`);
  const f2 = (await post('/factures', { commande_id: c2.id })).data;
  check(Number((await api(`/factures/${f2.id}`)).data.lignes[0].qty) === 6, `facture ${f2.numero} sur les 6 livrés`);

  console.log('AD. Annuler un bon de livraison');
  const c3 = await commande(5);
  const bl3 = (await post('/livraisons', { commande_id: c3.id })).data;
  check((await detail(c3.id)).statut === 'livree', 'livraison totale → commande livrée');
  check((await post(`/livraisons/${bl3.id}/annuler`, {})).status === 400, 'annulation de BL sans motif refusée');
  check((await post(`/livraisons/${bl3.id}/annuler`, { motif: 'Livraison refusée par le client' })).status === 200, 'BL annulé');
  const d3 = await detail(c3.id);
  check(Number(d3.lignes[0].qty_livree) === 0 && d3.statut === 'confirmee', 'quantités de nouveau « à livrer », commande confirmée');
  check((await post(`/commandes/${c3.id}/annuler`, { motif: 'test' })).status === 200, 'commande annulable une fois le BL annulé');

  console.log('AE. Facture en attente (pro forma)');
  const c4 = await commande(10);
  const pf = await post('/proformas', { commande_id: c4.id });
  check(pf.status === 201 && /^PRO-\d{4}$/.test(pf.data.numero) && pf.data.statut === 'en_attente', `facture en attente ${pf.data.numero}`);
  check(Math.abs(Number(pf.data.total_ttc) - Number(c4.total)) < 1.01, `total pro forma ${pf.data.total_ttc} ≈ commande ${c4.total} (+ timbre éventuel)`);
  check((await post('/proformas', { commande_id: c4.id })).status === 409, 'une seule facture en attente par commande');
  const pfd = (await api(`/proformas/${pf.data.id}`)).data;
  const mod = await api(`/proformas/${pf.data.id}`, { method: 'PUT', body: { notes: 'Prix négocié', lignes: [{ id: pfd.lignes[0].id, unit_price: 4 }] } });
  check(mod.status === 200 && Number(mod.data.lignes[0].total) === 40, `prix modifié : 10 × 4,000 = ${mod.data.lignes[0].total}`);
  check((await api(`/proformas/${pf.data.id}`, { method: 'PUT', body: { lignes: [{ id: pfd.lignes[0].id, unit_price: -1 }] } })).status === 400, 'prix négatif refusé');
  const val = await post(`/proformas/${pf.data.id}/valider`, {});
  check(val.status === 201 && /^FAC-/.test(val.data.numero), `validée → facture ${val.data.numero}`);
  const fac4 = (await api(`/factures/${val.data.id}`)).data;
  check(Number(fac4.lignes[0].unit_price) === 4, 'la facture reprend le prix négocié');
  check((await api(`/proformas/${pf.data.id}`)).data.statut === 'validee', 'pro forma marquée validée, liée à la facture');
  check((await api(`/proformas/${pf.data.id}`, { method: 'PUT', body: { notes: 'x' } })).status === 409, 'plus modifiable après validation');
  check((await detail(c4.id)).statut === 'livree', 'commande livrée (BL automatique)');

  console.log('AF. Facture directe alors qu\'une facture en attente existe');
  const c5 = await commande(2);
  const pf5 = (await post('/proformas', { commande_id: c5.id })).data;
  const f5 = (await post('/factures', { commande_id: c5.id })).data;
  check((await api(`/proformas/${pf5.id}`)).data.facture_numero === f5.numero, `pro forma ${pf5.numero} rattachée à ${f5.numero}`);
  const c6 = await commande(1);
  const pf6 = (await post('/proformas', { commande_id: c6.id })).data;
  await post(`/proformas/${pf6.id}/annuler`, {});
  check((await post('/proformas', { commande_id: c6.id })).status === 201, 'après annulation, une nouvelle facture en attente est possible');

  check((await api('/controle-stock')).data.ok, 'stock cohérent après toute la chaîne');
})();
