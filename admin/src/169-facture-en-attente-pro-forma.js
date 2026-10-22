  // ---------- Facture en attente (pro forma) ----------
  let PROFORMA = null;
  async function facturerEnAttente(commandeId) {
    const c = APP_DATA.commandes.find(x => x.id === commandeId);
    if (c && c.proforma_id) return ouvrirProforma(c.proforma_id);
    try {
      const p = await apiFetch('/proformas', { method: 'POST', body: JSON.stringify({ commande_id: commandeId, employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null }) });
      await rafraichirVentes();
      if (p.hors_ligne) return;
      notifier(`Facture en attente ${p.numero} préparée : ajustez les prix si besoin, imprimez-la, puis validez.`, 'succes');
      ouvrirProforma(p.id);
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function ouvrirProforma(id) {
    try {
      const p = await apiFetch(`/proformas/${id}`);
      PROFORMA = p;
      const modifiable = p.statut === 'en_attente';
      document.getElementById('proformaTitre').textContent = `Facture en attente ${p.numero}`;
      document.getElementById('proformaSous').textContent = `${p.client_nom || ''} · commande ${p.commande_numero} · pro forma sans valeur comptable`;
      document.getElementById('proformaNotes').value = p.notes || '';
      document.getElementById('proformaNotes').disabled = !modifiable;
      document.getElementById('proformaErreur').style.display = 'none';
      document.getElementById('proformaLignes').innerHTML = p.lignes.map(l => `<tr data-ligne="${l.id}">
        <td>${esc(l.designation)}</td><td class="num">${Number(l.qty)}</td>
        <td><input type="number" class="formInput proPrix" min="0" step="0.001" value="${Number(l.unit_price)}" ${modifiable ? '' : 'disabled'} style="width:110px; margin:0;"></td>
        <td class="num proTotal">${fmtDT(l.total)}</td></tr>`).join('');
      majTotauxProforma();
      ['proformaEnregistrer', 'proformaValider', 'proformaSupprimer'].forEach(b => { document.getElementById(b).style.display = modifiable ? '' : 'none'; });
      document.getElementById('proformaOverlay').classList.add('open');
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  function majTotauxProforma() {
    let ttc = 0;
    document.querySelectorAll('#proformaLignes tr[data-ligne]').forEach(tr => {
      const l = PROFORMA.lignes.find(x => x.id === Number(tr.dataset.ligne));
      const t = Math.round(Number(l.qty) * (Number(tr.querySelector('.proPrix').value) || 0) * 1000) / 1000;
      tr.querySelector('.proTotal').textContent = fmtDT(t);
      ttc += t;
    });
    const modifie = Math.abs(ttc - PROFORMA.lignes.reduce((s, l) => s + Number(l.total), 0)) > 0.0005;
    document.getElementById('proformaTotaux').innerHTML = modifie
      ? `Total des lignes : <b>${fmtDT(ttc)}</b> <span class="rowMeta">(HT, FODEC, TVA et timbre recalculés à l'enregistrement)</span>`
      : `Total HT ${fmtDT(PROFORMA.total_ht)} · TVA ${fmtDT(PROFORMA.montant_tva)}${Number(PROFORMA.droit_timbre) ? ' · timbre ' + fmtDT(PROFORMA.droit_timbre) : ''} · <b>Total TTC ${fmtDT(PROFORMA.total_ttc)}</b>`;
  }
  document.getElementById('proformaLignes').addEventListener('input', majTotauxProforma);
  async function enregistrerProforma(silencieux) {
    const lignes = [...document.querySelectorAll('#proformaLignes tr[data-ligne]')].map(tr => ({ id: Number(tr.dataset.ligne), unit_price: Number(tr.querySelector('.proPrix').value) }));
    const p = await apiFetch(`/proformas/${PROFORMA.id}`, { method: 'PUT', body: JSON.stringify({ notes: document.getElementById('proformaNotes').value.trim() || null, lignes }) });
    if (!p.hors_ligne) { PROFORMA = p; majTotauxProforma(); }
    if (!silencieux) notifier(p.hors_ligne ? 'Modification enregistrée hors ligne : elle partira au retour du réseau.' : `${PROFORMA.numero} enregistrée.`, 'succes');
    await rafraichirVentes();
  }
  document.getElementById('proformaEnregistrer').addEventListener('click', async () => {
    try { await enregistrerProforma(false); } catch (e) { const er = document.getElementById('proformaErreur'); er.textContent = e.message; er.style.display = 'block'; }
  });
  document.getElementById('proformaImprimer').addEventListener('click', async () => {
    try { if (PROFORMA.statut === 'en_attente') await enregistrerProforma(true); imprimerProforma(PROFORMA.id); } catch (e) { notifier(e.message, 'erreur'); }
  });
  document.getElementById('proformaValider').addEventListener('click', async () => {
    const er = document.getElementById('proformaErreur');
    er.style.display = 'none';
    try {
      await enregistrerProforma(true);
      const ok = await confirmer(`La facture définitive est émise avec un numéro légal (FAC-…) et les prix de ${PROFORMA.numero}. Ce qui n'est pas encore livré l'est par un bon de livraison automatique. Elle ne sera plus modifiable (correction par avoir).`,
        { titre: `Valider ${PROFORMA.numero} ?`, ok: 'Émettre la facture' });
      if (!ok) return;
      const f = await apiFetch(`/proformas/${PROFORMA.id}/valider`, { method: 'POST', body: JSON.stringify({ employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null }) });
      document.getElementById('proformaOverlay').classList.remove('open');
      await rafraichirVentes();
      notifier(`Facture ${f.numero} émise.`, 'succes');
      if (await confirmer(`Imprimer la facture ${f.numero} maintenant ?`, { titre: 'Facture émise', ok: 'Imprimer', non: 'Plus tard' })) imprimerFacture(f.id);
    } catch (e) { er.textContent = e.message; er.style.display = 'block'; }
  });
  document.getElementById('proformaSupprimer').addEventListener('click', async () => {
    if (!(await confirmer(`${PROFORMA.numero} sera annulée (la commande n'est pas touchée).`, { titre: 'Annuler la facture en attente ?', ok: 'Annuler la pro forma', non: 'Garder', danger: true }))) return;
    try { await apiFetch(`/proformas/${PROFORMA.id}/annuler`, { method: 'POST', body: '{}' }); document.getElementById('proformaOverlay').classList.remove('open'); await rafraichirVentes(); }
    catch (e) { notifier(e.message, 'erreur'); }
  });
  ['proformaFermer'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('proformaOverlay').classList.remove('open')));

