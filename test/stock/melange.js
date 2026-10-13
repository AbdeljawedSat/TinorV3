// Étape « Mélange » (lot fini en vrac) : n° yy x1x1 x2x2 avec yy continu, flacons au n°
// du mélange + format (110409-10ML), conditionnements successifs ajoutés au même lot.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const reglages = (await api('/settings')).data;
  const regler = (style) => api('/settings', { method: 'PUT', body: { ...reglages, lot_format_style: style } });
  const post = (url, body) => api(url, { method: 'POST', body });
  try {
    await regler('jardins_jerba');
    const produits = (await api('/produits')).data;
    const P = (debut) => produits.find(p => p.nom.startsWith(debut));
    const fourn = (await api('/fournisseurs')).data[0], local = (await api('/locaux')).data[0];
    const graine = P('Graines de Sésame'), vrac = P('Huile de Sésame — Vrac'), filtree = P('Huile de Sésame — Filtrée');
    const f10 = P('Huile de Sésame — Flacon 10ml'), f30 = P('Huile de Sésame — Flacon 30ml');
    const lotMP = `M${String(Date.now()).slice(-6)}`;
    const rec = await post('/receptions', { fournisseur_id: fourn.id, date_reception: '2025-09-01', local_id: local.id, lignes: [{ produit_id: graine.id, quantite: 100, lot_fournisseur: lotMP }] });
    const mp = rec.data.lignes[0];
    const presser = (date) => post('/presse', { date, sources: [{ lot_id: mp.lot_id, quantite: 40 }], sorties: [{ produit_id: vrac.id, quantite_produite: 3, quantite_tourteau: 30 }] });
    const pA = (await presser('2025-09-02')).data.lots_presse[0], pB = (await presser('2025-09-03')).data.lots_presse[0];
    const filtrer = (lp, date) => post('/filtration', { date, produit_id: filtree.id, quantite_produite: 2.5, quantite_dechet: 0.5, sources: [{ lot_presse_id: lp.id, quantite_utilisee: 3 }] });
    const fA = (await filtrer(pA, '2025-10-01')).data, fB = (await filtrer(pB, '2025-10-02')).data;
    const xA = fA.numero_lot.split('-')[0], xB = fB.numero_lot.split('-')[0];

    console.log('AV. Mélange : lot fini yy x1x1 x2x2');
    const prochain = (await api('/melanges/prochain')).data.yy;
    const m1 = await post('/melanges', { date: '2025-12-20', sources: [{ lot_id: fA.lot_id, quantite: 1 }, { lot_id: fB.lot_id, quantite: 0.8 }] });
    const yy = String(prochain).padStart(2, '0');
    check(m1.status === 201 && m1.data.numero_lot === `${yy}${xA}${xB}`, `mélange ${xA} + ${xB} → ${m1.data.numero_lot} (${m1.data.quantite} L)`);
    const lots = () => api('/lots').then(r => r.data);
    let L = await lots();
    check(Number(L.find(l => l.id === fA.lot_id).quantite_actuelle) === 1.5 && Number(L.find(l => l.id === fB.lot_id).quantite_actuelle) === 1.7, 'huiles filtrées déduites (2,5 − 1 ; 2,5 − 0,8)');
    const m2 = await post('/melanges', { date: '2026-01-05', sources: [{ lot_id: fA.lot_id, quantite: 0.5 }] });
    check(m2.data.numero_lot === `${String(prochain + 1).padStart(2, '0')}${xA}${xA}`, `nouvelle année, une seule huile → yy continue, x1x1 répété : ${m2.data.numero_lot}`);
    const trop = await post('/melanges', { date: '2026-01-06', sources: [{ lot_id: fB.lot_id, quantite: 99 }] });
    check(trop.status === 409, `stock insuffisant refusé : ${trop.data.error}`);

    console.log('AW. Flacons : n° du mélange + format, même lot à chaque conditionnement');
    const cond = (produit, qty, q, date) => post('/conditionnement', { date, produit_id: produit.id, qty, sources: [{ lot_id: m1.data.lot_id, quantite_utilisee: q }] });
    const c1 = await cond(f10, 20, 0.2, '2025-12-21');
    check(c1.data.numero_lot === `${m1.data.numero_lot}-10ML`, `flacons 10 ml → ${c1.data.numero_lot}`);
    const c2 = await cond(f30, 10, 0.3, '2025-12-22');
    check(c2.data.numero_lot === `${m1.data.numero_lot}-30ML`, `flacons 30 ml → ${c2.data.numero_lot}`);
    const c3 = await cond(f10, 15, 0.15, '2026-02-01');
    L = await lots();
    const l10 = L.filter(l => l.numero_lot === `${m1.data.numero_lot}-10ML`);
    check(c3.data.numero_lot === c1.data.numero_lot && l10.length === 1 && Number(l10[0].quantite_actuelle) === 35, `2e conditionnement 10 ml ajouté au même lot : ${l10[0] && Number(l10[0].quantite_actuelle)} flacons`);
    check(Math.abs(Number(L.find(l => l.id === m1.data.lot_id).quantite_actuelle) - 1.15) < 1e-9, 'mélange : 1,8 − 0,2 − 0,3 − 0,15 = 1,15 L restants');
    const liste = (await api('/melanges')).data.find(m => m.numero_lot === m1.data.numero_lot);
    check(liste && liste.huiles.length === 2 && liste.flacons.length === 2, `écran Mélange : 2 huiles, 2 formats (${liste?.flacons.map(f => f.numero_lot).join(', ')})`);
    const t = (await api(`/lots/${encodeURIComponent(c1.data.numero_lot)}/tracabilite`)).data;
    check([m1.data.numero_lot, fA.numero_lot, fB.numero_lot, lotMP].every(n => t.ascendants.some(a => a.numero_lot === n)), 'traçabilité : flacon → mélange → filtrés → presse → graines');
    check((await api('/controle-stock')).data.nb_lots_en_ecart === 0, 'contrôle de cohérence du stock : 0 écart');
  } finally {
    await regler(reglages.lot_format_style || 'code_origine_seq');
  }
})().catch((e) => { console.error(e); process.exit(1); });
