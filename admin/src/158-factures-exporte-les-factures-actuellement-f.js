  // ---------- Factures — exporte les factures actuellement filtrées à l'écran ----------
  function facturesExporter(format) {
    const { headers, rows } = extraireTableauVisible('#view-factures .panel:last-child');
    telechargerExportGenerique('Liste des factures', 'Selon les filtres actifs', headers, rows, format, 'factures');
  }
  document.getElementById('facturesExportDocxBtn').addEventListener('click', () => facturesExporter('docx'));
  document.getElementById('facturesExportXlsxBtn').addEventListener('click', () => facturesExporter('xlsx'));
  document.getElementById('facturesExportPdfBtn').addEventListener('click', () => facturesExporter('pdf'));
  cablerFiltresTexteEtDate('factures', renderFactures);

