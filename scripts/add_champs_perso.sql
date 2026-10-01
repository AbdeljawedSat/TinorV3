-- ============================================================================
-- Ajoute lots.champs_perso (JSON) — permet d'enregistrer les valeurs des
-- champs personnalisés définis dans Structure des lots, pour Presse,
-- Filtration et Conditionnement.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_champs_perso.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lots' AND COLUMN_NAME = 'champs_perso'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE lots ADD COLUMN champs_perso JSON NULL AFTER notes',
  'SELECT "champs_perso déjà en place" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) AS lots_existants FROM lots;
