  // ---------- Mélange (lot fini yy x1x1 x2x2) ----------
  // Quantités saisies en ml (comme les registres) ; l'huile est stockée en litres.
  APP_DATA.melanges = [];
  const estLotMelange = (l) => { try { return (typeof l.champs_perso === 'string' ? JSON.parse(l.champs_perso) : l.champs_perso || {}).etape === 'MELANGE'; } catch { return false; } };
  async function chargerMelanges() {
    try { APP_DATA.melanges = await apiFetch('/melanges'); } catch (e) {
      if (!HL.horsLigne) {
        document.getElementById('melangesBody').innerHTML = `<tr><td colspan="7" style="text-align:center; padding:22px; color:var(--danger);">Le serveur ne connaît pas encore cet écran (${esc(e.message)}).<br>Serveur pas à jour : après « git pull », fermez la fenêtre noire de TinOR puis relancez TinOR.bat.</td></tr>`;
        return;
      }
      APP_DATA.melanges = APP_DATA.melanges || [];
    }
    renderMelanges();
  }
  const enMl = (q) => `${Math.round(Number(q) * 1000).toLocaleString('fr-TN')} ml`;
  function renderMelanges() {
    const body = document.getElementById('melangesBody');
    if (!APP_DATA.melanges.length) { body.innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucun mélange. « ＋ Nouveau mélange » pour créer un lot fini.</td></tr>`; return; }
    body.innerHTML = APP_DATA.melanges.map(m => `<tr>
        <td><b class="mono">${esc(m.numero_lot)}</b></td>
        <td>${m.date ? fmtDate(m.date) : '—'}</td>
        <td>${m.huiles.map(h => `<span class="mono">${esc(h.numero_lot)}</span> <span class="rowMeta">${enMl(h.quantite_utilisee)}</span>`).join('<br>') || '—'}</td>
        <td class="num">${enMl(m.quantite_initiale)}</td>
        <td class="num">${Number(m.quantite_actuelle) > 0 ? `<b>${enMl(m.quantite_actuelle)}</b>` : '<span class="rowMeta">0 — tout conditionné</span>'}</td>
        <td>${m.flacons.map(f => `<span class="mono">${esc(f.numero_lot)}</span> <span class="rowMeta">${Number(f.quantite_initiale)} u</span>`).join('<br>') || '<span class="rowMeta">—</span>'}</td>
        <td>${Number(m.quantite_actuelle) > 0 ? `<button class="btnGhost" data-cond-melange="${m.id}">Mettre en flacons</button>` : ''}</td></tr>`).join('');
  }
  document.getElementById('melangesBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cond-melange]'); if (!b) return;
    await openConditionnementModal();
    const sel = document.querySelector('#conditionnementSourcesRows .srcLot');
    if (sel) { sel.value = `direct:${b.dataset.condMelange}`; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  function huilesPourMelange() {
    return APP_DATA.lots.filter(l => l.statut === 'LIBERE' && Number(l.quantite_actuelle) > 0 && !estLotMelange(l)).map(l => ({ l, p: APP_DATA.produits.find(p => p.id === l.produit_id) }))
      .filter(({ p }) => p && p.type_article !== 'MATIERE_PREMIERE' && !p.format_id && cleHuileGen(p.nom))
      .sort((a, b) => (nomFiltre(b.p.nom) - nomFiltre(a.p.nom)) || String(b.l.numero_lot).localeCompare(String(a.l.numero_lot)));
  }
  let MELANGE_YY = null;
  async function openMelangeModal() {
    try { APP_DATA.lots = await apiFetch('/lots'); } catch {}
    try { MELANGE_YY = await apiFetch('/melanges/prochain'); } catch { MELANGE_YY = null; }
    const options = huilesPourMelange().map(({ l, p }) => `<option value="${l.id}">${esc(l.numero_lot)} — ${esc(p.nom)} · ${enMl(l.quantite_actuelle)}</option>`).join('');
    document.getElementById('melangeLot1').innerHTML = `<option value="">— choisir un lot filtré —</option>${options}`;
    document.getElementById('melangeLot2').innerHTML = `<option value="">— aucune (une seule huile) —</option>${options}`;
    ['melangeQte1', 'melangeQte2', 'melangeNotes'].forEach(i => { document.getElementById(i).value = ''; });
    document.getElementById('melangeDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('melangeErreur').style.display = 'none';
    majApercuMelange();
    document.getElementById('melangeOverlay').classList.add('open');
  }
  function majApercuMelange() {
    const lot = (i) => APP_DATA.lots.find(l => String(l.id) === document.getElementById(`melangeLot${i}`).value);
    const l1 = lot(1), l2 = lot(2);
    const xx = (l) => (/^(\d+)-/.exec(l?.numero_lot || '') || [])[1];
    const q = (i) => Number(document.getElementById(`melangeQte${i}`).value) || 0;
    const total = q(1) + (l2 ? q(2) : 0);
    const jj = MELANGE_YY && MELANGE_YY.numerotation === 'jardins_jerba';
    const yy = MELANGE_YY ? String(MELANGE_YY.yy).padStart(2, '0') : 'yy';
    const numero = l1 && xx(l1) ? `${yy}${xx(l1).padStart(2, '0')}${(xx(l2) || xx(l1)).padStart(2, '0')}` : '—';
    document.getElementById('melangeApercu').innerHTML = `<small>N° du lot fini</small><b class="mono">${jj ? numero : 'n° automatique'}</b>
      <span>${total ? `${total.toLocaleString('fr-TN')} ml mélangés` : 'Choisissez l\'huile 1 et sa quantité'}${jj && l1 ? ` · flacons : ${numero}-10ML, ${numero}-30ML…` : ''}</span>`;
  }
  ['melangeLot1', 'melangeLot2', 'melangeQte1', 'melangeQte2'].forEach(i => document.getElementById(i).addEventListener(i.startsWith('melangeLot') ? 'change' : 'input', majApercuMelange));
  const fermerMelange = () => document.getElementById('melangeOverlay').classList.remove('open');
  document.getElementById('melangeFermer').addEventListener('click', fermerMelange);
  document.getElementById('melangeAnnuler').addEventListener('click', fermerMelange);
  document.getElementById('melangeNouveauBtn').addEventListener('click', () => openMelangeModal());
  document.getElementById('melangeEnregistrer').addEventListener('click', async () => {
    const err = document.getElementById('melangeErreur');
    const erreur = (m) => { err.textContent = m; err.style.display = 'block'; };
    err.style.display = 'none';
    const sources = [1, 2].map(i => ({ lot_id: Number(document.getElementById(`melangeLot${i}`).value) || null, ml: Number(document.getElementById(`melangeQte${i}`).value) || 0 }))
      .filter(s => s.lot_id);
    if (!sources.length) return erreur('Choisissez l\'huile 1.');
    if (sources.some(s => !(s.ml > 0))) return erreur('Indiquez la quantité (ml) de chaque huile.');
    if (sources.length === 2 && sources[0].lot_id === sources[1].lot_id) return erreur('Huile 1 et huile 2 sont le même lot.');
    for (const s of sources) {
      const l = APP_DATA.lots.find(x => x.id === s.lot_id);
      if (l && s.ml / 1000 > Number(l.quantite_actuelle) + 1e-9) return erreur(`Le lot ${l.numero_lot} n'a que ${enMl(l.quantite_actuelle)}.`);
    }
    try {
      const r = await apiFetch('/melanges', { method: 'POST', body: JSON.stringify({
        date: document.getElementById('melangeDate').value, note: document.getElementById('melangeNotes').value.trim() || null,
        employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null,
        sources: sources.map(s => ({ lot_id: s.lot_id, quantite: Math.round(s.ml) / 1000 })) }) });
      fermerMelange();
      notifier(`Lot fini ${r.numero_lot} créé (${enMl(r.quantite)}).`, 'succes');
      APP_DATA.lots = await apiFetch('/lots');
      await chargerMelanges();
    } catch (e) { erreur(e.message); }
  });

