// Test de bout en bout (API démarrée). Usage : npm run test:stock
const { api, login, check } = require('./api');
(async () => {
  await login();
  const local = (await api('/locaux')).data[0];
  const inv = await api('/inventaires', { method: 'POST', body: { local_id: local.id } });
  check(inv.status === 201, `ouverture ${inv.data.numero} (${inv.data.lignes?.length} lignes) sur « ${local.nom} »`);
  const dbl = await api('/inventaires', { method: 'POST', body: { local_id: local.id } });
  check(dbl.status === 409, 'second inventaire en cours refusé');
  const L = inv.data.lignes;
  const plus = L.find(l => Number(l.quantite_theorique) >= 10), moins = L.find(l => l !== plus && Number(l.quantite_theorique) >= 10), zero = L.find(l => l !== plus && l !== moins);
  const lotsAvant = (await api('/lots')).data;
  const qAvant = id => Number(lotsAvant.find(x => x.id === id).quantite_actuelle);
  const maj = await api(`/inventaires/${inv.data.id}/lignes`, { method: 'PUT', body: { lignes: [
    { id: plus.id, quantite_physique: Number(plus.quantite_theorique) + 3 },
    { id: moins.id, quantite_physique: Number(moins.quantite_theorique) - 4 },
    { id: zero.id, quantite_physique: 0 } ] } });
  check(maj.data.lignes.filter(l => Number(l.ecart) !== 0).length === 3, 'écarts calculés : ' + maj.data.lignes.filter(l => Number(l.ecart) !== 0).map(l => `${l.numero_lot} ${l.ecart > 0 ? '+' : ''}${Number(l.ecart)}`).join(', '));
  check((await api(`/inventaires/${inv.data.id}/lignes`, { method: 'PUT', body: { lignes: [{ id: plus.id, quantite_physique: -1 }] } })).status === 400, 'quantité négative refusée');
  const clo = await api(`/inventaires/${inv.data.id}/cloturer`, { method: 'POST', body: {} });
  check(clo.status === 200 && clo.data.statut === 'cloture', 'clôture OK');
  const lots = (await api('/lots')).data; const q = id => lots.find(x => x.id === id);
  check(Number(q(plus.lot_id).quantite_actuelle) === qAvant(plus.lot_id) + 3, `${plus.numero_lot} : ${qAvant(plus.lot_id)} → ${q(plus.lot_id).quantite_actuelle}`);
  check(Number(q(moins.lot_id).quantite_actuelle) === qAvant(moins.lot_id) - 4, `${moins.numero_lot} : ${qAvant(moins.lot_id)} → ${q(moins.lot_id).quantite_actuelle}`);
  check(Number(q(zero.lot_id).quantite_actuelle) === 0 && q(zero.lot_id).statut === 'EPUISE', `${zero.numero_lot} : → 0, statut ${q(zero.lot_id).statut}`);
  const mvts = (await api('/stock-mouvements')).data.filter(m => m.type_mouvement === 'INVENTAIRE');
  check(mvts.length >= 3, 'mouvements INVENTAIRE : ' + mvts.slice(0, 3).map(m => `${m.sens} ${Number(m.quantite)}`).join(', '));
  check(clo.data.lignes.filter(l => l.mouvement_ajustement_id).length === 3, 'lignes reliées à leur mouvement');
  check((await api(`/inventaires/${inv.data.id}/cloturer`, { method: 'POST' })).status === 409, 'double clôture refusée');
  check((await api(`/inventaires/${inv.data.id}`, { method: 'DELETE' })).status === 409, 'suppression d\'un inventaire clôturé refusée');
  const liste = (await api('/inventaires')).data;
  check(liste[0].nb_ecarts == 3, `liste : ${liste[0].numero} ${liste[0].statut}, ${liste[0].nb_lignes} lignes, ${liste[0].nb_ecarts} écarts`);
  const inv2 = (await api('/inventaires', { method: 'POST', body: { local_id: local.id } })).data;
  check((await api(`/inventaires/${inv2.id}`, { method: 'DELETE' })).status === 204, 'abandon d\'un inventaire en cours');
})();
