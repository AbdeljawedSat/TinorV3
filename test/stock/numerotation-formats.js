// Numérotation configurable des opérations : 15 opérations, 3 modes (actuel / proposé / personnalisé),
// règles légales (facture, avoir), aperçu, application réelle sur une commande et un lot de presse.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const put = (cle, body) => api(`/numerotation/${cle}`, { method: 'PUT', body });
  const annee = new Date().getFullYear();

  console.log('BA. Liste et règles');
  const liste = (await api('/numerotation')).data;
  check(liste.length === 15, `15 opérations listées (${liste.length})`);
  check(liste.find(o => o.cle === 'facture').legal && liste.find(o => o.cle === 'avoir').legal, 'facture et avoir sont « légaux »');
  const sansSeq = await put('facture', { mode: 'perso', zones: [{ t: 'txt', v: 'FAC-' }, { t: 'date', fmt: 'AAAA' }] });
  check(sansSeq.status === 400, `facture sans séquence refusée : ${sansSeq.data.error}`);
  const chaqueMois = await put('facture', { mode: 'perso', zones: [{ t: 'txt', v: 'F' }, { t: 'seq', digits: 4, reset: 'mois' }] });
  check(chaqueMois.status === 400, 'facture qui repart à 1 chaque mois refusée');
  const avecLettre = await put('avoir', { mode: 'perso', zones: [{ t: 'seq', digits: 4, reset: 'annee' }, { t: 'let', mode: 'fixe', v: 'A' }] });
  check(avecLettre.status === 400, `avoir avec lettre refusé : ${avecLettre.data.error}`);
  const trop = await put('commande', { mode: 'perso', zones: [{ t: 'txt', v: 'COMMANDE-' }, { t: 'txt', v: 'TRES-LONG-' }, { t: 'seq', digits: 8 }] });
  check(trop.status === 400, `numéro trop long refusé : ${trop.data.error}`);
  const apercu = (await api('/numerotation/apercu', { method: 'POST', body: { cle: 'presse', zones: [{ t: 'txt', v: 'P-' }, { t: 'date', fmt: 'AAMMJJ' }, { t: 'txt', v: '-' }, { t: 'let', mode: 'seq' }], date: '2026-10-20' } })).data;
  check(apercu.numeros[0] === 'P-261020-A' && apercu.numeros[1] === 'P-261020-B', `aperçu : ${apercu.numeros.join(', ')}`);

  console.log('BB. Proposition appliquée à une commande');
  const prop = await put('commande', { mode: 'prop' });
  check(prop.status === 200 && prop.data.mode === 'prop', 'proposition appliquée aux commandes');
  const clients = (await api('/clients')).data;
  const produits = (await api('/produits')).data;
  const stock = produits.find(p => Number(p.stock_total || p.quantite_totale || 0) > 0) || produits[0];
  const cmd = await api('/commandes', { method: 'POST', body: { client_id: clients[0].id, accepter_attente: true, lignes: [{ produit_id: stock.id, qty: 1 }] } });
  check(cmd.status === 201 && new RegExp(`^BC-${annee}-\\d{4}$`).test(cmd.data.numero), `commande numérotée ${cmd.data.numero}`);
  const rev = await put('commande', { mode: 'actuel' });
  const cmd2 = await api('/commandes', { method: 'POST', body: { client_id: clients[0].id, accepter_attente: true, lignes: [{ produit_id: stock.id, qty: 1 }] } });
  check(rev.status === 200 && /^BC-\d{4}$/.test(cmd2.data.numero), `retour au format actuel : ${cmd2.data.numero}`);

  console.log('BC. Date d\'application');
  await put('commande', { mode: 'prop', date_application: `${annee + 1}-01-01` });
  const cmd3 = await api('/commandes', { method: 'POST', body: { client_id: clients[0].id, accepter_attente: true, lignes: [{ produit_id: stock.id, qty: 1 }] } });
  check(/^BC-\d{4}$/.test(cmd3.data.numero), `avant la date d'application, l'ancien format continue : ${cmd3.data.numero}`);

  for (const o of liste) await put(o.cle, { mode: 'actuel' });
  const apres = (await api('/numerotation')).data;
  check(apres.every(o => o.mode === 'actuel'), 'tous les formats remis à « actuel »');
})();
