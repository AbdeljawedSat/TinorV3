-- ============================================================================
-- Ajoute settings.timbre_seuil — le droit de timbre ne s'applique désormais
-- que si le Total TTC de la facture atteint ce seuil (1000 TND par défaut).
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_timbre_seuil.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'timbre_seuil'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE settings ADD COLUMN timbre_seuil DECIMAL(10,3) NOT NULL DEFAULT 1000.000',
  'SELECT "timbre_seuil déjà en place" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT timbre_seuil FROM settings WHERE id = 1;
