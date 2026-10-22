  // ---------- Impression / export de facture (DOCX, XLSX, PDF via impression) ----------
  // Mise en page commune des documents de vente (facture, BC, BL, pro forma) :
  // même en-tête, même tableau, mêmes totaux. Logo : celui des Paramètres, sinon
  // le logo Les Jardins de Jerba de l'application.
  function logoEntreprise() {
    const s = APP_DATA.settings || {};
    return s.entreprise_logo || document.querySelector('.brand img')?.src || '';
  }
  function cssDocumentVente() {
    return `
        @page { size: A4; margin: 10mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12.5px; color: #1a1a1a; margin: 0; padding: 0; }
        .factureDoc table { border-collapse: collapse; width: 100%; }
        .factureDoc .no-border td, .factureDoc .no-border th { border: none; }
        .factureDoc .bordered { border: 1px solid #333; }
        .factureDoc .headRow { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .factureDoc .companyBlock { display: flex; gap: 10px; align-items: flex-start; }
        .factureDoc .companyBlock img { height: 58px; width: auto; }
        .factureDoc .companyName { font-weight: bold; font-size: 13px; color: var(--couleur); }
        .factureDoc .companyDetail { font-size: 10.5px; color: #333; line-height: 1.5; }
        .factureDoc .factureNum { font-size: 15px; font-weight: bold; margin: 10px 0 2px; }
        .factureDoc .factureTitle { font-size: 19px; font-weight: bold; text-align: center; margin: 4px 0 14px; color: var(--couleur); }
        .factureDoc .infoRow { width: 100%; margin-bottom: 16px; }
        .factureDoc .lblCell { background: #eef3ea; font-weight: bold; border-right: 1px solid #333; border-bottom: 1px solid #333; padding: 4px 8px; font-size: 11px; }
        .factureDoc .clientBox { border: 1px solid #333; padding: 8px 12px; }
        .factureDoc .clientBox .nom { font-weight: bold; text-align: center; margin-bottom: 6px; font-size: 13px; }
        .factureDoc .clientBox div { font-size: 11px; margin: 2px 0; }
        .factureDoc thead.lignes th { background: var(--couleur); color: #fff; font-weight: bold; padding: 6px 8px; text-align: left; border: 1px solid #333; font-size: 11.5px; }
        .factureDoc tbody.lignes td { padding: 5px 8px; border-left: 1px solid #333; border-right: 1px solid #333; font-size: 12px; }
        .factureDoc tbody.lignes tr:nth-child(even) { background: #fafaf6; }
        .factureDoc .num { text-align: right; }
        .factureDoc .lignesWrap { border: 1px solid #333; border-top: none; min-height: 260px; }
        .factureDoc .lignesFoot { display: flex; justify-content: space-between; border: 1px solid #333; border-top: none; padding: 5px 8px; font-weight: bold; font-size: 12px; }
        .factureDoc .bottomGrid { width: 100%; margin-top: 16px; border-collapse: separate; }
        .factureDoc .tvaTable, .factureDoc .totauxTable { width: 100%; }
        .factureDoc .tvaTable th, .factureDoc .tvaTable td, .factureDoc .totauxTable td { border: 1px solid #333; padding: 5px 8px; font-size: 11px; }
        .factureDoc .tvaTable th { background: var(--couleur); color: #fff; }
        .factureDoc .totauxTable td:first-child { background: #eef3ea; font-weight: bold; width: 55%; }
        .factureDoc .etapeTable { margin-top: 16px; }
        .factureDoc .etapeTable th, .factureDoc .etapeTable td { border: 1px solid #333; padding: 6px 8px; font-size: 11.5px; }
        .factureDoc .etapeTable th { background: var(--couleur); color: #fff; text-align: left; }
        .factureDoc .etapeTable td:first-child { font-weight: 600; width: 22%; }
        .factureDoc .etapeTable td:nth-child(2) { color: #555; width: 45%; }
        .factureDoc .netAPayer { border: 1px solid #333; }
        .factureDoc .netAPayer .lbl { background: var(--couleur); color: #fff; font-weight: bold; padding: 6px 8px; font-size: 11px; }
        .factureDoc .netAPayer .val { padding: 10px 8px; font-size: 17px; font-weight: bold; color: var(--couleur); text-align: right; }
        .factureDoc .modeReglement { border: 1px solid #333; margin-top: 8px; padding: 10px; min-height: 44px; font-size: 11px; color: #666; }
        .factureDoc .lettres { margin-top: 16px; font-size: 12px; }
        .factureDoc .lettres b { font-style: italic; }
        .factureDoc .pageFooter { display: flex; justify-content: space-between; border-top: 1px solid #333; margin-top: 22px; padding-top: 6px; font-size: 10.5px; color: #555; }
        .factureDoc { --couleur: ${(APP_DATA.settings || {}).facture_couleur || '#17231D'}; }
        .factureDoc .companyBlock img { height: 64px; }
        .factureDoc .refsTable td { border-right: 1px solid #333; padding: 6px 8px; }
        .factureDoc .refsTable td:last-child { border-right: none; }
        .factureDoc .mentionsBox { border: 1px solid #333; padding: 8px 10px; font-size: 11px; color: #333; white-space: pre-line; min-height: 60px; }
        .factureDoc .signatures { display: flex; gap: 16px; margin-top: 18px; }
        .factureDoc .signatures div { flex: 1; border: 1px solid #333; height: 86px; padding: 6px 8px; font-size: 11px; color: #555; }
        .filigrane { position: fixed; top: 40%; left: 0; right: 0; text-align: center; transform: rotate(-24deg); font-size: 80px; font-weight: 900; color: rgba(191,83,47,.13); pointer-events: none; }`;
  }
