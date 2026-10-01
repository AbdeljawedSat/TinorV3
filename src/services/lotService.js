// Logique partagée par tous les modules qui créent des lots (réceptions, presse,
// filtration, conditionnement, production...) — centralisée ici pour éviter que
// chaque route réimplémente sa propre variante du protocole TT-SSS et finisse
// par diverger.

async function nextNumero(pool, seqName, prefix) {
  const upd = await pool.query(`UPDATE sequences SET last_value = last_value + 1 WHERE name = $1`, [seqName]);
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO sequences (name, last_value) VALUES ($1, 1)`, [seqName]);
  }
  const cur = await pool.query(`SELECT last_value FROM sequences WHERE name = $1`, [seqName]);
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
  AUTRE: 'X',
};

async function nextLotNumber(pool, produitId, origine) {
  const prod = await pool.query('SELECT code FROM produits WHERE id = $1', [produitId]);
  if (!prod.rows[0]) throw Object.assign(new Error('Produit introuvable.'), { status: 400 });

  const settingsRes = await pool.query('SELECT lot_format_style, lot_seq_par_origine FROM settings WHERE id = 1');
  const settings = settingsRes.rows[0] || {};
  const formatStyle = settings.lot_format_style || 'code_origine_seq';
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

// Crée un lot générique + sa première entrée d'historique de statut. Renvoie l'id du lot.
async function createLot(pool, { produit_id, origine, quantite, employe_id, motif, extra = {} }) {
  const numeroLot = await nextLotNumber(pool, produit_id, origine);
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
  await pool.query('UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2', [quantite, lotSourceId]);
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

module.exports = { nextNumero, nextLotNumber, createLot, consumeLot, recordEntree };
