// ============================================================================
// Produit le fichier SQL de l'import des registres (base/import_registres_jj.sql),
// à exécuter tel quel dans la base RÉEL (HeidiSQL, phpMyAdmin, mysql …) quand
// « npm run importer:registres » n'est pas utilisable.
//
// Source : une base NEUVE (tinor_reel_creation.sql) dans laquelle l'import vient
// d'être fait — elle ne contient que les données des registres :
//   DB_NAME=tinor_essai node scripts/importer-registres.js fichier.xlsx --appliquer
//   DB_NAME=tinor_essai node scripts/registres-en-sql.js base/import_registres_jj.sql
//
// Le SQL produit ne suppose rien sur la base cible : les identifiants sont décalés
// après les plus grands existants, les produits / fournisseurs sont retrouvés par leur
// nom (créés s'ils manquent), unités / catégorie / formats / local par leur code, et
// les n° de réception et de mouvement suivent les compteurs de la base. S'il trouve
// déjà un lot des registres, il s'arrête sans rien modifier.
// ============================================================================
const fs = require('fs');
require('../src/env');
const mysql = require('mysql2/promise');

const esc = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : mysql.escape(typeof v === 'object' ? JSON.stringify(v) : String(v)));
const off = (variable, id) => (id == null ? 'NULL' : `@${variable}+${id}`);
const numero = (prefixe, variable, n) => `CONCAT('${prefixe}-', IF(@${variable}+${n} < 10000, LPAD(@${variable}+${n}, 4, '0'), @${variable}+${n}))`;

async function main() {
  const sortie = process.argv[2] || 'base/import_registres_jj.sql';
  const c = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true, decimalNumbers: true });
  const q = async (sql) => (await c.query(sql))[0];
  const produits = await q(`SELECT p.*, u.code AS unite_code, c.code AS categorie_code, f.volume AS format_volume, s.nom AS source_nom
    FROM produits p JOIN unites u ON u.id = p.unite_id JOIN categories c ON c.id = p.categorie_id
    LEFT JOIN formats f ON f.id = p.format_id LEFT JOIN produits s ON s.id = p.produit_source_id ORDER BY p.id`);
  const nomProduit = new Map(produits.map(p => [p.id, p.nom]));
  const fournisseurs = await q('SELECT * FROM fournisseurs ORDER BY id');
  const nomFourn = new Map(fournisseurs.map(f => [f.id, f.nom]));
  const P = (id) => (id == null ? 'NULL' : `(SELECT id FROM produits WHERE nom = ${esc(nomProduit.get(id))} ORDER BY id LIMIT 1)`);
  const F = (id) => (id == null ? 'NULL' : `(SELECT id FROM fournisseurs WHERE nom = ${esc(nomFourn.get(id))} ORDER BY id LIMIT 1)`);
  const lots = await q('SELECT * FROM lots ORDER BY id');
  const mvts = await q('SELECT * FROM stock_mouvements ORDER BY id');
  const recs = await q('SELECT * FROM receptions ORDER BY id');
  const L = [];
  const w = (s) => L.push(s);

  w(`-- ============================================================================
-- TinOR V3.3 — Import des registres Excel Jardins de Jerba (historique complet)
-- Graines (Eco-Land, Napoliss) → presse → filtration → mélanges (lots finis)
-- → conditionnements (flacons) → ventes, avec n° de lot et dates d'origine.
-- ${lots.length} lots · ${(await q('SELECT COUNT(*) n FROM conditionnements'))[0].n} conditionnements · ${mvts.length} mouvements de stock.
--
-- À exécuter UNE fois dans la base RÉEL (ex. tinor_reel), après avoir démarré
-- TinOR au moins une fois avec la dernière version (tables à jour).
-- Si un lot des registres existe déjà, le script s'arrête sans rien modifier.
-- Tout est dans UN SEUL bloc : à la moindre erreur, tout est annulé (même avec
-- « source » dans l'utilitaire de commande MariaDB, qui sinon continue après une erreur).
--
-- Utilitaire de commande MariaDB :
--   mysql -u root -p --default-character-set=utf8mb4
--   USE tinor_reel;
--   SOURCE C:/TinorV3/base/import_registres_jj.sql
-- Produit par scripts/registres-en-sql.js — ne pas modifier à la main.
-- ============================================================================
SET NAMES utf8mb4;

DELIMITER //
BEGIN NOT ATOMIC
DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
IF EXISTS (SELECT 1 FROM lots WHERE numero_lot IN (${lots.map(l => esc(l.numero_lot)).join(', ')})) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Import deja fait : des lots des registres existent deja dans la base. Rien n''est modifie.';
END IF;

START TRANSACTION;
`);
  w('-- Fournisseurs (créés s\'ils n\'existent pas)');
  for (const f of fournisseurs) {
    w(`INSERT INTO fournisseurs (nom, type, localisation, statut_bio, notes) SELECT ${esc(f.nom)}, ${esc(f.type)}, ${esc(f.localisation)}, ${esc(f.statut_bio)}, ${esc(f.notes)} FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM fournisseurs WHERE nom = ${esc(f.nom)});`);
  }
  w('\n-- Produits (créés s\'ils n\'existent pas ; code = suivant libre)');
  for (const p of produits) {
    w(`INSERT INTO produits (code, nom, categorie_id, unite_id, format_id, type_article, produit_source_id, vendable, fabriquable, stockable, actif, bio_eligible, tva)
  SELECT (SELECT LPAD(COALESCE(MAX(CAST(code AS UNSIGNED)), 0) + 1, 2, '0') FROM produits x), ${esc(p.nom)},
    (SELECT id FROM categories WHERE code = ${esc(p.categorie_code)} ORDER BY id LIMIT 1), (SELECT id FROM unites WHERE code = ${esc(p.unite_code)} ORDER BY id LIMIT 1),
    ${p.format_volume ? `(SELECT id FROM formats WHERE volume = ${Number(p.format_volume)} ORDER BY id LIMIT 1)` : 'NULL'}, ${esc(p.type_article)},
    ${p.source_nom ? `(SELECT id FROM produits y WHERE nom = ${esc(p.source_nom)} ORDER BY id LIMIT 1)` : 'NULL'}, ${p.vendable}, ${p.fabriquable}, ${p.stockable}, 1, ${p.bio_eligible}, ${p.tva}
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM produits z WHERE nom = ${esc(p.nom)});`);
  }
  w(`
-- Décalage des identifiants après ceux déjà présents dans la base
SET @L := (SELECT COALESCE(MAX(id), 0) FROM lots);
SET @P := (SELECT COALESCE(MAX(id), 0) FROM lots_presse);
SET @F := (SELECT COALESCE(MAX(id), 0) FROM lots_filtration);
SET @R := (SELECT COALESCE(MAX(id), 0) FROM receptions);
SET @C := (SELECT COALESCE(MAX(id), 0) FROM conditionnements);
SET @NR := COALESCE((SELECT \`last_value\` FROM sequences WHERE name = 'reception_seq'), 0);
SET @NM := COALESCE((SELECT \`last_value\` FROM sequences WHERE name = 'mouvement_seq'), 0);
SET @LOCAL := (SELECT MIN(id) FROM locaux);
`);
  w('-- Lots (graines, presse, filtrés, mélanges, flacons)');
  for (const l of lots) {
    w(`INSERT INTO lots (id, produit_id, numero_lot, origine, fournisseur_id, lot_fournisseur, bio_status, local_id, date_production, date_expiration, quantite_initiale, quantite_actuelle, statut, notes, champs_perso, created_at) VALUES
  (${off('L', l.id)}, ${P(l.produit_id)}, ${esc(l.numero_lot)}, ${esc(l.origine)}, ${F(l.fournisseur_id)}, ${esc(l.lot_fournisseur)}, ${esc(l.bio_status)}, @LOCAL, ${esc(l.date_production)}, ${esc(l.date_expiration)}, ${l.quantite_initiale}, ${l.quantite_actuelle}, ${esc(l.statut)}, ${esc(l.notes)}, ${esc(l.champs_perso)}, ${esc(l.created_at)});`);
  }
  const lignes = async (titre, sql, rendu) => { const r = await q(sql); if (!r.length) return; w(`\n-- ${titre}`); for (const x of r) w(rendu(x)); };
  await lignes('Historique des statuts', 'SELECT * FROM lot_statuts_historique ORDER BY id', h =>
    `INSERT INTO lot_statuts_historique (lot_id, statut, motif, date_debut) VALUES (${off('L', h.lot_id)}, ${esc(h.statut)}, ${esc(h.motif)}, ${esc(h.date_debut)});`);
  await lignes('Traçabilité (lot → lots sources)', 'SELECT * FROM lot_origines ORDER BY id', o =>
    `INSERT INTO lot_origines (lot_fils_id, lot_source_id, quantite_utilisee) VALUES (${off('L', o.lot_fils_id)}, ${off('L', o.lot_source_id)}, ${o.quantite_utilisee});`);
  w('\n-- Réceptions de graines');
  recs.forEach((r, i) => w(`INSERT INTO receptions (id, numero, fournisseur_id, date_reception, local_id, statut, notes) VALUES (${off('R', r.id)}, ${numero('REC', 'NR', i + 1)}, ${F(r.fournisseur_id)}, ${esc(r.date_reception)}, @LOCAL, ${esc(r.statut)}, ${esc(r.notes)});`));
  await lignes('Lignes de réception', 'SELECT * FROM reception_lignes ORDER BY id', r =>
    `INSERT INTO reception_lignes (reception_id, produit_id, lot_id, quantite, lot_fournisseur) VALUES (${off('R', r.reception_id)}, ${P(r.produit_id)}, ${off('L', r.lot_id)}, ${r.quantite}, ${esc(r.lot_fournisseur)});`);
  await lignes('Pressages', 'SELECT * FROM lots_presse ORDER BY id', p =>
    `INSERT INTO lots_presse (id, date, produit_id, lot_id, quantite_matiere_utilisee, quantite_produite, rendement_reel, numero_lot, notes, created_at) VALUES (${off('P', p.id)}, ${esc(p.date)}, ${P(p.produit_id)}, ${off('L', p.lot_id)}, ${p.quantite_matiere_utilisee ?? 'NULL'}, ${p.quantite_produite}, ${p.rendement_reel ?? 'NULL'}, ${esc(p.numero_lot)}, ${esc(p.notes)}, ${esc(p.created_at)});`);
  await lignes('Filtrations', 'SELECT * FROM lots_filtration ORDER BY id', f =>
    `INSERT INTO lots_filtration (id, date, produit_id, lot_id, filtre_utilise, quantite_dechet, quantite_produite, rendement_reel, numero_lot, notes, created_at) VALUES (${off('F', f.id)}, ${esc(f.date)}, ${P(f.produit_id)}, ${off('L', f.lot_id)}, ${esc(f.filtre_utilise)}, ${f.quantite_dechet ?? 'NULL'}, ${f.quantite_produite}, ${f.rendement_reel ?? 'NULL'}, ${esc(f.numero_lot)}, ${esc(f.notes)}, ${esc(f.created_at)});`);
  await lignes('Sources des filtrations', 'SELECT * FROM lots_filtration_sources ORDER BY id', s =>
    `INSERT INTO lots_filtration_sources (lot_filtration_id, lot_presse_id, quantite_utilisee) VALUES (${off('F', s.lot_filtration_id)}, ${off('P', s.lot_presse_id)}, ${s.quantite_utilisee});`);
  await lignes('Conditionnements (flacons)', 'SELECT c.*, f.volume FROM conditionnements c LEFT JOIN formats f ON f.id = c.format_id ORDER BY c.id', x =>
    `INSERT INTO conditionnements (id, date, produit_id, format_id, lot_id, qty, quantite_source_utilisee, note, created_at) VALUES (${off('C', x.id)}, ${esc(x.date)}, ${P(x.produit_id)}, ${x.volume ? `(SELECT id FROM formats WHERE volume = ${Number(x.volume)} ORDER BY id LIMIT 1)` : 'NULL'}, ${off('L', x.lot_id)}, ${x.qty}, ${x.quantite_source_utilisee}, ${esc(x.note)}, ${esc(x.created_at)});`);
  await lignes('Sources des conditionnements (lot fini)', 'SELECT * FROM conditionnement_sources ORDER BY id', s =>
    `INSERT INTO conditionnement_sources (conditionnement_id, lot_id, quantite_utilisee) VALUES (${off('C', s.conditionnement_id)}, ${off('L', s.lot_id)}, ${s.quantite_utilisee});`);
  const refSource = (m) => ({ lots_presse: 'L', lots_filtration: 'L', melange: 'L', conditionnements: 'C', receptions: 'R' }[m.source_type]);
  w('\n-- Mouvements de stock datés (réceptions, consommations, productions, conditionnements, pertes, ventes)');
  mvts.forEach((m, i) => w(`INSERT INTO stock_mouvements (numero, date_mouvement, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note, created_at) VALUES (${numero('MVT', 'NM', i + 1)}, ${esc(m.date_mouvement)}, ${esc(m.type_mouvement)}, ${esc(m.sens)}, ${P(m.produit_id)}, ${off('L', m.lot_id)}, ${m.quantite}, ${esc(m.source_type)}, ${refSource(m) && m.source_id != null ? off(refSource(m), m.source_id) : 'NULL'}, ${esc(m.note)}, ${esc(m.created_at)});`));
  const seq = await q("SELECT * FROM sequences WHERE name IN ('lot_jj_presse', 'lot_jj_fini')");
  w(`
-- Compteurs : réceptions, mouvements, n° de pressage (XX) et de lot fini (yy)
INSERT INTO sequences (name, \`last_value\`) VALUES ('reception_seq', @NR + ${recs.length}) ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, @NR + ${recs.length});
INSERT INTO sequences (name, \`last_value\`) VALUES ('mouvement_seq', @NM + ${mvts.length}) ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, @NM + ${mvts.length});
${seq.map(s => `INSERT INTO sequences (name, \`last_value\`) VALUES (${esc(s.name)}, ${s.last_value}) ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, ${s.last_value});`).join('\n')}

COMMIT;
SELECT 'Import termine : ${lots.length} lots, ${(await q('SELECT COUNT(*) n FROM conditionnements'))[0].n} conditionnements, ${mvts.length} mouvements' AS resultat;
END //
DELIMITER ;

-- Contrôle : stock par produit après l'import
SELECT p.nom AS produit, ROUND(SUM(l.quantite_actuelle), 3) AS stock, u.symbole AS unite
FROM lots l JOIN produits p ON p.id = l.produit_id JOIN unites u ON u.id = p.unite_id
WHERE JSON_VALUE(l.champs_perso, '$.import_registres') IS NOT NULL GROUP BY p.id ORDER BY p.id;`);
  fs.writeFileSync(sortie, L.join('\n') + '\n');
  console.log(`✓ ${sortie} : ${lots.length} lots, ${mvts.length} mouvements, ${recs.length} réceptions.`);
  await c.end();
}
main().catch((e) => { console.error('✗', e.message); process.exit(1); });
