// Logique partagée par tous les modules qui créent des lots (réceptions, presse,
// filtration, conditionnement, production...) — centralisée ici pour éviter que
// chaque route réimplémente sa propre variante du protocole TT-SSS et finisse
// par diverger.

const numerotation = require('./numerotation');

// ctx : { date, p1, p2 } — date de l'opération et numéro(s) d'origine (ex. la commande d'un BL),
// utilisés si l'opération a un format de numérotation choisi (écran « Numérotation »).
async function nextNumero(pool, seqName, prefix, ctx = {}) {
  const op = numerotation.PAR_SEQ[seqName];
  if (op) {
    const choisi = await numerotation.numeroPour(pool, op.cle, ctx);
    if (choisi) return choisi;
  }
  const upd = await pool.query(`UPDATE sequences SET \`last_value\` = \`last_value\` + 1 WHERE name = $1`, [seqName]);
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO sequences (name, \`last_value\`) VALUES ($1, 1)`, [seqName]);
  }
  const cur = await pool.query(`SELECT \`last_value\` FROM sequences WHERE name = $1`, [seqName]);
  return `${prefix}-${String(cur.rows[0].last_value).padStart(4, '0')}`;
}

// Préfixe visible dans le n° de lot selon l'étape d'origine — permet de
// reconnaître un lot d'un coup d'œil sans ouvrir sa fiche (ex: 01-P-004 =
// 4e lot du produit 01, issu d'un pressage).
const PREFIXE_ORIGINE = {
  RECEPTION_MP: 'MP',
  ACHAT: 'A',
  PRESSE: 'P',
  FILTRATION: 'F',
  CONDITIONNEMENT: 'PF',
  PRODUCTION_RECETTE: 'PR',
  INVENTAIRE: 'INV',
  MELANGE: 'M',
  AUTRE: 'X',
};

// ---------- Numérotation « Jardins de Jerba » (protocole maison) ----------
//   Matière première : n° du lot fournisseur, tel quel           GJ01/2023 · 2312
//   Presse           : XX-lotMP-AAAAMMJJH (XX = n° de pressage)  02-GJ01/2023-20230225H
//   Filtration       : même XX et lot MP, date de filtration      02-GJ01/2023-20241230
//   Lot fini (mélange): yy x1x1 x2x2 (yy = n° du lot fini, continue   090123
//                      d'une année à l'autre ; x1x1 / x2x2 = XX des deux
//                      huiles mélangées, x1x1 répété s'il n'y a qu'une huile)
//   Flacons          : n° du mélange + format                      090123-10ML
// Compteurs dans `sequences` (lot_jj_presse ; lot_jj_fini) : la reprise du
// stock les remet après les plus grands numéros repris. Un numéro déjà pris reçoit
// le suffixe -2, -3… Sans les informations nécessaires (pas de lot fournisseur,
// source dans un autre format…), la numérotation standard s'applique.
const pad2 = (n) => String(n).padStart(2, '0');
const jourCompact = (d) => String(d || new Date().toISOString()).slice(0, 10).replace(/-/g, '');
const RE_PRESSE_JJ = /^(\d+)-(.+)-\d{8}H(?:-\d+)?$/;
const RE_FILTRE_JJ = /^(\d+)-(.+)-\d{8}(?:-\d+)?$/;
const RE_FINI_JJ = /^(\d{2})\d{4,}(?:-\d+)?$/;

async function compteurSuivant(pool, nom) {
  const upd = await pool.query('UPDATE sequences SET `last_value` = `last_value` + 1 WHERE name = $1', [nom]);
  if (!upd.affectedRows) await pool.query('INSERT INTO sequences (name, `last_value`) VALUES ($1, 1)', [nom]);
  return Number((await pool.query('SELECT `last_value` AS v FROM sequences WHERE name = $1', [nom])).rows[0].v);
}
// Un compteur ne recule jamais : après une reprise, il repart au-delà du plus grand numéro repris.
async function compteurAuMoins(pool, nom, valeur) {
  const upd = await pool.query('UPDATE sequences SET `last_value` = GREATEST(`last_value`, $2) WHERE name = $1', [nom, valeur]);
  if (!upd.affectedRows) await pool.query('INSERT INTO sequences (name, `last_value`) VALUES ($1, $2)', [nom, valeur]);
}
async function numeroLibre(pool, base) {
  let numero = base, i = 2;
  while ((await pool.query('SELECT 1 FROM lots WHERE numero_lot = $1', [numero])).rows.length) numero = `${base}-${i++}`;
  return numero;
}
// Met les compteurs Jardins de Jerba au-delà d'un numéro repris, selon son étape
// (presse / filtration : XX ; lot fini / mélange : yy, qui continue d'une année à l'autre).
async function recalerCompteursJJ(pool, { numero, etape }) {
  if (etape === 'PRESSE' || etape === 'FILTRATION') {
    const p = RE_PRESSE_JJ.exec(numero) || RE_FILTRE_JJ.exec(numero);
    if (p) await compteurAuMoins(pool, 'lot_jj_presse', Number(p[1]));
  } else if (etape === 'CONDITIONNEMENT' || etape === 'MELANGE') {
    const f = RE_FINI_JJ.exec(numero);
    if (f) await compteurAuMoins(pool, 'lot_jj_fini', Number(f[1]));
  }
}
async function numeroJardinsJerba(pool, origine, ctx = {}) {
  if (origine === 'RECEPTION_MP' || origine === 'ACHAT') {
    const f = String(ctx.lot_fournisseur || '').trim();
    return f ? numeroLibre(pool, f) : null;
  }
  const ids = (ctx.sources || []).filter(s => s && s.lot_id);
  if (!ids.length) return null;
  const sources = [];
  for (const s of ids) {
    const l = (await pool.query('SELECT numero_lot FROM lots WHERE id = $1', [s.lot_id])).rows[0];
    if (l) sources.push({ numero: l.numero_lot, quantite: Number(s.quantite) || 0 });
  }
  if (!sources.length) return null;
  const principal = [...sources].sort((a, b) => b.quantite - a.quantite)[0];
  if (origine === 'PRESSE') {
    const xx = await compteurSuivant(pool, 'lot_jj_presse');
    return numeroLibre(pool, `${pad2(xx)}-${principal.numero}-${jourCompact(ctx.date)}H`);
  }
  if (origine === 'FILTRATION') {
    const m = RE_PRESSE_JJ.exec(principal.numero);
    return m ? numeroLibre(pool, `${m[1]}-${m[2]}-${jourCompact(ctx.date)}`) : null;
  }
  if (origine === 'CONDITIONNEMENT' || origine === 'MELANGE') {
    const xs = sources.map(s => (/^(\d+)-/.exec(s.numero) || [])[1]).filter(Boolean);
    if (!xs.length) return null;
    return numeroLibre(pool, `${pad2(await compteurSuivant(pool, 'lot_jj_fini'))}${pad2(xs[0])}${pad2(xs[1] || xs[0])}`);
  }
  return null;
}

const CLE_LOT = { RECEPTION_MP: 'lotmp', ACHAT: 'lotmp', PRESSE: 'presse', FILTRATION: 'filtration', MELANGE: 'melange', CONDITIONNEMENT: 'cond' };

// Numéro de lot selon le format choisi pour l'étape (écran « Numérotation »), ou null → format actuel.
async function numeroLotChoisi(pool, cle, produit, origine, ctx) {
  if (await numerotation.modeDe(pool, cle) === 'actuel') return null;
  if (cle === 'lotmp' && String(ctx.lot_fournisseur || '').trim()) return numeroLibre(pool, String(ctx.lot_fournisseur).trim()); // le n° du fournisseur est gardé
  const noms = [];
  const tri = [...(ctx.sources || [])].filter(s => s && s.lot_id);
  for (const s of tri) {
    const l = (await pool.query('SELECT numero_lot FROM lots WHERE id = $1', [s.lot_id])).rows[0];
    if (l) noms.push({ numero: l.numero_lot, quantite: Number(s.quantite) || 0 });
  }
  // Presse, filtration, conditionnement : l'origine principale est le lot le plus utilisé ; mélange : dans l'ordre saisi.
  const ordre = cle === 'melange' ? noms : [...noms].sort((a, b) => b.quantite - a.quantite);
  const brut = await numerotation.numeroPour(pool, cle, {
    date: ctx.date, p1: ctx.p1 ?? (ordre[0] && ordre[0].numero) ?? String(ctx.lot_fournisseur || ''), p2: ctx.p2 ?? (ordre[1] && ordre[1].numero) ?? '',
    prod: produit.code, contenance: ctx.contenance,
  });
  return brut ? numeroLibre(pool, brut) : null;
}

async function nextLotNumber(pool, produitId, origine, ctx = {}) {
  const prod = await pool.query('SELECT code FROM produits WHERE id = $1', [produitId]);
  if (!prod.rows[0]) throw Object.assign(new Error('Produit introuvable.'), { status: 400 });
  if (CLE_LOT[origine]) {
    const choisi = await numeroLotChoisi(pool, CLE_LOT[origine], prod.rows[0], origine, ctx);
    if (choisi) return choisi;
  }

  const settingsRes = await pool.query('SELECT lot_format_style, lot_seq_par_origine FROM settings WHERE id = 1');
  const settings = settingsRes.rows[0] || {};
  const formatStyle = settings.lot_format_style || 'code_origine_seq';
  if (formatStyle === 'jardins_jerba') {
    const numero = await numeroJardinsJerba(pool, origine, ctx);
    if (numero) return numero;
  }
  const seqParOrigine = !!settings.lot_seq_par_origine;

  // Clé de séquence : '' = partagée entre toutes les origines pour ce produit
  // (comportement historique) ; sinon une ligne par origine, remise à 001 pour chacune.
  const cleOrigine = seqParOrigine ? origine : '';
  const upd = await pool.query(
    `UPDATE lot_sequences SET last_seq = last_seq + 1 WHERE produit_id = $1 AND origine = $2`,
    [produitId, cleOrigine]
  );
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO lot_sequences (produit_id, origine, last_seq) VALUES ($1, $2, 1)`, [produitId, cleOrigine]);
  }
  const seq = await pool.query('SELECT last_seq FROM lot_sequences WHERE produit_id = $1 AND origine = $2', [produitId, cleOrigine]);

  const code = prod.rows[0].code;
  const prefixe = PREFIXE_ORIGINE[origine] || '';
  const numeroSeq = String(seq.rows[0].last_seq).padStart(3, '0');

  if (formatStyle === 'origine_code_seq') {
    // Ex: P03-001 — préfixe d'origine collé au code produit, puis séquence.
    return prefixe ? `${prefixe}${code}-${numeroSeq}` : `${code}-${numeroSeq}`;
  }
  // Par défaut (code_origine_seq) — Ex: 03-P-001, comportement historique inchangé.
  const suffixe = prefixe ? `${prefixe}-` : '';
  return `${code}-${suffixe}${numeroSeq}`;
}

const { StockInsuffisant } = require('../db/transaction');
const { Invalide } = require('./regles');

// Seul point de décrément d'un lot. La condition `quantite_actuelle >= quantité`
// est évaluée par MariaDB au moment de l'écriture (lecture courante, ligne
// verrouillée) : deux opérations simultanées sur le même lot ne peuvent plus le
// faire passer sous zéro — la seconde est refusée et sa transaction annulée.
async function decrementerLot(pool, lotId, quantite) {
  // Une quantité nulle ou négative ferait AUGMENTER le stock du lot.
  if (!(Number(quantite) > 0)) throw new Invalide(`Quantité à consommer invalide (${quantite}) : elle doit être supérieure à 0.`);
  const upd = await pool.query(
    'UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2 AND quantite_actuelle >= $1',
    [quantite, lotId]
  );
  if (!upd.affectedRows) {
    // FOR UPDATE : lecture de la valeur à jour (pas celle du début de la transaction).
    const lot = await pool.query('SELECT numero_lot, quantite_actuelle FROM lots WHERE id = $1 FOR UPDATE', [lotId]);
    const l = lot.rows[0];
    throw new StockInsuffisant(l
      ? `Stock insuffisant sur le lot ${l.numero_lot} : disponible ${Number(l.quantite_actuelle)}, demandé ${Number(quantite)} (il a pu être utilisé entre-temps par une autre opération).`
      : 'Lot introuvable.');
  }
}

// Crée un lot générique + sa première entrée d'historique de statut. Renvoie l'id du lot.
// numerotation : { date, sources: [{ lot_id, quantite }] } — utilisé par la numérotation Jardins de Jerba.
// numero (facultatif) : n° imposé (ex. flacons d'un mélange « 090123-10ML »).
async function createLot(pool, { produit_id, origine, quantite, employe_id, motif, extra = {}, numerotation = {}, numero = null }) {
  const numeroLot = numero || await nextLotNumber(pool, produit_id, origine, { lot_fournisseur: extra.lot_fournisseur, ...numerotation });
  const insertRes = await pool.query(
    `INSERT INTO lots
      (produit_id, numero_lot, origine, fournisseur_id, lot_fournisseur, certificat_bio_id, bio_status,
       local_id, zone_id, date_expiration, quantite_initiale, quantite_actuelle, employe_id, champs_perso)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13)`,
    [
      produit_id, numeroLot, origine,
      extra.fournisseur_id || null, extra.lot_fournisseur || null, extra.certificat_bio_id || null,
      extra.bio_status || 'A_VERIFIER', extra.local_id || null, extra.zone_id || null,
      extra.date_expiration || null, quantite, employe_id || null,
      extra.champs_perso ? JSON.stringify(extra.champs_perso) : null,
    ]
  );
  const lotId = insertRes.insertId;
  await pool.query(
    `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'LIBERE',$2,$3)`,
    [lotId, motif || 'Création du lot', employe_id || null]
  );
  return { lotId, numeroLot };
}

// Décrémente un lot source, trace la traçabilité amont (lot_origines) et le
// mouvement de sortie de stock correspondant. Fait passer le lot à EPUISE
// s'il tombe à zéro.
async function consumeLot(pool, { lotSourceId, lotFilsId, quantite, typeMouvement, employeId, numeroMouvement, groupId, sourceType, sourceId }) {
  await decrementerLot(pool, lotSourceId, quantite);
  await pool.query(
    `INSERT INTO lot_origines (lot_fils_id, lot_source_id, quantite_utilisee) VALUES ($1,$2,$3)`,
    [lotFilsId, lotSourceId, quantite]
  );
  const apres = await pool.query('SELECT quantite_actuelle, produit_id FROM lots WHERE id = $1', [lotSourceId]);
  if (Number(apres.rows[0].quantite_actuelle) <= 0) {
    await pool.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1`, [lotSourceId]);
    await pool.query(
      `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'EPUISE','Stock épuisé après consommation en production',$2)`,
      [lotSourceId, employeId || null]
    );
  }
  await pool.query(
    `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, group_id, employe_id)
     VALUES ($1,$2,'SORTIE',$3,$4,$5,$6,$7,$8,$9)`,
    [numeroMouvement, typeMouvement, apres.rows[0].produit_id, lotSourceId, quantite, sourceType, sourceId, groupId, employeId || null]
  );
}

async function recordEntree(pool, { produitId, lotId, quantite, typeMouvement, employeId, numeroMouvement, groupId, sourceType, sourceId }) {
  await pool.query(
    `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, group_id, employe_id)
     VALUES ($1,$2,'ENTREE',$3,$4,$5,$6,$7,$8,$9)`,
    [numeroMouvement, typeMouvement, produitId, lotId, quantite, sourceType, sourceId, groupId, employeId || null]
  );
}

// Lot utilisable pour une sortie de stock : libéré ET non périmé.
// Ordre FEFO (premier expiré, premier sorti) : les lots datés passent d'abord,
// du plus proche de l'expiration au plus lointain, puis les lots sans date (FIFO).
const LOT_DISPONIBLE = `statut = 'LIBERE' AND (date_expiration IS NULL OR date_expiration >= CURDATE())`;
const ORDRE_FEFO = `(date_expiration IS NULL), date_expiration ASC, created_at ASC`;

module.exports = { numeroLibre, nextNumero, nextLotNumber, numeroJardinsJerba, recalerCompteursJJ, createLot, consumeLot, recordEntree, decrementerLot, LOT_DISPONIBLE, ORDRE_FEFO };
