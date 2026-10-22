  // ---------- Registre des lots — exporte les lots actuellement filtrés à l'écran ----------
  function lotsExporter(format) {
    const { headers, rows } = extraireTableauVisible('#view-lots .panel:last-child');
    telechargerExportGenerique('Registre des lots', 'Selon les filtres actifs', headers, rows, format, 'registre_lots');
  }
  document.getElementById('lotsExportDocxBtn').addEventListener('click', () => lotsExporter('docx'));
  document.getElementById('lotsExportXlsxBtn').addEventListener('click', () => lotsExporter('xlsx'));
  document.getElementById('lotsExportPdfBtn').addEventListener('click', () => lotsExporter('pdf'));
  cablerFiltresTexteEtDate('lots', renderLotsRegistre);
  document.getElementById('lotsFilterOrigine').addEventListener('change', renderLotsRegistre);
  document.getElementById('lotsFilterResetBtn').addEventListener('click', () => { document.getElementById('lotsFilterOrigine').value = ''; LOTS_TRI.cle = ''; LOTS_TRI.sens = 1; renderLotsRegistre(); });

