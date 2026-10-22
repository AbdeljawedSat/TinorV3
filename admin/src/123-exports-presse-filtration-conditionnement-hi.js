  // ---------- Exports (Presse/Filtration/Conditionnement/Historique) — exportent
  // exactement ce qui est affiché à l'écran (tableau déjà filtré) ----------
  function exporterVueProduction(panelSelector, titre, format) {
    const { headers, rows } = extraireTableauVisible(panelSelector);
    telechargerExportGenerique(titre, 'Selon les filtres actifs', headers, rows, format, titre.toLowerCase().replace(/\s+/g, '_'));
  }
  document.getElementById('presseExportDocxBtn').addEventListener('click', () => exporterVueProduction('#view-presse .panel:last-child', 'Lots de presse', 'docx'));
  document.getElementById('presseExportXlsxBtn').addEventListener('click', () => exporterVueProduction('#view-presse .panel:last-child', 'Lots de presse', 'xlsx'));
  document.getElementById('presseExportPdfBtn').addEventListener('click', () => exporterVueProduction('#view-presse .panel:last-child', 'Lots de presse', 'pdf'));

  document.getElementById('filtrationExportDocxBtn').addEventListener('click', () => exporterVueProduction('#view-filtration .panel:last-child', 'Filtration', 'docx'));
  document.getElementById('filtrationExportXlsxBtn').addEventListener('click', () => exporterVueProduction('#view-filtration .panel:last-child', 'Filtration', 'xlsx'));
  document.getElementById('filtrationExportPdfBtn').addEventListener('click', () => exporterVueProduction('#view-filtration .panel:last-child', 'Filtration', 'pdf'));

  document.getElementById('conditionnementExportDocxBtn').addEventListener('click', () => exporterVueProduction('#view-conditionnement .panel:last-child', 'Conditionnement', 'docx'));
  document.getElementById('conditionnementExportXlsxBtn').addEventListener('click', () => exporterVueProduction('#view-conditionnement .panel:last-child', 'Conditionnement', 'xlsx'));
  document.getElementById('conditionnementExportPdfBtn').addEventListener('click', () => exporterVueProduction('#view-conditionnement .panel:last-child', 'Conditionnement', 'pdf'));

  document.getElementById('historiqueExportDocxBtn').addEventListener('click', () => exporterVueProduction('#view-historique-prod .panel:last-child', 'Historique de production', 'docx'));
  document.getElementById('historiqueExportXlsxBtn').addEventListener('click', () => exporterVueProduction('#view-historique-prod .panel:last-child', 'Historique de production', 'xlsx'));
  document.getElementById('historiqueExportPdfBtn').addEventListener('click', () => exporterVueProduction('#view-historique-prod .panel:last-child', 'Historique de production', 'pdf'));

