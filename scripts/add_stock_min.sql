-- ============================================================================
-- Ajoute produits.stock_min — seuil d'alerte stock bas, utilisé par les
-- nouvelles "Alertes prioritaires" du Tableau de bord. Optionnel : les
-- produits sans seuil défini ne génèrent simplement pas d'alerte.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_stock_min.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produits' AND COLUMN_NAME = 'stock_min'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE produits ADD COLUMN stock_min DECIMAL(12,3) NULL AFTER cout_standard',
  'SELECT "stock_min déjà en place" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) AS produits_existants FROM produits;
