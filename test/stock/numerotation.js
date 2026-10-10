// Numérotation « Jardins de Jerba » : graines = lot fournisseur, presse XX-lotMP-AAAAMMJJH,
// filtré XX-lotMP-AAAAMMJJ, produit fini yy x1x1 x2x2 (yy annuel, x2x2 = x1x1 sans mélange).
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const reglages = (await api('/settings')).data;
  const regler = (style) => api('/settings', { method: 'PUT', body: { ...reglages, lot_format_style: style } });
  try {
    check((await regler('jardins_jerba')).status === 200, 'réglage « Jardins de Jerba » enregistré');
    const produits = (await api('/produits')).data;
    const P = (debut) => produits.find(p => p.nom.startsWith(debut));
    const fourn = (await api('/fournisseurs')).data[0], local = (await api('/locaux')).data[0];
    const post = (url, body) => api(url, { method: 'POST', body });
    const graine = P('Graines de Sésame'), vrac = P('Huile de Sésame — Vrac'), filtree = P('Huile de Sésame — Filtrée'), flacon = P('Huile de Sésame — Flacon 30ml');

    console.log('AK. Graines : le n° de lot est celui du fournisseur');
    const rec = await post('/receptions', { fournisseur_id: fourn.id, date_reception: '2023-01-05', local_id: local.id,
      lignes: [{ produit_id: graine.id, quantite: 100, lot_fournisseur: 'GJ01/2023' }, { produit_id: graine.id, quantite: 80, lot_fournisseur: '212' }] });
    const [mpA, mpB] = rec.data.lignes;
    check(mpA.numero_lot === 'GJ01/2023' && mpB.numero_lot === '212', `lots de graines : ${mpA.numero_lot}, ${mpB.numero_lot}`);
    const rec2 = await post('/receptions', { fournisseur_id: fourn.id, date_reception: '2023-01-06', local_id: local.id, lignes: [{ produit_id: graine.id, quantite: 5, lot_fournisseur: '212' }] });
    check(rec2.data.lignes[0].numero_lot === '212-2', `même lot fournisseur reçu deux fois → ${rec2.data.lignes[0].numero_lot}`);

    console.log('AL. Presse : XX-lotMP-AAAAMMJJH, XX continue toujours');
    const presser = (date, sources) => post('/presse', { date, sources, sorties: [{ produit_id: vrac.id, quantite_produite: 20, quantite_tourteau: 30 }] });
    const p1 = await presser('2023-02-25', [{ lot_id: mpA.lot_id, quantite: 60 }]);
    const n1 = p1.data.lots_presse[0].numero_lot;
    const xx = Number(n1.split('-')[0]);
    check(/^\d{2,}-GJ01\/2023-20230225H$/.test(n1), `pressage → ${n1}`);
    const p2 = await presser('2023-03-10', [{ lot_id: mpB.lot_id, quantite: 50 }, { lot_id: mpA.lot_id, quantite: 10 }]);
    const n2 = p2.data.lots_presse[0].numero_lot;
    check(n2 === `${String(xx + 1).padStart(2, '0')}-212-20230310H`, `2 lots de graines → lot principal seulement (212 : 50 kg) : ${n2}`);

    console.log('AM. Filtration : même XX et lot MP, date de filtration, sans H');
    const filtrer = (lp, date) => post('/filtration', { date, produit_id: filtree.id, quantite_produite: 5, quantite_dechet: 1, sources: [{ lot_presse_id: lp.id, quantite_utilisee: 6 }] });
    const f1 = await filtrer(p1.data.lots_presse[0], '2024-12-30');
    const f2 = await filtrer(p2.data.lots_presse[0], '2024-12-30');
    check(f1.data.numero_lot === n1.replace('-20230225H', '-20241230'), `filtré → ${f1.data.numero_lot}`);
    const f1b = await filtrer(p1.data.lots_presse[0], '2024-12-30');
    check(f1b.data.numero_lot === `${f1.data.numero_lot}-2`, `même lot filtré deux fois le même jour → ${f1b.data.numero_lot}`);

    console.log('AN. Produit fini : yy x1x1 x2x2');
    const conditionner = (date, sources) => post('/conditionnement', { date, produit_id: flacon.id, qty: 50, sources });
    const c1 = await conditionner('2025-01-09', [{ lot_filtration_id: f1.data.id, quantite_utilisee: 1 }, { lot_filtration_id: f2.data.id, quantite_utilisee: 1 }]);
    const x1 = String(xx).padStart(2, '0'), x2 = String(xx + 1).padStart(2, '0');
    const yy1 = c1.data.numero_lot.slice(0, 2);
    check(c1.data.numero_lot === `${yy1}${x1}${x2}`, `mélange des huiles ${x1} et ${x2} → ${c1.data.numero_lot}`);
    const c2 = await conditionner('2025-01-10', [{ lot_filtration_id: f2.data.id, quantite_utilisee: 2 }]);
    check(c2.data.numero_lot === `${String(Number(yy1) + 1).padStart(2, '0')}${x2}${x2}`, `une seule huile → x1x1 répété : ${c2.data.numero_lot}`);
    const c3 = await conditionner('2026-01-03', [{ lot_filtration_id: f1b.data.id, quantite_utilisee: 2 }]);
    check(c3.data.numero_lot.startsWith('01'), `nouvelle année → yy repart à 01 : ${c3.data.numero_lot}`);

    console.log('AO. Traçabilité du flacon jusqu\'aux deux lots de graines');
    const t = (await api(`/lots/${encodeURIComponent(c1.data.numero_lot)}/tracabilite`)).data;
    const amont = t.ascendants.map(a => a.numero_lot);
    check(['GJ01/2023', '212'].every(n => amont.includes(n)) && amont.includes(f1.data.numero_lot) && amont.includes(n2), `amont : ${amont.join(', ')}`);
  } finally {
    await regler(reglages.lot_format_style || 'code_origine_seq');
  }
})();
