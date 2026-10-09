// ============================================================================
// Génère de VRAIS fichiers .xlsx (exceljs) et .docx (docx) — pas des HTML
// renommés — à la MÊME forme que l'impression PDF de la console :
//  - listes (Stock, Commandes, Lots, Traçabilité…) : en-tête société avec logo,
//    titre, sous-titre, « Généré le … — N lignes », tableau aux couleurs ;
//  - documents de vente (facture, bon de commande, bon de livraison, pro forma) :
//    même description (« spec ») que celle qui produit le PDF.
// ============================================================================
const ExcelJS = require('exceljs');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, WidthType, ShadingType,
  AlignmentType, BorderStyle, VerticalAlign,
} = require('docx');

const OLIVE = '17231D';
const FOND_LIBELLE = 'EEF3EA';
const couleurHex = (c) => (/^#?[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).replace('#', '').toUpperCase() : OLIVE);
const texte = (v) => (v == null ? '' : String(v));

// Logo envoyé par la console en data URI (Paramètres, sinon logo de l'application).
function imageDepuisDataUri(uri, hauteur = 64) {
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(uri || '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  const type = m[1].toLowerCase().startsWith('jp') ? 'jpg' : m[1].toLowerCase();
  let w = 0, h = 0;
  try {
    if (type === 'png') { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    else if (type === 'gif') { w = buf.readUInt16LE(6); h = buf.readUInt16LE(8); }
    else {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const marqueur = buf[i + 1];
        if (marqueur >= 0xC0 && marqueur <= 0xC3) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { return null; }
  if (!w || !h) return null;
  return { buf, type, base64: m[2], extension: type === 'jpg' ? 'jpeg' : type, largeur: Math.round(w * hauteur / h), hauteur };
}

// ---------- DOCX : briques ----------
const bordure = (c = '333333') => ({ style: BorderStyle.SINGLE, size: 6, color: c });
const BORDS = { top: bordure(), bottom: bordure(), left: bordure(), right: bordure() };
const SANS_BORDS = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
const run = (t, o = {}) => new TextRun({ text: texte(t), size: o.size || 18, bold: !!o.bold, italics: !!o.italics, color: o.color || '1A1A1A', font: 'Arial' });
const para = (contenu, o = {}) => new Paragraph({
  alignment: o.align === 'right' ? AlignmentType.RIGHT : o.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
  spacing: { before: o.before || 0, after: o.after || 0 },
  children: Array.isArray(contenu) ? contenu : [typeof contenu === 'string' || typeof contenu === 'number' ? run(contenu, o) : contenu],
});
function cellule(enfants, o = {}) {
  return new TableCell({
    width: o.largeur ? { size: o.largeur, type: WidthType.DXA } : undefined,
    columnSpan: o.span,
    borders: o.sansBord ? SANS_BORDS : BORDS,
    verticalAlign: o.centre ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: o.fond ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fond } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: Array.isArray(enfants) ? enfants : [enfants],
  });
}
const tableau = (lignes, largeurs) => new Table({ width: { size: largeurs.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: largeurs, rows: lignes });

function enteteSocieteDocx(s, largeurTotale) {
  const logo = imageDepuisDataUri(s.logo, 64);
  const lignesTexte = [
    ...(s.nom ? [para(s.nom, { bold: true, size: 26, color: s.couleur })] : []),
    ...(s.lignes || []).filter(Boolean).map(l => para(l, { size: 17, color: '333333' })),
  ];
  if (!lignesTexte.length) lignesTexte.push(para(''));
  const largeurLogo = logo ? Math.round(logo.largeur * 15) + 200 : 0;
  return tableau([new TableRow({ children: [
    ...(logo ? [cellule(new Paragraph({ children: [new ImageRun({ type: logo.type, data: logo.buf, transformation: { width: logo.largeur, height: logo.hauteur } })] }), { sansBord: true, largeur: largeurLogo })] : []),
    cellule(lignesTexte, { sansBord: true, largeur: largeurTotale - largeurLogo }),
  ] })], logo ? [largeurLogo, largeurTotale - largeurLogo] : [largeurTotale]);
}

// ---------- Listes ----------
// entete : { couleur, logo, nom, lignes } (facultatif) ; headers : [{ key, label, width? }] ; rows : [{ key: valeur }]
async function buildXlsxBuffer(title, headers, rows, entete = {}, sousTitre = '') {
  const couleur = couleurHex(entete.couleur);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TinOR ERP V3';
  wb.created = new Date();
  const ws = wb.addWorksheet((title || 'Export').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Export', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = headers.map(h => ({ key: h.key, width: h.width || Math.max(12, Math.min(40, (h.label || '').length + 6)) }));
  const nb = headers.length;
  let ligne = enteteSocieteXlsx(wb, ws, entete, Math.max(nb, 3));
  const fusion = (r, valeur, style) => {
    if (nb > 1) ws.mergeCells(r, 1, r, nb);
    const c = ws.getCell(r, 1); c.value = valeur; Object.assign(c, style);
  };
  fusion(ligne++, title, { font: { bold: true, size: 15, color: { argb: `FF${couleur}` } } });
  if (sousTitre) fusion(ligne++, sousTitre, { font: { italic: true, size: 10, color: { argb: 'FF666666' } } });
  fusion(ligne++, `Généré le ${new Date().toLocaleDateString('fr-TN')} — ${rows.length} ligne${rows.length > 1 ? 's' : ''}`, { font: { size: 9, color: { argb: 'FF888888' } } });
  ligne++;
  const ligneEntete = ligne;
  headers.forEach((h, i) => {
    const c = ws.getCell(ligne, i + 1);
    c.value = h.label;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${couleur}` } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    c.border = bordsXlsx();
  });
  rows.forEach((r, n) => {
    ligne++;
    headers.forEach((h, i) => {
      const c = ws.getCell(ligne, i + 1);
      c.value = r[h.key] ?? '';
      c.border = bordsXlsx('FFDDDDDD');
      c.alignment = { vertical: 'top', wrapText: true };
      if (n % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF6' } };
    });
  });
  ws.autoFilter = { from: { row: ligneEntete, column: 1 }, to: { row: ligneEntete, column: nb } };
  ws.views = [{ state: 'frozen', ySplit: ligneEntete }];
  return wb.xlsx.writeBuffer();
}

async function buildDocxBuffer(title, subtitle, headers, rows, entete = {}) {
  const couleur = couleurHex(entete.couleur);
  const largeurTotale = 15400; // A4 paysage, marges comprises
  const colWidth = Math.floor(largeurTotale / headers.length);
  const ligneEntete = new TableRow({ tableHeader: true, children: headers.map(h => cellule(para(h.label, { bold: true, color: 'FFFFFF' }), { largeur: colWidth, fond: couleur })) });
  const corps = rows.map((r, n) => new TableRow({ children: headers.map(h => cellule(para(texte(r[h.key])), { largeur: colWidth, fond: n % 2 ? 'FAFAF6' : undefined })) }));
  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        ...(entete.nom || entete.logo ? [enteteSocieteDocx({ ...entete, couleur }, largeurTotale), para('', { after: 120 })] : []),
        para(title, { bold: true, size: 32, color: couleur, after: 80 }),
        ...(subtitle ? [para(subtitle, { italics: true, color: '666666', size: 20, after: 60 })] : []),
        para(`Généré le ${new Date().toLocaleDateString('fr-TN')} — ${rows.length} ligne${rows.length > 1 ? 's' : ''}`, { size: 18, color: '888888', after: 200 }),
        tableau([ligneEntete, ...corps], headers.map(() => colWidth)),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

// ---------- XLSX : briques ----------
const bordsXlsx = (c = 'FF333333') => ({ top: { style: 'thin', color: { argb: c } }, bottom: { style: 'thin', color: { argb: c } }, left: { style: 'thin', color: { argb: c } }, right: { style: 'thin', color: { argb: c } } });
function enteteSocieteXlsx(wb, ws, s, nbColonnes) {
  const couleur = couleurHex(s.couleur);
  const logo = imageDepuisDataUri(s.logo, 64);
  let ligne = 1;
  const colTexte = logo ? 3 : 1;
  if (logo) {
    const id = wb.addImage({ base64: s.logo, extension: logo.extension });
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: logo.largeur, height: logo.hauteur } });
  }
  const lignes = [[s.nom, { bold: true, size: 13, color: { argb: `FF${couleur}` } }], ...(s.lignes || []).filter(Boolean).map(l => [l, { size: 9, color: { argb: 'FF333333' } }])];
  lignes.forEach(([t, font]) => {
    if (!t) return;
    if (nbColonnes > colTexte) ws.mergeCells(ligne, colTexte, ligne, nbColonnes);
    const c = ws.getCell(ligne, colTexte); c.value = t; c.font = font;
    ligne++;
  });
  return Math.max(ligne, logo ? 5 : 1) + 1;
}

// ---------- Documents de vente ----------
// spec : { couleur, logo, societe:{nom, lignes[]}, numero, titre, refs:[[libellé, valeur]], client:{nom, mention, lignes:[[libellé, valeur]]},
//          colonnes:[{label, num}], lignes:[[…]], piedLignes:[…], bas:{tva:{entetes, lignes}, mentions, totaux:[[k,v]], net:[k,v], reglement},
//          lettres:{intro, texte}, signatures:[…], piedPage }
async function buildDocumentDocx(spec) {
  const couleur = couleurHex(spec.couleur);
  const L = 10466; // A4 portrait, marges 10 mm
  const enfants = [enteteSocieteDocx({ ...spec.societe, logo: spec.logo, couleur }, L)];
  enfants.push(para(spec.numero, { bold: true, size: 30, before: 160, after: 40 }));
  enfants.push(para(spec.titre, { bold: true, size: 38, color: couleur, align: 'center', after: 220 }));

  // N° / Date (/ Commande) à gauche, cadre client à droite
  const refs = spec.refs || [];
  const lRefs = Math.floor(4100 / Math.max(refs.length, 1));
  const tableRefs = tableau([
    new TableRow({ children: refs.map(([l]) => cellule(para(l, { bold: true, size: 16 }), { largeur: lRefs, fond: FOND_LIBELLE })) }),
    new TableRow({ children: refs.map(([, v]) => cellule(para(v, { size: 22 }), { largeur: lRefs })) }),
  ], refs.map(() => lRefs));
  const cl = spec.client || {};
  const cadreClient = tableau([new TableRow({ children: [cellule([
    para([run(cl.nom, { bold: true, size: 22 }), ...(cl.mention ? [run(` — ${cl.mention}`, { bold: true, size: 22, color: 'A23B2E' })] : [])], { align: 'center', after: 80 }),
    ...(cl.lignes || []).map(([k, v]) => para([run(`${k} : `, { bold: true, size: 17 }), run(v, { size: 17 })])),
  ], { largeur: 6000 })] })], [6000]);
  enfants.push(tableau([new TableRow({ children: [cellule(tableRefs, { sansBord: true, largeur: 4466 }), cellule(cadreClient, { sansBord: true, largeur: 6000 })] })], [4466, 6000]));
  enfants.push(para('', { after: 200 }));

  // Lignes
  const cols = spec.colonnes || [];
  const premiere = Math.round(L * (cols.length > 4 ? 0.26 : 0.34));
  const autres = cols.length > 1 ? Math.floor((L - premiere) / (cols.length - 1)) : L;
  const largeurs = cols.map((_, i) => (i === 0 ? premiere : autres));
  const alignCol = (i) => (cols[i] && cols[i].num ? 'right' : 'left');
  const lignes = [new TableRow({ tableHeader: true, children: cols.map((c, i) => cellule(para(c.label, { bold: true, color: 'FFFFFF', size: 17, align: alignCol(i) }), { largeur: largeurs[i], fond: couleur })) })];
  (spec.lignes || []).forEach((l, n) => lignes.push(new TableRow({ children: l.map((v, i) => cellule(para(texte(v).replace(/<[^>]+>/g, ''), { size: 18, align: alignCol(i) }), { largeur: largeurs[i], fond: n % 2 ? 'FAFAF6' : undefined })) })));
  if (spec.piedLignes) {
    // Comme le PDF : valeurs réparties sur la largeur (première à gauche, dernière à droite).
    const n = spec.piedLignes.length, lp = Math.floor(L / n);
    const interne = tableau([new TableRow({ children: spec.piedLignes.map((v, i) => cellule(para(v, { bold: true, size: 18, align: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center' }), { sansBord: true, largeur: lp })) })], spec.piedLignes.map(() => lp));
    lignes.push(new TableRow({ children: [cellule(interne, { span: cols.length, largeur: L })] }));
  }
  enfants.push(tableau(lignes, largeurs));
  enfants.push(para('', { after: 200 }));

  // Bas : TVA ou remarques | totaux | net à payer
  const bas = spec.bas || {};
  if (bas.totaux || bas.net || bas.tva) {
    const c3 = Math.floor(L / 3);
    const gauche = bas.tva
      ? tableau([
        new TableRow({ children: bas.tva.entetes.map(e => cellule(para(e, { bold: true, color: 'FFFFFF', size: 16, align: 'center' }), { largeur: Math.floor(c3 / 3), fond: couleur })) }),
        ...bas.tva.lignes.map(l => new TableRow({ children: l.map(v => cellule(para(v, { size: 16, align: 'right' }), { largeur: Math.floor(c3 / 3) })) })),
      ], bas.tva.entetes.map(() => Math.floor(c3 / 3)))
      : tableau([new TableRow({ children: [cellule(texte(bas.mentions).split('\n').map(t => para(t, { size: 16, color: '333333' })), { largeur: c3 })] })], [c3]);
    const milieu = (bas.totaux || []).length
      ? tableau(bas.totaux.map(([k, v]) => new TableRow({ children: [cellule(para(k, { bold: true, size: 16 }), { largeur: Math.round(c3 * 0.55), fond: FOND_LIBELLE }), cellule(para(v, { size: 16, align: 'right' }), { largeur: Math.round(c3 * 0.45) })] })), [Math.round(c3 * 0.55), Math.round(c3 * 0.45)])
      : para('');
    const droite = [];
    if (bas.net) {
      droite.push(tableau([
        new TableRow({ children: [cellule(para(bas.net[0], { bold: true, color: 'FFFFFF', size: 17 }), { largeur: c3, fond: couleur })] }),
        new TableRow({ children: [cellule(para(bas.net[1], { bold: true, size: 30, color: couleur, align: 'right' }), { largeur: c3 })] }),
      ], [c3]));
    }
    if (bas.reglement) { droite.push(para('', { after: 100 })); droite.push(tableau([new TableRow({ children: [cellule(para(bas.reglement, { size: 16, color: '666666', after: 300 }), { largeur: c3 })] })], [c3])); }
    if (!droite.length) droite.push(para(''));
    enfants.push(tableau([new TableRow({ children: [cellule(gauche, { sansBord: true, largeur: c3 }), cellule(milieu, { sansBord: true, largeur: c3 }), cellule(droite, { sansBord: true, largeur: L - 2 * c3 })] })], [c3, c3, L - 2 * c3]));
  } else if (bas.mentions) {
    enfants.push(tableau([new TableRow({ children: [cellule(texte(bas.mentions).split('\n').map(t => para(t, { size: 16, color: '333333' })), { largeur: L })] })], [L]));
  }

  if (spec.lettres) {
    enfants.push(para(spec.lettres.intro, { size: 18, before: 240 }));
    enfants.push(para(spec.lettres.texte, { bold: true, italics: true, size: 18 }));
  }
  if (spec.signatures && spec.signatures.length) {
    const ls = Math.floor(L / spec.signatures.length);
    enfants.push(para('', { after: 200 }));
    enfants.push(tableau([new TableRow({ height: { value: 1300, rule: 'atLeast' }, children: spec.signatures.map(t => cellule(para(t, { size: 16, color: '555555' }), { largeur: ls })) })], spec.signatures.map(() => ls)));
  }
  enfants.push(para('', { after: 260 }));
  enfants.push(tableau([new TableRow({ children: [
    cellule(para(spec.piedPage, { size: 16, color: '555555' }), { sansBord: true, largeur: L - 1500 }),
    cellule(para('Page 1/1', { size: 16, color: '555555', align: 'right' }), { sansBord: true, largeur: 1500 }),
  ] })], [L - 1500, 1500]));

  const doc = new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 720, right: 720 } } }, children: enfants }] });
  return Packer.toBuffer(doc);
}

async function buildDocumentXlsx(spec) {
  const couleur = couleurHex(spec.couleur);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TinOR ERP V3';
  const ws = wb.addWorksheet(String(spec.numero || 'Document').slice(0, 31), { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const cols = spec.colonnes || [];
  const nb = Math.max(cols.length, 6);
  ws.columns = Array.from({ length: nb }, (_, i) => ({ width: i === 0 ? 30 : 15 }));
  const plein = { type: 'pattern', pattern: 'solid' };
  const fusion = (r1, c1, r2, c2) => { if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2); };
  let r = enteteSocieteXlsx(wb, ws, { ...spec.societe, logo: spec.logo, couleur: spec.couleur }, nb);

  const num = ws.getCell(r, 1); num.value = spec.numero; num.font = { bold: true, size: 14 }; r++;
  fusion(r, 1, r, nb);
  const t = ws.getCell(r, 1); t.value = spec.titre; t.font = { bold: true, size: 17, color: { argb: `FF${couleur}` } }; t.alignment = { horizontal: 'center' };
  r += 2;

  // N° / Date / Commande (à gauche) — client (à droite)
  const debutInfos = r;
  (spec.refs || []).forEach(([l, v], i) => {
    const a = ws.getCell(r, 1 + i), b = ws.getCell(r + 1, 1 + i);
    a.value = l; a.font = { bold: true, size: 9 }; a.fill = { ...plein, fgColor: { argb: `FF${FOND_LIBELLE}` } }; a.border = bordsXlsx();
    b.value = String(v ?? '').replace(/<[^>]+>/g, ''); b.font = { size: 11 }; b.border = bordsXlsx();
  });
  const cl = spec.client || {};
  const colClient = Math.min(nb - 1, Math.max((spec.refs || []).length + 2, nb - 2));
  const lignesClient = [[`${cl.nom || ''}${cl.mention ? ' — ' + cl.mention : ''}`, true], ...(cl.lignes || []).map(([k, v]) => [`${k} : ${v}`, false])];
  lignesClient.forEach(([txt, gras], i) => {
    fusion(debutInfos + i, colClient, debutInfos + i, nb);
    const c = ws.getCell(debutInfos + i, colClient);
    c.value = txt; c.font = { bold: gras, size: gras ? 11 : 9 }; c.alignment = { horizontal: gras ? 'center' : 'left' };
    for (let k = colClient; k <= nb; k++) {
      ws.getCell(debutInfos + i, k).border = {
        top: i === 0 ? { style: 'thin' } : undefined, bottom: i === lignesClient.length - 1 ? { style: 'thin' } : undefined,
        left: k === colClient ? { style: 'thin' } : undefined, right: k === nb ? { style: 'thin' } : undefined };
    }
  });
  r = debutInfos + Math.max(lignesClient.length, 2) + 1;

  // Lignes
  cols.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = c.label; cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { ...plein, fgColor: { argb: `FF${couleur}` } }; cell.border = bordsXlsx();
    cell.alignment = { horizontal: c.num ? 'right' : 'left', vertical: 'middle', wrapText: true };
  });
  r++;
  (spec.lignes || []).forEach((l, n) => {
    l.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = String(v ?? '').replace(/<[^>]+>/g, '');
      cell.border = { left: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: cols[i] && cols[i].num ? 'right' : 'left', wrapText: true };
      if (n % 2) cell.fill = { ...plein, fgColor: { argb: 'FFFAFAF6' } };
    });
    r++;
  });
  if (spec.piedLignes) {
    // Comme le PDF : valeurs réparties sur la largeur (première à gauche, dernière à droite).
    const n = spec.piedLignes.length, nc = cols.length;
    spec.piedLignes.forEach((v, i) => {
      if (v === '') return;
      const col = n > 1 ? Math.round(i * (nc - 1) / (n - 1)) + 1 : 1;
      const c = ws.getCell(r, col); c.value = v; c.font = { bold: true };
      c.alignment = { horizontal: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center' };
    });
    for (let k = 1; k <= nc; k++) ws.getCell(r, k).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: k === 1 ? { style: 'thin' } : undefined, right: k === nc ? { style: 'thin' } : undefined };
    r++;
  }
  r++;

  // Bas
  const bas = spec.bas || {};
  const debutBas = r;
  let fin = r;
  if (bas.tva) {
    bas.tva.entetes.forEach((e, i) => { const c = ws.getCell(r, 1 + i); c.value = e; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { ...plein, fgColor: { argb: `FF${couleur}` } }; c.border = bordsXlsx(); c.alignment = { horizontal: 'center' }; });
    bas.tva.lignes.forEach((l, j) => l.forEach((v, i) => { const c = ws.getCell(r + 1 + j, 1 + i); c.value = v; c.border = bordsXlsx(); c.alignment = { horizontal: 'right' }; }));
    fin = Math.max(fin, r + bas.tva.lignes.length);
  } else if (bas.mentions) {
    const lignesM = texte(bas.mentions).split('\n');
    const hauteur = Math.max(lignesM.length, 3);
    const largeurM = bas.totaux || bas.net ? 2 : nb;
    fusion(r, 1, r + hauteur - 1, largeurM);
    const c = ws.getCell(r, 1); c.value = lignesM.join('\n'); c.alignment = { wrapText: true, vertical: 'top' }; c.font = { size: 9 };
    for (let i = 0; i < hauteur; i++) for (let k = 1; k <= largeurM; k++) ws.getCell(r + i, k).border = bordsXlsx();
    fin = Math.max(fin, r + hauteur - 1);
  }
  const colTot = nb - 3, colNet = nb - 1;
  (bas.totaux || []).forEach(([k, v], i) => {
    const a = ws.getCell(r + i, colTot), b = ws.getCell(r + i, colTot + 1);
    a.value = k; a.font = { bold: true, size: 9 }; a.fill = { ...plein, fgColor: { argb: `FF${FOND_LIBELLE}` } }; a.border = bordsXlsx();
    b.value = v; b.alignment = { horizontal: 'right' }; b.border = bordsXlsx();
    fin = Math.max(fin, r + i);
  });
  if (bas.net) {
    fusion(r, colNet, r, nb); fusion(r + 1, colNet, r + 2, nb);
    const a = ws.getCell(r, colNet); a.value = bas.net[0]; a.font = { bold: true, color: { argb: 'FFFFFFFF' } }; a.fill = { ...plein, fgColor: { argb: `FF${couleur}` } };
    const b = ws.getCell(r + 1, colNet); b.value = bas.net[1]; b.font = { bold: true, size: 15, color: { argb: `FF${couleur}` } }; b.alignment = { horizontal: 'right', vertical: 'middle' };
    for (let i = 0; i < 3; i++) for (let k = colNet; k <= nb; k++) ws.getCell(r + i, k).border = bordsXlsx();
    if (bas.reglement) {
      fusion(r + 4, colNet, r + 5, nb);
      const m = ws.getCell(r + 4, colNet); m.value = bas.reglement; m.font = { size: 9, color: { argb: 'FF666666' } }; m.alignment = { vertical: 'top' };
      for (let i = 4; i < 6; i++) for (let k = colNet; k <= nb; k++) ws.getCell(r + i, k).border = bordsXlsx();
      fin = Math.max(fin, r + 5);
    } else fin = Math.max(fin, r + 2);
  }
  r = Math.max(fin, debutBas) + 2;

  if (spec.lettres) {
    ws.getCell(r, 1).value = spec.lettres.intro; r++;
    fusion(r, 1, r, nb);
    const c = ws.getCell(r, 1); c.value = spec.lettres.texte; c.font = { bold: true, italic: true }; r += 2;
  }
  if (spec.signatures && spec.signatures.length) {
    const largeur = Math.floor(nb / spec.signatures.length);
    spec.signatures.forEach((s, i) => {
      const c1 = 1 + i * largeur, c2 = i === spec.signatures.length - 1 ? nb : c1 + largeur - 1;
      fusion(r, c1, r + 3, c2);
      const c = ws.getCell(r, c1); c.value = s; c.font = { size: 9, color: { argb: 'FF555555' } }; c.alignment = { vertical: 'top' };
      for (let i2 = 0; i2 < 4; i2++) for (let k = c1; k <= c2; k++) ws.getCell(r + i2, k).border = bordsXlsx();
    });
    r += 5;
  }
  r++;
  fusion(r, 1, r, nb - 1);
  const p = ws.getCell(r, 1); p.value = spec.piedPage; p.font = { size: 9, color: { argb: 'FF555555' } };
  const pg = ws.getCell(r, nb); pg.value = 'Page 1/1'; pg.font = { size: 9, color: { argb: 'FF555555' } }; pg.alignment = { horizontal: 'right' };
  for (let k = 1; k <= nb; k++) ws.getCell(r, k).border = { top: { style: 'thin' } };
  return wb.xlsx.writeBuffer();
}

module.exports = { buildXlsxBuffer, buildDocxBuffer, buildDocumentDocx, buildDocumentXlsx };
