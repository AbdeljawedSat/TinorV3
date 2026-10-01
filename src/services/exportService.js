// ============================================================================
// Génère de VRAIS fichiers .xlsx (exceljs) et .docx (docx) — pas des HTML
// renommés. Réutilisable par tous les écrans qui exposent un export
// (Stock, Commandes, Registre des lots, ...).
// ============================================================================
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, ShadingType, AlignmentType } = require('docx');

const BRASS = 'A97D2F';
const OLIVE = '17231D';

// headers: [{ key, label, width? }]  rows: [{ key: value, ... }]
async function buildXlsxBuffer(title, headers, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TinOR ERP V3';
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31) || 'Export');

  ws.columns = headers.map(h => ({ header: h.label, key: h.key, width: h.width || 20 }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${OLIVE}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  rows.forEach(r => {
    const row = ws.addRow(r);
    row.eachCell(cell => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
    });
  });

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  return wb.xlsx.writeBuffer();
}

// headers: [{ key, label }]  rows: [{ key: value, ... }]
async function buildDocxBuffer(title, subtitle, headers, rows) {
  const colWidth = Math.floor(9000 / headers.length);
  const headerCells = headers.map(h => new TableCell({
    width: { size: colWidth, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: OLIVE },
    children: [new Paragraph({ children: [new TextRun({ text: h.label, bold: true, color: 'FFFFFF', size: 18 })] })],
  }));
  const bodyRows = rows.map(r => new TableRow({
    children: headers.map(h => new TableCell({
      width: { size: colWidth, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: String(r[h.key] ?? ''), size: 18 })] })],
    })),
  }));

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 16838, height: 11906 }, orientation: 'landscape' } }, // A4 paysage — plus de place pour les colonnes
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true, color: OLIVE })] }),
        ...(subtitle ? [new Paragraph({ children: [new TextRun({ text: subtitle, italics: true, color: '666666', size: 20 })], spacing: { after: 200 } })] : []),
        new Paragraph({ children: [new TextRun({ text: `Généré le ${new Date().toLocaleDateString('fr-TN')} — ${rows.length} ligne${rows.length > 1 ? 's' : ''}`, size: 18, color: '888888' })], spacing: { after: 200 } }),
        new Table({
          columnWidths: headers.map(() => colWidth),
          width: { size: colWidth * headers.length, type: WidthType.DXA },
          rows: [new TableRow({ children: headerCells }), ...bodyRows],
        }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildXlsxBuffer, buildDocxBuffer };
