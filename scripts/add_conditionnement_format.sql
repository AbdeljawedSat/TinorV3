-- ============================================================================
-- Ajoute conditionnements.format_id — fige le format réellement utilisé à
-- chaque opération, pour que l'historique ne dépende plus du format ACTUEL
-- du produit (qui peut changer après coup et fausser rétroactivement les
-- anciennes lignes).
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_conditionnement_format.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conditionnements' AND COLUMN_NAME = 'format_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE conditionnements ADD COLUMN format_id INT NULL AFTER produit_id, ADD FOREIGN KEY (format_id) REFERENCES formats(id)',
  'SELECT "conditionnements.format_id déjà en place, rien à faire" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remplit les lignes existantes avec le format ACTUEL du produit (meilleure
-- estimation possible rétroactivement — l'historique futur sera fiable).
UPDATE conditionnements c
  JOIN produits p ON p.id = c.produit_id
  SET c.format_id = p.format_id
  WHERE c.format_id IS NULL;

SELECT COUNT(*) AS lignes_mises_a_jour FROM conditionnements WHERE format_id IS NOT NULL;
