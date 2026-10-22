  // ---------- Dérivés d'une graine : huile vrac, huile filtrée, flacons ----------
  // « Graines de Sésame » → « Huile de Sésame — Vrac / — Filtrée / — Flacon 30ml » (même règle que le serveur).
  function nomHuileDeGraine(nom) {
    const m = String(nom || '').trim().match(/^(graines?|p[ée]pins?)\s+(de\s+|d['’])(.+)$/i);
    if (!m || !cleGraine(nom)) return null;
    const particule = /^d['’]/i.test(m[2]) ? "d'" : 'de ';
    return /^p/i.test(m[1]) ? `Huile de pépins ${particule}${m[3].trim()}` : `Huile ${particule}${m[3].trim()}`;
  }
  const volumesFormats = () => REF_DATA.formats.filter(f => f.volume).sort((a, b) => a.volume - b.volume);
  const libelleVolume = f => (Number(f.volume) >= 1000 ? `${Number(f.volume) / 1000} L` : `${Number(f.volume)} ml`);
  const derivesBoites = new Set(); // blocs affichés (mis à jour quand un format est créé)

  // Monte le bloc dans `box`. opts : { nomGraine, nouvelle (la graine n'existe pas encore), onChange }
  function monterDerives(box, opts) {
    box._d = { ...opts, etat: { vrac: true, filtree: true, cond: false, formats: new Set(), prix: {} } };
    derivesBoites.add(box);
    rendreDerives(box);
  }
  function rendreDerives(box) {
    const d = box._d, e = d.etat, base = nomHuileDeGraine(d.nomGraine);
    if (!base) { box.innerHTML = ''; return; }
    const existants = new Set(APP_DATA.produits.map(p => normaliserNomGraine(p.nom)));
    const existe = n => existants.has(normaliserNomGraine(n));
    const formats = volumesFormats();
    const nomFlacon = f => `${base} — Flacon ${f.code}`;
    if (existe(`${base} — Vrac`)) e.vrac = false;       // déjà créés : rien à cocher
    if (existe(`${base} — Filtrée`)) e.filtree = false;
    const choisis = formats.filter(f => e.cond && e.formats.has(f.id) && !existe(nomFlacon(f)));
    // Aperçu : ce qui sera créé et ce qui existe déjà (ignoré)
    const lignes = [];
    if (d.nouvelle) lignes.push({ nom: d.nomGraine, type: 'Matière première · kg', lie: '—', ex: existe(d.nomGraine) });
    if (e.vrac || existe(`${base} — Vrac`)) lignes.push({ nom: `${base} — Vrac`, type: 'Produit fabriqué · L', lie: '—', ex: existe(`${base} — Vrac`) });
    if (e.filtree || existe(`${base} — Filtrée`)) lignes.push({ nom: `${base} — Filtrée`, type: 'Produit fabriqué · L', lie: `${base} — Vrac`, ex: existe(`${base} — Filtrée`) });
    if (e.cond) formats.filter(f => e.formats.has(f.id)).forEach(f => lignes.push({ nom: nomFlacon(f), type: `Vendable · unité · ${libelleVolume(f)}`, lie: `${base} — Vrac`, ex: existe(nomFlacon(f)) }));
    const aCreer = lignes.filter(l => !l.ex).length, ignores = lignes.length - aCreer;
    const dernierCode = APP_DATA.produits.reduce((m, p) => Math.max(m, parseInt(p.code, 10) || 0), 0);
    let prochain = dernierCode;
    const ligHtml = lignes.map(l => `<tr><td class="num">${l.ex ? '—' : String(++prochain).padStart(2, '0')}</td><td><b>${esc(l.nom)}</b></td><td>${esc(l.type)}</td><td class="rowMeta">${esc(l.lie)}</td>
      <td><span class="dvSt ${l.ex ? 'exist' : ''}">${l.ex ? 'existe déjà — ignoré' : 'sera créé'}</span></td></tr>`).join('');
    const ligne = (cle, titre, nom, aide, tag, off) => `<div class="dvRow"><input type="checkbox" data-dv="${cle}" ${e[cle] ? 'checked' : ''} ${off ? 'disabled' : ''}>
        <div class="dvNom"><b>${esc(nom || titre)}</b><small>${aide}</small></div><span class="pill">${tag}</span></div>`;
    box.className = 'derivesBox';
    box.innerHTML = `<div class="dvHead">🌱 Cette graine donne de l'huile — ${d.nouvelle ? 'créer ses dérivés en même temps' : 'ajouter des dérivés'}</div>
      <div class="dvIn">
        ${ligne('vrac', 'Huile vrac', `${base} — Vrac`, existe(`${base} — Vrac`) ? 'existe déjà' : 'sortie du pressage · en litres', 'Vrac', existe(`${base} — Vrac`))}
        ${ligne('filtree', 'Huile filtrée', `${base} — Filtrée`, existe(`${base} — Filtrée`) ? 'existe déjà' : 'sortie de la filtration · en litres', 'Filtrée', existe(`${base} — Filtrée`))}
        ${ligne('cond', 'Huile conditionnée (flacons)', 'Huile conditionnée (flacons)', 'cochez les volumes à créer — un produit par volume, vendable, en unités', 'Flacons')}
        ${e.cond ? `<div class="dvFmts">${formats.map(f => { const ex = existe(nomFlacon(f)); return `<label class="dvFmt ${e.formats.has(f.id) && !ex ? 'on' : ''} ${ex ? 'dis' : ''}">
            <input type="checkbox" data-dvf="${f.id}" ${e.formats.has(f.id) && !ex ? 'checked' : ''} ${ex ? 'disabled' : ''}> ${libelleVolume(f)}${ex ? ' <small>(existe)</small>' : ''}</label>`; }).join('')}
          <a href="#" class="dvFmt" data-dv-autre style="color:var(--ink); border-style:dashed;">＋ Autre volume…</a></div>` : ''}
        ${choisis.length ? `<div class="dvPrix"><b style="color:var(--text-soft);">Prix de vente (facultatif, DT) :</b>${choisis.map(f =>
          `<span>${libelleVolume(f)} <input type="number" step="0.001" class="formInput" data-dvp="${f.id}" value="${e.prix[f.id] ?? ''}"></span>`).join('')}</div>` : ''}
        <table><thead><tr><th>Code prévu</th><th>Produit</th><th>Type · unité</th><th>Lié à</th><th></th></tr></thead><tbody>${ligHtml}</tbody></table>
        <div class="dvSum">${aCreer ? `${aCreer} produit(s) à créer` : 'Rien à créer : tout existe déjà'}${ignores ? ` · ${ignores} déjà existant(s), ignoré(s)` : ''}</div>
      </div>`;
    box.querySelectorAll('[data-dv]').forEach(c => c.onchange = () => { e[c.dataset.dv] = c.checked; if (c.dataset.dv === 'cond' && c.checked && !e.formats.size) { const f30 = formats.find(f => Number(f.volume) === 30); if (f30) e.formats.add(f30.id); } rendreDerives(box); });
    box.querySelectorAll('[data-dvf]').forEach(c => c.onchange = () => { const id = Number(c.dataset.dvf); c.checked ? e.formats.add(id) : e.formats.delete(id); rendreDerives(box); });
    box.querySelectorAll('[data-dvp]').forEach(c => c.oninput = () => { e.prix[c.dataset.dvp] = c.value; });
    box.querySelector('[data-dv-autre]')?.addEventListener('click', (ev) => { ev.preventDefault(); openFormatRapideModal(); });
    box._d.resume = { aCreer, ignores };
    if (d.onChange) d.onChange(aCreer);
  }
  // Ce que le serveur doit créer (les flacons déjà existants sont écartés côté serveur aussi).
  function lireDerives(box) {
    const e = box._d.etat;
    return { vrac: e.vrac, filtree: e.filtree, formats: e.cond ? [...e.formats].map(id => ({ format_id: id, prix_vente: e.prix[id] === undefined || e.prix[id] === '' ? null : Number(e.prix[id]) })) : [] };
  }
  const derivesChoisis = box => { const e = box._d.etat; return e.vrac || e.filtree || (e.cond && e.formats.size > 0); };
  // Un format vient d'être créé (« ＋ Autre volume ») : on le coche dans les blocs affichés.
  document.addEventListener('formatCree', (ev) => {
    const f = ev.detail; if (!f || !f.volume) return;
    derivesBoites.forEach(box => { if (box.isConnected && box._d) { box._d.etat.cond = true; box._d.etat.formats.add(f.id); rendreDerives(box); } });
  });

  // Dans le formulaire « Nouveau produit » : le bloc apparaît pour une graine reconnue.
  function majDerivesProduit() {
    const box = document.getElementById('derivesBox');
    const creation = !document.getElementById('produitId').value;
    const nom = document.getElementById('produitNom').value.trim();
    const mp = document.getElementById('produitType').value === 'MATIERE_PREMIERE';
    if (!creation || !mp || !nom) { box._d = null; box.className = ''; box.innerHTML = ''; return; }
    if (!nomHuileDeGraine(nom)) {
      box._d = null; box.className = 'derivesAide';
      box.innerHTML = 'Nom non reconnu comme une graine. Commencez par <b>« Graines de … »</b> ou <b>« Pépins de … »</b> pour créer aussi ses dérivés (huile vrac, filtrée, flacons) et relier la graine à son huile.';
      return;
    }
    if (box._d && box._d.nomGraine !== nom) { box._d.nomGraine = nom; rendreDerives(box); return; }
    if (!box._d) monterDerives(box, { nomGraine: nom, nouvelle: true });
  }
  document.getElementById('produitNom').addEventListener('input', majDerivesProduit);
  // Type « Matière première » choisi à la création : « Graines de » s'ajoute au nom (modifiable ensuite).
  // Ex. « Nigelle » → « Graines de Nigelle », « Amande » → « Graines d'Amande », nom vide → « Graines de ».
  const PREFIXE_GRAINE_RE = /^(graines?|p[ée]pins?)\s+(de\s+|d['’])/i;
  function nomAvecPrefixeGraine(nom) {
    const n = String(nom || '').trim();
    if (PREFIXE_GRAINE_RE.test(n)) return n;
    if (!n) return 'Graines de ';
    return /^[aeiouyàâäéèêëîïôöûüœ]/i.test(n) ? `Graines d'${n}` : `Graines de ${n}`;
  }
  function surChangementTypeProduit() {
    const champ = document.getElementById('produitNom');
    if (!document.getElementById('produitId').value) { // création seulement : on ne touche jamais un produit existant
      if (document.getElementById('produitType').value === 'MATIERE_PREMIERE') {
        const vide = !champ.value.trim();
        champ.value = nomAvecPrefixeGraine(champ.value);
        if (vide) { champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
      } else if (/^graines?\s+de\s*$/i.test(champ.value.trim())) champ.value = ''; // préfixe seul : on le retire
    }
    majDerivesProduit();
  }
  document.getElementById('produitType').addEventListener('change', surChangementTypeProduit);

  // Graine déjà créée : fenêtre « Ajouter des dérivés ».
  let derivesGraineId = null;
  function openDerivesModal(id) {
    const p = APP_DATA.produits.find(x => x.id === id); if (!p) return;
    derivesGraineId = id;
    document.getElementById('derivesModalTitle').textContent = `Dérivés — ${p.nom}`;
    document.getElementById('derivesFormError').style.display = 'none';
    const box = document.getElementById('derivesBoxExistant');
    monterDerives(box, { nomGraine: p.nom, nouvelle: false, onChange: () => { document.getElementById('derivesSaveBtn').disabled = !derivesChoisis(box) || !(box._d.resume && box._d.resume.aCreer); } });
    document.getElementById('derivesModalOverlay').classList.add('open');
  }
  function closeDerivesModal() { document.getElementById('derivesModalOverlay').classList.remove('open'); derivesBoites.delete(document.getElementById('derivesBoxExistant')); }
  document.getElementById('derivesCancelBtn').addEventListener('click', closeDerivesModal);
  document.getElementById('derivesModalCloseBtn').addEventListener('click', closeDerivesModal);
  document.getElementById('derivesSaveBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('derivesFormError'); errEl.style.display = 'none';
    try {
      const r = await apiFetch(`/produits/${derivesGraineId}/derives`, { method: 'POST', body: JSON.stringify({ derives: lireDerives(document.getElementById('derivesBoxExistant')) }) });
      closeDerivesModal();
      APP_DATA.produits = await apiFetch('/produits'); renderProduits(); renderDashboard();
      notifier(`${r.crees.length} produit(s) créé(s)${r.ignores.length ? `, ${r.ignores.length} déjà existant(s) ignoré(s)` : ''}.`, 'succes');
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

  async function saveProduit() {
    const id = document.getElementById('produitId').value;
    const errEl = document.getElementById('produitFormError');
    errEl.style.display = 'none';
    const payload = {
      nom: document.getElementById('produitNom').value.trim(),
      description: document.getElementById('produitDescription').value.trim() || null,
      barcode: document.getElementById('produitBarcode').value.trim() || null,
      categorie_id: Number(document.getElementById('produitCategorie').value) || null,
      unite_id: Number(document.getElementById('produitUnite').value) || null,
      format_id: document.getElementById('produitFormat').value ? Number(document.getElementById('produitFormat').value) : null,
      produit_source_id: document.getElementById('produitSource').value ? Number(document.getElementById('produitSource').value) : null,
      type_article: document.getElementById('produitType').value,
      prix_vente: document.getElementById('produitPrix').value ? Number(document.getElementById('produitPrix').value) : null,
      stock_min: document.getElementById('produitStockMin').value ? Number(document.getElementById('produitStockMin').value) : null,
      cout_standard: document.getElementById('produitCoutStandard').value ? Number(document.getElementById('produitCoutStandard').value) : null,
      vendable: document.getElementById('produitVendable').checked,
      achetable: document.getElementById('produitAchetable').checked,
      fabriquable: document.getElementById('produitFabriquable').checked,
      stockable: document.getElementById('produitStockable').checked,
      actif: document.getElementById('produitActif').checked,
      bio_eligible: document.getElementById('produitBio').checked,
    };
    if (!payload.nom || !payload.categorie_id || !payload.unite_id) {
      errEl.textContent = 'Nom, catégorie et unité sont requis.'; errEl.style.display = 'block'; return;
    }
    if (/^(graines?|p[ée]pins?)\s+(de|d['’])\s*$/i.test(payload.nom)) {
      errEl.textContent = 'Complétez le nom de la graine (ex. « Graines de Nigelle »).'; errEl.style.display = 'block'; return;
    }
    try {
      const boxD = document.getElementById('derivesBox');
      let resume = null;
      if (id) await apiFetch(`/produits/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else if (boxD._d && derivesChoisis(boxD)) {
        resume = await apiFetch('/produits/avec-derives', { method: 'POST', body: JSON.stringify({ graine: payload, derives: lireDerives(boxD) }) });
      } else await apiFetch('/produits', { method: 'POST', body: JSON.stringify(payload) });
      derivesBoites.delete(boxD);
      closeProduitModal();
      APP_DATA.produits = await apiFetch('/produits');
      renderProduits(); renderDashboard();
      if (resume) notifier(`${resume.crees.length} produit(s) créé(s) : ${resume.crees.map(x => x.nom).join(', ')}.`, 'succes');
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }

