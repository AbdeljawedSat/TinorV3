  // ---------- Mouvements — exporte les mouvements actuellement filtrés à l'écran ----------
  function mouvementsExporter(format) {
    const { headers, rows } = extraireTableauVisible('#view-stock-mouvements .panel');
    telechargerExportGenerique('Mouvements de stock', 'Selon les filtres actifs', headers, rows, format, 'mouvements');
  }
  document.getElementById('mouvementsExportDocxBtn').addEventListener('click', () => mouvementsExporter('docx'));
  document.getElementById('mouvementsExportXlsxBtn').addEventListener('click', () => mouvementsExporter('xlsx'));
  document.getElementById('mouvementsExportPdfBtn').addEventListener('click', () => mouvementsExporter('pdf'));
  cablerFiltresTexteEtDate('mouvements', renderStockMouvements);

