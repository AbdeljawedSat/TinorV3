// Ventes, factures et paiements : le stock et l'argent restent cohérents.
// Prérequis : API démarrée sur une base de TEST avec les données de démonstration.
const { api, login, check } = require('./api');

(async () => {
  await login();
  const post = (u, b) => api(u, { method: 'POST', body: b || {} });
  const produits = (await api('/produits')).data, client = (await api('/clients')).data[0];
  const lots = (await api('/lots')).data;
  const stockDe = async (id) => (await api('/lots')).data.filter(l => l.produit_id === id && l.statut === 'LIBERE').reduce((s, l) => s + Number(l.quantite_actuelle), 0);
  const flacon = produits.find(p => p.produit_source_id && lots.some(l => l.produit_id === p.id && l.statut === 'LIBERE' && Number(l.quantite_actuelle) >= 3));
  const commander = (qty, produit = flacon) => post('/commandes', { client_id: client.id, lignes: [{ produit_id: produit.id, qty }] });

  console.log('P. Ligne en attente de conditionnement : pas de facture');
  const cmdA = (await commander(Math.floor(await stockDe(flacon.id)) + 5)).data;
  check(cmdA.statut === 'en_attente', `commande ${cmdA.numero} en attente (format manquant, vrac disponible)`);
  const fA = await post('/factures', { commande_id: cmdA.id });
  check(fA.status === 409, `facture refusée : ${fA.data.error}`);

  console.log('Q. « Payée » suit l\'argent reçu');
  const cmd = (await commander(2)).data;
  let r = await api(`/commandes/${cmd.id}/statut`, { method: 'PUT', body: { statut: 'payee' } });
  check(r.status === 409, `« payée » refusé sans facture : ${r.data.error}`);
  const fac = (await post('/factures', { commande_id: cmd.id })).data;
  r = await api(`/commandes/${cmd.id}/statut`, { method: 'PUT', body: { statut: 'payee' } });
  check(r.status === 409, `« payée » refusé avec une facture non soldée : ${r.data.error}`);
  const moitie = Math.round(Number(fac.total_ttc) / 2 * 1000) / 1000;
  const p1 = (await post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-04', montant: moitie })).data;
  check((await api('/commandes')).data.find(c => c.id === cmd.id).statut !== 'payee', 'paiement partiel : commande pas encore payée');
  const p2 = (await post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-04', montant: Math.round((Number(fac.total_ttc) - moitie) * 1000) / 1000 })).data;
  check((await api('/commandes')).data.find(c => c.id === cmd.id).statut === 'payee', 'facture soldée : commande passée « payée » automatiquement');

  console.log('R. Paiements : annulation tracée');
  r = await post(`/factures/${fac.id}/paiements/${p2.id}/annuler`, {});
  check(r.status === 400, 'annulation de paiement sans motif refusée');
  r = await post(`/factures/${fac.id}/paiements/${p2.id}/annuler`, { motif: 'Erreur de montant' });
  check(r.status === 200 && r.data.annule_motif === 'Erreur de montant', 'paiement annulé avec son motif');
  let det = (await api(`/factures/${fac.id}`)).data;
  check(Math.abs(det.total_paye - moitie) < 0.001 && det.paiements.length === 2, `le paiement annulé reste visible mais ne compte plus (payé ${det.total_paye})`);
  check((await api('/commandes')).data.find(c => c.id === cmd.id).statut === 'livree', 'commande repassée « livrée »');
  r = await post(`/factures/${fac.id}/paiements/${p2.id}/annuler`, { motif: 'encore' });
  check(r.status === 409, 'un paiement ne s\'annule qu\'une fois');

  console.log('S. Une facture émise ne s\'annule pas : avoir');
  r = await post(`/factures/${fac.id}/annuler`);
  check(r.status === 409, `annulation de facture refusée : ${r.data.error}`);
  const ligneCmd = det.lignes_avoirables[0];
  r = await post(`/factures/${fac.id}/avoirs`, { lignes: [{ commande_ligne_id: ligneCmd.commande_ligne_id, qty: 1 }] });
  check(r.status === 400, 'avoir sans motif refusé');
  const s1 = await stockDe(flacon.id);
  const av1 = await post(`/factures/${fac.id}/avoirs`, { motif: 'Flacon abîmé, retourné', lignes: [{ commande_ligne_id: ligneCmd.commande_ligne_id, qty: 1 }] });
  check(av1.status === 201 && /^AV-\d{4}$/.test(av1.data.numero), `avoir partiel ${av1.data.numero} : ${av1.data.total_ttc} DT`);
  check(await stockDe(flacon.id) === s1 + 1, 'flacon retourné remis en stock (+1)');
  det = (await api(`/factures/${fac.id}`)).data;
  check(Math.abs(det.solde - (Number(fac.total_ttc) - moitie - Number(av1.data.total_ttc))) < 0.001, `reste dû = TTC − payé − avoir (${det.solde} DT)`);
  r = await post(`/factures/${fac.id}/avoirs`, { motif: 'trop', lignes: [{ commande_ligne_id: ligneCmd.commande_ligne_id, qty: 2 }] });
  check(r.status === 400, `reprendre plus que facturé refusé : ${r.data.error}`);
  const av2 = await post(`/factures/${fac.id}/avoirs`, { motif: 'Second flacon gardé, geste commercial', remise_en_stock: false, lignes: [{ commande_ligne_id: ligneCmd.commande_ligne_id, qty: 1 }] });
  check(av2.status === 201 && await stockDe(flacon.id) === s1 + 1, 'avoir sans retour de marchandise : stock inchangé');
  det = (await api(`/factures/${fac.id}`)).data;
  check(Math.abs(Number(av1.data.total_ttc) + Number(av2.data.total_ttc) - Number(fac.total_ttc)) < 0.0005, 'les avoirs reprennent exactement le TTC de la facture (au millime)');
  check(Math.abs(det.solde + moitie) < 0.001, `client payé ${moitie} DT puis tout repris : ${det.solde} DT en sa faveur`);
  check((await api('/commandes')).data.find(c => c.id === cmd.id).statut === 'annulee', 'vente entièrement reprise : commande « annulée »');
  r = await post(`/factures/${fac.id}/avoirs`, { motif: 'encore', lignes: [{ commande_ligne_id: ligneCmd.commande_ligne_id, qty: 1 }] });
  check(r.status === 400, 'plus rien à reprendre : avoir refusé');
  r = await post(`/factures/${fac.id}/paiements`, { date_paiement: '2026-10-04', montant: 1 });
  check(r.status === 409, 'facture soldée par avoir : plus d\'encaissement');
  check((await api('/avoirs')).data.some(a => a.numero === av1.data.numero), 'avoir listé dans /avoirs');

  console.log('T. Annulation d\'une commande');
  r = await post(`/commandes/${cmd.id}/annuler`, { motif: 'x' });
  check(r.status === 409, 'commande déjà annulée par avoir : refus');
  const cmdD = (await commander(1)).data;
  const s0 = await stockDe(flacon.id);
  r = await post(`/commandes/${cmdD.id}/annuler`, {});
  check(r.status === 400, 'annulation de commande sans motif refusée');
  r = await post(`/commandes/${cmdD.id}/annuler`, { motif: 'Client renonce' });
  check(r.status === 200 && await stockDe(flacon.id) === s0 + 1, 'commande non facturée annulée : stock réintégré (+1)');
  r = await post('/factures', { commande_id: cmdD.id });
  check(r.status === 409, 'commande annulée : facture refusée');
  r = await api(`/commandes/${cmdD.id}/statut`, { method: 'PUT', body: { statut: 'livree' } });
  check(r.status === 409, 'commande annulée : statut figé');
  const cmdE = (await commander(1)).data; await post('/factures', { commande_id: cmdE.id });
  r = await post(`/commandes/${cmdE.id}/annuler`, { motif: 'test' });
  check(r.status === 409, `commande facturée : ${r.data.error}`);
  r = await post(`/commandes/${cmdA.id}/annuler`, { motif: 'Format indisponible' });
  check(r.status === 200, 'commande en attente de conditionnement annulée');

  console.log('U. Solde client et relevé');
  const releve = (await api(`/clients/${client.id}/releve`)).data;
  const ligneClient = (await api('/clients')).data.find(c => c.id === client.id);
  check(Math.abs(releve.solde - Number(ligneClient.solde)) < 0.001, `solde du relevé = solde de la liste (${releve.solde} DT)`);
  check(releve.operations.some(o => o.libelle.startsWith(`Avoir ${av1.data.numero}`)), 'l\'avoir apparaît au crédit du relevé');
  const fE = (await api('/factures')).data.find(f => f.commande_id === cmdE.id);
  check(releve.operations.some(o => o.libelle === `Facture ${fE.numero}`), 'la facture en cours apparaît dans le relevé');

  check((await api('/controle-stock')).data.ok, 'stock cohérent après toutes ces opérations');
})();
