-- ============================================================================
-- Rend le format des numéros de lot paramétrable (Paramètres → Format des
-- numéros de lot) au lieu d'être figé dans le code. Deux changements :
--   1. settings.lot_format_style + lot_seq_par_origine (nouveaux réglages)
--   2. lot_sequences : clé composite (produit_id, origine) pour permettre
--      une séquence séparée par origine si activé — vos séquences déjà
--      utilisées sont préservées telles quelles (mode "partagé" par défaut).
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_lot_format_parametrable.sql
-- ============================================================================

-- 1. Nouveaux réglages sur settings
SET @col1_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'lot_format_style'
);
SET @sql1 := IF(@col1_exists = 0,
  'ALTER TABLE settings ADD COLUMN lot_format_style VARCHAR(20) NOT NULL DEFAULT \'code_origine_seq\'
     CHECK (lot_format_style IN (\'code_origine_seq\', \'origine_code_seq\'))',
  'SELECT "lot_format_style déjà en place" AS info'
);
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col2_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'lot_seq_par_origine'
);
SET @sql2 := IF(@col2_exists = 0,
  'ALTER TABLE settings ADD COLUMN lot_seq_par_origine BOOLEAN NOT NULL DEFAULT FALSE',
  'SELECT "lot_seq_par_origine déjà en place" AS info'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 2. lot_sequences : ajoute la colonne origine (vide par défaut = mode
--    partagé, préserve exactement vos séquences déjà utilisées), puis
--    reconstruit la clé primaire en clé composite (produit_id, origine).
SET @col3_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_sequences' AND COLUMN_NAME = 'origine'
);
SET @sql3 := IF(@col3_exists = 0,
  'ALTER TABLE lot_sequences
     DROP PRIMARY KEY,
     ADD COLUMN origine VARCHAR(20) NOT NULL DEFAULT \'\' AFTER produit_id,
     ADD PRIMARY KEY (produit_id, origine)',
  'SELECT "lot_sequences.origine déjà en place" AS info'
);
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SELECT lot_format_style, lot_seq_par_origine FROM settings WHERE id = 1;
