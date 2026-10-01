-- ============================================================================
-- Généralise huile_ref_id (spécifique à l'huile) en produit_source_id
-- (utilisable pour tout produit conditionné, savon compris) — même colonne,
-- mêmes valeurs, juste renommée. Aucune donnée perdue.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\rename_produit_source.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produits' AND COLUMN_NAME = 'huile_ref_id'
);
SET @sql := IF(@col_exists > 0,
  'ALTER TABLE produits CHANGE COLUMN huile_ref_id produit_source_id INT NULL',
  'SELECT "produits.produit_source_id déjà en place, rien à faire" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produits' AND COLUMN_NAME = 'produit_source_id';
