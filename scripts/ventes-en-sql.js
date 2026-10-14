// ============================================================================
// Produit base/import_ventes_jj.sql : les DOCUMENTS DE VENTE des registres
// (bon de commande → bon de livraison → facture → paiement) pour les sorties déjà
// importées par base/import_registres_jj.sql, avec les prix et la remise.
//
// Source : une base NEUVE (tinor_reel_creation.sql) dans laquelle l'import des registres
// vient d'être fait (import_registres_jj.sql ou « npm run importer:registres … --appliquer ») :
//   DB_NAME=tinor_essai node scripts/ventes-en-sql.js base/import_ventes_jj.sql
//
// Une vente = un bon de commande (BC), un bon de livraison (BL), une facture (FAC) et un
// paiement en espèces, à la date du registre. Les mouvements « VENTE » déjà présents sont
// rattachés à la commande (le stock n'est donc pas sorti deux fois).
// Tarif : prix de détail + remise de 19 % ; TVA, FODEC et timbre selon les paramètres.
// ============================================================================
const fs = require('fs');
require('../src/env');
const mysql = require('mysql2/promise');
const { computeFactureTotalsDepuisLignes } = require('../src/services/pricing');

const PRIX = { 10: 25, 30: 77.5 };            // prix de détail (DT, TTC) par format en ml : 20 et 62 DT après remise
const REMISE = { nom: 'Remise 20 %', pct: 20 };
const NOM_CLIENT = { artizanet: 'artisanet' }; // variante de frappe évidente
const SANS_CLIENT = 'Client à identifier';

const esc = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : mysql.escape(String(v)));
const r3 = (x) => Math.round(x * 1000) / 1000;

async function main() {
  const sortie = process.argv[2] || 'base/import_ventes_jj.sql';
  const c = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true, decimalNumbers: true });
  const q = async (sql) => (await c.query(sql))[0];
  const st = (await q('SELECT tva, fodec_rate, droit_timbre, timbre_seuil FROM settings WHERE id = 1'))[0];
  const mvts = await q(`SELECT m.id, DATE(m.date_mouvement) AS jour, m.quantite, m.note, l.numero_lot, f.volume
    FROM stock_mouvements m JOIN lots l ON l.id = m.lot_id JOIN produits p ON p.id = m.produit_id LEFT JOIN formats f ON f.id = p.format_id
    WHERE m.type_mouvement = 'VENTE' AND m.source_type = 'import_registres' ORDER BY m.date_mouvement, m.id`);
  if (!mvts.length) throw new Error('Aucune sortie « VENTE » issue de l\'import des registres : importez-les d\'abord.');

  // Une vente = même date + même note (« Vente n° 5 — Gosef · Espèces »)
  const ventes = [];
  for (const m of mvts) {
    const cle = `${m.jour}|${m.note}`;
    let v = ventes.find(x => x.cle === cle);
    if (!v) {
      const brut = (/—\s*(.+?)\s*·/.exec(m.note) || [])[1] || SANS_CLIENT;
      const nom = /client non not/i.test(brut) ? SANS_CLIENT : (NOM_CLIENT[brut] || brut);
      v = { cle, jour: m.jour, note: m.note, client: nom, lignes: [] };
      ventes.push(v);
    }
    const fmt = Math.round(Number(m.volume));
    if (!PRIX[fmt]) throw new Error(`Pas de prix pour le format ${fmt} ml (lot ${m.numero_lot}).`);
    v.lignes.push({ lot: m.numero_lot, qte: Number(m.quantite), fmt, detail: PRIX[fmt], unit: r3(PRIX[fmt] * (1 - REMISE.pct / 100)) });
  }
  const clients = [...new Map(ventes.map(v => [v.client.toLowerCase(), v.client])).values()];

  const L = (n) => `(SELECT id FROM lots WHERE numero_lot = ${esc(n)} ORDER BY id LIMIT 1)`;
  const out = [];
  const w = (s) => out.push(s);
  w(`-- ============================================================================
-- TinOR V3.3 — Documents de vente des registres Jardins de Jerba
-- ${ventes.length} ventes : bon de commande + bon de livraison + facture + paiement en espèces chacune,
-- au tarif actuel (flacon 10 ml ${PRIX[10]} DT, 30 ml ${PRIX[30]} DT, remise ${REMISE.pct} %), avec les prix de vente des produits.
--
-- À exécuter UNE fois dans la base RÉEL (ex. tinor_reel), APRÈS base/import_registres_jj.sql :
--   mysql -u root -p --default-character-set=utf8mb4
--   USE tinor_reel;
--   SOURCE C:/TinorV3/base/import_ventes_jj.sql
-- Si des commandes existent déjà, ou si les sorties des registres sont absentes, le script
-- s'arrête sans rien modifier. Un seul bloc : à la moindre erreur, tout est annulé.
-- Toutes les ventes sont ensuite à corriger une par une dans TinOR (prix, remise, client, type de client).
-- Produit par scripts/ventes-en-sql.js — ne pas modifier à la main.
-- ============================================================================
SET NAMES utf8mb4;

DELIMITER //
BEGIN NOT ATOMIC
DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
IF EXISTS (SELECT 1 FROM commandes) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Des commandes existent deja : documents de vente non importes. Rien n''est modifie.';
END IF;
IF (SELECT COUNT(*) FROM stock_mouvements WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres') <> ${mvts.length} THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Les ${mvts.length} sorties des registres sont absentes : lancez d''abord import_registres_jj.sql. Rien n''est modifie.';
END IF;

START TRANSACTION;

-- Prix de vente des flacons et remise
UPDATE produits SET prix_vente = ${PRIX[10]} WHERE nom LIKE '%Flacon 10ml';
UPDATE produits SET prix_vente = ${PRIX[30]} WHERE nom LIKE '%Flacon 30ml';
INSERT INTO remises (nom, type, pourcentage, categorie) SELECT ${esc(REMISE.nom)}, 'pourcentage', ${REMISE.pct}, 'client' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM remises WHERE nom = ${esc(REMISE.nom)});
SET @remise := (SELECT id FROM remises WHERE nom = ${esc(REMISE.nom)} ORDER BY id LIMIT 1);

-- Clients (créés s'ils n'existent pas)`);
  for (const nom of clients) {
    const note = nom === SANS_CLIENT ? 'Sortie sans client au registre : à rattacher au bon client' : 'Repris du registre des ventes (type et coordonnées à compléter)';
    w(`INSERT INTO clients (nom, ville, type, notes) SELECT ${esc(nom)}, 'Djerba', 'particulier', ${esc(note)} FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = ${esc(nom)});`);
  }
  w(`
SET @nbc := (SELECT COALESCE(MAX(\`last_value\`), 0) FROM sequences WHERE name = 'commande_seq');
SET @nbl := (SELECT COALESCE(MAX(\`last_value\`), 0) FROM sequences WHERE name = 'bl_seq');
SET @nfa := (SELECT COALESCE(MAX(\`last_value\`), 0) FROM sequences WHERE name = 'facture_seq');
`);
  const num = (pre, v, i) => `CONCAT('${pre}-', IF(@${v}+${i} < 10000, LPAD(@${v}+${i}, 4, '0'), @${v}+${i}))`;
  let totaux = { ht: 0, ttc: 0 };
  ventes.forEach((v, k) => {
    const i = k + 1;
    const fac = computeFactureTotalsDepuisLignes(v.lignes.map(l => ({ unitPrice: l.unit, qty: l.qte })), Number(st.tva), Number(st.fodec_rate), Number(st.droit_timbre), Number(st.timbre_seuil));
    const total = r3(v.lignes.reduce((t, l) => t + l.unit * l.qte, 0));
    totaux.ht += r3(fac.totalHT); totaux.ttc += r3(fac.totalTTC);
    w(`-- Vente ${i} — ${v.jour} — ${v.client}`);
    w(`SET @cl := (SELECT id FROM clients WHERE nom = ${esc(v.client)} ORDER BY id LIMIT 1);`);
    w(`INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (${num('BC', 'nbc', i)}, @cl, ${esc(v.jour + ' 00:00:00')}, 'payee', ${esc(v.note)}, ${total}, ${esc(v.jour + ' 00:00:00')});`);
    w(`SET @cmd := LAST_INSERT_ID();`);
    w(`INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (${num('BL', 'nbl', i)}, @cmd, @cl, ${esc(v.jour)}, 'Repris du registre des ventes', ${esc(v.jour + ' 00:00:00')});`);
    w(`SET @bl := LAST_INSERT_ID();`);
    w(`INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (${num('FAC', 'nfa', i)}, @cmd, ${num('BC', 'nbc', i)}, @cl, ${esc(v.client)}, ${esc(v.jour)}, ${Number(st.tva)}, ${r3(fac.fodecMontant)}, ${fac.droitTimbre}, ${r3(fac.totalHT)}, ${r3(fac.montantTVA)}, ${r3(fac.totalTTC)}, ${esc(v.jour + ' 00:00:00')});`);
    w(`SET @fac := LAST_INSERT_ID();`);
    for (const l of v.lignes) {
      const tot = r3(l.unit * l.qte);
      w(`INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = ${L(l.lot)}), ${L(l.lot)}, ${l.qte}, ${l.qte}, ${l.detail}, ${l.unit}, ${tot}, @remise, ${esc(REMISE.nom)}, ${REMISE.pct}, 'pourcentage');`);
      w(`SET @ligne := LAST_INSERT_ID();`);
      w(`INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = ${L(l.lot)}), ${L(l.lot)}, ${l.qte});`);
      w(`INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = ${L(l.lot)})), ' (lot ', ${esc(l.lot)}, ')'), ${l.detail}, ${l.unit}, ${l.qte}, ${tot}, ${esc(REMISE.nom)}, ${REMISE.pct});`);
      w(`UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = ${L(l.lot)} AND DATE(date_mouvement) = ${esc(v.jour)} AND note = ${esc(v.note)} AND quantite = ${l.qte};`);
    }
    w(`INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, ${esc(v.jour)}, ${r3(fac.totalTTC)}, 'especes', 'Espèces — repris du registre des ventes');`);
    w('');
  });
  const n = ventes.length;
  w(`-- Compteurs
INSERT INTO sequences (name, \`last_value\`) VALUES ('commande_seq', @nbc + ${n}) ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, @nbc + ${n});
INSERT INTO sequences (name, \`last_value\`) VALUES ('bl_seq', @nbl + ${n}) ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, @nbl + ${n});
INSERT INTO sequences (name, \`last_value\`) VALUES ('facture_seq', @nfa + ${n}) ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, @nfa + ${n});

COMMIT;
SELECT 'Documents de vente termines : ${n} commandes, bons de livraison, factures et paiements' AS resultat;
END //
DELIMITER ;

-- Contrôle : ventes par facture
SELECT COUNT(*) AS factures, ROUND(SUM(total_ht), 3) AS total_ht, ROUND(SUM(total_ttc), 3) AS total_ttc FROM factures;`);
  fs.writeFileSync(sortie, out.join('\n') + '\n');
  console.log(`✓ ${sortie} : ${n} ventes, ${mvts.length} lignes, ${clients.length} clients, total HT ${r3(totaux.ht)} · TTC ${r3(totaux.ttc)}`);
  await c.end();
}
main().catch(e => { console.error('✗', e.message); process.exit(1); });
