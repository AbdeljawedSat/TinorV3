// ============================================================================
// Reprise de l'historique des registres papier (classeur Excel « BD_tinorexel »)
// dans la base TinOR : pépins → presse → filtration → mélange/flaconnage → sorties.
//
// Usage : node scripts/importer-registres.js [classeur.xlsx]
//         (connexion : variables DB_* de l'environnement, base DB_NAME=tinor_reel)
//
// La base doit être NEUVE (créée par base/tinor_reel_creation.sql). Le script écrit
// comme le ferait l'application (lots, lots_presse, lots_filtration, conditionnements,
// lot_origines, stock_mouvements, historique de statut) et REFUSE de s'exécuter si des
// lots existent déjà. Tout est dans une transaction : tout ou rien.
//
// Les corrections de saisie des registres (numéros de lot mal recopiés, dates…) sont
// listées dans CORRECTIONS ci-dessous et dans base/RAPPORT_IMPORT_REGISTRES.md.
// ============================================================================
const path = require('path');
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise');

const CLASSEUR = process.argv[2] || path.join(__dirname, '..', 'base', 'source', 'BD_tinorexel.xlsx');
const ml = (litres) => Math.round(Number(litres) * 1000);          // L → ml entier (évite les erreurs de virgule)
const L = (m) => m / 1000;
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const ajouterAns = (date, n) => `${Number(date.slice(0, 4)) + n}${date.slice(4)}`;
const pad6 = (v) => String(v).padStart(6, '0');                    // Excel a retiré le 0 initial : 11823 → 011823

// ---------------------------------------------------------------------------
// Corrections des erreurs de saisie des registres (clé = valeur lue dans le classeur)
// ---------------------------------------------------------------------------
const CORRECTIONS = {
  // registre de presse : la date saisie (18/02) ne correspond pas au n° de lot (…0318H) ni à l'ordre chronologique
  datePresse: { '11-2313-20240318H': '2024-03-18' },
  // registre de filtration : n° du lot de presse mal recopié → vrai lot de presse
  lotPresse: {
    '01-2312-20231217H': '01-2314-20231217H',   // le registre de presse dit fournisseur 2314
    '25-2312-20240505H': '25-2312-20240427H',   // pressé le 27/04, pas le 05/05
    '08-2312-20240210H': '08-2313-20240210H',   // 2313 (22,2 kg du 10/02) ; la quantité filtrée complète le lot
    '03-JG01/2023-20231218H': '03-GJ01/2023-20231218H', // JG → GJ
  },
  // mélange : référence du registre (normalisée) → n° du lot filtré
  lotFiltre: {
    '23-2312-20240331': '23-2312-20240331',
    '18-GJ01/23-20240325': '18-GJ01/2023-20240325',
    '25-2312-20240427': '25-2312-20240427',
    '25-2312-20242704': '25-2312-20240427',
    '08-GJ01/2320240210': '08-GJ01/2023-20241105',
    '08-231320240210': '08-2313-20241105',
    '05-GJ01/2023-20231224': '05-GJ01/2023-20231224',
    '02-2314-20241009': '02-2314-20241009',
    '18-GJ01/2023-20240325': '18-GJ01/2023-20240325',
    '03-GJ01/2023-20251105': '03-GJ01/2023-20250115',
    '24-2312-20240407': '24-2312-20240407',
    '15-GJ01/2023-20240321': '15-GJ01/2023-20240321',
    '08-GJ01/2023-20250122': '08-GJ01/2023-20250122',
    '08-2313-20250123': '08-2313-20250123',
    '01-2312-20231217': '01-2314-20231217',
    '06-GJ01/2023-20251105': '06-GJ01/2023-20251105',
  },
};

// ---------------------------------------------------------------------------
// Flaconnage (registre de stock produit fini) — [date, lot fini, ml du flacon, nombre, remarque]
// ---------------------------------------------------------------------------
const FLACONNAGE = [
  ['2024-09-22', '011823', 10, 80],
  ['2024-09-23', '021825', 10, 21],
  ['2024-09-23', '021825', 30, 19],
  ['2024-09-24', '021825', 10, 2],
  ['2025-01-15', '042505', 30, 28],
  ['2025-04-10', '050502', 30, 32],
  ['2025-04-03', '061803', 30, 7],
  ['2025-04-15', '070324', 30, 14],
  ['2025-05-04', '082415', 30, 4],
  ['2025-08-05', '082415', 10, 20],
  ['2026-01-01', '082415', 10, 134],
  ['2026-02-01', '090808', 30, 10],
  ['2026-02-01', '090808', 10, 8],
  ['2026-04-07', '090808', 30, 6],
  ['2026-04-08', '090808', 10, 19, '2 ml de perte'],
  ['2026-05-09', '030808', 30, 1],
  ['2026-05-09', '030808', 10, 2, '5 ml de perte'],
  ['2026-05-10', '100106', 30, 26],
  ['2026-05-11', '100106', 10, 59],
];

// ---------------------------------------------------------------------------
// Sorties (registre « mouvement ») — [n° registre, date, client, [[lot fini, ml, nombre], …], remarque]
// ---------------------------------------------------------------------------
const VENTES = [
  ['—', '2025-05-04', null, [['082415', 30, 4]], 'sortie du registre mélange (04/05/2025), absente du registre des ventes'],
  [3, '2025-06-10', 'Gisel', [['042505', 30, 22], ['050502', 30, 3]]],
  [2, '2025-07-10', 'Client particulier', [['021825', 10, 2]]],
  [1, '2025-08-14', 'Berntrard', [['021825', 30, 19], ['042505', 30, 6]]],
  [4, '2025-08-14', 'louccy', [['050502', 30, 25]]],
  [5, '2025-08-14', 'Gosef', [['061803', 30, 7], ['050502', 30, 4], ['070324', 30, 14]]],
  [6, '2025-08-19', 'client Passage', [['082415', 10, 20]], 'registre : « 6*30=180 + 2*10=20 » (200 ml) ; enregistré en 20 flacons de 10 ml (le lot n\'a que 4 flacons de 30 ml, déjà sortis le 04/05)'],
  [7, '2025-09-06', 'ben abdesslem', [['011823', 10, 20]]],
  [8, '2025-09-10', 'artisanet', [['011823', 10, 30]]],
  [9, '2025-09-15', 'omran khaled', [['011823', 10, 30]]],
  [10, '2025-11-15', 'louccy', [['021825', 10, 21]]],
  [11, '2026-01-09', 'ben abdesslem', [['082415', 10, 30]]],
  [12, '2026-01-16', 'omran khaled', [['082415', 10, 50]]],
  [13, '2026-01-26', 'Relax and spay', [['082415', 10, 21]]],
  [14, '2026-02-18', 'biojerba', [['082415', 10, 20]]],
  [15, '2026-02-19', 'artisanet', [['082415', 10, 13]]],
  [16, '2026-02-21', 'client', [['090808', 30, 3], ['090808', 10, 3]]],
  [17, '2026-02-23', 'bernard', [['090808', 30, 4], ['090808', 10, 4]]],
  [18, '2026-03-14', 'omran khaled', [['090808', 30, 3], ['090808', 10, 1]]],
  [18, '2026-05-22', 'client passaget', [['030808', 30, 1], ['030808', 10, 2]]],
  [18, '2026-05-26', 'artizanet', [['090808', 30, 6], ['090808', 10, 19]]],
  [18, '2026-07-19', 'passaget claude', [['100106', 30, 26], ['100106', 10, 59]]],
];
// Clients : variantes d'orthographe évidentes regroupées (casse/typo), les autres laissées telles quelles.
const NOM_CLIENT = { artizanet: 'artisanet' };

// ---------------------------------------------------------------------------
async function lireClasseur() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CLASSEUR);
  const feuille = (debut) => wb.worksheets.find(w => w.name.toLowerCase().startsWith(debut));
  const lignes = (ws) => { const out = []; ws.eachRow({ includeEmpty: false }, (r, n) => out.push({ n, v: r.values.slice(1) })); return out; };
  const val = (c) => (c && typeof c === 'object' && !(c instanceof Date) ? (c.result ?? c.text ?? '') : c);

  const presse = lignes(feuille('registre de press')).slice(1).map(({ n, v }) => {
    const [, date, lotMp, kg, outil, litres, numero] = v.map(val);
    const num = String(numero).trim();
    return { ligne: n, date: CORRECTIONS.datePresse[num] || iso(date), lotMp: String(lotMp).trim(), kg: Number(kg), outil: String(outil), ml: ml(litres), numero: num, dateSaisie: iso(date) };
  });

  const filtration = lignes(feuille('registre filtration')).slice(2)
    .filter(({ v }) => typeof val(v[0]) === 'number')
    .map(({ n, v }) => {
      const [num, date, lotPresse, qIni, filtre, qFini, lotFiltre] = v.map(val);
      const brut = String(lotPresse).trim();
      const cle = brut.replace(/h$/i, 'H');
      return { ligne: n, numReg: num, date: iso(date), lotPresseBrut: brut, lotPresse: CORRECTIONS.lotPresse[cle] || cle.replace(/^(\d+)-JG/, '$1-GJ'),
        ml: ml(qIni), filtre: String(filtre), mlFini: ml(qFini), lotFiltreSaisi: String(lotFiltre).trim() };
    });

  const melange = lignes(feuille('registre melange')).filter(({ v }) => typeof val(v[0]) === 'number').map(({ n, v }) => {
    const x = v.map(val);
    return { ligne: n, date: iso(x[1]), lot: pad6(x[2]), ml: Number(x[3]), s1: String(x[4]).trim(), q1: Number(x[5]), s2: String(x[7]).trim(), q2: Number(x[8]) };
  });
  return { presse, filtration, melange };
}

const normRef = (s) => s.replace(/h$/i, '').replace(/^(\d+)-jG/i, '$1-GJ').replace(/\s+/g, '');

async function main() {
  const { presse, filtration, melange } = await lireClasseur();
  const anomalies = [];

  // ---- Lots de presse
  const lotsPresse = new Map(presse.map(p => { p.restant = p.ml; return [p.numero.toUpperCase(), p]; }));
  if (lotsPresse.size !== presse.length) throw new Error('N° de lot de presse en double.');

  // ---- Lots filtrés : n° = règle de l'application (n° de presse sans « H », date de filtration)
  const lotsFiltres = new Map();
  for (const f of filtration) {
    const lp = lotsPresse.get(f.lotPresse.toUpperCase());
    if (!lp) throw new Error(`Filtration ligne ${f.ligne} : lot de presse « ${f.lotPresseBrut} » introuvable.`);
    const m = /^(\d+)-(.+)-\d{8}H$/.exec(lp.numero);
    const numero = `${m[1]}-${m[2]}-${f.date.replace(/-/g, '')}`;
    if (numero.toUpperCase() !== f.lotFiltreSaisi.toUpperCase()) anomalies.push(`filtration ligne ${f.ligne} : n° saisi « ${f.lotFiltreSaisi} » → « ${numero} »`);
    if (f.lotPresse !== f.lotPresseBrut.replace(/h$/i, 'H')) anomalies.push(`filtration ligne ${f.ligne} : lot de presse saisi « ${f.lotPresseBrut} » → « ${lp.numero} »`);
    if (lotsFiltres.has(numero.toUpperCase())) throw new Error(`Lot filtré en double : ${numero}`);
    if (f.ml > lp.restant) throw new Error(`Filtration ${numero} : ${f.ml} ml demandés, ${lp.restant} ml disponibles sur ${lp.numero}.`);
    lp.restant -= f.ml;
    lotsFiltres.set(numero.toUpperCase(), { ...f, numero, presse: lp, restant: f.mlFini });
  }

  // ---- Mélanges : chaque lot fini = 2 lots filtrés (ml)
  const lotsFinis = new Map();
  for (const m of melange) {
    const src = [[m.s1, m.q1], [m.s2, m.q2]].map(([ref, q]) => {
      const cible = CORRECTIONS.lotFiltre[normRef(ref)];
      const lf = cible && lotsFiltres.get(cible.toUpperCase());
      if (!lf) throw new Error(`Mélange ${m.lot} : lot filtré « ${ref} » non résolu.`);
      if (q > lf.restant) throw new Error(`Mélange ${m.lot} : ${q} ml demandés sur ${lf.numero}, reste ${lf.restant}.`);
      lf.restant -= q;
      if (cible !== normRef(ref)) anomalies.push(`mélange ${m.lot} : source « ${ref} » → « ${lf.numero} »`);
      return { lf, ml: q };
    });
    if (src[0].ml + src[1].ml !== m.ml) throw new Error(`Mélange ${m.lot} : sources ≠ total.`);
    lotsFinis.set(m.lot, { ...m, src, consomme: 0 });
  }

  // ---- Flaconnage : un lot TinOR par (lot fini, format) — 2e format = suffixe -2 (règle de l'application)
  const lotsFlacons = new Map(); // `${lot}|${format}` → { numero, ... }
  const parLotFini = new Map();
  for (const [date, lot, fmt, nb, rem] of FLACONNAGE) {
    if (!lotsFinis.has(lot)) throw new Error(`Flaconnage : lot fini ${lot} inconnu.`);
    const cle = `${lot}|${fmt}`;
    if (!lotsFlacons.has(cle)) {
      const rang = parLotFini.get(lot) || 0; parLotFini.set(lot, rang + 1);
      lotsFlacons.set(cle, { cle, lot, fmt, numero: rang ? `${lot}-${rang + 1}` : lot, premiereDate: date, initial: 0, restant: 0, ops: [] });
    }
    const lf = lotsFlacons.get(cle);
    lf.initial += nb; lf.restant += nb; lf.ops.push({ date, nb, rem });
  }

  // ---- Sorties
  for (const [reg, date, client, lignes, rem] of VENTES) {
    for (const [lot, fmt, nb] of lignes) {
      const lf = lotsFlacons.get(`${lot}|${fmt}`);
      if (!lf) throw new Error(`Sortie ${reg} : flacons ${fmt} ml du lot ${lot} inexistants.`);
      if (nb > lf.restant) throw new Error(`Sortie ${reg} (${date}) : ${nb} × ${fmt} ml demandés sur ${lf.numero}, il en reste ${lf.restant}.`);
      lf.restant -= nb;
    }
  }

  // ---- Contrôles de cohérence entre registres (avant toute écriture)
  for (const lf of lotsFlacons.values()) {
    if (lf.restant !== 0) anomalies.push(`stock flacons non nul : ${lf.numero} (${lf.fmt} ml) reste ${lf.restant}`);
  }
  for (const f of lotsFinis.values()) {
    const contenu = FLACONNAGE.filter(x => x[1] === f.lot).reduce((t, x) => t + x[2] * x[3], 0);
    if (contenu > f.ml) throw new Error(`Lot fini ${f.lot} : flacons (${contenu} ml) > mélange (${f.ml} ml).`);
    f.perte = f.ml - contenu;
  }

  // =========================================================================
  // ÉCRITURE
  // =========================================================================
  const cx = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'tinor_reel', decimalNumbers: true, dateStrings: true,
  });
  const run = async (sql, p = []) => { try { return (await cx.execute(sql, p))[0]; } catch (e) { e.message += ' | ' + sql.slice(0, 80) + ' | ' + JSON.stringify(p); throw e; } };
  const un = async (sql, p = []) => (await run(sql, p))[0];
  await cx.beginTransaction();
  try {
    if ((await un('SELECT COUNT(*) n FROM lots')).n > 0 || (await un('SELECT COUNT(*) n FROM produits')).n > 0) {
      throw new Error('La base contient déjà des produits ou des lots : import refusé (base neuve requise).');
    }
    const settings = await un('SELECT lot_format_style s FROM settings WHERE id = 1');
    if (settings.s !== 'jardins_jerba') throw new Error('La numérotation « Jardins de Jerba » doit être active.');
    const unite = Object.fromEntries((await run('SELECT id, code FROM unites')).map(u => [u.code, u.id]));
    const format = Object.fromEntries((await run('SELECT id, volume FROM formats')).map(f => [Number(f.volume), f.id]));
    const local = Object.fromEntries((await run('SELECT id, code FROM locaux')).map(l => [l.code, l.id]));
    const catHuile = (await un("SELECT id FROM categories WHERE code = 'HUILE'")).id;
    const catMp = (await run("INSERT INTO categories (code, nom, type_category) VALUES ('MP','Matières premières','MATIERE')")).insertId;

    // ---- Produits
    const produit = async (code, nom, cat, uni, type, extra = {}) => (await run(
      `INSERT INTO produits (code, nom, categorie_id, unite_id, format_id, type_article, produit_source_id, vendable, achetable, fabriquable, stockable, bio_eligible, tva, prix_vente)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,1,19,?)`,
      [code, nom, cat, uni, extra.format || null, type, extra.source || null, extra.vendable ? 1 : 0, extra.achetable ? 1 : 0, extra.fabriquable ? 1 : 0, extra.prix || null])).insertId;
    const pPepins = await produit('01', 'Pépins de figue de barbarie', catMp, unite.kg, 'MATIERE_PREMIERE', { achetable: true });
    const pVrac = await produit('02', 'Huile de pépins de figue de barbarie — Vrac', catHuile, unite.litre, 'PRODUIT_FABRIQUE', { fabriquable: true });
    const pFiltree = await produit('03', 'Huile de pépins de figue de barbarie — Filtrée', catHuile, unite.litre, 'PRODUIT_FABRIQUE', { fabriquable: true, source: pVrac });
    const pFlacon = {};
    pFlacon[10] = await produit('04', 'Huile de pépins de figue de barbarie — Flacon 10ml', catHuile, unite.unite, 'PRODUIT_FABRIQUE', { format: format[10], source: pVrac, vendable: true, fabriquable: true, prix: 20 });
    pFlacon[30] = await produit('05', 'Huile de pépins de figue de barbarie — Flacon 30ml', catHuile, unite.unite, 'PRODUIT_FABRIQUE', { format: format[30], source: pVrac, vendable: true, fabriquable: true, prix: 62 });
    await run("UPDATE sequences SET `last_value` = 5 WHERE name = 'produit_code_seq'");

    // ---- Clients
    const clients = new Map();
    for (const v of VENTES) {
      if (!v[2]) continue;
      const nom = NOM_CLIENT[v[2]] || v[2];
      if (!clients.has(nom.toLowerCase())) {
        clients.set(nom.toLowerCase(), (await run(`INSERT INTO clients (nom, ville, type, notes) VALUES (?,?, 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)')`, [nom, 'Djerba'])).insertId);
      }
    }

    // ---- Opérations chronologiques
    let nbMvt = 0;
    const numMvt = () => `MVT-${String(++nbMvt).padStart(4, '0')}`;
    const lotIdParNumero = new Map();
    const histEpuise = async (lotId, date, motif) => {
      await run(`UPDATE lots SET statut = 'EPUISE' WHERE id = ?`, [lotId]);
      await run(`INSERT INTO lot_statuts_historique (lot_id, statut, motif, date_debut) VALUES (?,?,?,?)`, [lotId, 'EPUISE', motif, `${date} 00:00:00`]);
    };
    const creerLot = async ({ produit_id, numero, origine, date, qte, local_id, expiration = null, lotFournisseur = null, notes = null, champs = null }) => {
      const id = (await run(
        `INSERT INTO lots (produit_id, numero_lot, origine, lot_fournisseur, bio_status, local_id, date_production, date_expiration, quantite_initiale, quantite_actuelle, statut, notes, champs_perso, created_at)
         VALUES (?,?,?,?, 'A_VERIFIER', ?,?,?,?,?, 'LIBERE', ?,?,?)`,
        [produit_id, numero, origine, lotFournisseur, local_id, date, expiration, qte, qte, notes, champs ? JSON.stringify(champs) : null, `${date || '2023-12-17'} 00:00:00`])).insertId;
      await run(`INSERT INTO lot_statuts_historique (lot_id, statut, motif, date_debut) VALUES (?,?,?,?)`, [id, 'LIBERE', 'Reprise des registres papier', `${date || '2023-12-17'} 00:00:00`]);
      lotIdParNumero.set(numero, id);
      return id;
    };
    // Sortie d'un lot source (consommation) : décrémente, trace l'origine, écrit le mouvement.
    const consommer = async ({ lotId, filsId, qte, date, num, groupe, srcType, srcId, motifEpuise }) => {
      await run('UPDATE lots SET quantite_actuelle = quantite_actuelle - ? WHERE id = ? AND quantite_actuelle >= ?', [L(qte), lotId, L(qte)]);
      await run('INSERT INTO lot_origines (lot_fils_id, lot_source_id, quantite_utilisee) VALUES (?,?,?)', [filsId, lotId, L(qte)]);
      const lot = await un('SELECT produit_id, quantite_actuelle q FROM lots WHERE id = ?', [lotId]);
      if (Number(lot.q) <= 0) await histEpuise(lotId, date, motifEpuise);
      await run(`INSERT INTO stock_mouvements (numero, date_mouvement, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, group_id)
                 VALUES (?,?, 'CONSOMMATION','SORTIE',?,?,?,?,?,?)`, [num, `${date} 00:00:00`, lot.produit_id, lotId, L(qte), srcType, srcId, groupe]);
    };
    const entree = (prodId, lotId, qte, date, type, num, groupe, srcType, srcId) => run(
      `INSERT INTO stock_mouvements (numero, date_mouvement, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, group_id)
       VALUES (?,?,?,'ENTREE',?,?,?,?,?,?)`, [num, `${date} 00:00:00`, type, prodId, lotId, qte, srcType, srcId, groupe]);
    const uuid = () => require('crypto').randomUUID();

    const evenements = [];
    // pépins : un lot par n° de lot fournisseur, quantité reçue inconnue = total pressé
    const pepins = new Map();
    for (const p of presse) {
      if (!pepins.has(p.lotMp)) pepins.set(p.lotMp, { numero: p.lotMp, premiere: p.date, kg: 0 });
      pepins.get(p.lotMp).kg += p.kg;
    }
    for (const mp of pepins.values()) evenements.push({ date: mp.premiere, ordre: 0, tri: mp.numero, fait: async () => {
      const id = await creerLot({ produit_id: pPepins, numero: mp.numero, origine: 'RECEPTION_MP', date: null, qte: mp.kg, local_id: local.ATELIER, lotFournisseur: mp.numero,
        notes: 'Quantité reçue non renseignée dans les registres : égale au total pressé (à corriger par un inventaire)', champs: { etape_reprise: 'MP' } });
      await run('UPDATE lots SET created_at = ? WHERE id = ?', [`${mp.premiere} 00:00:00`, id]);
      await entree(pPepins, id, mp.kg, mp.premiere, 'RECEPTION', numMvt(), uuid(), 'reception_registre', id);
      mp.id = id;
    } });
    for (const p of presse) evenements.push({ date: p.date, ordre: 1, tri: p.numero, fait: async () => {
      const mp = pepins.get(p.lotMp);
      const groupe = uuid();
      const lotId = await creerLot({ produit_id: pVrac, numero: p.numero, origine: 'PRESSE', date: p.date, qte: L(p.ml), local_id: local.ATELIER,
        notes: `Registre de presse n° ${p.ligne - 1} · outil n° ${p.outil}`, champs: { etape_reprise: 'PRESSE' } });
      const id = (await run(
        `INSERT INTO lots_presse (date, produit_id, lot_id, quantite_matiere_utilisee, quantite_produite, rendement_reel, numero_lot, notes) VALUES (?,?,?,?,?,?,?,?)`,
        [p.date, pVrac, lotId, p.kg, L(p.ml), L(p.ml) / p.kg, p.numero, `Outil n° ${p.outil} (registre de presse)`])).insertId;
      p.lp = id; p.lotId = lotId;
      await consommer({ lotId: mp.id, filsId: lotId, qte: Math.round(p.kg * 1000), date: p.date, num: numMvt(), groupe, srcType: 'lots_presse', srcId: lotId, motifEpuise: 'Stock épuisé après consommation en production' });
      await entree(pVrac, lotId, L(p.ml), p.date, 'PRODUCTION', numMvt(), groupe, 'lots_presse', lotId);
    } });
    for (const f of [...lotsFiltres.values()]) evenements.push({ date: f.date, ordre: 2, tri: f.numero, fait: async () => {
      const lp = f.presse; const groupe = uuid();
      const lotId = await creerLot({ produit_id: pFiltree, numero: f.numero, origine: 'FILTRATION', date: f.date, qte: L(f.mlFini), local_id: local.ATELIER,
        notes: f.lotFiltreSaisi.toUpperCase() !== f.numero.toUpperCase() ? `N° saisi dans le registre : ${f.lotFiltreSaisi}` : null, champs: { etape_reprise: 'FILTRATION' } });
      const id = (await run(
        `INSERT INTO lots_filtration (date, produit_id, lot_id, filtre_utilise, quantite_dechet, quantite_produite, rendement_reel, numero_lot, notes) VALUES (?,?,?,?,?,?,?,?,?)`,
        [f.date, pFiltree, lotId, f.filtre, L(f.ml - f.mlFini), L(f.mlFini), f.mlFini / f.ml, f.numero, `N° d'ordre du registre de filtration : ${f.numReg}`])).insertId;
      f.lf = id; f.lotId = lotId;
      await run('INSERT INTO lots_filtration_sources (lot_filtration_id, lot_presse_id, quantite_utilisee) VALUES (?,?,?)', [id, lp.lp, L(f.ml)]);
      await consommer({ lotId: lp.lotId, filsId: lotId, qte: f.ml, date: f.date, num: numMvt(), groupe, srcType: 'lots_filtration', srcId: id, motifEpuise: 'Stock épuisé après consommation en production' });
      await entree(pFiltree, lotId, L(f.mlFini), f.date, 'PRODUCTION', numMvt(), groupe, 'lots_filtration', id);
    } });

    // flaconnage : une opération par ligne du registre ; sources = les 2 huiles filtrées au prorata du mélange
    const flaconnages = FLACONNAGE.map((x, i) => ({ date: x[0], lot: x[1], fmt: x[2], nb: x[3], rem: x[4], i }));
    const dernierDuLot = new Map();
    for (const op of flaconnages) dernierDuLot.set(op.lot, op); // la perte est imputée à la dernière opération du lot
    for (const op of flaconnages) evenements.push({ date: op.date, ordre: 3, tri: `${op.lot}-${op.i}`, fait: async () => {
      const fin = lotsFinis.get(op.lot); const lf = lotsFlacons.get(`${op.lot}|${op.fmt}`);
      let contenu = op.fmt * op.nb + (dernierDuLot.get(op.lot) === op ? fin.perte : 0);
      const parts = fin.src.map((s, k) => { // répartition entière, le dernier prend le reste
        const q = k === fin.src.length - 1 ? contenu : Math.round(contenu * s.ml / fin.ml); contenu -= q; return q; });
      const total = parts.reduce((a, b) => a + b, 0);
      let lotId = lotIdParNumero.get(lf.numero);
      if (!lotId) {
        lotId = await creerLot({ produit_id: pFlacon[op.fmt], numero: lf.numero, origine: 'CONDITIONNEMENT', date: lf.premiereDate, qte: lf.initial, local_id: local.STOCK1,
          expiration: ajouterAns(lf.premiereDate, 3),
          notes: `Lot fini ${op.lot} (mélange du ${fin.date}, ${fin.ml} ml)${lf.numero !== op.lot ? ` — flacons de ${op.fmt} ml` : ''}. Péremption = production + 3 ans (colonne « Date d'expiration » = 3 du registre)`,
          champs: { etape_reprise: 'CONDITIONNEMENT', lot_fini_registre: op.lot } });
        // le lot est créé avec la quantité totale prévue : on remet à 0 puis on alimente par chaque opération
        await run('UPDATE lots SET quantite_actuelle = 0 WHERE id = ?', [lotId]);
      }
      const cond = (await run(
        `INSERT INTO conditionnements (date, produit_id, format_id, lot_id, qty, quantite_source_utilisee, note) VALUES (?,?,?,?,?,?,?)`,
        [op.date, pFlacon[op.fmt], format[op.fmt], lotId, op.nb, L(total), [op.rem, `Lot fini ${op.lot}`].filter(Boolean).join(' · ')])).insertId;
      const groupe = uuid(); const base = numMvt();
      for (const [k, s] of fin.src.entries()) {
        if (!parts[k]) continue;
        await run('INSERT INTO conditionnement_sources (conditionnement_id, lot_filtration_id, quantite_utilisee) VALUES (?,?,?)', [cond, s.lf.lf, L(parts[k])]);
        await consommer({ lotId: s.lf.lotId, filsId: lotId, qte: parts[k], date: op.date, num: `${base}-OUT-filtration-${s.lf.lf}`, groupe, srcType: 'conditionnement', srcId: cond, motifEpuise: 'Stock épuisé après consommation en production' });
      }
      await run('UPDATE lots SET quantite_actuelle = quantite_actuelle + ? WHERE id = ?', [op.nb, lotId]);
      await entree(pFlacon[op.fmt], lotId, op.nb, op.date, 'CONDITIONNEMENT', `${base}-IN`, groupe, 'conditionnement', cond);
    } });

    for (const [reg, date, client, lignes, rem] of VENTES) for (const [lot, fmt, nb] of lignes) evenements.push({ date, ordre: 4, tri: `${reg}-${lot}-${fmt}`, fait: async () => {
      const lf = lotsFlacons.get(`${lot}|${fmt}`); const lotId = lotIdParNumero.get(lf.numero);
      await run('UPDATE lots SET quantite_actuelle = quantite_actuelle - ? WHERE id = ? AND quantite_actuelle >= ?', [nb, lotId, nb]);
      const q = (await un('SELECT quantite_actuelle q FROM lots WHERE id = ?', [lotId])).q;
      if (Number(q) <= 0) await histEpuise(lotId, date, 'Stock épuisé après vente');
      const nom = client ? (NOM_CLIENT[client] || client) : null;
      const note = [`Vente registre n° ${reg}`, nom ? `client : ${nom}` : 'client non renseigné', client ? 'paiement : espèces · livraison : Djerba' : null, rem].filter(Boolean).join(' · ');
      await run(`INSERT INTO stock_mouvements (numero, date_mouvement, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note)
                 VALUES (?,?, 'VENTE','SORTIE',?,?,?, 'registre_ventes', ?, ?)`,
        [numMvt(), `${date} 00:00:00`, pFlacon[fmt], lotId, nb, nom ? clients.get(nom.toLowerCase()) : null, note]);
    } });

    evenements.sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || a.tri.localeCompare(b.tri));
    for (const e of evenements) await e.fait();

    // ---- Compteurs de numérotation
    const maxXX = Math.max(...presse.map(p => Number(p.numero.split('-')[0])));
    const fini = {}; for (const f of lotsFinis.values()) { const a = f.date.slice(0, 4); fini[a] = Math.max(fini[a] || 0, Number(f.lot.slice(0, 2))); }
    const seq = async (nom, v) => run('INSERT INTO sequences (name, `last_value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `last_value` = GREATEST(`last_value`, VALUES(`last_value`))', [nom, v]);
    await seq('mouvement_seq', nbMvt); await seq('lot_jj_presse', maxXX);
    for (const [a, v] of Object.entries(fini)) await seq(`lot_jj_fini_${a}`, v);

    await cx.commit();
    console.log(`✓ Import terminé : ${pepins.size} lots de pépins, ${presse.length} pressages, ${lotsFiltres.size} filtrations, ${lotsFinis.size} lots finis, ${lotsFlacons.size} lots de flacons, ${nbMvt} mouvements, ${clients.size} clients.`);
    console.log(`Corrections appliquées (${anomalies.length}) :\n - ${anomalies.join('\n - ')}`);
  } catch (e) { await cx.rollback(); console.error('✗ Import annulé :', e.message); process.exitCode = 1; } finally { await cx.end(); }
}
main().catch(e => { console.error('✗', e.message); process.exit(1); });
