  // ---------- Avoirs (V3.3) : une facture émise se corrige par un avoir ----------
  let AVOIR_FACTURE = null;
  function fermerAvoir() { document.getElementById('avoirOverlay').classList.remove('open'); }
  function avoirEstimer() {
    const f = AVOIR_FACTURE; if (!f) return;
    const fodec = Number(f.total_ht) > 0 ? Number(f.fodec_montant) / Number(f.total_ht) : 0;
    let total = 0, tout = true;
    document.querySelectorAll('#avoirLignes input').forEach(inp => {
      const l = f.lignes_avoirables.find(x => x.commande_ligne_id === Number(inp.dataset.id));
      const q = Number(inp.value) || 0;
      total += q * Number(l.unit_price) * (1 + fodec);
      if (Number(l.deja_avoir) + q < Number(l.qty) - 0.0005) tout = false;
    });
    // Dernier avoir qui reprend tout : il prend exactement le reliquat de la facture.
    if (tout) total = Number(f.total_ttc) - Number(f.total_avoirs);
    document.getElementById('avoirEstimation').textContent = fmtDT(total);
  }
  function avoirToutReprendre(oui) {
    document.querySelectorAll('#avoirLignes input').forEach(inp => { inp.value = oui ? inp.max : 0; });
    avoirEstimer();
  }
  async function ouvrirAvoir(factureId) {
    try {
      const f = await apiFetch(`/factures/${factureId}`);
      AVOIR_FACTURE = f;
      document.getElementById('avoirTitre').textContent = `Émettre un avoir — ${f.numero}`;
      document.getElementById('avoirSous').textContent = `${f.client_nom || ''} · facture de ${fmtDT(f.total_ttc)}${Number(f.total_avoirs) ? ` · déjà ${fmtDT(f.total_avoirs)} en avoir` : ''}`;
      document.getElementById('avoirLignes').innerHTML = f.lignes_avoirables.map(l => {
        const reste = Math.round((Number(l.qty) - Number(l.deja_avoir)) * 1000) / 1000;
        return `<tr><td>${esc(l.produit_nom)}<div class="rowMeta" style="font-size:11px;">${fmtDT(l.unit_price)} l'unité</div></td>
          <td class="num">${Number(l.qty)}</td><td class="num">${Number(l.deja_avoir) || '—'}</td>
          <td class="num"><input type="number" class="formInput" style="width:100px; text-align:right;" min="0" max="${reste}" step="any" value="0" data-id="${l.commande_ligne_id}" ${reste <= 0 ? 'disabled' : ''}></td></tr>`;
      }).join('');
      document.querySelectorAll('#avoirLignes input').forEach(inp => inp.addEventListener('input', avoirEstimer));
      document.getElementById('avoirStock').checked = true;
      document.getElementById('avoirMotif').value = '';
      document.getElementById('avoirErreur').style.display = 'none';
      avoirEstimer();
      document.getElementById('avoirOverlay').classList.add('open');
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  document.getElementById('avoirValider').addEventListener('click', async () => {
    const err = document.getElementById('avoirErreur');
    err.style.display = 'none';
    const lignes = Array.from(document.querySelectorAll('#avoirLignes input')).map(i => ({ commande_ligne_id: Number(i.dataset.id), qty: Number(i.value) || 0 })).filter(l => l.qty > 0);
    const motif = document.getElementById('avoirMotif').value.trim();
    if (!lignes.length) { err.textContent = 'Indiquez au moins une quantité à reprendre.'; err.style.display = 'block'; return; }
    if (!motif) { err.textContent = 'Le motif est obligatoire.'; err.style.display = 'block'; document.getElementById('avoirMotif').focus(); return; }
    try {
      const a = await apiFetch(`/factures/${AVOIR_FACTURE.id}/avoirs`, { method: 'POST', body: JSON.stringify({ lignes, motif, remise_en_stock: document.getElementById('avoirStock').checked }) });
      fermerAvoir();
      await rafraichirVentes();
      notifier(`Avoir ${a.numero} émis : ${fmtDT(a.total_ttc)}${a.reste_du < -0.0005 ? ` — crédit de ${fmtDT(-a.reste_du)} en faveur du client` : ''}.`, 'succes');
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  });
  function renderAvoirs() {
    const body = document.getElementById('avoirsBody');
    if (!body) return;
    const avoirs = APP_DATA.avoirs || [];
    if (!avoirs.length) { body.innerHTML = `<tr><td colspan="7" class="videAction">Aucun avoir : un avoir s'émet depuis une facture (menu ⋯ › Émettre un avoir).</td></tr>`; return; }
    body.innerHTML = avoirs.map(a => `
      <tr data-id="${a.id}">
        <td class="lotCode">${esc(a.numero)}</td>
        <td>${esc(a.client_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(a.date_emission)}</td>
        <td><span class="ficheLien" onclick="ouvrirFicheFacture(${a.facture_id})">${esc(a.facture_numero)}</span></td>
        <td class="rowMeta">${esc(a.motif)}${a.remise_en_stock ? '' : ' <span class="pill grey">sans retour</span>'}</td>
        <td class="num">${fmtDT(a.total_ttc)}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="imprimerAvoir(${a.id})">🖨 Imprimer</button></td>
      </tr>`).join('');
  }
  async function imprimerAvoir(id) {
    try {
      const a = await apiFetch(`/avoirs/${id}`);
      const s = APP_DATA.settings || {};
      const client = APP_DATA.clients.find(c => c.id === a.client_id) || {};
      const w = window.open('', `avoir_${id}_${Date.now()}`);
      if (!w) { notifier("Autorisez les pop-ups pour imprimer l'avoir."); return; }
      w.document.open();
      w.document.write(`<html><head><meta charset="UTF-8"><title>Avoir ${esc(a.numero)}</title><style>
        @page { size: A4; margin: 14mm; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
        .tete { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .5px; } .gris { color: #555; }
        .cadre { border: 1px solid #333; padding: 8px 12px; min-width: 220px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; } th, td { border-bottom: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #eef3ea; font-size: 11px; text-transform: uppercase; } .n { text-align: right; white-space: nowrap; }
        .tot { margin-left: auto; margin-top: 14px; width: 280px; } .tot div { display: flex; justify-content: space-between; padding: 3px 0; }
        .tot .fort { font-weight: bold; font-size: 14px; border-top: 1px solid #333; padding-top: 6px; }
      </style></head><body>
        <div class="tete">
          <div><b>${esc(s.entreprise_nom || '')}</b><div class="gris">${esc(s.entreprise_adresse || '')}</div>${s.entreprise_matricule_fiscal ? `<div class="gris">MF ${esc(s.entreprise_matricule_fiscal)}</div>` : ''}${s.entreprise_telephone ? `<div class="gris">Tél. ${esc(s.entreprise_telephone)}</div>` : ''}</div>
          <div class="cadre"><b>${esc(a.client_nom || '')}</b>${client.matricule_fiscal ? `<div class="gris">MF ${esc(client.matricule_fiscal)}</div>` : ''}${client.ville ? `<div class="gris">${esc(client.ville)}</div>` : ''}</div>
        </div>
        <h1>AVOIR N° ${esc(a.numero)}</h1>
        <div class="gris">Du ${fmtDate(a.date_emission)} — sur la facture ${esc(a.facture_numero)} du ${fmtDate(a.facture_date)}</div>
        <div style="margin-top:6px;">Motif : ${esc(a.motif)}</div>
        <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix TTC</th><th class="n">Total</th></tr></thead><tbody>
          ${a.lignes.map(l => `<tr><td>${esc(l.designation)}</td><td class="n">${Number(l.qty)}</td><td class="n">${fmtDT(l.unit_price)}</td><td class="n">${fmtDT(l.total)}</td></tr>`).join('')}
        </tbody></table>
        <div class="tot">
          <div><span>Total HT</span><span>${fmtDT(a.total_ht)}</span></div>
          ${Number(a.fodec_montant) ? `<div><span>FODEC</span><span>${fmtDT(a.fodec_montant)}</span></div>` : ''}
          <div><span>TVA (${Number(a.tva_rate)} %)</span><span>${fmtDT(a.montant_tva)}</span></div>
          ${Number(a.droit_timbre) ? `<div><span>Droit de timbre</span><span>${fmtDT(a.droit_timbre)}</span></div>` : ''}
          <div class="fort"><span>Total de l'avoir TTC</span><span>${fmtDT(a.total_ttc)}</span></div>
        </div>
        <script>window.onload = () => window.print();<\/script></body></html>`);
      w.document.close();
    } catch (err) { notifier(err.message, 'erreur'); }
  }

