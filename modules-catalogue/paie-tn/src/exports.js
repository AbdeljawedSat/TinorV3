'use strict';
/**
 * États récapitulatifs (mêmes colonnes que l'application Java) en CSV (UTF-8 BOM, « ; ») ou XLSX (exceljs, si installé).
 * Ce ne sont PAS des fichiers déclaratifs officiels CNSS/DGI : leur format exact reste à confirmer.
 */
const { d } = require('./engine/dec');

const TYPES = {
  'livre-paie': {
    titre: 'Livre de paie',
    colonnes: ['Période', 'Matricule', 'Nom', 'Prénom', 'Brut', 'Base CNSS', 'CNSS salarié', 'Imposable mensuel', 'IRPP', 'CSS', 'Retenues nettes',
      'Net à payer', 'Charges patronales', 'Coût employeur', 'Version', 'Statut', 'Certifiable'],
    numeriques: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    ligne: (per, k) => {
      const r = k.resultat, sy = r.synthese;
      return [per, k.salarie.matricule, k.salarie.nom, k.salarie.prenom, sy.brut, r.totaux.baseCnss, sy.cnssSalarial, r.fiscal.imposableMensuel,
        sy.irpp, sy.css, sy.totalRetenuesNet, sy.netAPayer, sy.chargesPatronales, sy.coutEmployeur, k.version, k.statut, k.certifiable ? 'oui' : 'NON'];
    },
    total: true,
  },
  'etat-cnss': {
    titre: 'État des cotisations CNSS',
    colonnes: ['Période', 'Matricule', 'N° CNSS', 'Nom', 'Prénom', 'Base', 'Cotisation salariale', 'Cotisation patronale CNSS+PE', 'Accident du travail'],
    numeriques: [5, 6, 7, 8],
    ligne: (per, k) => {
      let base = '0.000', sal = d('0'), pat = d('0'), at = d('0');
      for (const c of k.resultat.cotisations) {
        if (c.code === 'CNSS' || c.code === 'PERTE_EMPLOI') { base = c.base; sal = sal.plus(c.montantSalarial); pat = pat.plus(c.montantPatronal); }
        else if (c.code === 'AT') at = d(c.montantPatronal);
      }
      return [per, k.salarie.matricule, k.salarie.numCnss, k.salarie.nom, k.salarie.prenom, base, sal.toFixed(3), pat.toFixed(3), at.toFixed(3)];
    },
    total: true,
  },
  'etat-retenues': {
    titre: 'État des retenues IRPP / CSS',
    colonnes: ['Période', 'Matricule', 'Nom', 'Prénom', 'Brut', 'Imposable mensuel', 'Net imposable annualisé', 'IRPP retenu', 'CSS retenue'],
    numeriques: [4, 5, 6, 7, 8],
    ligne: (per, k) => [per, k.salarie.matricule, k.salarie.nom, k.salarie.prenom, k.resultat.synthese.brut, k.resultat.fiscal.imposableMensuel,
      k.resultat.fiscal.netImposableAnnuel, k.resultat.synthese.irpp, k.resultat.synthese.css],
    total: true,
  },
  'etat-paiement': {
    titre: 'État de paiement des salaires',
    colonnes: ['Période', 'Matricule', 'Nom', 'Prénom', 'Mode de paiement', 'RIB', 'Net à payer'],
    numeriques: [6],
    ligne: (per, k) => [per, k.salarie.matricule, k.salarie.nom, k.salarie.prenom, k.salarie.modePaiement, k.salarie.rib, k.resultat.synthese.netAPayer],
    total: true,
  },
};

function tableau(type, periode, calculs) {
  const t = TYPES[type];
  if (!t) throw new Error('Type d\'état inconnu : ' + type);
  const lignes = calculs.map((k) => t.ligne(periode, k));
  let total = null;
  if (t.total && lignes.length) {
    total = t.colonnes.map(() => '');
    total[0] = periode;
    total[1] = 'TOTAL';
    for (const i of t.numeriques) total[i] = lignes.reduce((s, l) => s.plus(d(l[i] || '0')), d('0')).toFixed(3);
  }
  return { ...t, lignes, totalLigne: total };
}

const cellule = (v) => {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = "'" + s; // neutralise les formules
  if (/[;"\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

function csv(type, periode, calculs) {
  const t = tableau(type, periode, calculs);
  const fmt = (l) => l.map((v, i) => (t.numeriques.includes(i) && v !== '' && v != null ? String(v).replace('.', ',') : cellule(v))).join(';');
  return '﻿' + [t.colonnes.join(';'), ...t.lignes.map(fmt), ...(t.totalLigne ? [fmt(t.totalLigne)] : [])].join('\n') + '\n';
}

async function xlsx(type, periode, calculs) {
  let ExcelJS;
  try { ExcelJS = require('exceljs'); } catch (e) { const err = new Error('Export Excel indisponible : installer le paquet exceljs'); err.status = 501; throw err; }
  const t = tableau(type, periode, calculs);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TinOR – module paie';
  const ws = wb.addWorksheet(t.titre.slice(0, 31));
  ws.addRow([`${t.titre} – ${periode}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const h = ws.addRow(t.colonnes);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5E3E' } }; });
  const ajouter = (l, gras) => {
    const row = ws.addRow(l.map((v, i) => (t.numeriques.includes(i) && v !== '' && v != null ? Number(v) : v)));
    for (const i of t.numeriques) row.getCell(i + 1).numFmt = '#,##0.000';
    if (gras) row.font = { bold: true };
  };
  t.lignes.forEach((l) => ajouter(l, false));
  if (t.totalLigne) ajouter(t.totalLigne, true);
  ws.columns.forEach((c, i) => { c.width = Math.max(10, Math.min(28, String(t.colonnes[i] || '').length + 4)); });
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { TYPES, csv, xlsx, tableau };
