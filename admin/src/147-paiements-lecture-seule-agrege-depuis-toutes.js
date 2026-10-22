  // ============================================================================
  // PAIEMENTS — lecture seule, agrégé depuis toutes les factures.
  // ============================================================================
  const MODE_PAIEMENT_LABEL = { especes: 'Espèces', cheque: 'Chèque', virement: 'Virement', carte: 'Carte', autre: 'Autre' };
  function renderPaiements() {
    const body = document.getElementById('paiementsBody');
    if (!body) return;
    if (!APP_DATA.paiements.length) { body.innerHTML = `<tr><td colspan="7" class="videAction">Aucun paiement enregistré : un paiement s'enregistre depuis une facture (Encaisser).</td></tr>`; return; }
    const paiementsVus = filtreVue('paiements', APP_DATA.paiements);
    if (!paiementsVus.length) { body.innerHTML = `<tr><td colspan="7" class="videAction">Aucun paiement dans cette vue.</td></tr>`; return; }
    body.innerHTML = paiementsVus.map(p => `
      <tr data-id="${p.id}"${p.annule_le ? ' class="ligneAnnulee"' : ''}>
        <td class="rowMeta num">${fmtDate(p.date_paiement)}</td>
        <td class="lotCode">${p.facture_numero || '—'}</td>
        <td>${esc(p.client_nom || '—')}</td>
        <td class="rowMeta">${MODE_PAIEMENT_LABEL[p.mode] || p.mode}</td>
        <td class="rowMeta">${esc(p.reference || '—')}</td>
        <td class="num"><span class="montant">${fmtDT(p.montant)}</span></td>
        <td class="rowActions">${p.annule_le
          ? `<span class="pill danger" title="${(p.annule_motif || '').replace(/"/g, '&quot;')}">Annulé</span><span class="rowMeta motifAnnul">${p.annule_motif || ''}</span>`
          : (isGerant() ? `<button class="rowActionBtn" onclick="annulerPaiement(${p.facture_id}, ${p.id})">Annuler…</button>` : '')}</td>
      </tr>`).join('');
  }

