  // ---------- Reprise du stock existant (V3.3) ----------
  // Fichier Excel / CSV → aperçu contrôlé par le serveur → import tout ou rien.
  const REPRISE = { nom: '', lignes: [], ignorees: new Set() };
  const ETAPE_LIB = { MP: 'Matière première', PRESSE: 'Presse (vrac)', FILTRATION: 'Filtration', CONDITIONNEMENT: 'Produit fini', AUTRE: 'Autre' };
  const BIO_LIB = { BIO: 'Bio', NON_BIO: 'Non bio', EN_CONVERSION: 'Conversion', A_VERIFIER: 'À vérifier' };
  async function chargerReprises() {
    const sel = document.getElementById('repriseLocal');
    if (!sel.options.length) sel.innerHTML = '<option value="">— Aucun —</option>' + (APP_DATA.locaux || []).map(l => `<option value="${l.id}">${esc(l.nom)}</option>`).join('');
    const d = document.getElementById('repriseDate'); if (!d.value) d.value = isoLocal(new Date());
    try {
      const liste = await apiFetch('/reprises');
      const body = document.getElementById('reprisesBody');
      body.innerHTML = liste.length ? liste.map(r => `<tr data-id="${r.id}"${r.annulee_le ? ' class="ligneAnnulee"' : ''}>
        <td class="lotCode">${esc(r.numero)}</td><td class="rowMeta num">${fmtDate(r.date_reprise)}</td><td class="rowMeta">${esc(r.fichier || '—')}</td>
        <td class="num">${r.annulee_le ? r.nb_lots : r.nb_lots_restants}</td><td class="rowMeta">${esc([r.employe_prenom, r.employe_nom].filter(Boolean).join(' ') || '—')}</td>
        <td>${r.annulee_le ? `<span class="pill danger">Annulée</span><div class="rowMeta" style="font-size:11px;">${esc(r.annule_motif || '')}</div>` : '<span class="pill good">Importée</span>'}</td>
        <td class="rowActions">${r.annulee_le || !isGerant() ? '' : `<button class="rowActionBtn danger" onclick="annulerReprise(${r.id})">Annuler…</button>`}</td></tr>`).join('')
        : '<tr><td colspan="7" class="videAction">Aucune reprise pour le moment.</td></tr>';
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function analyserReprise(corps) {
    try {
      const r = await apiFetch('/reprises/analyser', { method: 'POST', body: JSON.stringify({ ...corps, local_id_defaut: Number(document.getElementById('repriseLocal').value) || null }) });
      REPRISE.lignes = r.lignes;
      renderApercuReprise();
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  function lireFichierReprise(fichier) {
    if (!fichier) return;
    REPRISE.nom = fichier.name; REPRISE.ignorees = new Set();
    const lecteur = new FileReader();
    lecteur.onload = () => analyserReprise({ nom_fichier: fichier.name, fichier_base64: String(lecteur.result).split(',')[1] || '' });
    lecteur.readAsDataURL(fichier);
  }
  function renderApercuReprise() {
    const lignes = REPRISE.lignes;
    const actives = lignes.filter(l => !REPRISE.ignorees.has(l.ligne));
    const ko = actives.filter(l => l.erreurs.length).length, ok = actives.length - ko;
    document.getElementById('repriseApercu').style.display = '';
    document.getElementById('repriseApercuTitre').textContent = `Aperçu — ${esc(REPRISE.nom || 'fichier')}`;
    document.getElementById('repriseApercuSub').innerHTML = `<b style="color:var(--good);">${ok} prête${ok > 1 ? 's' : ''}</b>${ko ? ` · <b style="color:var(--danger);">${ko} à corriger</b> (choisissez le produit, ou cochez « Ignorer »)` : ''}${REPRISE.ignorees.size ? ` · ${REPRISE.ignorees.size} ignorée(s)` : ''} · rien n'est enregistré avant « Importer »`;
    const btn = document.getElementById('repriseImporterBtn');
    btn.textContent = `Importer ${ok} lot${ok > 1 ? 's' : ''}`;
    btn.disabled = !!ko || !ok;
    const options = (id) => `<option value="">— Choisir le produit —</option>` + APP_DATA.produits.map(p => `<option value="${p.id}"${p.id === id ? ' selected' : ''}>${esc(p.code)} — ${esc(p.nom)}</option>`).join('');
    document.getElementById('repriseLignes').innerHTML = lignes.map(l => {
      const ignoree = REPRISE.ignorees.has(l.ligne);
      const produitKo = l.erreurs.some(e => /Produit/.test(e));
      return `<tr class="${ignoree ? 'ignoree' : l.erreurs.length ? 'erreur' : ''}">
        <td class="rowMeta num">${l.ligne}</td><td class="lotCode">${esc(l.numero_lot || '—')}</td>
        <td>${produitKo ? `<div class="rowMeta" style="font-size:11px;">« ${esc(l.produit_saisi)} »</div><select data-ligne="${l.ligne}" class="repriseProduit formInput">${options(l.produit_id)}</select>` : esc(l.produit_nom)}</td>
        <td class="num">${l.quantite ?? '—'} ${esc(l.unite || '')}</td><td class="rowMeta">${ETAPE_LIB[l.etape] || '—'}</td>
        <td class="rowMeta num">${l.date_production ? fmtDate(l.date_production) : '—'}</td><td class="rowMeta num">${l.date_expiration ? fmtDate(l.date_expiration) : '—'}</td>
        <td class="rowMeta">${esc(l.local_nom || '—')}</td><td class="rowMeta">${BIO_LIB[l.bio_status] || ''}</td>
        <td>${l.erreurs.length ? `<span class="ctlKo">✗ ${l.erreurs.map(esc).join(' · ')}</span>` : '<span class="ctlOk">✓ prêt</span>'}${l.avertissements.length ? `<div class="ctlAv">⚠ ${l.avertissements.map(esc).join(' · ')}</div>` : ''}</td>
        <td><input type="checkbox" data-ignorer="${l.ligne}"${ignoree ? ' checked' : ''}></td></tr>`;
    }).join('');
  }
  document.getElementById('repriseLignes').addEventListener('change', (e) => {
    const sel = e.target.closest('.repriseProduit');
    if (sel) {
      const l = REPRISE.lignes.find(x => x.ligne === Number(sel.dataset.ligne));
      l.produit_id = Number(sel.value) || null; delete l.produit;
      return analyserReprise({ lignes: REPRISE.lignes }); // recontrôle avec le produit choisi
    }
    const ign = e.target.closest('[data-ignorer]');
    if (ign) { const n = Number(ign.dataset.ignorer); if (ign.checked) REPRISE.ignorees.add(n); else REPRISE.ignorees.delete(n); renderApercuReprise(); }
  });
  async function importerReprise() {
    const lignes = REPRISE.lignes.filter(l => !REPRISE.ignorees.has(l.ligne));
    const date = document.getElementById('repriseDate').value;
    if (!(await confirmer(`${lignes.length} lot(s) seront créés avec leur numéro d'origine, en stock au ${fmtDate(date)} (mouvement « Stock initial »).`, { titre: 'Importer le stock existant ?', ok: 'Importer' }))) return;
    try {
      const r = await apiFetch('/reprises/importer', { method: 'POST', body: JSON.stringify({ date_reprise: date, nom_fichier: REPRISE.nom, lignes,
        local_id_defaut: Number(document.getElementById('repriseLocal').value) || null, employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null }) });
      notifier(`Reprise ${r.numero} : ${r.nb_lots} lot(s) importé(s) avec leur numéro d'origine.`, 'succes');
      REPRISE.lignes = []; document.getElementById('repriseApercu').style.display = 'none'; document.getElementById('repriseFichier').value = '';
      APP_DATA.lots = await apiFetch('/lots'); renderLotsRegistre(); majBadgesMenu();
      chargerReprises();
    } catch (err) {
      notifier(err.message, 'erreur');
    }
  }
  async function annulerReprise(id) {
    const motif = await confirmer('Les lots de cette reprise sont retirés du stock (possible seulement si aucun n\'a encore servi).', { titre: 'Annuler la reprise ?', ok: 'Annuler la reprise', non: 'Garder', danger: true, saisie: { label: 'Motif (obligatoire)', placeholder: 'ex. mauvais fichier, quantités erronées' } });
    if (!motif) return;
    try { const r = await apiFetch(`/reprises/${id}/annuler`, { method: 'POST', body: JSON.stringify({ motif }) }); notifier(`Reprise annulée : ${r.lots_retires} lot(s) retiré(s).`, 'succes'); APP_DATA.lots = await apiFetch('/lots'); renderLotsRegistre(); chargerReprises(); }
    catch (err) { notifier(err.message, 'erreur'); }
  }
  document.getElementById('repriseFichier').addEventListener('change', (e) => lireFichierReprise(e.target.files[0]));
  const zoneReprise = document.getElementById('repriseZone');
  ['dragenter', 'dragover'].forEach(ev => zoneReprise.addEventListener(ev, (e) => { e.preventDefault(); zoneReprise.classList.add('survol'); }));
  ['dragleave', 'drop'].forEach(ev => zoneReprise.addEventListener(ev, (e) => { e.preventDefault(); zoneReprise.classList.remove('survol'); }));
  zoneReprise.addEventListener('drop', (e) => lireFichierReprise(e.dataTransfer.files[0]));
  document.getElementById('repriseImporterBtn').addEventListener('click', importerReprise);
  document.getElementById('repriseAnnulerApercu').addEventListener('click', () => { REPRISE.lignes = []; document.getElementById('repriseApercu').style.display = 'none'; document.getElementById('repriseFichier').value = ''; });
  document.getElementById('repriseModeleBtn').addEventListener('click', async () => {
    try {
      const r = await fetch(`${API_BASE}/reprises/modele`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (!r.ok) throw new Error(`Erreur HTTP ${r.status}`);
      telechargerBlob(await r.blob(), 'modele_reprise_stock.xlsx');
    } catch (err) { notifier(`Modèle indisponible : ${err.message}`, 'erreur'); }
  });

