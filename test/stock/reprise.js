// Reprise du stock existant : modèle, contrôle, import tout-ou-rien, n° de lot gardés,
// compteurs Jardins de Jerba recalés, annulation.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const ExcelJS = require('exceljs');
const { api, login, check } = require('./api');
const API = process.env.API_URL || 'http://127.0.0.1:3001/api';

(async () => {
  await login();
  const T = (await api('/auth/login', { method: 'POST', body: { username: 'admin', password: 'changeme' } })).data.token;
  const reglages = (await api('/settings')).data;
  try {
    console.log('AP. Modèle Excel');
    const m = await fetch(`${API}/reprises/modele`, { headers: { Authorization: `Bearer ${T}` } });
    const wbM = new ExcelJS.Workbook(); await wbM.xlsx.load(Buffer.from(await m.arrayBuffer()));
    check(m.status === 200 && wbM.worksheets.map(w => w.name).join('|') === 'Stock à reprendre|Produits|Locaux', `modèle : ${wbM.worksheets.map(w => w.name).join(', ')}`);

    console.log('AQ. Fichier avec erreurs → rien n\'est importé');
    const produits = (await api('/produits')).data;
    const P = (debut) => produits.find(p => p.nom.startsWith(debut));
    const local = (await api('/locaux')).data[0];
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Stock');
    ws.addRow(['N° lot', 'Produit (code ou nom)', 'Quantité', 'Étape', 'Date production', 'Date expiration', 'Local', 'Bio', 'Remarque']);
    ws.addRow(['GJ07/2024', P('Graines de Sésame').nom, 420, '', '05/01/2024', '', local.nom, 'oui', '']);
    ws.addRow(['14-GJ07/2024-20240301H', P('Huile de Sésame — Vrac').nom, '36,5', '', '01/03/2024', '06/2026', '', 'non', '']);
    ws.addRow(['14-GJ07/2024-20241230', P('Huile de Sésame — Filtrée').code, 12, 'FILTRATION', new Date(Date.UTC(2024, 11, 30)), '', '', '', '']);
    ws.addRow(['120714', P('Huile de Sésame — Flacon 30ml').nom, 240, '', '09/01/2026', '01/2027', '', 'oui', '']);
    ws.addRow(['GJ07/2024', P('Graines de Sésame').nom, 5, '', '', '', '', '', '']);            // doublon dans le fichier
    ws.addRow(['SAV-OL-12', 'Savon inconnu', 80, '', '', '', '', '', '']);                       // produit inconnu
    ws.addRow(['03-F-002', P('Huile de Sésame — Filtrée').nom, 1, '', '', '', '', '', '']);       // déjà dans TinOR
    const b64 = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
    const an = await api('/reprises/analyser', { method: 'POST', body: { nom_fichier: 'stock.xlsx', fichier_base64: b64, local_id_defaut: local.id } });
    check(an.status === 200 && an.data.nb_ok === 4 && an.data.nb_erreurs === 3, `analyse : ${an.data.nb_ok} prêtes, ${an.data.nb_erreurs} à corriger`);
    const err = (n) => an.data.lignes.find(l => l.ligne === n).erreurs.join(' / ');
    check(/déjà présent ligne 2/.test(err(6)) && /Produit inconnu/.test(err(7)) && /déjà dans TinOR/.test(err(8)), `erreurs : ${err(6)} | ${err(7)} | ${err(8)}`);
    const l3 = an.data.lignes.find(l => l.ligne === 3), l4 = an.data.lignes.find(l => l.ligne === 4), l5 = an.data.lignes.find(l => l.ligne === 5);
    check(l3.quantite === 36.5 && l3.date_expiration === '2026-06-30' && l3.etape === 'PRESSE' && l3.local_id === local.id, `ligne 3 : 36,5 · fin 06/2026 → ${l3.date_expiration} · étape ${l3.etape} · local par défaut`);
    check(l4.date_production === '2024-12-30' && l5.etape === 'CONDITIONNEMENT', `date Excel lue (${l4.date_production}), flacon → ${l5.etape}`);
    const avant = (await api('/lots')).data.length;
    const ko = await api('/reprises/importer', { method: 'POST', body: { date_reprise: '2026-10-01', lignes: an.data.lignes } });
    check(ko.status === 400 && (await api('/lots')).data.length === avant, `import refusé tant qu'il reste des erreurs : ${ko.data.error}`);

    console.log('AR. Lignes corrigées → import');
    const corrigees = an.data.lignes.filter(l => !l.erreurs.length);
    const ok = await api('/reprises/importer', { method: 'POST', body: { date_reprise: '2026-10-01', nom_fichier: 'stock.xlsx', lignes: corrigees } });
    check(ok.status === 201 && ok.data.nb_lots === 4, `import ${ok.data.numero} : ${ok.data.nb_lots} lots${ok.data.error ? ' — ' + ok.data.error + ' ' + JSON.stringify((ok.data.lignes || []).filter(l => l.erreurs.length).map(l => [l.ligne, l.erreurs])) : ''}`);
    const lots = (await api('/lots')).data;
    const lot = (n) => lots.find(l => l.numero_lot === n);
    check(['GJ07/2024', '14-GJ07/2024-20240301H', '14-GJ07/2024-20241230', '120714'].every(n => lot(n) && lot(n).origine === 'REPRISE'), 'n° de lot gardés tels quels, origine REPRISE');
    check(Number(lot('14-GJ07/2024-20240301H').quantite_actuelle) === 36.5, 'quantité 36,5 en stock');
    check(lot('GJ07/2024').bio_status === 'BIO' && lot('GJ07/2024').local_id === local.id && lot('14-GJ07/2024-20240301H').bio_status === 'NON_BIO', 'bio et local de chaque ligne conservés jusqu\'à l\'import');
    const mvts = (await api('/stock-mouvements')).data.filter(x => x.type_mouvement === 'REPRISE');
    check(mvts.length === 4 && mvts.every(x => x.sens === 'ENTREE'), '4 mouvements « Stock initial » en entrée');
    const ctrl = (await api('/controle-stock')).data;
    check(ctrl.nb_lots_en_ecart === 0, `contrôle de cohérence du stock : ${ctrl.nb_lots_en_ecart} écart`);
    const t = (await api(`/lots/${encodeURIComponent('120714')}/tracabilite`)).data;
    check(t.lot.origine === 'REPRISE' && t.ascendants.length === 0, 'traçabilité : lot repris, sans amont (avant TinOR)');

    console.log('AS. Compteurs Jardins de Jerba repris après les numéros importés');
    await api('/settings', { method: 'PUT', body: { ...reglages, lot_format_style: 'jardins_jerba' } });
    const p = await api('/presse', { method: 'POST', body: { date: '2026-10-02', sources: [{ lot_id: lot('GJ07/2024').id, quantite: 50 }], sorties: [{ produit_id: P('Huile de Sésame — Vrac').id, quantite_produite: 15, quantite_tourteau: 30 }] } });
    const n = p.data.lots_presse[0].numero_lot;
    check(Number(n.split('-')[0]) >= 15 && n.endsWith('-GJ07/2024-20261002H'), `pressage suivant après le 14 repris : ${n}`);
    const c = await api('/conditionnement', { method: 'POST', body: { date: '2026-10-03', produit_id: P('Huile de Sésame — Flacon 30ml').id, qty: 10, sources: [{ lot_id: lot('14-GJ07/2024-20241230').id, quantite_utilisee: 1 }] } });
    check(c.data.numero_lot && c.data.numero_lot.startsWith('13'), `flacons 2026 après le lot fini 12 repris : ${c.data.numero_lot}`);

    console.log('AT. Annulation d\'une reprise');
    const refus = await api(`/reprises/${ok.data.id}/annuler`, { method: 'POST', body: { motif: 'erreur de fichier' } });
    check(refus.status === 409, `refusée : des lots ont servi → ${refus.data.error}`);
    const an2 = await api('/reprises/analyser', { method: 'POST', body: { lignes: [{ ligne: 2, numero_lot: 'TEST-ANNUL-1', produit: P('Graines de Sésame').nom, quantite: 3 }] } });
    const ok2 = await api('/reprises/importer', { method: 'POST', body: { date_reprise: '2026-10-01', lignes: an2.data.lignes } });
    const ann = await api(`/reprises/${ok2.data.id}/annuler`, { method: 'POST', body: { motif: 'essai' } });
    check(ann.status === 200 && !(await api('/lots')).data.some(l => l.numero_lot === 'TEST-ANNUL-1'), 'reprise inutilisée annulée : lot retiré');
    check((await api('/controle-stock')).data.nb_lots_en_ecart === 0, 'stock toujours cohérent');
  } finally {
    await api('/settings', { method: 'PUT', body: { ...reglages } });
  }
})();
