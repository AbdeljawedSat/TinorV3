-- ============================================================================
-- TinOR V3.3 — Documents de vente des registres Jardins de Jerba
-- 22 ventes : bon de commande + bon de livraison + facture + paiement en espèces chacune,
-- au tarif actuel (flacon 10 ml 24.7 DT, 30 ml 76.5 DT, remise 19 %), avec les prix de vente des produits.
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
IF (SELECT COUNT(*) FROM stock_mouvements WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres') <> 32 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Les 32 sorties des registres sont absentes : lancez d''abord import_registres_jj.sql. Rien n''est modifie.';
END IF;

START TRANSACTION;

-- Prix de vente des flacons et remise
UPDATE produits SET prix_vente = 24.7 WHERE nom LIKE '%Flacon 10ml';
UPDATE produits SET prix_vente = 76.5 WHERE nom LIKE '%Flacon 30ml';
INSERT INTO remises (nom, type, pourcentage, categorie) SELECT 'Remise 19 %', 'pourcentage', 19, 'client' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM remises WHERE nom = 'Remise 19 %');
SET @remise := (SELECT id FROM remises WHERE nom = 'Remise 19 %' ORDER BY id LIMIT 1);

-- Clients (créés s'ils n'existent pas)
INSERT INTO clients (nom, ville, type, notes) SELECT 'Client à identifier', 'Djerba', 'particulier', 'Sortie sans client au registre : à rattacher au bon client' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'Client à identifier');
INSERT INTO clients (nom, ville, type, notes) SELECT 'Gisel', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'Gisel');
INSERT INTO clients (nom, ville, type, notes) SELECT 'Client particulier', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'Client particulier');
INSERT INTO clients (nom, ville, type, notes) SELECT 'Berntrard', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'Berntrard');
INSERT INTO clients (nom, ville, type, notes) SELECT 'louccy', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'louccy');
INSERT INTO clients (nom, ville, type, notes) SELECT 'Gosef', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'Gosef');
INSERT INTO clients (nom, ville, type, notes) SELECT 'client Passage', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'client Passage');
INSERT INTO clients (nom, ville, type, notes) SELECT 'ben abdesslem', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'ben abdesslem');
INSERT INTO clients (nom, ville, type, notes) SELECT 'artisanet', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'artisanet');
INSERT INTO clients (nom, ville, type, notes) SELECT 'omran khaled', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'omran khaled');
INSERT INTO clients (nom, ville, type, notes) SELECT 'Relax and spay', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'Relax and spay');
INSERT INTO clients (nom, ville, type, notes) SELECT 'biojerba', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'biojerba');
INSERT INTO clients (nom, ville, type, notes) SELECT 'client', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'client');
INSERT INTO clients (nom, ville, type, notes) SELECT 'bernard', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'bernard');
INSERT INTO clients (nom, ville, type, notes) SELECT 'client passaget', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'client passaget');
INSERT INTO clients (nom, ville, type, notes) SELECT 'passaget claude', 'Djerba', 'particulier', 'Repris du registre des ventes (type et coordonnées à compléter)' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM clients WHERE nom = 'passaget claude');

SET @nbc := (SELECT COALESCE(MAX(`last_value`), 0) FROM sequences WHERE name = 'commande_seq');
SET @nbl := (SELECT COALESCE(MAX(`last_value`), 0) FROM sequences WHERE name = 'bl_seq');
SET @nfa := (SELECT COALESCE(MAX(`last_value`), 0) FROM sequences WHERE name = 'facture_seq');

-- Vente 1 — 2025-05-04 — Client à identifier
SET @cl := (SELECT id FROM clients WHERE nom = 'Client à identifier' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+1 < 10000, LPAD(@nbc+1, 4, '0'), @nbc+1)), @cl, '2025-05-04 00:00:00', 'payee', 'Vente — Client non noté (registre mélange) · Espèces', 247.86, '2025-05-04 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+1 < 10000, LPAD(@nbl+1, 4, '0'), @nbl+1)), @cmd, @cl, '2025-05-04', 'Repris du registre des ventes', '2025-05-04 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+1 < 10000, LPAD(@nfa+1, 4, '0'), @nfa+1)), @cmd, CONCAT('BC-', IF(@nbc+1 < 10000, LPAD(@nbc+1, 4, '0'), @nbc+1)), @cl, 'Client à identifier', '2025-05-04', 19, 2.083, 0, 208.286, 39.97, 250.339, '2025-05-04 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-30ML' ORDER BY id LIMIT 1), 4, 4, 76.5, 61.965, 247.86, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-30ML' ORDER BY id LIMIT 1), 4);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-30ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-30ML', ')'), 76.5, 61.965, 4, 247.86, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-05-04' AND note = 'Vente — Client non noté (registre mélange) · Espèces' AND quantite = 4;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-05-04', 250.339, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 2 — 2025-06-10 — Gisel
SET @cl := (SELECT id FROM clients WHERE nom = 'Gisel' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+2 < 10000, LPAD(@nbc+2, 4, '0'), @nbc+2)), @cl, '2025-06-10 00:00:00', 'payee', 'Vente n° 3 — Gisel · Espèces', 1549.125, '2025-06-10 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+2 < 10000, LPAD(@nbl+2, 4, '0'), @nbl+2)), @cmd, @cl, '2025-06-10', 'Repris du registre des ventes', '2025-06-10 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+2 < 10000, LPAD(@nfa+2, 4, '0'), @nfa+2)), @cmd, CONCAT('BC-', IF(@nbc+2 < 10000, LPAD(@nbc+2, 4, '0'), @nbc+2)), @cl, 'Gisel', '2025-06-10', 19, 13.018, 1, 1301.786, 249.813, 1565.616, '2025-06-10 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1), 22, 22, 76.5, 61.965, 1363.23, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1), 22);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1))), ' (lot ', '042505-30ML', ')'), 76.5, 61.965, 22, 1363.23, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-06-10' AND note = 'Vente n° 3 — Gisel · Espèces' AND quantite = 22;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1), 3, 3, 76.5, 61.965, 185.895, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1), 3);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1))), ' (lot ', '050502-30ML', ')'), 76.5, 61.965, 3, 185.895, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-06-10' AND note = 'Vente n° 3 — Gisel · Espèces' AND quantite = 3;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-06-10', 1565.616, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 3 — 2025-07-10 — Client particulier
SET @cl := (SELECT id FROM clients WHERE nom = 'Client particulier' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+3 < 10000, LPAD(@nbc+3, 4, '0'), @nbc+3)), @cl, '2025-07-10 00:00:00', 'payee', 'Vente n° 2 — Client particulier · Espèces', 40.014, '2025-07-10 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+3 < 10000, LPAD(@nbl+3, 4, '0'), @nbl+3)), @cmd, @cl, '2025-07-10', 'Repris du registre des ventes', '2025-07-10 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+3 < 10000, LPAD(@nfa+3, 4, '0'), @nfa+3)), @cmd, CONCAT('BC-', IF(@nbc+3 < 10000, LPAD(@nbc+3, 4, '0'), @nbc+3)), @cl, 'Client particulier', '2025-07-10', 19, 0.336, 0, 33.625, 6.453, 40.414, '2025-07-10 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1), 2, 2, 24.7, 20.007, 40.014, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1), 2);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1))), ' (lot ', '021825-10ML', ')'), 24.7, 20.007, 2, 40.014, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-07-10' AND note = 'Vente n° 2 — Client particulier · Espèces' AND quantite = 2;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-07-10', 40.414, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 4 — 2025-08-14 — Berntrard
SET @cl := (SELECT id FROM clients WHERE nom = 'Berntrard' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+4 < 10000, LPAD(@nbc+4, 4, '0'), @nbc+4)), @cl, '2025-08-14 00:00:00', 'payee', 'Vente n° 1 — Berntrard · Espèces', 1549.125, '2025-08-14 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+4 < 10000, LPAD(@nbl+4, 4, '0'), @nbl+4)), @cmd, @cl, '2025-08-14', 'Repris du registre des ventes', '2025-08-14 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+4 < 10000, LPAD(@nfa+4, 4, '0'), @nfa+4)), @cmd, CONCAT('BC-', IF(@nbc+4 < 10000, LPAD(@nbc+4, 4, '0'), @nbc+4)), @cl, 'Berntrard', '2025-08-14', 19, 13.018, 1, 1301.786, 249.813, 1565.616, '2025-08-14 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '021825-30ML' ORDER BY id LIMIT 1), 19, 19, 76.5, 61.965, 1177.335, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '021825-30ML' ORDER BY id LIMIT 1), 19);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-30ML' ORDER BY id LIMIT 1))), ' (lot ', '021825-30ML', ')'), 76.5, 61.965, 19, 1177.335, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '021825-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-14' AND note = 'Vente n° 1 — Berntrard · Espèces' AND quantite = 19;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1), 6, 6, 76.5, 61.965, 371.79, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1), 6);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1))), ' (lot ', '042505-30ML', ')'), 76.5, 61.965, 6, 371.79, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '042505-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-14' AND note = 'Vente n° 1 — Berntrard · Espèces' AND quantite = 6;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-08-14', 1565.616, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 5 — 2025-08-14 — louccy
SET @cl := (SELECT id FROM clients WHERE nom = 'louccy' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+5 < 10000, LPAD(@nbc+5, 4, '0'), @nbc+5)), @cl, '2025-08-14 00:00:00', 'payee', 'Vente n° 4 — louccy · Espèces', 1549.125, '2025-08-14 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+5 < 10000, LPAD(@nbl+5, 4, '0'), @nbl+5)), @cmd, @cl, '2025-08-14', 'Repris du registre des ventes', '2025-08-14 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+5 < 10000, LPAD(@nfa+5, 4, '0'), @nfa+5)), @cmd, CONCAT('BC-', IF(@nbc+5 < 10000, LPAD(@nbc+5, 4, '0'), @nbc+5)), @cl, 'louccy', '2025-08-14', 19, 13.018, 1, 1301.786, 249.813, 1565.616, '2025-08-14 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1), 25, 25, 76.5, 61.965, 1549.125, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1), 25);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1))), ' (lot ', '050502-30ML', ')'), 76.5, 61.965, 25, 1549.125, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-14' AND note = 'Vente n° 4 — louccy · Espèces' AND quantite = 25;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-08-14', 1565.616, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 6 — 2025-08-14 — Gosef
SET @cl := (SELECT id FROM clients WHERE nom = 'Gosef' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+6 < 10000, LPAD(@nbc+6, 4, '0'), @nbc+6)), @cl, '2025-08-14 00:00:00', 'payee', 'Vente n° 5 — Gosef · Espèces', 1549.125, '2025-08-14 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+6 < 10000, LPAD(@nbl+6, 4, '0'), @nbl+6)), @cmd, @cl, '2025-08-14', 'Repris du registre des ventes', '2025-08-14 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+6 < 10000, LPAD(@nfa+6, 4, '0'), @nfa+6)), @cmd, CONCAT('BC-', IF(@nbc+6 < 10000, LPAD(@nbc+6, 4, '0'), @nbc+6)), @cl, 'Gosef', '2025-08-14', 19, 13.018, 1, 1301.786, 249.813, 1565.616, '2025-08-14 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '061803-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '061803-30ML' ORDER BY id LIMIT 1), 7, 7, 76.5, 61.965, 433.755, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '061803-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '061803-30ML' ORDER BY id LIMIT 1), 7);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '061803-30ML' ORDER BY id LIMIT 1))), ' (lot ', '061803-30ML', ')'), 76.5, 61.965, 7, 433.755, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '061803-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-14' AND note = 'Vente n° 5 — Gosef · Espèces' AND quantite = 7;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1), 4, 4, 76.5, 61.965, 247.86, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1), 4);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1))), ' (lot ', '050502-30ML', ')'), 76.5, 61.965, 4, 247.86, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '050502-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-14' AND note = 'Vente n° 5 — Gosef · Espèces' AND quantite = 4;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '070324-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '070324-30ML' ORDER BY id LIMIT 1), 14, 14, 76.5, 61.965, 867.51, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '070324-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '070324-30ML' ORDER BY id LIMIT 1), 14);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '070324-30ML' ORDER BY id LIMIT 1))), ' (lot ', '070324-30ML', ')'), 76.5, 61.965, 14, 867.51, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '070324-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-14' AND note = 'Vente n° 5 — Gosef · Espèces' AND quantite = 14;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-08-14', 1565.616, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 7 — 2025-08-19 — client Passage
SET @cl := (SELECT id FROM clients WHERE nom = 'client Passage' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+7 < 10000, LPAD(@nbc+7, 4, '0'), @nbc+7)), @cl, '2025-08-19 00:00:00', 'payee', 'Vente n° 6 — client Passage · Espèces', 400.14, '2025-08-19 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+7 < 10000, LPAD(@nbl+7, 4, '0'), @nbl+7)), @cmd, @cl, '2025-08-19', 'Repris du registre des ventes', '2025-08-19 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+7 < 10000, LPAD(@nfa+7, 4, '0'), @nfa+7)), @cmd, CONCAT('BC-', IF(@nbc+7 < 10000, LPAD(@nbc+7, 4, '0'), @nbc+7)), @cl, 'client Passage', '2025-08-19', 19, 3.363, 0, 336.252, 64.527, 404.141, '2025-08-19 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 20, 20, 24.7, 20.007, 400.14, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 20);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-10ML', ')'), 24.7, 20.007, 20, 400.14, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-08-19' AND note = 'Vente n° 6 — client Passage · Espèces' AND quantite = 20;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-08-19', 404.141, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 8 — 2025-09-06 — ben abdesslem
SET @cl := (SELECT id FROM clients WHERE nom = 'ben abdesslem' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+8 < 10000, LPAD(@nbc+8, 4, '0'), @nbc+8)), @cl, '2025-09-06 00:00:00', 'payee', 'Vente n° 7 — ben abdesslem · Espèces', 400.14, '2025-09-06 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+8 < 10000, LPAD(@nbl+8, 4, '0'), @nbl+8)), @cmd, @cl, '2025-09-06', 'Repris du registre des ventes', '2025-09-06 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+8 < 10000, LPAD(@nfa+8, 4, '0'), @nfa+8)), @cmd, CONCAT('BC-', IF(@nbc+8 < 10000, LPAD(@nbc+8, 4, '0'), @nbc+8)), @cl, 'ben abdesslem', '2025-09-06', 19, 3.363, 0, 336.252, 64.527, 404.141, '2025-09-06 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1), 20, 20, 24.7, 20.007, 400.14, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1), 20);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1))), ' (lot ', '011823-10ML', ')'), 24.7, 20.007, 20, 400.14, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-09-06' AND note = 'Vente n° 7 — ben abdesslem · Espèces' AND quantite = 20;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-09-06', 404.141, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 9 — 2025-09-10 — artisanet
SET @cl := (SELECT id FROM clients WHERE nom = 'artisanet' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+9 < 10000, LPAD(@nbc+9, 4, '0'), @nbc+9)), @cl, '2025-09-10 00:00:00', 'payee', 'Vente n° 8 — artisanet · Espèces', 600.21, '2025-09-10 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+9 < 10000, LPAD(@nbl+9, 4, '0'), @nbl+9)), @cmd, @cl, '2025-09-10', 'Repris du registre des ventes', '2025-09-10 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+9 < 10000, LPAD(@nfa+9, 4, '0'), @nfa+9)), @cmd, CONCAT('BC-', IF(@nbc+9 < 10000, LPAD(@nbc+9, 4, '0'), @nbc+9)), @cl, 'artisanet', '2025-09-10', 19, 5.044, 0, 504.378, 96.79, 606.212, '2025-09-10 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1), 30, 30, 24.7, 20.007, 600.21, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1), 30);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1))), ' (lot ', '011823-10ML', ')'), 24.7, 20.007, 30, 600.21, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-09-10' AND note = 'Vente n° 8 — artisanet · Espèces' AND quantite = 30;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-09-10', 606.212, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 10 — 2025-09-15 — omran khaled
SET @cl := (SELECT id FROM clients WHERE nom = 'omran khaled' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+10 < 10000, LPAD(@nbc+10, 4, '0'), @nbc+10)), @cl, '2025-09-15 00:00:00', 'payee', 'Vente n° 9 — omran khaled · Espèces', 600.21, '2025-09-15 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+10 < 10000, LPAD(@nbl+10, 4, '0'), @nbl+10)), @cmd, @cl, '2025-09-15', 'Repris du registre des ventes', '2025-09-15 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+10 < 10000, LPAD(@nfa+10, 4, '0'), @nfa+10)), @cmd, CONCAT('BC-', IF(@nbc+10 < 10000, LPAD(@nbc+10, 4, '0'), @nbc+10)), @cl, 'omran khaled', '2025-09-15', 19, 5.044, 0, 504.378, 96.79, 606.212, '2025-09-15 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1), 30, 30, 24.7, 20.007, 600.21, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1), 30);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1))), ' (lot ', '011823-10ML', ')'), 24.7, 20.007, 30, 600.21, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '011823-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-09-15' AND note = 'Vente n° 9 — omran khaled · Espèces' AND quantite = 30;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-09-15', 606.212, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 11 — 2025-11-15 — louccy
SET @cl := (SELECT id FROM clients WHERE nom = 'louccy' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+11 < 10000, LPAD(@nbc+11, 4, '0'), @nbc+11)), @cl, '2025-11-15 00:00:00', 'payee', 'Vente n° 10 — louccy · Espèces', 420.147, '2025-11-15 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+11 < 10000, LPAD(@nbl+11, 4, '0'), @nbl+11)), @cmd, @cl, '2025-11-15', 'Repris du registre des ventes', '2025-11-15 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+11 < 10000, LPAD(@nfa+11, 4, '0'), @nfa+11)), @cmd, CONCAT('BC-', IF(@nbc+11 < 10000, LPAD(@nbc+11, 4, '0'), @nbc+11)), @cl, 'louccy', '2025-11-15', 19, 3.531, 0, 353.065, 67.753, 424.348, '2025-11-15 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1), 21, 21, 24.7, 20.007, 420.147, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1), 21);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1))), ' (lot ', '021825-10ML', ')'), 24.7, 20.007, 21, 420.147, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '021825-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2025-11-15' AND note = 'Vente n° 10 — louccy · Espèces' AND quantite = 21;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2025-11-15', 424.348, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 12 — 2026-01-09 — ben abdesslem
SET @cl := (SELECT id FROM clients WHERE nom = 'ben abdesslem' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+12 < 10000, LPAD(@nbc+12, 4, '0'), @nbc+12)), @cl, '2026-01-09 00:00:00', 'payee', 'Vente n° 11 — ben abdesslem · Espèces', 600.21, '2026-01-09 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+12 < 10000, LPAD(@nbl+12, 4, '0'), @nbl+12)), @cmd, @cl, '2026-01-09', 'Repris du registre des ventes', '2026-01-09 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+12 < 10000, LPAD(@nfa+12, 4, '0'), @nfa+12)), @cmd, CONCAT('BC-', IF(@nbc+12 < 10000, LPAD(@nbc+12, 4, '0'), @nbc+12)), @cl, 'ben abdesslem', '2026-01-09', 19, 5.044, 0, 504.378, 96.79, 606.212, '2026-01-09 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 30, 30, 24.7, 20.007, 600.21, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 30);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-10ML', ')'), 24.7, 20.007, 30, 600.21, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-01-09' AND note = 'Vente n° 11 — ben abdesslem · Espèces' AND quantite = 30;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-01-09', 606.212, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 13 — 2026-01-16 — omran khaled
SET @cl := (SELECT id FROM clients WHERE nom = 'omran khaled' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+13 < 10000, LPAD(@nbc+13, 4, '0'), @nbc+13)), @cl, '2026-01-16 00:00:00', 'payee', 'Vente n° 12 — omran khaled · Espèces', 1000.35, '2026-01-16 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+13 < 10000, LPAD(@nbl+13, 4, '0'), @nbl+13)), @cmd, @cl, '2026-01-16', 'Repris du registre des ventes', '2026-01-16 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+13 < 10000, LPAD(@nfa+13, 4, '0'), @nfa+13)), @cmd, CONCAT('BC-', IF(@nbc+13 < 10000, LPAD(@nbc+13, 4, '0'), @nbc+13)), @cl, 'omran khaled', '2026-01-16', 19, 8.406, 1, 840.63, 161.317, 1011.354, '2026-01-16 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 50, 50, 24.7, 20.007, 1000.35, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 50);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-10ML', ')'), 24.7, 20.007, 50, 1000.35, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-01-16' AND note = 'Vente n° 12 — omran khaled · Espèces' AND quantite = 50;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-01-16', 1011.354, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 14 — 2026-01-26 — Relax and spay
SET @cl := (SELECT id FROM clients WHERE nom = 'Relax and spay' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+14 < 10000, LPAD(@nbc+14, 4, '0'), @nbc+14)), @cl, '2026-01-26 00:00:00', 'payee', 'Vente n° 13 — Relax and spay · Espèces', 420.147, '2026-01-26 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+14 < 10000, LPAD(@nbl+14, 4, '0'), @nbl+14)), @cmd, @cl, '2026-01-26', 'Repris du registre des ventes', '2026-01-26 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+14 < 10000, LPAD(@nfa+14, 4, '0'), @nfa+14)), @cmd, CONCAT('BC-', IF(@nbc+14 < 10000, LPAD(@nbc+14, 4, '0'), @nbc+14)), @cl, 'Relax and spay', '2026-01-26', 19, 3.531, 0, 353.065, 67.753, 424.348, '2026-01-26 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 21, 21, 24.7, 20.007, 420.147, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 21);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-10ML', ')'), 24.7, 20.007, 21, 420.147, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-01-26' AND note = 'Vente n° 13 — Relax and spay · Espèces' AND quantite = 21;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-01-26', 424.348, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 15 — 2026-02-18 — biojerba
SET @cl := (SELECT id FROM clients WHERE nom = 'biojerba' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+15 < 10000, LPAD(@nbc+15, 4, '0'), @nbc+15)), @cl, '2026-02-18 00:00:00', 'payee', 'Vente n° 14 — biojerba · Espèces', 400.14, '2026-02-18 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+15 < 10000, LPAD(@nbl+15, 4, '0'), @nbl+15)), @cmd, @cl, '2026-02-18', 'Repris du registre des ventes', '2026-02-18 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+15 < 10000, LPAD(@nfa+15, 4, '0'), @nfa+15)), @cmd, CONCAT('BC-', IF(@nbc+15 < 10000, LPAD(@nbc+15, 4, '0'), @nbc+15)), @cl, 'biojerba', '2026-02-18', 19, 3.363, 0, 336.252, 64.527, 404.141, '2026-02-18 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 20, 20, 24.7, 20.007, 400.14, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 20);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-10ML', ')'), 24.7, 20.007, 20, 400.14, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-02-18' AND note = 'Vente n° 14 — biojerba · Espèces' AND quantite = 20;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-02-18', 404.141, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 16 — 2026-02-19 — artisanet
SET @cl := (SELECT id FROM clients WHERE nom = 'artisanet' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+16 < 10000, LPAD(@nbc+16, 4, '0'), @nbc+16)), @cl, '2026-02-19 00:00:00', 'payee', 'Vente n° 15 — artisanet · Espèces', 260.091, '2026-02-19 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+16 < 10000, LPAD(@nbl+16, 4, '0'), @nbl+16)), @cmd, @cl, '2026-02-19', 'Repris du registre des ventes', '2026-02-19 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+16 < 10000, LPAD(@nfa+16, 4, '0'), @nfa+16)), @cmd, CONCAT('BC-', IF(@nbc+16 < 10000, LPAD(@nbc+16, 4, '0'), @nbc+16)), @cl, 'artisanet', '2026-02-19', 19, 2.186, 0, 218.564, 41.942, 262.692, '2026-02-19 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 13, 13, 24.7, 20.007, 260.091, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1), 13);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1))), ' (lot ', '082415-10ML', ')'), 24.7, 20.007, 13, 260.091, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '082415-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-02-19' AND note = 'Vente n° 15 — artisanet · Espèces' AND quantite = 13;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-02-19', 262.692, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 17 — 2026-02-21 — client
SET @cl := (SELECT id FROM clients WHERE nom = 'client' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+17 < 10000, LPAD(@nbc+17, 4, '0'), @nbc+17)), @cl, '2026-02-21 00:00:00', 'payee', 'Vente n° 16 — client · Espèces', 245.916, '2026-02-21 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+17 < 10000, LPAD(@nbl+17, 4, '0'), @nbl+17)), @cmd, @cl, '2026-02-21', 'Repris du registre des ventes', '2026-02-21 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+17 < 10000, LPAD(@nfa+17, 4, '0'), @nfa+17)), @cmd, CONCAT('BC-', IF(@nbc+17 < 10000, LPAD(@nbc+17, 4, '0'), @nbc+17)), @cl, 'client', '2026-02-21', 19, 2.067, 0, 206.652, 39.657, 248.375, '2026-02-21 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 3, 3, 76.5, 61.965, 185.895, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 3);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-30ML', ')'), 76.5, 61.965, 3, 185.895, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-02-21' AND note = 'Vente n° 16 — client · Espèces' AND quantite = 3;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 3, 3, 24.7, 20.007, 60.021, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 3);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-10ML', ')'), 24.7, 20.007, 3, 60.021, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-02-21' AND note = 'Vente n° 16 — client · Espèces' AND quantite = 3;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-02-21', 248.375, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 18 — 2026-02-23 — bernard
SET @cl := (SELECT id FROM clients WHERE nom = 'bernard' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+18 < 10000, LPAD(@nbc+18, 4, '0'), @nbc+18)), @cl, '2026-02-23 00:00:00', 'payee', 'Vente n° 17 — bernard · Espèces', 327.888, '2026-02-23 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+18 < 10000, LPAD(@nbl+18, 4, '0'), @nbl+18)), @cmd, @cl, '2026-02-23', 'Repris du registre des ventes', '2026-02-23 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+18 < 10000, LPAD(@nfa+18, 4, '0'), @nfa+18)), @cmd, CONCAT('BC-', IF(@nbc+18 < 10000, LPAD(@nbc+18, 4, '0'), @nbc+18)), @cl, 'bernard', '2026-02-23', 19, 2.755, 0, 275.536, 52.875, 331.167, '2026-02-23 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 4, 4, 76.5, 61.965, 247.86, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 4);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-30ML', ')'), 76.5, 61.965, 4, 247.86, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-02-23' AND note = 'Vente n° 17 — bernard · Espèces' AND quantite = 4;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 4, 4, 24.7, 20.007, 80.028, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 4);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-10ML', ')'), 24.7, 20.007, 4, 80.028, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-02-23' AND note = 'Vente n° 17 — bernard · Espèces' AND quantite = 4;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-02-23', 331.167, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 19 — 2026-03-14 — omran khaled
SET @cl := (SELECT id FROM clients WHERE nom = 'omran khaled' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+19 < 10000, LPAD(@nbc+19, 4, '0'), @nbc+19)), @cl, '2026-03-14 00:00:00', 'payee', 'Vente n° 18 — omran khaled · Espèces', 205.902, '2026-03-14 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+19 < 10000, LPAD(@nbl+19, 4, '0'), @nbl+19)), @cmd, @cl, '2026-03-14', 'Repris du registre des ventes', '2026-03-14 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+19 < 10000, LPAD(@nfa+19, 4, '0'), @nfa+19)), @cmd, CONCAT('BC-', IF(@nbc+19 < 10000, LPAD(@nbc+19, 4, '0'), @nbc+19)), @cl, 'omran khaled', '2026-03-14', 19, 1.73, 0, 173.027, 33.204, 207.961, '2026-03-14 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 3, 3, 76.5, 61.965, 185.895, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 3);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-30ML', ')'), 76.5, 61.965, 3, 185.895, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-03-14' AND note = 'Vente n° 18 — omran khaled · Espèces' AND quantite = 3;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 1, 1, 24.7, 20.007, 20.007, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 1);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-10ML', ')'), 24.7, 20.007, 1, 20.007, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-03-14' AND note = 'Vente n° 18 — omran khaled · Espèces' AND quantite = 1;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-03-14', 207.961, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 20 — 2026-05-22 — client passaget
SET @cl := (SELECT id FROM clients WHERE nom = 'client passaget' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+20 < 10000, LPAD(@nbc+20, 4, '0'), @nbc+20)), @cl, '2026-05-22 00:00:00', 'payee', 'Vente n° 18 — client passaget · Espèces', 101.979, '2026-05-22 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+20 < 10000, LPAD(@nbl+20, 4, '0'), @nbl+20)), @cmd, @cl, '2026-05-22', 'Repris du registre des ventes', '2026-05-22 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+20 < 10000, LPAD(@nfa+20, 4, '0'), @nfa+20)), @cmd, CONCAT('BC-', IF(@nbc+20 < 10000, LPAD(@nbc+20, 4, '0'), @nbc+20)), @cl, 'client passaget', '2026-05-22', 19, 0.857, 0, 85.697, 16.445, 102.999, '2026-05-22 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '030808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '030808-30ML' ORDER BY id LIMIT 1), 1, 1, 76.5, 61.965, 61.965, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '030808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '030808-30ML' ORDER BY id LIMIT 1), 1);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '030808-30ML' ORDER BY id LIMIT 1))), ' (lot ', '030808-30ML', ')'), 76.5, 61.965, 1, 61.965, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '030808-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-05-22' AND note = 'Vente n° 18 — client passaget · Espèces' AND quantite = 1;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '030808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '030808-10ML' ORDER BY id LIMIT 1), 2, 2, 24.7, 20.007, 40.014, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '030808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '030808-10ML' ORDER BY id LIMIT 1), 2);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '030808-10ML' ORDER BY id LIMIT 1))), ' (lot ', '030808-10ML', ')'), 24.7, 20.007, 2, 40.014, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '030808-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-05-22' AND note = 'Vente n° 18 — client passaget · Espèces' AND quantite = 2;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-05-22', 102.999, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 21 — 2026-05-26 — artisanet
SET @cl := (SELECT id FROM clients WHERE nom = 'artisanet' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+21 < 10000, LPAD(@nbc+21, 4, '0'), @nbc+21)), @cl, '2026-05-26 00:00:00', 'payee', 'Vente n° 18 — artizanet · Espèces', 751.923, '2026-05-26 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+21 < 10000, LPAD(@nbl+21, 4, '0'), @nbl+21)), @cmd, @cl, '2026-05-26', 'Repris du registre des ventes', '2026-05-26 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+21 < 10000, LPAD(@nfa+21, 4, '0'), @nfa+21)), @cmd, CONCAT('BC-', IF(@nbc+21 < 10000, LPAD(@nbc+21, 4, '0'), @nbc+21)), @cl, 'artisanet', '2026-05-26', 19, 6.319, 0, 631.868, 121.255, 759.442, '2026-05-26 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 6, 6, 76.5, 61.965, 371.79, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1), 6);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-30ML', ')'), 76.5, 61.965, 6, 371.79, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-05-26' AND note = 'Vente n° 18 — artizanet · Espèces' AND quantite = 6;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 19, 19, 24.7, 20.007, 380.133, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1), 19);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1))), ' (lot ', '090808-10ML', ')'), 24.7, 20.007, 19, 380.133, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '090808-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-05-26' AND note = 'Vente n° 18 — artizanet · Espèces' AND quantite = 19;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-05-26', 759.442, 'especes', 'Espèces — repris du registre des ventes');

-- Vente 22 — 2026-07-19 — passaget claude
SET @cl := (SELECT id FROM clients WHERE nom = 'passaget claude' ORDER BY id LIMIT 1);
INSERT INTO commandes (numero, client_id, date_iso, statut, notes, total, created_at) VALUES (CONCAT('BC-', IF(@nbc+22 < 10000, LPAD(@nbc+22, 4, '0'), @nbc+22)), @cl, '2026-07-19 00:00:00', 'payee', 'Vente n° 18 — passaget claude · Espèces', 2791.503, '2026-07-19 00:00:00');
SET @cmd := LAST_INSERT_ID();
INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, created_at) VALUES (CONCAT('BL-', IF(@nbl+22 < 10000, LPAD(@nbl+22, 4, '0'), @nbl+22)), @cmd, @cl, '2026-07-19', 'Repris du registre des ventes', '2026-07-19 00:00:00');
SET @bl := LAST_INSERT_ID();
INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, date_emission, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc, created_at)
  VALUES (CONCAT('FAC-', IF(@nfa+22 < 10000, LPAD(@nfa+22, 4, '0'), @nfa+22)), @cmd, CONCAT('BC-', IF(@nbc+22 < 10000, LPAD(@nbc+22, 4, '0'), @nbc+22)), @cl, 'passaget claude', '2026-07-19', 19, 23.458, 1, 2345.801, 450.159, 2820.418, '2026-07-19 00:00:00');
SET @fac := LAST_INSERT_ID();
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '100106-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '100106-30ML' ORDER BY id LIMIT 1), 26, 26, 76.5, 61.965, 1611.09, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '100106-30ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '100106-30ML' ORDER BY id LIMIT 1), 26);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '100106-30ML' ORDER BY id LIMIT 1))), ' (lot ', '100106-30ML', ')'), 76.5, 61.965, 26, 1611.09, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '100106-30ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-07-19' AND note = 'Vente n° 18 — passaget claude · Espèces' AND quantite = 26;
INSERT INTO commande_lignes (commande_id, produit_id, lot_id, qty, qty_livree, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type)
  VALUES (@cmd, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '100106-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '100106-10ML' ORDER BY id LIMIT 1), 59, 59, 24.7, 20.007, 1180.413, @remise, 'Remise 19 %', 19, 'pourcentage');
SET @ligne := LAST_INSERT_ID();
INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES (@bl, @ligne, (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '100106-10ML' ORDER BY id LIMIT 1)), (SELECT id FROM lots WHERE numero_lot = '100106-10ML' ORDER BY id LIMIT 1), 59);
INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
  VALUES (@fac, CONCAT((SELECT nom FROM produits WHERE id = (SELECT produit_id FROM lots WHERE id = (SELECT id FROM lots WHERE numero_lot = '100106-10ML' ORDER BY id LIMIT 1))), ' (lot ', '100106-10ML', ')'), 24.7, 20.007, 59, 1180.413, 'Remise 19 %', 19);
UPDATE stock_mouvements SET source_type = 'commande', source_id = @cmd WHERE type_mouvement = 'VENTE' AND source_type = 'import_registres'
  AND lot_id = (SELECT id FROM lots WHERE numero_lot = '100106-10ML' ORDER BY id LIMIT 1) AND DATE(date_mouvement) = '2026-07-19' AND note = 'Vente n° 18 — passaget claude · Espèces' AND quantite = 59;
INSERT INTO paiements (facture_id, date_paiement, montant, mode, notes) VALUES (@fac, '2026-07-19', 2820.418, 'especes', 'Espèces — repris du registre des ventes');

-- Compteurs
INSERT INTO sequences (name, `last_value`) VALUES ('commande_seq', @nbc + 22) ON DUPLICATE KEY UPDATE `last_value` = GREATEST(`last_value`, @nbc + 22);
INSERT INTO sequences (name, `last_value`) VALUES ('bl_seq', @nbl + 22) ON DUPLICATE KEY UPDATE `last_value` = GREATEST(`last_value`, @nbl + 22);
INSERT INTO sequences (name, `last_value`) VALUES ('facture_seq', @nfa + 22) ON DUPLICATE KEY UPDATE `last_value` = GREATEST(`last_value`, @nfa + 22);

COMMIT;
SELECT 'Documents de vente termines : 22 commandes, bons de livraison, factures et paiements' AS resultat;
END //
DELIMITER ;

-- Contrôle : ventes par facture
SELECT COUNT(*) AS factures, ROUND(SUM(total_ht), 3) AS total_ht, ROUND(SUM(total_ttc), 3) AS total_ttc FROM factures;
