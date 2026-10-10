const express = require('express');
const ExcelJS = require('exceljs');
const { enTransaction } = require('../db/transaction');
const { nextNumero, recalerCompteursJJ } = require('../services/lotService');
const { normaliser, estGraine, estHuileVrac, estHuileFiltree, estHuileMelangeFiltree, estHuileMelangeVrac } = require('../services/graines');

// ============================================================================
// Reprise du stock existant (démarrage avec les données réelles) : un fichier
// Excel ou CSV, une ligne par lot, le N° DE LOT EST GARDÉ TEL QUEL.
//   1. GET  /modele            → modèle Excel (avec la liste des produits et locaux)
//   2. POST /analyser          → lecture + contrôle de chaque ligne (rien n'est écrit)
//   3. POST /importer          → tout ou rien : un lot par ligne (origine REPRISE),
//                                un mouvement « Stock initial » à la date de reprise
//   4. POST /:id/annuler       → retire une reprise tant qu'aucun de ses lots n'a servi
// ============================================================================
const COLONNES = [
  ['numero_lot', 'N° lot', 22, 'Gardé tel quel (ex. GJ01/2023, 02-GJ01/2023-20230225H, 090123)'],
  ['produit', 'Produit (code ou nom)', 34, 'Code ou nom exact du produit TinOR (voir l\'onglet Produits)'],
  ['quantite', 'Quantité', 11, 'Dans l\'unité du produit (kg, L, unités…)'],
  ['etape', 'Étape', 14, 'MP, PRESSE, FILTRATION, CONDITIONNEMENT ou AUTRE — vide : déduite du produit'],
  ['date_production', 'Date production', 15, 'JJ/MM/AAAA (date de pressage, filtration, conditionnement…)'],
  ['date_expiration', 'Date expiration', 15, 'JJ/MM/AAAA ou MM/AAAA'],
  ['local', 'Local', 16, 'Nom du local (vide : local par défaut)'],
  ['bio', 'Bio', 10, 'oui / non / conversion (vide : à vérifier)'],
  ['lot_fournisseur', 'Lot fournisseur / ancienne référence', 26, 'Facultatif'],
  ['fournisseur', 'Fournisseur', 20, 'Facultatif — nom du fournisseur'],
  ['remarque', 'Remarque', 30, 'Facultatif'],
];
// En-têtes reconnus (accents, majuscules et ponctuation ignorés).
const ALIAS = {
  numero_lot: ['n lot', 'no lot', 'numero lot', 'num lot', 'lot', 'n de lot', 'numero de lot'],
  produit: ['produit code ou nom', 'produit', 'code produit', 'nom produit', 'designation', 'article', 'code'],
  quantite: ['quantite', 'qte', 'qt', 'stock', 'quantite en stock'],
  etape: ['etape', 'type', 'stade'],
  date_production: ['date production', 'date de production', 'date fabrication', 'date de fabrication', 'date'],
  date_expiration: ['date expiration', 'date d expiration', 'expiration', 'dluo', 'ddm', 'dlc', 'peremption'],
  local: ['local', 'emplacement', 'depot', 'magasin'],
  bio: ['bio', 'statut bio'],
  lot_fournisseur: ['lot fournisseur ancienne reference', 'lot fournisseur', 'ancienne reference', 'reference', 'ref'],
  fournisseur: ['fournisseur'],
  remarque: ['remarque', 'remarques', 'notes', 'note', 'commentaire'],
};
const ETAPES = { MP: 'MP', 'MATIERE PREMIERE': 'MP', GRAINES: 'MP', PEPINS: 'MP', PRESSE: 'PRESSE', VRAC: 'PRESSE', FILTRATION: 'FILTRATION', FILTRE: 'FILTRATION', FILTREE: 'FILTRATION',
  CONDITIONNEMENT: 'CONDITIONNEMENT', 'PRODUIT FINI': 'CONDITIONNEMENT', FINI: 'CONDITIONNEMENT', FLACON: 'CONDITIONNEMENT', AUTRE: 'AUTRE' };
const cleEntete = (t) => normaliser(t).replace(/[°º]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const iso = (a, m, j) => `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

// 25/02/2023, 2023-02-25, 25-02-23, 06/2027 (fin du mois), date Excel → 'AAAA-MM-JJ' ; '' si vide ; null si invalide.
function lireDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return valide(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) return valide(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return valide(+m[2], +m[1], new Date(Date.UTC(+m[2], +m[1], 0)).getUTCDate());
  return null;
}
function valide(a, mo, j) {
  const d = new Date(Date.UTC(a, mo - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j ? iso(a, mo, j) : null;
}
const lireNombre = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')));
const texteCellule = (v) => {
  if (v == null) return '';
  if (typeof v === 'object' && !(v instanceof Date)) return v.text ?? v.result ?? (v.richText ? v.richText.map(r => r.text).join('') : '');
  return v instanceof Date ? v : String(v).trim();
};

// Fichier (base64) → lignes { ligne, numero_lot, produit, … } selon les en-têtes trouvés.
async function lireFichier(nom, base64) {
  const buf = Buffer.from(base64, 'base64');
  let table = [];
  if (/\.csv$|\.txt$/i.test(nom || '')) {
    const texte = buf.toString('utf8').replace(/^﻿/, '');
    const lignes = texte.split(/\r?\n/).filter(l => l.trim());
    const sep = (lignes[0].match(/;/g) || []).length >= (lignes[0].match(/,/g) || []).length ? ';' : ',';
    const decouper = (l) => { const r = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r.map(x => x.trim()); };
    table = lignes.map(decouper);
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    ws.eachRow({ includeEmpty: false }, (row) => { const r = []; row.eachCell({ includeEmpty: true }, (c, i) => { r[i - 1] = texteCellule(c.value); }); table.push(r); });
  }
  // Ligne d'en-têtes : la première qui contient « lot » et « produit ».
  const iEntete = table.findIndex(r => r.some(c => /lot/.test(cleEntete(c))) && r.some(c => /produit|designation|article/.test(cleEntete(c))));
  if (iEntete < 0) throw Object.assign(new Error('En-têtes introuvables : la feuille doit contenir au moins les colonnes « N° lot », « Produit » et « Quantité » (utilisez le modèle).'), { status: 400 });
  const entetes = table[iEntete].map(cleEntete);
  const index = {};
  for (const [cle, alias] of Object.entries(ALIAS)) {
    const i = entetes.findIndex((e, k) => alias.includes(e) && !Object.values(index).includes(k));
    if (i >= 0) index[cle] = i;
  }
  for (const requis of ['numero_lot', 'produit', 'quantite']) {
    if (index[requis] == null) throw Object.assign(new Error(`Colonne « ${COLONNES.find(c => c[0] === requis)[1]} » introuvable dans le fichier.`), { status: 400 });
  }
  return table.slice(iEntete + 1)
    .map((r, k) => ({ r, ligne: iEntete + k + 2 }))
    .filter(({ r }) => r.some(c => String(c ?? '').trim() !== ''))
    .filter(({ r }) => !/^(ex|exemple)\b/i.test(String(r[index.remarque] ?? '')))
    .map(({ r, ligne }) => Object.fromEntries([['ligne', ligne], ...Object.entries(index).map(([cle, i]) => [cle, r[i] ?? ''])]));
}

module.exports = function (pool) {
  const router = express.Router();

  async function referentiels(conn) {
    const produits = (await conn.query(
      `SELECT p.id, p.code, p.nom, p.type_article, p.format_id, u.symbole AS unite FROM produits p LEFT JOIN unites u ON u.id = p.unite_id WHERE p.actif = 1 OR p.actif IS NULL`)).rows;
    const locaux = (await conn.query('SELECT id, nom FROM locaux')).rows;
    const fournisseurs = (await conn.query('SELECT id, nom FROM fournisseurs')).rows;
    return { produits, locaux, fournisseurs };
  }
  const etapeDuProduit = (p) => (estGraine(p) || p.type_article === 'MATIERE_PREMIERE' ? 'MP'
    : estHuileVrac(p) || estHuileMelangeVrac(p) ? 'PRESSE'
    : estHuileFiltree(p) || estHuileMelangeFiltree(p) ? 'FILTRATION'
    : p.format_id ? 'CONDITIONNEMENT' : 'AUTRE');

  // Contrôle de chaque ligne ; renvoie les lignes enrichies (ids, valeurs lues) avec leurs erreurs.
  async function controler(conn, brutes, { local_id_defaut } = {}) {
    const { produits, locaux, fournisseurs } = await referentiels(conn);
    const parCode = new Map(produits.map(p => [normaliser(p.code), p]));
    const parNom = new Map(produits.map(p => [normaliser(p.nom), p]));
    const vus = new Map();
    const lignes = [];
    for (const b of brutes) {
      const erreurs = [], avertissements = [];
      const numero = String(b.numero_lot ?? '').trim();
      if (!numero) erreurs.push('N° de lot manquant');
      else if (numero.length > 60) erreurs.push('N° de lot trop long (60 caractères maximum)');
      if (numero) {
        const cle = numero.toUpperCase();
        if (vus.has(cle)) erreurs.push(`N° déjà présent ligne ${vus.get(cle)} du fichier`); else vus.set(cle, b.ligne);
        if ((await conn.query('SELECT 1 FROM lots WHERE numero_lot = $1', [numero])).rows.length) erreurs.push('N° de lot déjà dans TinOR');
      }
      let p = null;
      if (b.produit_id) p = produits.find(x => x.id === Number(b.produit_id)) || null;
      else { const t = normaliser(b.produit); p = parCode.get(t) || parNom.get(t) || null; }
      if (!p) erreurs.push(String(b.produit || '').trim() ? 'Produit inconnu : choisissez-le' : 'Produit manquant');
      const quantite = lireNombre(b.quantite);
      if (!(quantite > 0)) erreurs.push('Quantité invalide (doit être supérieure à 0)');
      const dp = lireDate(b.date_production), de = lireDate(b.date_expiration);
      if (dp === null) erreurs.push('Date de production illisible');
      if (de === null) erreurs.push('Date d\'expiration illisible');
      if (dp && de && de < dp) erreurs.push('Expiration avant la production');
      let local = null;
      if (b.local_id) local = locaux.find(l => l.id === Number(b.local_id)) || null; // ligne déjà contrôlée (renvoyée par l'écran)
      else if (String(b.local || '').trim()) {
        local = locaux.find(l => normaliser(l.nom) === normaliser(b.local));
        if (!local) erreurs.push(`Local « ${b.local} » inconnu`);
      } else if (local_id_defaut) local = locaux.find(l => l.id === Number(local_id_defaut)) || null;
      let fournisseur = null;
      if (b.fournisseur_id) fournisseur = fournisseurs.find(f => f.id === Number(b.fournisseur_id)) || null;
      else if (String(b.fournisseur || '').trim()) {
        fournisseur = fournisseurs.find(f => normaliser(f.nom) === normaliser(b.fournisseur));
        if (!fournisseur) avertissements.push(`Fournisseur « ${b.fournisseur} » inconnu (ignoré)`);
      }
      const bioTxt = normaliser(b.bio);
      const bio = ['BIO', 'NON_BIO', 'EN_CONVERSION', 'A_VERIFIER'].includes(b.bio_status) && !bioTxt ? b.bio_status
        : !bioTxt ? 'A_VERIFIER' : /^(oui|bio|yes|1)$/.test(bioTxt) ? 'BIO' : /^(non|no|0|non bio)$/.test(bioTxt) ? 'NON_BIO' : /conversion/.test(bioTxt) ? 'EN_CONVERSION' : 'A_VERIFIER';
      if (bioTxt && bio === 'A_VERIFIER') avertissements.push(`Bio « ${b.bio} » non reconnu (à vérifier)`);
      const etapeTxt = normaliser(b.etape).toUpperCase();
      const etape = etapeTxt ? ETAPES[etapeTxt] : (p ? etapeDuProduit(p) : 'AUTRE');
      if (etapeTxt && !etape) erreurs.push(`Étape « ${b.etape} » inconnue (MP, PRESSE, FILTRATION, CONDITIONNEMENT, AUTRE)`);
      lignes.push({
        ligne: b.ligne, numero_lot: numero, produit_id: p ? p.id : null, produit_nom: p ? p.nom : String(b.produit || ''), produit_saisi: String(b.produit || ''),
        unite: p ? p.unite : '', quantite: quantite > 0 ? quantite : null, etape: etape || null,
        date_production: dp || null, date_expiration: de || null, local_id: local ? local.id : null, local_nom: local ? local.nom : '',
        bio_status: bio, lot_fournisseur: String(b.lot_fournisseur || '').trim() || null, fournisseur_id: fournisseur ? fournisseur.id : null,
        remarque: String(b.remarque || '').trim() || null, erreurs, avertissements,
      });
    }
    return lignes;
  }

  router.get('/', async (req, res) => {
    const r = await pool.query(
      `SELECT rp.*, e.nom AS employe_nom, e.prenom AS employe_prenom,
         (SELECT COUNT(*) FROM lots l WHERE l.reprise_id = rp.id) AS nb_lots_restants
       FROM reprises rp LEFT JOIN employes e ON e.id = rp.employe_id ORDER BY rp.id DESC`);
    res.json(r.rows);
  });

  router.get('/modele', async (req, res) => {
    const { produits, locaux } = await referentiels(pool);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock à reprendre');
    ws.columns = COLONNES.map(([key, header, width]) => ({ key, header, width }));
    ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB07A1E' } }; c.alignment = { wrapText: true, vertical: 'middle' }; });
    COLONNES.forEach(([, , , aide], i) => { ws.getCell(1, i + 1).note = aide; });
    const ex = (p) => (produits.find(x => p(x)) || {}).nom || '';
    ws.addRow({ numero_lot: 'GJ01/2023', produit: ex(estGraine) || ex(x => x.type_article === 'MATIERE_PREMIERE'), quantite: 420, etape: 'MP', date_production: '05/01/2023', local: (locaux[0] || {}).nom || '', bio: 'oui', remarque: 'Exemple — ligne ignorée, à remplacer' });
    ws.addRow({ numero_lot: '02-GJ01/2023-20241230', produit: ex(x => estHuileFiltree(x)), quantite: 36, etape: 'FILTRATION', date_production: '30/12/2024', date_expiration: '12/2026', local: (locaux[0] || {}).nom || '', bio: 'oui', remarque: 'Exemple — ligne ignorée, à remplacer' });
    ws.addRow({ numero_lot: '090123', produit: ex(x => !!x.format_id), quantite: 240, etape: 'CONDITIONNEMENT', date_production: '09/01/2025', date_expiration: '01/2027', local: (locaux[0] || {}).nom || '', bio: 'oui', remarque: 'Exemple — ligne ignorée, à remplacer' });
    [2, 3, 4].forEach(n => ws.getRow(n).eachCell(c => { c.font = { italic: true, color: { argb: 'FF888888' } }; }));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const wp = wb.addWorksheet('Produits');
    wp.columns = [{ header: 'Code', key: 'code', width: 10 }, { header: 'Nom (à recopier dans « Produit »)', key: 'nom', width: 46 }, { header: 'Unité', key: 'unite', width: 10 }, { header: 'Étape déduite', key: 'etape', width: 18 }];
    produits.forEach(p => wp.addRow({ code: p.code, nom: p.nom, unite: p.unite, etape: etapeDuProduit(p) }));
    wp.getRow(1).font = { bold: true };
    const wl = wb.addWorksheet('Locaux');
    wl.columns = [{ header: 'Local', key: 'nom', width: 30 }];
    locaux.forEach(l => wl.addRow({ nom: l.nom }));
    wl.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modele_reprise_stock.xlsx"');
    res.send(await wb.xlsx.writeBuffer());
  });

  // Lecture du fichier + contrôle, sans rien écrire. Corps : { nom_fichier, fichier_base64, local_id_defaut }
  // ou { lignes: [...] } pour recontrôler après corrections à l'écran.
  router.post('/analyser', async (req, res, next) => {
    try {
      const { nom_fichier, fichier_base64, local_id_defaut } = req.body || {};
      const brutes = Array.isArray(req.body.lignes) ? req.body.lignes : await lireFichier(nom_fichier, fichier_base64 || '');
      if (!brutes.length) return res.status(400).json({ error: 'Aucune ligne de stock dans le fichier.' });
      if (brutes.length > 5000) return res.status(400).json({ error: 'Plus de 5 000 lignes : découpez le fichier.' });
      const lignes = await controler(pool, brutes, { local_id_defaut });
      res.json({ lignes, nb_ok: lignes.filter(l => !l.erreurs.length).length, nb_erreurs: lignes.filter(l => l.erreurs.length).length });
    } catch (err) { next(err); }
  });

  // Import tout ou rien. Corps : { date_reprise, nom_fichier, local_id_defaut, employe_id, lignes: [...] }
  router.post('/importer', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { date_reprise, nom_fichier, local_id_defaut, employe_id } = req.body || {};
      const dateReprise = lireDate(date_reprise);
      if (!dateReprise) return res.status(400).json({ error: 'Date de reprise invalide.' });
      if (!Array.isArray(req.body.lignes) || !req.body.lignes.length) return res.status(400).json({ error: 'Aucune ligne à importer.' });
      const lignes = await controler(pool, req.body.lignes, { local_id_defaut });
      const enErreur = lignes.filter(l => l.erreurs.length);
      if (enErreur.length) return res.status(400).json({ error: `${enErreur.length} ligne(s) à corriger avant l'import (rien n'a été enregistré).`, lignes });
      const numero = await nextNumero(pool, 'reprise_seq', 'REP');
      const rep = await pool.query('INSERT INTO reprises (numero, date_reprise, fichier, nb_lots, employe_id) VALUES ($1,$2,$3,$4,$5)',
        [numero, dateReprise, nom_fichier || null, lignes.length, employe_id || null]);
      const repriseId = rep.insertId;
      const groupId = require('crypto').randomUUID();
      const crees = [];
      for (const [i, l] of lignes.entries()) {
        const lot = await pool.query(
          `INSERT INTO lots (produit_id, numero_lot, origine, fournisseur_id, lot_fournisseur, bio_status, local_id, date_production, date_expiration,
             quantite_initiale, quantite_actuelle, notes, employe_id, champs_perso, reprise_id)
           VALUES ($1,$2,'REPRISE',$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13)`,
          [l.produit_id, l.numero_lot, l.fournisseur_id, l.lot_fournisseur, l.bio_status, l.local_id, l.date_production || dateReprise, l.date_expiration,
           l.quantite, l.remarque, employe_id || null, JSON.stringify({ etape_reprise: l.etape }), repriseId]);
        const lotId = lot.insertId;
        await pool.query(`INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'LIBERE',$2,$3)`,
          [lotId, `Reprise du stock existant (${numero})`, employe_id || null]);
        await pool.query(
          `INSERT INTO stock_mouvements (numero, date_mouvement, type_mouvement, sens, produit_id, lot_id, local_id, quantite, source_type, source_id, group_id, employe_id, note)
           VALUES ($1,$2,'REPRISE','ENTREE',$3,$4,$5,$6,'reprise',$7,$8,$9,$10)`,
          [`${numero}-${String(i + 1).padStart(4, '0')}`, `${dateReprise} 00:00:00`, l.produit_id, lotId, l.local_id, l.quantite, repriseId, groupId, employe_id || null, 'Stock initial (reprise)']);
        await recalerCompteursJJ(pool, { numero: l.numero_lot, etape: l.etape, date: l.date_production || dateReprise });
        crees.push({ lot_id: lotId, numero_lot: l.numero_lot });
      }
      res.status(201).json({ id: repriseId, numero, nb_lots: crees.length, lots: crees });
    } catch (err) { next(err); }
  }));

  // Annulation : seulement si aucun lot de la reprise n'a servi (vente, production, inventaire…).
  router.post('/:id/annuler', enTransaction(pool, async (req, res, next, pool) => {
    try {
      if (req.user && req.user.role !== 'gerant') return res.status(403).json({ error: 'Réservé au gérant.' });
      const motif = String((req.body || {}).motif || '').trim();
      if (!motif) return res.status(400).json({ error: 'Indiquez le motif de l\'annulation.' });
      const rp = (await pool.query('SELECT * FROM reprises WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!rp) return res.status(404).json({ error: 'Reprise introuvable.' });
      if (rp.annulee_le) return res.status(409).json({ error: 'Reprise déjà annulée.' });
      const utilises = (await pool.query(
        `SELECT l.numero_lot FROM lots l
         WHERE l.reprise_id = $1 AND (l.quantite_actuelle <> l.quantite_initiale
           OR EXISTS (SELECT 1 FROM stock_mouvements m WHERE m.lot_id = l.id AND m.type_mouvement <> 'REPRISE')
           OR EXISTS (SELECT 1 FROM lot_origines o WHERE o.lot_source_id = l.id)
           OR EXISTS (SELECT 1 FROM commande_lignes cl WHERE cl.lot_id = l.id))
         LIMIT 5`, [rp.id])).rows;
      if (utilises.length) return res.status(409).json({ error: `Impossible : des lots de cette reprise ont déjà servi (${utilises.map(u => u.numero_lot).join(', ')}…). Corrigez-les par un inventaire.` });
      const ids = (await pool.query('SELECT id FROM lots WHERE reprise_id = $1', [rp.id])).rows.map(r => r.id);
      for (const id of ids) {
        await pool.query('DELETE FROM stock_mouvements WHERE lot_id = $1', [id]);
        await pool.query('DELETE FROM lot_statuts_historique WHERE lot_id = $1', [id]);
        await pool.query('DELETE FROM lots WHERE id = $1', [id]);
      }
      await pool.query('UPDATE reprises SET annulee_le = NOW(), annule_motif = $1 WHERE id = $2', [motif, rp.id]);
      res.json({ ok: true, lots_retires: ids.length });
    } catch (err) { next(err); }
  }));

  return router;
};
