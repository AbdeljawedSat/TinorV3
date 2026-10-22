  // ---------- Numérotation des opérations ----------
  const NUM = { liste: [], cle: 'facture', brouillon: {}, minuterie: null };
  const NUM_TYPES = { seq: 'Séquence', date: 'Date', par: "Partie du numéro d'origine", let: 'Lettre', prod: 'Code produit', fmt: 'Contenance (10ML, 30ML…)', txt: 'Texte fixe' };
  const NUM_PARTIES = [['entier', 'Le numéro en entier'], ['xx', 'Le n° de pressage (avant le 1er « - »)'], ['lotmp', 'Le lot fournisseur (au milieu)'], ['date', 'La date (8 chiffres à la fin)'], ['sep', 'Le morceau n° … séparé par un caractère'], ['chars', 'Les caractères de … à …']];
  const NUM_FMT_DATE = [['AAAAMMJJ', 'AAAAMMJJ → 20261020'], ['AAMMJJ', 'AAMMJJ → 261020'], ['JJMMAAAA', 'JJMMAAAA → 20102026'], ['AAAAMM', 'AAAAMM → 202610'], ['AAAA', 'AAAA → 2026'], ['AA', 'AA → 26'], ['MMJJ', 'MMJJ → 1020']];
  const NUM_NOUVELLE = { seq: { t: 'seq', digits: 4, reset: 'jamais', last: 0 }, date: { t: 'date', fmt: 'AAAAMMJJ', src: 'op' }, par: { t: 'par', src: 1, part: 'entier' },
    let: { t: 'let', mode: 'fixe', v: 'H' }, prod: { t: 'prod' }, fmt: { t: 'fmt' }, txt: { t: 'txt', v: '-' } };
  const numOp = () => NUM.liste.find(o => o.cle === NUM.cle);
  const numBrouillon = () => NUM.brouillon[NUM.cle];
  const numEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const numOptions = (valeur, liste) => liste.map(([a, b]) => `<option value="${a}" ${String(a) === String(valeur) ? 'selected' : ''}>${b}</option>`).join('');

  async function chargerNumerotation() {
    NUM.liste = await apiFetch('/numerotation');
    for (const o of NUM.liste) {
      NUM.brouillon[o.cle] = { mode: o.mode, zones: JSON.parse(JSON.stringify(o.zones)), date_application: o.date_application || '' };
    }
    const sel = document.getElementById('numOp');
    const groupes = {};
    NUM.liste.forEach(o => (groupes[o.groupe] = groupes[o.groupe] || []).push(o));
    sel.innerHTML = Object.entries(groupes).map(([g, l]) => `<optgroup label="${g}">${l.map(o => `<option value="${o.cle}">${esc(o.nom)}</option>`).join('')}</optgroup>`).join('');
    sel.value = NUM.cle;
    numChoisir(NUM.cle);
  }
  function numChoisir(cle) {
    NUM.cle = cle;
    const o = numOp();
    document.getElementById('numOp').value = cle;
    document.getElementById('numNote').textContent = o.note || '';
    document.getElementById('numCDate').value = new Date().toISOString().slice(0, 10);
    const exemples = { bl: 'BC-2026-0008', proforma: 'BC-2026-0008', facture: 'BC-2026-0008', avoir: 'FAC-2026-0011', lotmp: 'GJ01/2023', presse: 'GJ01/2023',
      filtration: '07-GJ01/2023-20231226H', melange: '23-2312-20240331', cond: '011823' };
    document.getElementById('numCP1').value = exemples[cle] || '';
    document.getElementById('numCP2').value = o.p2 ? '18-GJ01/2023-20240325' : '';
    document.getElementById('numBP1').style.display = o.p1 ? '' : 'none';
    document.getElementById('numBP2').style.display = o.p2 ? '' : 'none';
    document.getElementById('numBProd').style.display = o.kind === 'lot' ? '' : 'none';
    if (o.p1) document.getElementById('numLP1').textContent = `${o.p1} (origine n°1)`;
    if (o.p2) document.getElementById('numLP2').textContent = `${o.p2} (origine n°2)`;
    document.getElementById('numLDate').textContent = o.date_label;
    document.getElementById('numDApp').value = numBrouillon().date_application || '';
    numRendre();
  }
  function numAppliquer(mode) {
    const o = numOp(), b = numBrouillon();
    b.mode = mode;
    if (mode === 'prop' || (mode === 'perso' && !b.zones.length)) b.zones = JSON.parse(JSON.stringify(o.proposition));
    numRendre();
  }
  function numContexte() {
    return { date: document.getElementById('numCDate').value, p1: document.getElementById('numCP1').value, p2: document.getElementById('numCP2').value, prod: document.getElementById('numCProd').value };
  }
  function numRendre() {
    const o = numOp(), b = numBrouillon();
    const cartes = [
      ['prop', 'Proposé par le système', o.exemple_proposition, o.kind === 'lot' ? "lettre de l'étape + année + numéro qui avance" : 'préfixe + année + numéro qui avance', 'Appliquer la proposition'],
      ['actuel', 'Format actuel', o.exemple_actuel, "celui que TinOR utilise aujourd'hui", 'Garder le format actuel'],
      ['perso', 'Personnalisé', o.exemple_perso || '—', 'vous composez les zones ci-dessous', 'Composer mon format'],
    ];
    document.getElementById('numCartes').innerHTML = cartes.map(([k, t, ex, d, bouton]) => `<div class="numCarte ${b.mode === k ? 'on' : ''}">
      <b>${b.mode === k ? '● ' : '○ '}${t}</b><div class="ex">${numEsc(ex)}</div><small>${d}</small>
      ${b.mode !== k ? `<button class="btnGhost" data-num-mode="${k}">${bouton}</button>` : ''}</div>`).join('');
    document.querySelectorAll('[data-num-mode]').forEach(x => x.onclick = () => numAppliquer(x.dataset.numMode));
    document.getElementById('numEditeur').style.display = b.mode === 'actuel' ? 'none' : '';
    document.getElementById('numSave').disabled = !isGerant();
    if (b.mode === 'actuel') { document.getElementById('numRegle').textContent = isGerant() ? '' : 'Seul le gérant peut enregistrer.'; return; }

    const aSeq = b.zones.some(z => z.t === 'seq'), seqOk = b.zones.some(z => z.t === 'seq' && ['jamais', 'annee'].includes(z.reset));
    document.getElementById('numLegal').innerHTML = o.legal ? `<div class="numLegal ${aSeq && seqOk ? '' : 'ko'}">⚖ <b>Numéro légal</b> — la suite doit être <b>continue et sans trou</b> : une zone Séquence qui ne repart à 1 qu'en début d'année (ou jamais) est obligatoire. ${aSeq && seqOk ? '✔ Format conforme.' : '✖ Ajoutez-la pour pouvoir enregistrer.'}</div>` : '';
    document.getElementById('numZones').innerHTML = b.zones.map((z, i) => `<div class="numZone"><div class="n">${i + 1}</div>
      <div><b>${NUM_TYPES[z.t]}</b>${numOptionsZone(z, i, o)}</div>
      <div class="ctl"><button data-num-m="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button data-num-m="down" data-i="${i}" ${i === b.zones.length - 1 ? 'disabled' : ''}>▼</button><button data-num-m="del" data-i="${i}">✕</button></div></div>`).join('')
      || '<div class="rowMeta">Ajoutez une première zone ↓</div>';
    const dispo = Object.keys(NUM_TYPES).filter(k => (k !== 'prod' || o.kind === 'lot') && (k !== 'par' || o.p1) && (k !== 'fmt' || o.cle === 'cond') && !(k === 'let' && o.legal));
    document.getElementById('numAjout').innerHTML = dispo.map(k => `<button class="btnGhost" data-num-a="${k}">＋ ${NUM_TYPES[k]}</button>`).join('');
    document.querySelectorAll('[data-num-a]').forEach(x => x.onclick = () => { b.mode = 'perso'; b.zones.push(JSON.parse(JSON.stringify(NUM_NOUVELLE[x.dataset.numA]))); numRendre(); });
    document.querySelectorAll('[data-num-m]').forEach(x => x.onclick = () => {
      const i = Number(x.dataset.i);
      b.mode = 'perso';
      if (x.dataset.numM === 'del') b.zones.splice(i, 1);
      else { const j = x.dataset.numM === 'up' ? i - 1 : i + 1; [b.zones[i], b.zones[j]] = [b.zones[j], b.zones[i]]; }
      numRendre();
    });
    document.querySelectorAll('#numZones [data-k]').forEach(el => el.oninput = el.onchange = () => {
      const z = b.zones[el.dataset.i];
      let v = el.value;
      if (['digits', 'last', 'n', 'de', 'a'].includes(el.dataset.k) || (el.dataset.k === 'src' && z.t === 'par')) v = Number(v);
      z[el.dataset.k] = v;
      b.mode = 'perso';
      if (el.tagName === 'SELECT') numRendre(); else numApercuDiffere();
    });
    numApercuDiffere();
  }
  function numOptionsZone(z, i, o) {
    const d = `data-i="${i}"`;
    if (z.t === 'seq') {
      const remises = o.legal ? [['jamais', 'Jamais (continue)'], ['annee', "Chaque année (début d'exercice)"]] : [['jamais', 'Jamais (continue)'], ['annee', 'Chaque année'], ['mois', 'Chaque mois'], ['jour', 'Chaque jour']];
      return `<div class="opts"><div><label>Nombre de chiffres</label><select ${d} data-k="digits">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === z.digits ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label>Repart à 1…</label><select ${d} data-k="reset">${numOptions(z.reset, remises)}</select></div>
        <div><label>Dernier n° utilisé</label><input type="number" min="0" ${d} data-k="last" value="${z.last || 0}" style="width:90px"></div></div>`;
    }
    if (z.t === 'date') return `<div class="opts"><div><label>Format</label><select ${d} data-k="fmt">${numOptions(z.fmt, NUM_FMT_DATE)}</select></div>
      <div><label>Quelle date ?</label><select ${d} data-k="src">${numOptions(z.src || 'op', [['op', o.date_label], ['jour', 'Date du jour de saisie'], ['orig', "Date du lot / document d'origine"]])}</select></div></div>`;
    if (z.t === 'par') return `<div class="opts"><div><label>Origine</label><select ${d} data-k="src">${numOptions(z.src, [['1', o.p1], ...(o.p2 ? [['2', o.p2]] : [])])}</select></div>
      <div><label>Quelle partie récupérer</label><select ${d} data-k="part">${numOptions(z.part, NUM_PARTIES)}</select></div>
      ${z.part === 'sep' ? `<div><label>Séparateur</label><input type="text" ${d} data-k="sep" value="${numEsc(z.sep || '-')}" maxlength="3" style="width:50px"></div><div><label>Morceau n°</label><input type="number" min="1" ${d} data-k="n" value="${z.n || 1}" style="width:70px"></div>` : ''}
      ${z.part === 'chars' ? `<div><label>De</label><input type="number" min="1" ${d} data-k="de" value="${z.de || 1}" style="width:70px"></div><div><label>À</label><input type="number" min="1" ${d} data-k="a" value="${z.a || 2}" style="width:70px"></div>` : ''}</div>`;
    if (z.t === 'let') return `<div class="opts"><div><label>Type</label><select ${d} data-k="mode">${numOptions(z.mode, [['fixe', 'Lettre fixe (ex. H)'], ['seq', 'A, B, C… selon le rang du jour']])}</select></div>
      ${z.mode === 'fixe' ? `<div><label>Lettre</label><input type="text" maxlength="2" ${d} data-k="v" value="${numEsc(z.v || '')}" style="width:50px"></div>` : ''}</div>`;
    if (z.t === 'prod') return '<div class="rowMeta">Code à 2 chiffres du produit (fiche produit).</div>';
    if (z.t === 'fmt') return '<div class="rowMeta">Contenance du flacon : 10ML, 30ML…</div>';
    return `<div class="opts"><div><label>Texte</label><input type="text" ${d} data-k="v" value="${numEsc(z.v || '')}" maxlength="20"></div></div>`;
  }
  function numApercuDiffere() {
    clearTimeout(NUM.minuterie);
    NUM.minuterie = setTimeout(numApercu, 200);
  }
  async function numApercu() {
    const o = numOp(), b = numBrouillon();
    if (!o || b.mode === 'actuel') return;
    const apercu = document.getElementById('numApercu'), suite = document.getElementById('numSuite');
    try {
      const r = await apiFetch('/numerotation/apercu', { method: 'POST', body: JSON.stringify({ cle: o.cle, zones: b.zones, n: 3, ...numContexte() }) });
      apercu.innerHTML = r.segments.map(s => `<span class="numSeg">${numEsc(s.texte) || '∅'}</span>`).join('');
      const jour = numContexte().date.split('-').reverse().join('/');
      suite.innerHTML = r.numeros.map((n, i) => `<tr><td>${i + 1}</td><td>${jour}</td><td style="font-family:ui-monospace,Consolas,monospace"><b>${numEsc(n)}</b></td></tr>`).join('');
      const depasse = r.longueur > r.max;
      document.getElementById('numRegle').textContent = `Longueur : ${r.longueur} caractères (maximum ${r.max}).` + (depasse ? ' ✖ Trop long.' : '');
      document.getElementById('numSave').disabled = !isGerant() || depasse;
    } catch (e) {
      apercu.textContent = '—';
      suite.innerHTML = '';
      document.getElementById('numRegle').textContent = e.message || 'Format invalide.';
      document.getElementById('numSave').disabled = true;
    }
  }
  async function numEnregistrer() {
    const o = numOp(), b = numBrouillon();
    b.date_application = document.getElementById('numDApp').value;
    try {
      const r = await apiFetch(`/numerotation/${o.cle}`, { method: 'PUT', body: JSON.stringify({ mode: b.mode, zones: b.mode === 'actuel' ? [] : b.zones, date_application: b.date_application || null }) });
      const i = NUM.liste.findIndex(x => x.cle === o.cle);
      NUM.liste[i] = r;
      NUM.brouillon[o.cle] = { mode: r.mode, zones: JSON.parse(JSON.stringify(r.zones)), date_application: r.date_application || '' };
      notifier(`Numérotation enregistrée : ${o.nom}.`, 'succes');
      numChoisir(o.cle);
    } catch (e) { notifier(e.message || 'Enregistrement impossible.', 'erreur'); }
  }
  document.getElementById('numOp').onchange = (e) => numChoisir(e.target.value);
  document.getElementById('numSave').onclick = numEnregistrer;
  ['numCDate', 'numCP1', 'numCP2', 'numCProd'].forEach(id => document.getElementById(id).addEventListener('input', numApercuDiffere));

