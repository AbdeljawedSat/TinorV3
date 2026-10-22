  // ============================================================================
  // PARAMÈTRES — édition du singleton settings (pas de création, un seul enregistrement).
  // ============================================================================
  function renderParametres() {
    if (!document.getElementById('paramSalaire') || !APP_DATA.settings) return;
    const s = APP_DATA.settings;
    document.getElementById('paramSalaire').value = s.salaire;
    document.getElementById('paramMarge').value = s.marge;
    document.getElementById('paramTva').value = s.tva;
    document.getElementById('paramFodecRate').value = s.fodec_rate;
    document.getElementById('paramDroitTimbre').value = s.droit_timbre;
    document.getElementById('paramTimbreSeuil').value = s.timbre_seuil;
    document.getElementById('paramLotFormatStyle').value = s.lot_format_style || 'code_origine_seq';
    document.getElementById('paramLotSeqParOrigine').checked = !!s.lot_seq_par_origine;
    document.getElementById('paramMatierePct').value = s.matiere_pct;
    document.getElementById('paramRendPct').value = s.rend_pct;
    document.getElementById('paramRefSource').value = s.ref_source;
    document.getElementById('paramOffreAchete').value = s.offre_achete;
    document.getElementById('paramOffreGratuit').value = s.offre_gratuit;
    document.getElementById('paramCumulerLot').checked = !!s.cumuler_lot;

    document.getElementById('paramEntrepriseNom').value = s.entreprise_nom || '';
    document.getElementById('paramEntrepriseAdresse').value = s.entreprise_adresse || '';
    document.getElementById('paramEntrepriseTelephone').value = s.entreprise_telephone || '';
    document.getElementById('paramEntrepriseEmail').value = s.entreprise_email || '';
    document.getElementById('paramEntrepriseMatriculeFiscal').value = s.entreprise_matricule_fiscal || '';
    document.getElementById('paramFactureCouleur').value = s.facture_couleur || '#17231D';
    const logoPreview = document.getElementById('paramLogoPreview');
    if (s.entreprise_logo) { logoPreview.src = s.entreprise_logo; logoPreview.style.display = 'block'; }
    else { logoPreview.style.display = 'none'; }
  }
  document.getElementById('parametresSaveBtn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('parametresFormError');
    const statusEl = document.getElementById('parametresFormStatus');
    errEl.style.display = 'none';
    const payload = {
      salaire: Number(document.getElementById('paramSalaire').value) || 0,
      marge: Number(document.getElementById('paramMarge').value) || 0,
      tva: Number(document.getElementById('paramTva').value) || 0,
      fodec_rate: Number(document.getElementById('paramFodecRate').value) || 0,
      droit_timbre: Number(document.getElementById('paramDroitTimbre').value) || 0,
      timbre_seuil: Number(document.getElementById('paramTimbreSeuil').value) || 0,
      lot_format_style: document.getElementById('paramLotFormatStyle').value,
      lot_seq_par_origine: document.getElementById('paramLotSeqParOrigine').checked,
      matiere_pct: Number(document.getElementById('paramMatierePct').value) || 0,
      rend_pct: Number(document.getElementById('paramRendPct').value) || 0,
      ref_source: document.getElementById('paramRefSource').value,
      offre_achete: Number(document.getElementById('paramOffreAchete').value) || 0,
      offre_gratuit: Number(document.getElementById('paramOffreGratuit').value) || 0,
      cumuler_lot: document.getElementById('paramCumulerLot').checked,
    };
    try {
      APP_DATA.settings = await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      statusEl.textContent = 'Enregistré.';
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

