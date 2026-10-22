// Contrôle qualité des lots (seuils, libération / blocage, dérogation) et rappel de lot.
// Prérequis : API démarrée sur une base de TEST avec les données de démonstration.
const { api, login, check } = require('./api');

(async () => {
  await login();
  const post = (u, b) => api(u, { method: 'POST', body: b || {} });
  const put = (u, b) => api(u, { method: 'PUT', body: b || {} });
  const lots = (await api('/lots')).data;
  const lotLibre = lots.find(l => l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  console.log('QA. Paramètres et seuils');
  const params = (await api('/qualite/parametres?profil=OLIVE')).data;
  check(params.some(p => p.code === 'ACIDITE' && Number(p.max_valeur) === 0.8) && params.some(p => p.code === 'PEROXYDE' && Number(p.max_valeur) === 20), 'seuils par défaut huile d\'olive (acidité 0,8 ; peroxyde 20)');
  check((await api('/qualite/parametres?profil=GRAINES')).data.some(p => p.code === 'INDICE_ACIDE'), 'profil graines présent');

  console.log('QB. Analyse conforme → lot libéré');
  await post(`/lots/${lotLibre.id}/statut`, { statut: 'QUARANTAINE', motif: 'test qualité' });
  let r = await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', laboratoire: 'Labo test', reference_rapport: 'R-1',
    resultats: [{ code: 'ACIDITE', valeur: 0.4 }, { code: 'PEROXYDE', valeur: 12 }] });
  check(r.status === 201 && r.data.conforme === 1 && r.data.decision === 'LIBERE' && r.data.statut_lot === 'LIBERE', `analyse conforme : lot libéré (${r.status})`);
  check(r.data.resultats.length === 2 && r.data.resultats.every(x => x.conforme === 1), 'résultats détaillés enregistrés');

  console.log('QC. Analyse hors seuils → lot bloqué');
  r = await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [{ code: 'ACIDITE', valeur: 1.3 }, { code: 'PEROXYDE', valeur: 12 }] });
  check(r.status === 201 && r.data.conforme === 0 && r.data.statut_lot === 'BLOQUE', 'acidité 1,3 > 0,8 : lot bloqué');
  const hist = (await api(`/lots/${lotLibre.numero_lot}/historique-statuts`)).data;
  check(hist.some(h => h.statut === 'BLOQUE' && /Acidité libre 1.3 > 0.8/.test(h.motif)), `motif tracé dans l'historique : ${hist.find(h => h.statut === 'BLOQUE')?.motif}`);
  const vente = await post('/commandes', { client_id: (await api('/clients')).data[0].id, lignes: [{ produit_id: lotLibre.produit_id, qty: 1 }] });
  check(vente.status !== 500, 'un lot bloqué n\'est plus proposé à la vente (pas d\'erreur serveur)');

  console.log('QD. Dérogation et validations');
  r = await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [{ code: 'ACIDITE', valeur: 1.3 }], decision: 'LIBERE' });
  check(r.status === 400, `libération hors seuils sans motif refusée : ${r.data.error}`);
  r = await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [{ code: 'ACIDITE', valeur: 1.3 }], decision: 'LIBERE', derogation_motif: 'Mélange prévu avec lot conforme' });
  check(r.status === 201 && r.data.statut_lot === 'LIBERE' && r.data.derogation_motif, 'dérogation du gérant avec motif : lot libéré');
  check((await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [{ code: 'ACIDITE', valeur: 'abc' }] })).status === 400, 'valeur non numérique refusée');
  check((await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [{ code: 'INCONNU', valeur: 1 }] })).status === 400, 'paramètre inconnu refusé');
  check((await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [] })).status === 400, 'analyse vide refusée');
  const liste = (await api(`/qualite/controles?lot=${encodeURIComponent(lotLibre.numero_lot)}`)).data;
  check(liste.length >= 3, `analyses consignées sur le lot : ${liste.length}`);

  console.log('QE. Seuils modifiables par le gérant');
  const acidite = params.find(p => p.code === 'ACIDITE');
  r = await put(`/qualite/parametres/${acidite.id}`, { max_valeur: 0.5 });
  check(r.status === 200 && Number(r.data.max_valeur) === 0.5, 'seuil d\'acidité abaissé à 0,5');
  r = await post('/qualite/controles', { lot_id: lotLibre.id, date_controle: aujourdhui, profil: 'OLIVE', resultats: [{ code: 'ACIDITE', valeur: 0.6 }] });
  check(r.data.conforme === 0, '0,6 devient hors seuil');
  await put(`/qualite/parametres/${acidite.id}`, { max_valeur: 0.8 });
  check((await put(`/qualite/parametres/${acidite.id}`, { min_valeur: 2, max_valeur: 1 })).status === 400, 'minimum supérieur au maximum refusé');

  console.log('QF. Quarantaine à la création');
  check((await put('/qualite/quarantaine', { etapes: ['FILTRATION'] })).status === 200, 'quarantaine activée pour la filtration');
  check((await api('/qualite/quarantaine')).data.etapes.join() === 'FILTRATION', 'réglage relu');
  await put('/qualite/quarantaine', { etapes: [] });

  console.log('QG. Rappel de lot');
  const sorti = (await api('/commandes')).data.find(c => ['livree', 'payee'].includes(c.statut));
  if (sorti) {
    const det = (await api(`/commandes/${sorti.id}`)).data;
    const ligne = (det.lignes || []).find(l => l.lot_id);
    const lot = ligne && lots.find(l => l.id === ligne.lot_id);
    if (lot) {
      const rap = (await api(`/qualite/rappel/${encodeURIComponent(lot.numero_lot)}`)).data;
      check(rap.lot.numero_lot === lot.numero_lot && Array.isArray(rap.clients) && rap.clients.length >= 1, `rappel du lot ${lot.numero_lot} : ${rap.clients.length} client(s), ${rap.total_livre} livré(s)`);
      check(rap.clients.some(c => c.nom === sorti.client_nom), 'le client de la commande figure dans le rappel');
    } else console.log('  (aucune ligne avec lot : étape ignorée)');
  }
  check((await api('/qualite/rappel/INEXISTANT')).status === 404, 'rappel d\'un lot inconnu : 404');
  const ascendant = lots.find(l => l.origine === 'PRESSE');
  if (ascendant) {
    const rap = (await api(`/qualite/rappel/${encodeURIComponent(ascendant.numero_lot)}`)).data;
    check(rap.lots_concernes.length >= 1, `lot de presse ${ascendant.numero_lot} : ${rap.lots_concernes.length} lot(s) concerné(s)`);
  }
})();
