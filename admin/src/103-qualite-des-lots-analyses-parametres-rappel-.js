  // ---------- Qualité des lots : analyses, paramètres, rappel de lot ----------
  const Q = { lot: null, profils: [], params: {} };
  const Q_DECISIONS = { LIBERE: 'Libérer le lot', BLOQUE: 'Bloquer le lot', REJETE: 'Rejeter le lot' };
  const fmtSeuil = (p) => p.max_valeur != null && p.min_valeur != null ? `${Number(p.min_valeur)} – ${Number(p.max_valeur)}` : p.max_valeur != null ? `≤ ${Number(p.max_valeur)}` : p.min_valeur != null ? `≥ ${Number(p.min_valeur)}` : '—';
  const qConforme = (v, p) => (p.min_valeur == null || v >= Number(p.min_valeur)) && (p.max_valeur == null || v <= Number(p.max_valeur));

  async function ouvrirQualite(numero) {
    const lot = APP_DATA.lots.find(l => l.numero_lot === numero);
    Q.lot = lot;
    document.getElementById('qualiteModalTitle').textContent = `Analyses qualité — ${numero}`;
    document.getElementById('qualiteBanner').innerHTML = lot ? `<span class="lotCode" style="font-size:14px; padding:5px 10px;">${esc(lot.numero_lot)}</span>
      <span style="margin-left:8px; font-weight:600;">${esc(lot.produit_nom || '')}</span> ${pillStatut(lot.statut)}` : '';
    if (!Q.profils.length) Q.profils = await apiFetch('/qualite/profils');
    Q.params = {};
    for (const p of Q.profils) Q.params[p.code] = (await apiFetch(`/qualite/parametres?profil=${p.code}`)).filter(x => x.actif);
    const profilDefaut = /olive/i.test((lot && lot.produit_nom) || '') ? 'OLIVE' : 'GRAINES';
    document.getElementById('qProfil').innerHTML = Q.profils.map(p => `<option value="${p.code}">${esc(p.nom)}</option>`).join('');
    document.getElementById('qProfil').value = profilDefaut;
    document.getElementById('qDate').value = new Date().toISOString().slice(0, 10);
    ['qLabo', 'qRef', 'qNotes', 'qDerog'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('qStatus').textContent = '';
    qDessinerChamps();
    await qChargerListe();
    document.getElementById('qualiteModalOverlay').classList.add('open');
  }
  function qDessinerChamps() {
    const params = Q.params[document.getElementById('qProfil').value] || [];
    document.getElementById('qChamps').innerHTML = params.map(p => `<div><label>${esc(p.nom)} <span class="rowMeta">${esc(p.unite)} · seuil ${fmtSeuil(p)}</span></label>
      <input type="number" step="any" min="0" data-q="${esc(p.code)}" style="width:130px"></div>`).join('');
    document.querySelectorAll('#qChamps [data-q]').forEach(i => i.oninput = qVerdict);
    qVerdict();
  }
  function qVerdict() {
    const params = Q.params[document.getElementById('qProfil').value] || [];
    const saisis = [...document.querySelectorAll('#qChamps [data-q]')].filter(i => i.value !== '').map(i => ({ p: params.find(x => x.code === i.dataset.q), v: Number(i.value) }));
    const hors = saisis.filter(s => !qConforme(s.v, s.p));
    const v = document.getElementById('qVerdict');
    if (!saisis.length) { v.className = 'numLegal'; v.textContent = 'Saisissez les valeurs du rapport d\'analyse.'; }
    else if (!hors.length) { v.className = 'numLegal'; v.innerHTML = '✔ <b>Conforme</b> — le lot sera libéré.'; }
    else { v.className = 'numLegal ko'; v.innerHTML = `✖ <b>Hors seuils</b> : ${hors.map(h => `${esc(h.p.nom)} ${h.v} (seuil ${fmtSeuil(h.p)})`).join(', ')} — le lot sera bloqué.`; }
    const dec = document.getElementById('qDecision'), ancien = dec.value;
    dec.innerHTML = Object.entries(Q_DECISIONS).filter(([k]) => hors.length || k !== 'REJETE' || true).map(([k, t]) => `<option value="${k}" ${(!ancien && ((hors.length && k === 'BLOQUE') || (!hors.length && k === 'LIBERE'))) || ancien === k ? 'selected' : ''}>${t}</option>`).join('');
    if (!saisis.length) dec.value = 'LIBERE';
    document.getElementById('qDerogBloc').style.display = hors.length && dec.value === 'LIBERE' ? '' : 'none';
    dec.onchange = () => { document.getElementById('qDerogBloc').style.display = hors.length && dec.value === 'LIBERE' ? '' : 'none'; };
  }
  async function qChargerListe() {
    const liste = await apiFetch(`/qualite/controles?lot_id=${Q.lot.id}`);
    document.getElementById('qualiteListe').innerHTML = liste.length ? liste.map(c => `<div class="panel" style="padding:10px 12px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;"><b>${fmtDate(c.date_controle)}</b>
        <span class="pill ${c.conforme ? 'good' : 'danger'}">${c.conforme ? 'Conforme' : 'Hors seuils'}</span>
        <span class="rowMeta">${esc(c.laboratoire || '')} ${c.reference_rapport ? '· rapport ' + esc(c.reference_rapport) : ''}</span>
        <span class="rowMeta">Décision : ${Q_DECISIONS[c.decision] || c.decision}</span>
        <button class="rowActionBtn" onclick="imprimerCertificatAnalyse(${c.id})">🖨 Certificat</button></div>
      <div style="margin-top:6px;">${c.resultats.map(r => `<span class="pill ${r.conforme ? 'good' : 'danger'}" style="margin-right:4px;">${esc(r.nom)} ${Number(r.valeur)} ${esc(r.unite)}</span>`).join('')}</div>
      ${c.derogation_motif ? `<div class="rowMeta" style="margin-top:4px;">Dérogation : ${esc(c.derogation_motif)}</div>` : ''}${c.notes ? `<div class="rowMeta">${esc(c.notes)}</div>` : ''}</div>`).join('')
      : '<div class="rowMeta">Aucune analyse pour ce lot.</div>';
  }
  async function qEnregistrer() {
    const resultats = [...document.querySelectorAll('#qChamps [data-q]')].filter(i => i.value !== '').map(i => ({ code: i.dataset.q, valeur: i.value }));
    try {
      const c = await apiFetch('/qualite/controles', { method: 'POST', body: JSON.stringify({ lot_id: Q.lot.id, date_controle: document.getElementById('qDate').value, profil: document.getElementById('qProfil').value,
        laboratoire: document.getElementById('qLabo').value, reference_rapport: document.getElementById('qRef').value, resultats, notes: document.getElementById('qNotes').value,
        decision: document.getElementById('qDecision').value, derogation_motif: document.getElementById('qDerog').value }) });
      notifier(`Analyse enregistrée : lot ${Q.lot.numero_lot} ${STATUT_LABEL[c.statut_lot] ? '→ ' + STATUT_LABEL[c.statut_lot].toLowerCase() : ''}.`, c.conforme ? 'succes' : 'info');
      APP_DATA.lots = await apiFetch('/lots'); renderLots();
      Q.lot = APP_DATA.lots.find(l => l.id === Q.lot.id) || Q.lot;
      document.getElementById('qualiteBanner').querySelector('.pill')?.remove();
      document.getElementById('qualiteBanner').insertAdjacentHTML('beforeend', ' ' + pillStatut(Q.lot.statut));
      await qChargerListe();
      document.querySelectorAll('#qChamps [data-q]').forEach(i => { i.value = ''; }); qVerdict();
    } catch (e) { document.getElementById('qStatus').textContent = e.message; }
  }
  async function imprimerCertificatAnalyse(id) {
    const c = await apiFetch(`/qualite/controles/${id}`);
    const ent = APP_DATA.settings || {};
    const w = window.open('', `analyse_${id}`);
    if (!w) { notifier('Autorisez les pop-ups pour imprimer.'); return; }
    w.document.open();
    w.document.write(`<html><head><meta charset="UTF-8"><title>Analyse ${esc(c.numero_lot)}</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#123} table{border-collapse:collapse;width:100%;margin-top:14px}
      td,th{border:1px solid #bbb;padding:6px 10px;text-align:left} th{background:#eef3f4} .ko{color:#b3261e;font-weight:700} .ok{color:#17703a;font-weight:700}</style></head><body>
      <h2>${esc(ent.entreprise_nom || 'Jardins de Jerba')} — Certificat d'analyse interne</h2>
      <p><b>Lot :</b> ${esc(c.numero_lot)} — ${esc(c.produit_nom || '')}<br><b>Date de l'analyse :</b> ${fmtDate(c.date_controle)}<br>
      <b>Laboratoire :</b> ${esc(c.laboratoire || '—')} &nbsp; <b>Rapport n° :</b> ${esc(c.reference_rapport || '—')}<br><b>Référentiel :</b> ${esc((Q.profils.find(p => p.code === c.profil) || {}).source || c.profil || '')}</p>
      <table><tr><th>Paramètre</th><th>Résultat</th><th>Seuil</th><th>Conformité</th></tr>
      ${c.resultats.map(r => `<tr><td>${esc(r.nom)}</td><td>${Number(r.valeur)} ${esc(r.unite)}</td><td>${fmtSeuil(r)}</td><td class="${r.conforme ? 'ok' : 'ko'}">${r.conforme ? 'Conforme' : 'Hors seuil'}</td></tr>`).join('')}</table>
      <p>Conclusion : <b class="${c.conforme ? 'ok' : 'ko'}">${c.conforme ? 'CONFORME' : 'NON CONFORME'}</b> — décision : ${Q_DECISIONS[c.decision] || c.decision}${c.derogation_motif ? ` (dérogation : ${esc(c.derogation_motif)})` : ''}</p>
      ${c.notes ? `<p>Remarques : ${esc(c.notes)}</p>` : ''}
      <script>window.onload = () => window.print();<\/script></body></html>`);
    w.document.close();
  }
  document.getElementById('tracRappelBtn').onclick = () => { const n = document.getElementById('tracLot').value; if (n) ouvrirRappel(n); else notifier('Choisissez d\'abord un lot.'); };
  document.getElementById('qProfil').onchange = qDessinerChamps;
  document.getElementById('qEnregistrer').onclick = qEnregistrer;
  ['qualiteModalCloseBtn', 'qFermer'].forEach(id => document.getElementById(id).onclick = () => document.getElementById('qualiteModalOverlay').classList.remove('open'));

  // Rappel de lot
  let RAPPEL = null;
  async function ouvrirRappel(numero) {
    try { RAPPEL = await apiFetch(`/qualite/rappel/${encodeURIComponent(numero)}`); }
    catch (e) { notifier(e.message, 'erreur'); return; }
    const r = RAPPEL;
    document.getElementById('rappelModalTitle').textContent = `Rappel du lot ${numero}`;
    document.getElementById('rappelCorps').innerHTML = `
      <div class="numLegal ${r.clients.length ? 'ko' : ''}"><b>${r.lots_concernes.length} lot(s)</b> concerné(s) · <b>${r.clients.length} client(s)</b> livré(s) · <b>${Number(r.total_livre)}</b> unité(s) livrée(s)
        · encore en stock : <b>${r.en_stock.length}</b> lot(s)</div>
      <h4 style="margin:14px 0 6px;">Clients à contacter</h4>
      <table style="width:100%"><thead><tr><th>Client</th><th>Téléphone</th><th>Ville</th><th>Livraisons</th><th class="num">Quantité</th></tr></thead><tbody>
      ${r.clients.map(c => `<tr><td>${esc(c.nom)}</td><td>${esc(c.tel || '—')}</td><td>${esc(c.ville || '')}</td><td>${c.livraisons}</td><td class="num">${Number(c.quantite)}</td></tr>`).join('') || '<tr><td colspan="5" class="rowMeta">Aucun client livré avec ce lot.</td></tr>'}</tbody></table>
      <h4 style="margin:14px 0 6px;">Détail des livraisons</h4>
      <table style="width:100%"><thead><tr><th>Date</th><th>Client</th><th>Lot livré</th><th>Produit</th><th>BL</th><th>Facture</th><th class="num">Qté</th></tr></thead><tbody>
      ${r.livraisons.map(x => `<tr><td>${fmtDate(x.date)}</td><td>${esc(x.client_nom)}</td><td class="lotCode">${esc(x.numero_lot)}</td><td>${esc(x.produit_nom || '')}</td><td>${esc(x.bl_numero || '—')}</td><td>${esc(x.facture_numero || '—')}</td><td class="num">${Number(x.quantite)}</td></tr>`).join('') || '<tr><td colspan="7" class="rowMeta">—</td></tr>'}</tbody></table>
      <h4 style="margin:14px 0 6px;">Lots issus de ce lot (à retirer du stock)</h4>
      <table style="width:100%"><thead><tr><th>Lot</th><th>Produit</th><th>Étape</th><th>Statut</th><th class="num">En stock</th></tr></thead><tbody>
      ${r.lots_concernes.map(l => `<tr><td class="lotCode">${esc(l.numero_lot)}</td><td>${esc(l.produit_nom || '')}</td><td class="rowMeta">${esc(l.origine || '')}</td><td>${pillStatut(l.statut)}</td><td class="num">${Number(l.quantite_actuelle)}</td></tr>`).join('')}</tbody></table>`;
    document.getElementById('rappelModalOverlay').classList.add('open');
  }
  document.getElementById('rappelModalCloseBtn').onclick = () => document.getElementById('rappelModalOverlay').classList.remove('open');
  document.getElementById('rappelImprimer').onclick = () => {
    const w = window.open('', 'rappel_lot'); if (!w) { notifier('Autorisez les pop-ups pour imprimer.'); return; }
    w.document.open();
    w.document.write(`<html><head><meta charset="UTF-8"><title>Rappel ${esc(RAPPEL.lot.numero_lot)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#123;font-size:13px} table{border-collapse:collapse;width:100%;margin-bottom:10px}
      td,th{border:1px solid #bbb;padding:5px 8px;text-align:left} th{background:#eef3f4} .num{text-align:right} .pill{padding:1px 6px;border:1px solid #999;border-radius:8px}</style></head><body>
      <h2>Fiche de rappel — lot ${esc(RAPPEL.lot.numero_lot)} (${esc(RAPPEL.lot.produit_nom || '')})</h2>${document.getElementById('rappelCorps').innerHTML}
      <script>window.onload = () => window.print();<\/script></body></html>`);
    w.document.close();
  };
  document.getElementById('rappelCsv').onclick = () => {
    const l = (RAPPEL.livraisons || []).map(x => [x.date, x.client_nom, x.client_tel, x.client_ville, x.numero_lot, x.produit_nom, x.bl_numero, x.facture_numero, x.quantite]);
    const csv = [['date', 'client', 'téléphone', 'ville', 'lot livré', 'produit', 'BL', 'facture', 'quantité']].concat(l).map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rappel-${RAPPEL.lot.numero_lot}.csv`; a.click();
  };

  // Paramètres qualité (gérant)
  async function chargerParametresQualite() {
    const profils = await apiFetch('/qualite/profils');
    const params = await apiFetch('/qualite/parametres');
    document.getElementById('qpProfils').innerHTML = profils.map(pr => `<div class="panel" style="padding:16px 20px; margin-top:14px;">
      <div><b>${esc(pr.nom)}</b> <span class="rowMeta">— ${esc(pr.source)}</span></div>
      <table style="width:100%; margin-top:8px;"><thead><tr><th>Paramètre</th><th>Unité</th><th>Minimum</th><th>Maximum</th><th>Actif</th><th></th></tr></thead><tbody>
      ${params.filter(p => p.profil === pr.code).map(p => `<tr data-qp="${p.id}"><td>${esc(p.nom)}</td><td class="rowMeta">${esc(p.unite)}</td>
        <td><input type="number" step="any" data-f="min" value="${p.min_valeur ?? ''}" style="width:90px"></td><td><input type="number" step="any" data-f="max" value="${p.max_valeur ?? ''}" style="width:90px"></td>
        <td><input type="checkbox" data-f="actif" ${p.actif ? 'checked' : ''}></td><td><button class="rowActionBtn" data-qp-save="${p.id}">Enregistrer</button></td></tr>`).join('')}</tbody></table></div>`).join('');
    document.querySelectorAll('[data-qp-save]').forEach(b => b.onclick = async () => {
      const tr = document.querySelector(`tr[data-qp="${b.dataset.qpSave}"]`);
      try {
        await apiFetch(`/qualite/parametres/${b.dataset.qpSave}`, { method: 'PUT', body: JSON.stringify({ min_valeur: tr.querySelector('[data-f=min]').value, max_valeur: tr.querySelector('[data-f=max]').value, actif: tr.querySelector('[data-f=actif]').checked }) });
        notifier('Seuils enregistrés.', 'succes');
      } catch (e) { notifier(e.message, 'erreur'); }
    });
    const q = await apiFetch('/qualite/quarantaine');
    const ETAPES = [['RECEPTION_MP', 'Graines reçues'], ['PRESSE', 'Presse'], ['FILTRATION', 'Filtration'], ['MELANGE', 'Mélange'], ['CONDITIONNEMENT', 'Conditionnement']];
    document.getElementById('qpQuarantaine').innerHTML = ETAPES.map(([k, t]) => `<label class="chkLbl"><input type="checkbox" data-etape="${k}" ${q.etapes.includes(k) ? 'checked' : ''}> ${t}</label>`).join('')
      + '<button class="btnGhost" id="qpQSave">Enregistrer</button>';
    document.getElementById('qpQSave').onclick = async () => {
      try { await apiFetch('/qualite/quarantaine', { method: 'PUT', body: JSON.stringify({ etapes: [...document.querySelectorAll('[data-etape]:checked')].map(c => c.dataset.etape) }) }); notifier('Quarantaine enregistrée.', 'succes'); }
      catch (e) { notifier(e.message, 'erreur'); }
    };
  }

