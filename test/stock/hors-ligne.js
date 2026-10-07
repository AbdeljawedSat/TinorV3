// Mode hors ligne : opérations renvoyées par un téléphone revenu en ligne.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const produits = (await api('/produits')).data;
  const P = (debut) => produits.find(p => p.nom.startsWith(debut));
  const client = (await api('/clients')).data[0];
  const flacon = P('Huile de Sésame — Flacon 30ml');
  const vrac = P('Huile de Sésame — Vrac'); // sans produit source : pas d'attente automatique
  const stockDe = async (p) => (await api('/lots')).data.filter(l => l.produit_id === p.id && l.statut === 'LIBERE').reduce((t, l) => t + Number(l.quantite_actuelle), 0);
  const stock = async () => (await api('/lots')).data.filter(l => l.produit_id === flacon.id).reduce((t, l) => t + Number(l.quantite_actuelle), 0);
  const nbCommandes = async () => (await api('/commandes')).data.length;
  const op = () => 'op-test-' + Math.random().toString(36).slice(2, 12);
  const envoyer = (id, body) => api('/commandes', { method: 'POST', body, headers: { 'X-Operation-Id': id } });

  console.log('V. Une opération renvoyée (coupure réseau) n\'est enregistrée qu\'une fois');
  const avant = await nbCommandes(), stockAvant = await stock();
  const id1 = op();
  const r1 = await envoyer(id1, { client_id: client.id, lignes: [{ produit_id: flacon.id, qty: 2 }] });
  const r2 = await envoyer(id1, { client_id: client.id, lignes: [{ produit_id: flacon.id, qty: 2 }] });
  check(r1.status === 201, `1er envoi enregistré (${r1.data.numero})`);
  check(r2.status === 201 && r2.data.numero === r1.data.numero && r2.headers.get('x-operation-rejouee') === '1', `2e envoi : même réponse rejouée (${r2.data.numero}), rien de recréé`);
  check(await nbCommandes() === avant + 1, 'une seule commande en base');
  check(await stock() === stockAvant - 2, 'stock décrémenté une seule fois (−2)');

  console.log('W. Deux envois simultanés de la même opération');
  const id2 = op();
  const [a, b] = await Promise.all([envoyer(id2, { client_id: client.id, lignes: [{ produit_id: flacon.id, qty: 1 }] }),
                                    envoyer(id2, { client_id: client.id, lignes: [{ produit_id: flacon.id, qty: 1 }] })]);
  const statuts = [a.status, b.status].sort();
  check(statuts[0] === 201 && (statuts[1] === 201 || statuts[1] === 409), `réponses ${statuts.join(' / ')} (l'un enregistre, l'autre rejoue ou attend)`);
  check(await nbCommandes() === avant + 2, 'toujours une seule commande pour cette opération');

  console.log('X. Opération refusée, corrigée puis renvoyée avec le même identifiant');
  const id3 = op();
  const dispo = await stockDe(vrac);
  const refus = await envoyer(id3, { client_id: client.id, lignes: [{ produit_id: vrac.id, qty: dispo + 50 }] });
  check(refus.status === 409, `refus (rien n'est mémorisé) : ${refus.data.error}`);
  const corrigee = await envoyer(id3, { client_id: client.id, lignes: [{ produit_id: vrac.id, qty: 1 }] });
  check(corrigee.status === 201, `après correction (quantité ramenée à 1) : enregistrée (${corrigee.data.numero})`);

  console.log('Y. Rupture acceptée : la commande passe en attente de production');
  const reste = await stockDe(vrac);
  const sansAccord = await envoyer(op(), { client_id: client.id, lignes: [{ produit_id: vrac.id, qty: reste + 10 }] });
  check(sansAccord.status === 409, 'sans accord : refus « stock insuffisant »');
  const enAttente = await envoyer(op(), { client_id: client.id, accepter_attente: true, lignes: [{ produit_id: vrac.id, qty: reste + 10 }] });
  check(enAttente.status === 201 && enAttente.data.statut === 'en_attente', `avec « mettre en attente » : commande ${enAttente.data.numero} en attente`);
  check(await stockDe(vrac) === reste, 'rien prélevé sur le stock');
  const notifs = (await api('/notifications')).data.filter(n => n.commande_id === enAttente.data.id);
  check(notifs.length === 1 && notifs[0].type === 'RUPTURE', `notification de rupture : ${notifs[0] && notifs[0].titre}`);

  console.log('Z. Conflit signalé au bureau, puis résolu');
  const c = await api('/sync/conflits', { method: 'POST', body: { libelle: 'Commande — Boutique <b>Bio</b>', erreur: 'Stock insuffisant', numero_provisoire: 'CMD-HL-TEST-1' } });
  check(c.status === 201, 'conflit enregistré comme notification');
  const n = (await api('/notifications')).data.find(x => x.id === c.data.id);
  check(n && n.type === 'SYNC_CONFLIT' && !/[<>]/.test(n.titre + n.message), `notification lisible sans HTML : « ${n && n.titre} »`);
  await api('/sync/conflits/resolus', { method: 'POST', body: { numero_provisoire: 'CMD-HL-TEST-1' } });
  check((await api('/notifications')).data.find(x => x.id === c.data.id).statut === 'RESOLUE', 'résolue après correction sur le téléphone');
  check((await api('/sync/conflits', { method: 'POST', body: {} })).status === 400, 'conflit sans détail refusé');
  check((await api('/commandes', { method: 'POST', body: {}, headers: { 'X-Operation-Id': 'x' } })).status === 400, 'identifiant d\'opération invalide refusé');

  check((await api('/controle-stock')).data.ok, 'stock cohérent après tous ces essais');
})();
