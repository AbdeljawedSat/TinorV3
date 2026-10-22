  // ---------- Commandes — exporte les commandes actuellement filtrées à l'écran ----------
  function commandesExporter(format) {
    const { headers, rows } = extraireTableauVisible('#view-commandes .panel');
    telechargerExportGenerique('Liste des commandes', 'Selon les filtres actifs', headers, rows, format, 'commandes');
  }
  document.getElementById('commandesExportDocxBtn').addEventListener('click', () => commandesExporter('docx'));
  document.getElementById('commandesExportXlsxBtn').addEventListener('click', () => commandesExporter('xlsx'));
  document.getElementById('commandesExportPdfBtn').addEventListener('click', () => commandesExporter('pdf'));

