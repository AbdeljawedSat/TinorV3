// Numérotation configurable des opérations (documents et lots).
// Pour chaque opération, trois modes :
//   'actuel' : format historique de TinOR (code inchangé, voir lotService) ;
//   'prop'   : format proposé par le système (PROPOSITIONS ci-dessous) ;
//   'perso'  : zones composées par l'utilisateur.
// Un numéro = suite de zones : seq, date, par (partie du n° d'origine), let, prod, fmt, txt.
// Les compteurs sont dans la table `sequences` sous le nom num:<opération>:<zone>:<portée>
// (portée = all / AAAA / AAAAMM / AAAAMMJJ selon la remise à 1).

const { Invalide } = require('./regles');

const DOC = { kind: 'doc', max: 20 };
const LOT = { kind: 'lot', max: 60 };
const OPERATIONS = [
  { cle: 'commande',   groupe: 'Ventes',     nom: 'Bon de commande',                          ...DOC, seqName: 'commande_seq',  dateLabel: 'Date de la commande', legacy: 'BC-0001' },
  { cle: 'bl',         groupe: 'Ventes',     nom: 'Bon de livraison',                         ...DOC, seqName: 'bl_seq',        dateLabel: 'Date de livraison', p1: 'Commande livrée', legacy: 'BL-0001' },
  { cle: 'proforma',   groupe: 'Ventes',     nom: 'Facture en attente (pro forma)',           ...DOC, seqName: 'proforma_seq',  dateLabel: 'Date', p1: 'Commande', legacy: 'PRO-0001' },
  { cle: 'facture',    groupe: 'Ventes',     nom: 'Facture',                    legal: true, ...DOC, seqName: 'facture_seq',   dateLabel: 'Date d\'émission', p1: 'Commande facturée', legacy: 'FAC-0001' },
  { cle: 'avoir',      groupe: 'Ventes',     nom: 'Avoir',                      legal: true, ...DOC, seqName: 'avoir_seq',     dateLabel: 'Date d\'émission', p1: 'Facture d\'origine', legacy: 'AV-0001' },
  { cle: 'achat',      groupe: 'Achats',     nom: 'Achat',                                    ...DOC, seqName: 'achat_seq',     dateLabel: 'Date de l\'achat', legacy: 'ACH-0001' },
  { cle: 'reception',  groupe: 'Achats',     nom: 'Réception de matière première (document)', ...DOC, seqName: 'reception_seq', dateLabel: 'Date de réception', legacy: 'REC-0001' },
  { cle: 'lotmp',      groupe: 'Achats',     nom: 'Lot de graines reçues (lot)',              ...LOT, dateLabel: 'Date de réception', p1: 'Lot du fournisseur', legacy: '03-MP-001',
    note: 'Si le fournisseur donne son numéro de lot, TinOR le garde tel quel ; ce format sert quand il n\'y en a pas.' },
  { cle: 'presse',     groupe: 'Production', nom: 'Lot de presse',                            ...LOT, dateLabel: 'Date du pressage', p1: 'Lot de graines utilisé', legacy: '03-P-001' },
  { cle: 'filtration', groupe: 'Production', nom: 'Lot filtré (filtration)',                  ...LOT, dateLabel: 'Date de filtration', p1: 'Lot de presse filtré', legacy: '03-F-001' },
  { cle: 'melange',    groupe: 'Production', nom: 'Lot fini (mélange)',                       ...LOT, dateLabel: 'Date du mélange', p1: '1re huile filtrée', p2: '2e huile filtrée', legacy: '03-M-001' },
  { cle: 'cond',       groupe: 'Production', nom: 'Lot de flacons (conditionnement)',         ...LOT, dateLabel: 'Date du conditionnement', p1: 'Lot fini conditionné', legacy: '011823-30ML' },
  { cle: 'mvt',        groupe: 'Stock',      nom: 'Mouvement de stock',                       kind: 'doc', max: 40, seqName: 'mouvement_seq', dateLabel: 'Date du mouvement', legacy: 'MVT-0001' },
  { cle: 'inv',        groupe: 'Stock',      nom: 'Inventaire',                               ...DOC, seqName: 'inventaire_seq', dateLabel: 'Date de l\'inventaire', legacy: 'INV-0001' },
  { cle: 'rep',        groupe: 'Stock',      nom: 'Reprise du stock',                         ...DOC, seqName: 'reprise_seq',   dateLabel: 'Date de reprise', legacy: 'REP-0001' },
];
const PAR_CLE = Object.fromEntries(OPERATIONS.map(o => [o.cle, o]));
const PAR_SEQ = Object.fromEntries(OPERATIONS.filter(o => o.seqName).map(o => [o.seqName, o]));

const PREFIXE_DOC = { commande: 'BC-', bl: 'BL-', proforma: 'PRO-', facture: 'FAC-', avoir: 'AV-', achat: 'ACH-', reception: 'REC-', mvt: 'MVT-', inv: 'INV-', rep: 'REP-' };
const PREFIXE_LOT = { lotmp: 'GR-', presse: 'P-', filtration: 'F-', melange: 'M-' };
const CHIFFRES = { mvt: 5, inv: 3, rep: 3 };

// Format proposé par le système (zones prêtes à l'emploi, `last` = dernier n° déjà utilisé).
function proposition(cle) {
  const o = PAR_CLE[cle];
  if (!o) return [];
  if (o.kind === 'doc') {
    return [
      { t: 'txt', v: PREFIXE_DOC[cle] }, { t: 'date', fmt: 'AAAA', src: 'op' }, { t: 'txt', v: '-' },
      { t: 'seq', digits: CHIFFRES[cle] || 4, reset: 'annee', last: 0 },
    ];
  }
  if (cle === 'cond') return [{ t: 'par', src: 1, part: 'entier' }, { t: 'txt', v: '-' }, { t: 'fmt' }];
  return [
    { t: 'txt', v: PREFIXE_LOT[cle] }, { t: 'date', fmt: 'AA', src: 'op' }, { t: 'txt', v: '-' },
    { t: 'seq', digits: 3, reset: 'annee', last: 0 },
  ];
}

const FORMATS_DATE = ['AAAAMMJJ', 'AAMMJJ', 'JJMMAAAA', 'AAAAMM', 'AAAA', 'AA', 'MMJJ'];
const REMISES = ['jamais', 'annee', 'mois', 'jour'];
const PARTIES = ['entier', 'xx', 'lotmp', 'date', 'sep', 'chars'];
const TYPES = ['seq', 'date', 'par', 'let', 'prod', 'fmt', 'txt'];
const RE_TEXTE = /^[A-Za-z0-9\-_/.]{0,20}$/;

const jourISO = (d) => {
  const s = d instanceof Date ? d.toISOString() : String(d || '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date().toISOString().slice(0, 10);
};
function formaterDate(iso, f) {
  const [y, m, j] = iso.split('-');
  return ({ AAAAMMJJ: y + m + j, AAMMJJ: y.slice(2) + m + j, JJMMAAAA: j + m + y, AAAAMM: y + m, AAAA: y, AA: y.slice(2), MMJJ: m + j })[f] || y + m + j;
}
function partie(lot, z) {
  lot = String(lot || '');
  const m = /^(\d+)-(.+)-(\d{8})H?(?:-\d+)?$/.exec(lot);
  switch (z.part) {
    case 'entier': return lot;
    case 'xx': return m ? m[1] : (lot.split('-')[0] || '');
    case 'lotmp': return m ? m[2] : (lot.split('-')[1] || '');
    case 'date': return m ? m[3] : ((lot.match(/\d{8}/) || [''])[0]);
    case 'sep': return lot.split(z.sep || '-')[(Number(z.n) || 1) - 1] || '';
    case 'chars': return lot.slice((Number(z.de) || 1) - 1, Number(z.a) || undefined);
  }
  return '';
}
const portee = (reset, iso) => ({ jamais: 'all', annee: iso.slice(0, 4), mois: iso.slice(0, 7).replace('-', ''), jour: iso.replace(/-/g, '') })[reset] || 'all';
const nomCompteur = (cle, i, reset, iso) => `num:${cle}:${i}:${portee(reset, iso)}`;

async function lireCompteur(pool, nom) {
  const r = await pool.query('SELECT `last_value` AS v FROM sequences WHERE name = $1', [nom]);
  return r.rows[0] ? Number(r.rows[0].v) : 0;
}
async function avancerCompteur(pool, nom) {
  const upd = await pool.query('UPDATE sequences SET `last_value` = `last_value` + 1 WHERE name = $1', [nom]);
  if (!upd.affectedRows) await pool.query('INSERT INTO sequences (name, `last_value`) VALUES ($1, 1)', [nom]);
  return lireCompteur(pool, nom);
}
async function fixerCompteur(pool, nom, valeur) {
  const upd = await pool.query('UPDATE sequences SET `last_value` = $1 WHERE name = $2', [valeur, nom]);
  if (!upd.affectedRows) await pool.query('INSERT INTO sequences (name, `last_value`) VALUES ($2, $1)', [valeur, nom]);
}

// Calcule le texte d'une zone. consommer=false : simple aperçu (compteurs non modifiés) ;
// rang = n-ième numéro à venir (aperçu des 3 prochains).
async function texteZone(pool, cle, z, i, ctx, { consommer, rang }) {
  const iso = jourISO(ctx.date);
  switch (z.t) {
    case 'seq': {
      const nom = nomCompteur(cle, i, z.reset, iso);
      const n = consommer ? await avancerCompteur(pool, nom) : (await lireCompteur(pool, nom)) + 1 + rang;
      return String(n).padStart(Number(z.digits) || 4, '0');
    }
    case 'date': {
      const d = z.src === 'jour' ? new Date().toISOString().slice(0, 10) : z.src === 'orig' ? jourISO(ctx.date_orig || ctx.date) : iso;
      return formaterDate(d, z.fmt);
    }
    case 'par': return partie(z.src === 2 ? ctx.p2 : ctx.p1, z);
    case 'let': {
      if (z.mode !== 'seq') return String(z.v || '');
      const nom = `num:${cle}:L${i}:${iso.replace(/-/g, '')}`;
      const n = consommer ? await avancerCompteur(pool, nom) : (await lireCompteur(pool, nom)) + 1 + rang;
      return String.fromCharCode(64 + (((n - 1) % 26) + 1));
    }
    case 'prod': return String(ctx.prod || '');
    case 'fmt': return String(ctx.contenance || '');
    case 'txt': return String(z.v || '');
  }
  return '';
}
async function composer(pool, cle, zones, ctx, opts) {
  let s = '';
  for (let i = 0; i < zones.length; i++) s += await texteZone(pool, cle, zones[i], i, ctx, opts);
  return s;
}

// ---------- Contrôle d'un format ----------
function verifierZones(op, zones) {
  if (!Array.isArray(zones) || !zones.length) throw new Invalide('Ajoutez au moins une zone au numéro.');
  if (zones.length > 12) throw new Invalide('Un numéro ne peut pas dépasser 12 zones.');
  const propres = zones.map((z, i) => {
    if (!z || !TYPES.includes(z.t)) throw new Invalide(`Zone ${i + 1} : type inconnu.`);
    const r = { t: z.t };
    if (z.t === 'seq') {
      r.digits = Math.min(8, Math.max(1, Math.trunc(Number(z.digits)) || 4));
      r.reset = REMISES.includes(z.reset) ? z.reset : 'jamais';
      r.last = Math.max(0, Math.trunc(Number(z.last)) || 0);
    } else if (z.t === 'date') {
      r.fmt = FORMATS_DATE.includes(z.fmt) ? z.fmt : 'AAAAMMJJ';
      r.src = ['op', 'jour', 'orig'].includes(z.src) ? z.src : 'op';
    } else if (z.t === 'par') {
      if (!op.p1) throw new Invalide(`Zone ${i + 1} : « ${op.nom} » n'a pas de numéro d'origine à reprendre.`);
      r.src = Number(z.src) === 2 && op.p2 ? 2 : 1;
      r.part = PARTIES.includes(z.part) ? z.part : 'entier';
      if (r.part === 'sep') { r.sep = String(z.sep || '-').slice(0, 3); r.n = Math.max(1, Math.trunc(Number(z.n)) || 1); }
      if (r.part === 'chars') { r.de = Math.max(1, Math.trunc(Number(z.de)) || 1); r.a = Math.max(r.de, Math.trunc(Number(z.a)) || r.de); }
    } else if (z.t === 'let') {
      if (op.legal) throw new Invalide(`Zone ${i + 1} : une lettre n'est pas autorisée dans un numéro de ${op.nom.toLowerCase()} (suite légale continue).`);
      r.mode = z.mode === 'seq' ? 'seq' : 'fixe';
      if (r.mode === 'fixe') r.v = String(z.v || '').slice(0, 2);
      if (r.v && !/^[A-Za-z0-9]{1,2}$/.test(r.v)) throw new Invalide(`Zone ${i + 1} : lettre fixe invalide.`);
    } else if (z.t === 'prod') {
      if (op.kind !== 'lot') throw new Invalide(`Zone ${i + 1} : le code produit n'existe que pour les lots.`);
    } else if (z.t === 'fmt') {
      if (op.cle !== 'cond') throw new Invalide(`Zone ${i + 1} : la contenance n'existe que pour le conditionnement.`);
    } else if (z.t === 'txt') {
      r.v = String(z.v || '');
      if (!RE_TEXTE.test(r.v)) throw new Invalide(`Zone ${i + 1} : texte fixe invalide (lettres, chiffres, - _ / . ; 20 caractères maximum).`);
    }
    return r;
  });
  if (op.legal) {
    const ok = propres.some(z => z.t === 'seq' && ['jamais', 'annee'].includes(z.reset));
    if (!ok) throw new Invalide(`Numéro légal : « ${op.nom} » doit contenir une zone Séquence qui ne repart à 1 qu'en début d'année (ou jamais), pour que la suite reste continue et sans trou.`);
  }
  return propres;
}
function contexteExemple(op, c = {}) {
  const exemples = { commande: '', bl: 'BC-2026-0008', proforma: 'BC-2026-0008', facture: 'BC-2026-0008', avoir: 'FAC-2026-0011', lotmp: 'GJ01/2023',
    presse: 'GJ01/2023', filtration: '07-GJ01/2023-20231226H', melange: '23-2312-20240331', cond: '011823' };
  return { date: c.date || jourISO(), p1: c.p1 ?? exemples[op.cle] ?? '', p2: c.p2 ?? (op.p2 ? '18-GJ01/2023-20240325' : ''), prod: c.prod || '04', contenance: c.contenance || '30ML', date_orig: c.date_orig };
}

// ---------- Format actif d'une opération ----------
let cache = { t: 0, formats: null };
const vider = () => { cache = { t: 0, formats: null }; };
async function formats(pool) {
  if (cache.formats && Date.now() - cache.t < 5000) return cache.formats;
  let lignes = [];
  try { lignes = (await pool.query('SELECT cle, mode, zones, date_application FROM numerotation_formats')).rows; } catch { /* table absente : formats actuels */ }
  const f = {};
  for (const l of lignes) {
    let zones = [];
    try { zones = typeof l.zones === 'string' ? JSON.parse(l.zones) : (l.zones || []); } catch { /* ignoré */ }
    f[l.cle] = { mode: l.mode, zones, date_application: l.date_application ? jourISO(l.date_application) : null };
  }
  cache = { t: Date.now(), formats: f };
  return f;
}
async function formatActif(pool, cle, iso) {
  const f = (await formats(pool))[cle];
  if (!f || f.mode === 'actuel') return null;
  if (f.date_application && iso < f.date_application) return null; // avant la date d'application : format actuel
  const zones = f.mode === 'prop' ? proposition(cle) : f.zones;
  return zones && zones.length ? { mode: f.mode, zones } : null;
}

// Numéro de l'opération selon le format choisi, ou null s'il faut garder le format actuel.
async function numeroPour(pool, cle, ctx = {}) {
  const iso = jourISO(ctx.date);
  const fmt = await formatActif(pool, cle, iso);
  if (!fmt) return null;
  return composer(pool, cle, fmt.zones, { ...ctx, date: iso }, { consommer: true, rang: 0 });
}
async function modeDe(pool, cle) {
  const f = (await formats(pool))[cle];
  return f ? f.mode : 'actuel';
}

// Aperçu : n prochains numéros d'un format (sans toucher aux compteurs).
async function apercu(pool, cle, zones, ctx, n = 3) {
  const op = PAR_CLE[cle];
  const propres = verifierZones(op, zones);
  const c = contexteExemple(op, ctx);
  const numeros = [];
  for (let r = 0; r < n; r++) numeros.push(await composer(pool, cle, propres, c, { consommer: false, rang: r }));
  const segments = [];
  for (let i = 0; i < propres.length; i++) segments.push({ t: propres[i].t, texte: await texteZone(pool, cle, propres[i], i, c, { consommer: false, rang: 0 }) });
  return { numeros, segments, longueur: Math.max(...numeros.map(x => x.length)), max: op.max };
}

// Dernier n° utilisé affiché dans l'éditeur : compteur courant (ou compteur historique pour les documents).
async function zonesAvecCompteurs(pool, cle, zones, iso) {
  const op = PAR_CLE[cle];
  const sortie = [];
  for (let i = 0; i < zones.length; i++) {
    const z = { ...zones[i] };
    if (z.t === 'seq') {
      const courant = await lireCompteur(pool, nomCompteur(cle, i, z.reset, iso));
      if (courant) z.last = courant;
      else if (op.seqName && (z.last || 0) === 0) z.last = await lireCompteur(pool, op.seqName);
    }
    sortie.push(z);
  }
  return sortie;
}

async function lister(pool) {
  const f = await formats(pool);
  const iso = jourISO();
  const out = [];
  for (const op of OPERATIONS) {
    const cur = f[op.cle] || { mode: 'actuel', zones: [], date_application: null };
    const prop = await zonesAvecCompteurs(pool, op.cle, proposition(op.cle), iso);
    const perso = cur.mode === 'perso' ? await zonesAvecCompteurs(pool, op.cle, cur.zones, iso) : (cur.zones.length ? cur.zones : prop);
    const ex = async (zones) => (await apercu(pool, op.cle, zones, {}, 1)).numeros[0];
    out.push({
      cle: op.cle, groupe: op.groupe, nom: op.nom, kind: op.kind, legal: !!op.legal, max: op.max,
      date_label: op.dateLabel, p1: op.p1 || null, p2: op.p2 || null, note: op.note || null,
      mode: cur.mode, date_application: cur.date_application,
      zones: cur.mode === 'perso' ? perso : cur.mode === 'prop' ? prop : prop,
      proposition: prop, exemple_proposition: await ex(prop), exemple_actuel: op.legacy,
      exemple_perso: cur.mode === 'perso' ? await ex(perso) : null,
    });
  }
  return out;
}

async function enregistrer(pool, cle, { mode, zones, date_application }, utilisateur) {
  const op = PAR_CLE[cle];
  if (!op) throw Object.assign(new Invalide('Opération inconnue.'), { status: 404 });
  if (!['actuel', 'prop', 'perso'].includes(mode)) throw new Invalide('Mode inconnu (actuel, prop ou perso).');
  let propres = [];
  if (mode !== 'actuel') {
    const base = mode === 'prop' ? proposition(cle).map((z, i) => (z.t === 'seq' && zones && zones[i] ? { ...z, last: zones[i].last } : z)) : zones;
    propres = verifierZones(op, base);
    const sortie = await apercu(pool, cle, propres, {}, 3);
    if (sortie.longueur > op.max) throw new Invalide(`Le numéro fait ${sortie.longueur} caractères : le maximum pour « ${op.nom} » est ${op.max}.`);
    // Le « dernier n° utilisé » saisi devient la valeur du compteur dans la période en cours.
    const iso = jourISO();
    for (let i = 0; i < propres.length; i++) {
      const z = propres[i];
      if (z.t !== 'seq') continue;
      const nom = nomCompteur(cle, i, z.reset, iso);
      const actuel = await lireCompteur(pool, nom);
      const voulu = z.last || (actuel ? actuel : op.seqName ? await lireCompteur(pool, op.seqName) : 0);
      await fixerCompteur(pool, nom, voulu);
    }
  }
  const date = date_application ? jourISO(date_application) : null;
  await pool.query(
    `INSERT INTO numerotation_formats (cle, mode, zones, date_application, updated_by) VALUES ($1,$2,$3,$4,$5)
     ON DUPLICATE KEY UPDATE mode = VALUES(mode), zones = VALUES(zones), date_application = VALUES(date_application), updated_by = VALUES(updated_by)`,
    [cle, mode, JSON.stringify(propres), date, utilisateur || null]);
  vider();
}

module.exports = { OPERATIONS, PAR_CLE, PAR_SEQ, proposition, numeroPour, modeDe, apercu, lister, enregistrer, verifierZones, vider, jourISO };
