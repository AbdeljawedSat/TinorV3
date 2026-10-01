-- ============================================================================
-- Ajoute le FODEC (1% du HT) et le droit de timbre à la chaîne de calcul des
-- factures. N'affecte jamais le Total TTC déjà payé par le client — seule la
-- décomposition HT/FODEC/TVA/Timbre est recalculée correctement.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_fodec_timbre.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'fodec_rate'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE settings
     ADD COLUMN fodec_rate DECIMAL(5,2) NOT NULL DEFAULT 1.00,
     ADD COLUMN droit_timbre DECIMAL(6,3) NOT NULL DEFAULT 1.000',
  'SELECT "settings : déjà en place" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factures' AND COLUMN_NAME = 'fodec_montant'
);
SET @sql2 := IF(@col_exists2 = 0,
  'ALTER TABLE factures
     ADD COLUMN fodec_montant DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER tva_rate,
     ADD COLUMN droit_timbre DECIMAL(6,3) NOT NULL DEFAULT 0 AFTER fodec_montant',
  'SELECT "factures : déjà en place" AS info'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Les factures déjà émises gardent leur total_ht/montant_tva existants tels
-- quels (fodec_montant=0, droit_timbre=0 pour l'historique) — seules les
-- NOUVELLES factures émises après cette mise à jour auront la décomposition
-- FODEC/Timbre correcte. Ne pas recalculer rétroactivement l'historique.

SELECT fodec_rate, droit_timbre FROM settings WHERE id = 1;
