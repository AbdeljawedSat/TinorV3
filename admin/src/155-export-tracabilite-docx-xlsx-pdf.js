  // ---------- Export Traçabilité : DOCX / XLSX / PDF ----------
  function tracExportStatus(msg){
    const el = document.getElementById('tracExportStatus');
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(tracExportStatus._t);
    tracExportStatus._t = setTimeout(()=>{ el.style.opacity = '0'; }, 2200);
  }
  // ============================================================================
  // EXPORTS RÉELS (Stock, Commandes, Registre des lots) — DOCX/XLSX sont de
  // vrais fichiers binaires générés côté serveur (exceljs/docx), pas du HTML
  // déguisé. PDF reste côté client via l'impression navigateur (déjà un vrai
  // PDF natif, pas besoin de le refaire côté serveur).
  // ============================================================================
  async function telechargerExportReel(endpoint, format, nomFichier) {
    const res = await fetch(`${API_BASE}/exports/${endpoint}?format=${format}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) { notifier('Erreur lors de la génération du fichier.', 'erreur'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nomFichier}.${format}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // Impression PDF générique pour une liste (titre + colonnes + lignes) — même
  // thème visuel que les factures (couleur configurée, tableau propre).
  function imprimerListeGenerique(titre, colonnes, lignes, sousTitre = '') {
    const e = enteteSociete();
    const theadHtml = colonnes.map(c => `<th>${esc(c.label)}</th>`).join('');
    const tbodyHtml = lignes.map(l => `<tr>${colonnes.map(c => `<td>${esc(l[c.key] ?? '')}</td>`).join('')}</tr>`).join('');
    const w = window.open('', `export_print_${Date.now()}`);
    if (!w) { notifier('Autorisez les pop-ups pour imprimer.'); return; }
    w.document.open();
    w.document.write(`<html><head><meta charset="UTF-8"><title>${esc(titre)}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; color: #1a1a1a; }
        .soc { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; } .soc img { height: 64px; }
        .soc .nom { font-weight: bold; font-size: 13px; color: ${e.couleur}; } .soc .det { font-size: 10.5px; color: #333; line-height: 1.5; }
        h1 { font-size: 20px; color: ${e.couleur}; margin: 6px 0 2px; }
        .sous { font-size: 12px; color: #666; font-style: italic; }
        .meta { font-size: 11px; color: #888; margin: 2px 0 12px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: ${e.couleur}; color: #fff; text-align: left; padding: 6px 8px; font-size: 11.5px; border: 1px solid #333; }
        td { padding: 5px 8px; border: 1px solid #ddd; font-size: 12px; vertical-align: top; }
        tbody tr:nth-child(even) td { background: #fafaf6; }
      </style></head><body>
      <div class="soc">${e.logo ? `<img src="${e.logo}" alt="">` : ''}<div>${e.nom ? `<div class="nom">${esc(e.nom)}</div>` : ''}<div class="det">${e.lignes.map(esc).join('<br>')}</div></div></div>
      <h1>${esc(titre)}</h1>
      ${sousTitre ? `<div class="sous">${esc(sousTitre)}</div>` : ''}
      <div class="meta">Généré le ${new Date().toLocaleDateString('fr-TN')} — ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}</div>
      <table><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table>
      <script>window.onload = () => window.print();<\/script>
      </body></html>`);
    w.document.close();
  }

  // Traçabilité : la chaîne complète affichée, exportée comme toute liste
  // (même forme en PDF, Word et Excel).
  function tracExporter(format) {
    const numero = document.getElementById('tracLot').value;
    if (!TRAC_CURRENT_CHAIN.length) { tracExportStatus('⚠ Lancez d\'abord la recherche du lot'); return; }
    const headers = [['direction', 'Sens'], ['numero', 'N° lot'], ['produit', 'Produit'], ['origine', 'Origine'], ['date', 'Date'],
      ['qte_utilisee', 'Qté utilisée'], ['qte_produite', 'Qté produite']].map(([key, label]) => ({ key, label }));
    const rows = TRAC_CURRENT_CHAIN.map(r => Object.fromEntries(headers.map(h => [h.key, r[h.key] == null ? '—' : String(r[h.key])])));
    telechargerExportGenerique(`Traçabilité — Lot ${numero}`, 'Chaîne complète : amont (graines, presse, filtration) → lot → aval', headers, rows, format, `tracabilite_${numero}`);
    tracExportStatus(format === 'pdf' ? '✓ Aperçu PDF ouvert (imprimer → Enregistrer en PDF)' : `✓ Export ${format.toUpperCase()} généré`);
  }
  const tracExportDocx = () => tracExporter('docx');
  const tracExportXlsx = () => tracExporter('xlsx');
  const tracExportPdf = () => tracExporter('pdf');
  // Extrait le tableau HTML actuellement visible (en-têtes + lignes en texte
  // brut) — fonctionne pour n'importe quel onglet, y compris la Répartition
  // dont la structure de colonnes change dynamiquement.
  function extraireTableauVisible(panelSelector) {
    const panel = document.querySelector(panelSelector);
    const ths = [...panel.querySelectorAll('table thead th')];
    const headers = ths.map((th, i) => ({ key: `c${i}`, label: th.textContent.trim() }));
    const trs = [...panel.querySelectorAll('table tbody tr')];
    const rows = trs.map(tr => {
      const tds = [...tr.querySelectorAll('td')];
      const obj = {};
      tds.forEach((td, i) => { obj[`c${i}`] = td.textContent.trim(); });
      return obj;
    }).filter(r => Object.values(r).some(v => v)); // ignore les lignes "Aucune donnée"
    return { headers, rows };
  }
  async function telechargerExportGenerique(titre, sousTitre, headers, rows, format, nomFichier) {
    if (format === 'pdf') { imprimerListeGenerique(titre, headers, rows, sousTitre); return; }
    const res = await fetch(`${API_BASE}/exports/generique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ titre, sousTitre, headers, rows, format, entete: enteteSociete() }),
    });
    if (!res.ok) { notifier('Erreur lors de la génération du fichier.', 'erreur'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nomFichier}.${format}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById('tracExportDocxBtn').addEventListener('click', tracExportDocx);
  document.getElementById('tracExportXlsxBtn').addEventListener('click', tracExportXlsx);
  document.getElementById('tracExportPdfBtn').addEventListener('click', tracExportPdf);

