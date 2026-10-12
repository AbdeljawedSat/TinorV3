// Import des registres Excel Jardins de Jerba (scripts/importer-registres.js) :
// vérification sans écriture, import avec l'historique, n° de lot et dates gardés,
// stock cohérent, traçabilité flacon → graines, relance sans doublon.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const os = require('os');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { execFileSync } = require('child_process');
const { api, login, check } = require('./api');

const D = (s) => new Date(`${s}T00:00:00Z`);
const lancer = (...args) => execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'importer-registres.js'), ...args], { encoding: 'utf8' });

(async () => {
  await login();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'registres-'));
  const fichier = path.join(dir, 'registres.xlsx');
  const suffixe = String(Date.now()).slice(-5);
  const mp = `T${suffixe}`;
  const sansCorrection = path.join(dir, 'reglages.json');
  fs.writeFileSync(sansCorrection, JSON.stringify({ fournisseurs: [{ nom: `Fournisseur ${suffixe}`, localisation: 'Sousse, Tunisie', lots: [mp] }], quantites_recues_kg: { [mp]: 100 } }));
  const wb = new ExcelJS.Workbook();
  const presse = wb.addWorksheet('registre de press');
  presse.addRow(['N/L', 'Date', 'Num de lot Fournisseur', 'Qte', 'Num Outille', 'Quantité Produite', 'Num de lot Press']);
  presse.addRow([1, D('2024-01-10'), mp, 30, 12, 1, `01-${mp}-20240110H`]);
  presse.addRow([2, D('2024-01-11'), mp, 30, 12, 1.2, `02-${mp}-20240111h`]);
  const filt = wb.addWorksheet('registre filtration');
  filt.addRow(['Filtration']); filt.addRow(['Numéro', 'Date', 'Num de lot press', 'Qantité initial', 'filtre', 'Quantité fini', 'Num de lot filtré']);
  filt.addRow([1, D('2024-02-01'), `01-${mp}-20240110H`, 1, 'ST60', 0.9, `01-${mp}-20240201`]);
  filt.addRow([2, D('2024-02-02'), `02-${mp}-20240111H`, 1.2, 'ST60', 1, `02-${mp}-20240299`]); // n° filtré mal écrit
  const mel = wb.addWorksheet('registre melange');
  mel.addRow(['Registre des lots fini']); mel.addRow(['Num']); mel.addRow(['Num', 'Date', 'N° Lot', 'QTE']);
  mel.addRow([1, D('2024-03-01'), 990102, 600, `01-${mp}-20240201`, 300, 0, `02-${mp}-20240299`, 300, 0]);
  const pf = wb.addWorksheet('registre de stock Produit finie');
  pf.addRow(['Registre']); pf.addRow(['Date', 'Produit', 'Num de lot', 'Expiration', 'Unite (ml)', 'NBR', 'Quantité']);
  pf.addRow([D('2024-03-02'), 'HFB', 990102, 3, 10, 30, 300]);
  pf.addRow([D('2024-03-02'), 'HFB', 990102, 3, 30, 9, 270]);
  pf.addRow([D('2024-03-03'), 'HFB', 990102, 3, 1000, 1, 30]); // bouteille de reste : pas des flacons
  const mv = wb.addWorksheet('mouvement');
  mv.addRow(['Mouvement']); mv.addRow(['N° Vente', 'Date', 'Produit', 'Lot', 'Quantité', 'Quantité', 'Client', 'Paiement']);
  mv.addRow([1, D('2024-04-01'), 'Huile', '990102', '5*10=50\n2*30=60', 110, 'Client A', 'Espèces']);
  await wb.xlsx.writeFile(fichier);

  console.log('AS. Vérification : rien n\'est écrit, rapport produit');
  const avant = (await api('/lots')).data.length;
  const v = lancer(fichier, `--corrections=${sansCorrection}`);
  check(/VÉRIFICATION/.test(v) && (await api('/lots')).data.length === avant, 'vérification sans écriture');
  check(fs.existsSync(fichier.replace(/\.xlsx$/, '_rapport_import.xlsx')), 'rapport Excel créé');
  const rap = new ExcelJS.Workbook(); await rap.xlsx.readFile(fichier.replace(/\.xlsx$/, '_rapport_import.xlsx'));
  const anos = []; rap.getWorksheet('Anomalies').eachRow((r, i) => { if (i > 1) anos.push(r.values.slice(1).join(' ')); });
  check(anos.some(a => a.includes(`02-${mp}-20240202`)) && anos.some(a => /bouteille/.test(a)), `anomalies : n° filtré corrigé, bouteille de reste (${anos.length})`);

  console.log('AT. Import avec l\'historique');
  const r = lancer(fichier, '--appliquer', `--corrections=${sansCorrection}`);
  check(/Import terminé/.test(r), 'import terminé');
  const lots = (await api('/lots')).data;
  const L = (n) => lots.find(l => l.numero_lot === n);
  check(L(mp) && L(`01-${mp}-20240110H`) && L(`02-${mp}-20240111H`) && L(`02-${mp}-20240202`) && L('990102'), 'n° de lot gardés (graines, presse, filtré corrigé, lot fini 990102 avec son 0)');
  check(Math.abs(Number(L(`01-${mp}-20240201`).quantite_actuelle) - 0.6) < 1e-6 && Math.abs(Number(L(`02-${mp}-20240202`).quantite_actuelle) - 0.7) < 1e-6, 'filtrés : 0,9 − 0,3 = 0,6 L et 1 − 0,3 = 0,7 L');
  check(Math.abs(Number(L('990102').quantite_actuelle) - 0.03) < 1e-6, 'lot fini en vrac : 600 − 300 − 270 = 30 ml restants');
  check(Number(L('990102-10ML').quantite_actuelle) === 25 && Number(L('990102-30ML').quantite_actuelle) === 7, 'flacons : 30 − 5 = 25 × 10 ml, 9 − 2 = 7 × 30 ml');
  check(String(L('990102-10ML').date_production || '').startsWith('2024-03-02'), 'date de conditionnement d\'origine');
  check(Number(L(mp).quantite_actuelle) === 40 && L(mp).fournisseur_id, `graines : 100 kg reçus − 2 × 30 kg pressés = ${Number(L(mp).quantite_actuelle)} kg, fournisseur rattaché`);
  const four = (await api('/fournisseurs')).data.find(f => f.nom === `Fournisseur ${suffixe}`);
  check(four && four.localisation === 'Sousse, Tunisie' && L(mp).fournisseur_id === four.id, 'fournisseur créé avec son adresse');
  const conds = (await api('/conditionnement')).data.filter(c => (c.numero_lot || '').startsWith('990102-'));
  check(conds.length === 2, `écran Conditionnement : ${conds.length} conditionnements`);
  const t = (await api(`/lots/${encodeURIComponent('990102-10ML')}/tracabilite`)).data;
  check([`02-${mp}-20240202`, `01-${mp}-20240110H`, mp].every(n => t.ascendants.some(a => a.numero_lot === n)), 'traçabilité : flacon → lot fini → filtré → presse → graines');
  check((await api('/controle-stock')).data.nb_lots_en_ecart === 0, 'contrôle de cohérence du stock : 0 écart');

  console.log('AU. Relance : aucun doublon');
  const n = (await api('/lots')).data.length;
  const r2 = lancer(fichier, '--appliquer', `--corrections=${sansCorrection}`);
  check(/Rien de nouveau/.test(r2) && (await api('/lots')).data.length === n, 'relance sans doublon');
})().catch((e) => { console.error(e); process.exit(1); });
