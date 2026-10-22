  // ---------- Documents de vente : UNE description (« spec ») par document ----------
  // La même spec produit l'impression PDF (htmlDepuisSpec) et les fichiers Word /
  // Excel (générés par le serveur) : les trois formats ont la même forme.
  const sansDT = (v) => fmtDT(v).replace(' DT', '');
  function enteteSociete() {
    const s = APP_DATA.settings || {};
    const contact = [s.entreprise_telephone ? `Tél : ${s.entreprise_telephone}` : '', s.entreprise_email || ''].filter(Boolean).join(' — ');
    return { couleur: s.facture_couleur || '#17231D', logo: logoEntreprise(), nom: s.entreprise_nom || '',
      lignes: [s.entreprise_adresse || '', contact, s.entreprise_matricule_fiscal ? `MF : ${s.entreprise_matricule_fiscal}` : ''].filter(Boolean) };
  }
  function clientSpec(clientId, nom, mention) {
    const c = APP_DATA.clients.find(x => x.id === clientId) || {}; // coordonnées à jour, pas figées
    return { nom: nom || c.nom || '', mention: mention || '', lignes: [['Matricule fiscal', c.matricule_fiscal || '—'], ['Adresse', c.ville || '—'], ['Téléphone', c.tel || '—']] };
  }
  function specFacture(f) {
    const e = enteteSociete();
    const lignes = f.lignes.map(l => {
      const tvaF = 1 + Number(f.tva_rate) / 100;
      const prixTtcCatalogue = Number(l.prix_detail || l.unit_price); // Prix TTC catalogue (avant remise)
      const prixTtcFacture = Number(l.unit_price);                     // Prix TTC facturé (après remise)
      const puHtFacture = prixTtcFacture / tvaF;                       // PU HT (facturé) = Prix TTC facturé / (1+TVA)
      return [l.designation, l.qty, sansDT(prixTtcCatalogue), l.remise_pct ? `${l.remise_pct}%` : '—', sansDT(prixTtcFacture), sansDT(puHtFacture), sansDT(puHtFacture * Number(l.qty))];
    });
    const baseTva = Number(f.total_ht) + Number(f.fodec_montant || 0);
    // Total remise = ce que la remise par ligne a fait économiser au client.
    const totalRemise = f.lignes.reduce((sum, l) => sum + (Number(l.prix_detail || l.unit_price) - Number(l.unit_price)) * Number(l.qty), 0);
    return {
      couleur: e.couleur, logo: e.logo, societe: { nom: e.nom, lignes: e.lignes },
      numero: f.numero, titre: 'Facture',
      refs: [['N°', f.numero], ['Date', fmtDate(f.date_emission)]],
      client: clientSpec(f.client_id, f.client_nom, f.statut === 'annulee' ? 'ANNULÉE' : ''),
      colonnes: [{ label: 'Désignation' }, { label: 'Qté', num: 1 }, { label: 'Prix TTC catalogue', num: 1 }, { label: 'Remise (%)', num: 1 },
        { label: 'Prix TTC facturé', num: 1 }, { label: 'PU HT (facturé)', num: 1 }, { label: 'Total HT', num: 1 }],
      lignes,
      piedLignes: [String(f.lignes.length), `${f.tva_rate},00`, '', sansDT(f.total_ht)],
      bas: {
        tva: { entetes: ['Base', 'Taux TVA', 'Montant TVA'], lignes: [[sansDT(baseTva), `${f.tva_rate},000`, sansDT(f.montant_tva)]] },
        totaux: [...(totalRemise > 0 ? [['Total remise', `−${sansDT(totalRemise)}`]] : []), ['Total HT', sansDT(f.total_ht)], ['FODEC', sansDT(f.fodec_montant)],
          ['Total TVA', sansDT(f.montant_tva)], ['Timbre', sansDT(f.droit_timbre)]],
        net: ['Net à payer', sansDT(f.total_ttc)], reglement: 'Mode règlement',
      },
      lettres: { intro: 'Arrêtée la présente à la somme de :', texte: montantEnLettres(f.total_ttc) },
      piedPage: `Facture N° ${f.numero} pour ${f.client_nom}`,
    };
  }
  // Rendu HTML (PDF) d'une spec — mêmes classes que la facture.
  function htmlDepuisSpec(sp) {
    const bas = sp.bas || {};
    const ligneClient = (sp.client.lignes || []).map(([k, v]) => `<div><b>${esc(k)} :</b> ${esc(v)}</div>`).join('');
    const blocTotaux = (bas.totaux || []).length ? `<table class="totauxTable">${bas.totaux.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`).join('')}</table>` : '';
    const blocNet = bas.net ? `<div class="netAPayer"><div class="lbl">${bas.net[0]}</div><div class="val">${bas.net[1]}</div></div>${bas.reglement ? `<div class="modeReglement">${esc(bas.reglement)}</div>` : ''}` : '';
    const blocGauche = bas.tva
      ? `<table class="tvaTable"><thead><tr>${bas.tva.entetes.map(e => `<th>${e}</th>`).join('')}</tr></thead><tbody>${bas.tva.lignes.map(l => `<tr>${l.map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : `<div class="mentionsBox">${bas.mentions || ''}</div>`;
    return `
      <div class="factureDoc">
        <div class="headRow"><div class="companyBlock">
          ${sp.logo ? `<img src="${sp.logo}" alt="">` : ''}
          <div>${sp.societe.nom ? `<div class="companyName">${esc(sp.societe.nom)}</div>` : ''}
            <div class="companyDetail">${sp.societe.lignes.map(esc).join('<br>')}</div></div>
        </div></div>
        <div class="factureNum">${esc(sp.numero)}</div>
        <div class="factureTitle">${esc(sp.titre)}</div>
        <table class="infoRow"><tr>
          <td style="width:40%; vertical-align:top; padding-right:14px;">
            <table class="bordered no-border refsTable">
              <tr>${sp.refs.map(([l]) => `<td class="lblCell">${l}</td>`).join('')}</tr>
              <tr>${sp.refs.map(([, v]) => `<td>${v}</td>`).join('')}</tr>
            </table>
          </td>
          <td style="vertical-align:top;"><div class="clientBox">
            <div class="nom">${esc(sp.client.nom)}${sp.client.mention ? ` — <span style="color:#a23b2e;">${esc(sp.client.mention)}</span>` : ''}</div>${ligneClient}
          </div></td>
        </tr></table>
        <div class="lignesWrap"><table>
          <thead class="lignes"><tr>${sp.colonnes.map((c, i) => `<th${c.num ? ' class="num"' : ''}${i === 0 ? ` style="width:${sp.colonnes.length > 4 ? 26 : 34}%;"` : ''}>${c.label}</th>`).join('')}</tr></thead>
          <tbody class="lignes">${sp.lignes.map(l => `<tr>${l.map((v, i) => `<td${sp.colonnes[i] && sp.colonnes[i].num ? ' class="num"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        ${sp.piedLignes ? `<div class="lignesFoot">${sp.piedLignes.map(v => `<span>${v}</span>`).join('')}</div>` : ''}
        ${bas.totaux || bas.net || bas.tva ? `<table class="bottomGrid"><tr>
          <td style="width:34%; vertical-align:top; padding-right:10px;">${blocGauche}</td>
          <td style="width:33%; vertical-align:top; padding-right:10px;">${blocTotaux}</td>
          <td style="width:33%; vertical-align:top;">${blocNet}</td>
        </tr></table>` : (bas.mentions ? `<div class="mentionsBox" style="margin-top:16px;">${bas.mentions}</div>` : '')}
        ${sp.lettres ? `<div class="lettres">${sp.lettres.intro}<br><b>${sp.lettres.texte}</b></div>` : ''}
        ${sp.signatures ? `<div class="signatures">${sp.signatures.map(t => `<div>${t}</div>`).join('')}</div>` : ''}
        <div class="pageFooter"><span>${esc(sp.piedPage)}</span><span>Page 1/1</span></div>
      </div>`;
  }
  function factureHtmlContent(f) { return htmlDepuisSpec(specFacture(f)); }
  // Word / Excel d'un document : fichier généré par le serveur à partir de la même spec.
  async function exporterDocument(spec, format) {
    try {
      const corps = { ...spec, lignes: spec.lignes.map(l => l.map(v => String(v ?? '').replace(/<[^>]+>/g, '')))};
      const res = await fetch(`${API_BASE}/exports/document`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ spec: corps, format }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erreur HTTP ${res.status}`);
      telechargerBlob(await res.blob(), `${spec.titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_')}_${spec.numero}.${format}`);
    } catch (err) { notifier(`Export impossible : ${err.message}`, 'erreur'); }
  }
  function telechargerBlob(blob, nom) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function imprimerFacture(factureId) {
    const f = await apiFetch(`/factures/${factureId}`);
    // Nom de fenêtre unique à chaque appel — "_blank" seul peut, sur certains
    // navigateurs, réutiliser une fenêtre déjà ouverte (contenu d'une
    // impression précédente resté en mémoire au lieu d'être remplacé).
    const w = window.open('', `facture_print_${factureId}_${Date.now()}`);
    if (!w) { notifier('Autorisez les pop-ups pour imprimer la facture.'); return; }
    w.document.open(); // vide explicitement tout contenu déjà présent avant d'écrire
    w.document.write(`<html><head><meta charset="UTF-8"><title>Facture ${esc(f.numero)}</title>
      <style>${cssDocumentVente()}      </style></head><body>${factureHtmlContent(f)}
      <script>window.onload = () => window.print();<\/script>
      </body></html>`);
    w.document.close();
  }
  async function exportFactureDocx(factureId) { exporterDocument(specFacture(await apiFetch(`/factures/${factureId}`)), 'docx'); }
  async function exportFactureXlsx(factureId) { exporterDocument(specFacture(await apiFetch(`/factures/${factureId}`)), 'xlsx'); }

  async function emettreFacture(commandeId) {
    try {
      await apiFetch('/factures', { method: 'POST', body: JSON.stringify({ commande_id: commandeId }) });
      await rafraichirVentes(); // la facture peut créer un BL automatique ; compteurs et fil de la vente suivent
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  function openPaiementModal(factureId) {
    const f = APP_DATA.factures.find(x => x.id === factureId);
    document.getElementById('paiementFormError').style.display = 'none';
    document.getElementById('paiementFactureId').value = factureId;
    document.getElementById('paiementModalTitle').textContent = `Paiement — ${f ? f.numero : ''} (solde ${f ? fmtDT(f.solde) : ''})`;
    document.getElementById('paiementDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('paiementMontant').value = f ? f.solde : '';
    document.getElementById('paiementReference').value = '';
    document.getElementById('paiementModalOverlay').classList.add('open');
  }
  function closePaiementModal() { document.getElementById('paiementModalOverlay').classList.remove('open'); }

  async function savePaiement() {
    const errEl = document.getElementById('paiementFormError');
    errEl.style.display = 'none';
    const factureId = document.getElementById('paiementFactureId').value;
    const payload = {
      date_paiement: document.getElementById('paiementDate').value,
      montant: Number(document.getElementById('paiementMontant').value) || null,
      mode: document.getElementById('paiementMode').value,
      reference: document.getElementById('paiementReference').value.trim() || null,
    };
    if (!payload.date_paiement || !payload.montant) {
      errEl.textContent = 'Date et montant sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      await apiFetch(`/factures/${factureId}/paiements`, { method: 'POST', body: JSON.stringify(payload) });
      closePaiementModal();
      await rafraichirVentes(); // le statut de la commande suit le paiement (« payée » une fois soldée)
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('paiementSaveBtn').addEventListener('click', savePaiement);
  document.getElementById('paiementCancelBtn').addEventListener('click', closePaiementModal);
  document.getElementById('paiementModalCloseBtn').addEventListener('click', closePaiementModal);

  async function rafraichirVentes() {
    const cles = [['factures', '/factures'], ['commandes', '/commandes'], ['paiements', '/paiements'], ['avoirs', '/avoirs'], ['clients', '/clients'],
      ['lots', '/lots'], ['produits', '/produits'], ['notifications', '/notifications'], ['livraisons', '/livraisons'], ['proformas', '/proformas']];
    const res = await Promise.all(cles.map(([, u]) => apiFetch(u)));
    cles.forEach(([k], i) => { APP_DATA[k] = res[i]; });
    [renderFactures, renderCommandes, renderPaiements, renderAvoirs, renderLivraisons, renderProformas, renderClients, renderLotsRegistre, renderProduits, renderDashboard]
      .forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    if (TOKEN) majBadgesMenu();
  }
  async function annulerCommande(id) {
    const c = APP_DATA.commandes.find(x => x.id === id);
    if (!c) return;
    const motif = await confirmer('Le stock sorti pour cette commande est remis en stock. La commande reste visible, marquée « Annulée ».',
      { titre: `Annuler la commande ${c.numero} ?`, ok: 'Annuler la commande', non: 'Garder la commande', danger: true,
        saisie: { label: 'Motif (obligatoire)', placeholder: 'ex. client qui renonce, erreur de saisie…' } });
    if (!motif) return;
    try {
      await apiFetch(`/commandes/${id}/annuler`, { method: 'POST', body: JSON.stringify({ motif }) });
      await rafraichirVentes();
      notifier(`Commande ${c.numero} annulée — stock réintégré.`, 'succes');
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function annulerPaiement(factureId, paiementId) {
    const p = APP_DATA.paiements.find(x => x.id === paiementId);
    if (!p) return;
    const motif = await confirmer(`Paiement de ${fmtDT(p.montant)} du ${fmtDate(p.date_paiement)} sur la facture ${p.facture_numero}.\nIl restera visible, barré, avec son motif, et ne comptera plus dans le total payé.`,
      { titre: 'Annuler ce paiement ?', ok: 'Annuler le paiement', non: 'Garder le paiement', danger: true,
        saisie: { label: 'Motif (obligatoire)', placeholder: 'ex. remboursement au client, erreur de montant…' } });
    if (!motif) return;
    try {
      await apiFetch(`/factures/${factureId}/paiements/${paiementId}/annuler`, { method: 'POST', body: JSON.stringify({ motif }) });
      await rafraichirVentes();
      notifier('Paiement annulé.', 'succes');
    } catch (err) { notifier(err.message, 'erreur'); }
  }
