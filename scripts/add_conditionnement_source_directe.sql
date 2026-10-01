-- ============================================================================
-- Permet au Conditionnement d'utiliser comme source un vrac reçu DIRECTEMENT
-- (achat/réception), pas seulement un lot de presse ou de filtration — cas
-- d'une matière achetée toute faite (ex: pâte à savon) plutôt que pressée.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_conditionnement_source_directe.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conditionnement_sources' AND COLUMN_NAME = 'lot_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE conditionnement_sources
     ADD COLUMN lot_id BIGINT NULL AFTER lot_filtration_id,
     ADD FOREIGN KEY (lot_id) REFERENCES lots(id)',
  'SELECT "lot_id déjà en place" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remplace l'ancienne contrainte (2 types possibles) par la nouvelle (3 types).
-- Le nom de la contrainte CHECK est généré automatiquement par MariaDB et
-- n'est PAS prévisible (ex: "CONSTRAINT_1") — on le cherche dynamiquement.
SET @old_check := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conditionnement_sources' AND CONSTRAINT_TYPE = 'CHECK'
  LIMIT 1
);
SET @sql2 := IF(@old_check IS NOT NULL,
  CONCAT('ALTER TABLE conditionnement_sources DROP CONSTRAINT `', @old_check, '`'),
  'SELECT "Aucune ancienne contrainte à retirer" AS info'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Recrée la contrainte à 3 types — protégé : ne fait rien si déjà en place
-- (une contrainte contenant "lot_id" existe déjà = la nouvelle version).
SET @has_new_check := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conditionnement_sources'
    AND CONSTRAINT_TYPE = 'CHECK' AND CONSTRAINT_NAME = 'conditionnement_sources_chk_3types'
);
SET @sql3 := IF(@has_new_check = 0,
  'ALTER TABLE conditionnement_sources
     ADD CONSTRAINT conditionnement_sources_chk_3types CHECK (
       (lot_presse_id IS NOT NULL AND lot_filtration_id IS NULL AND lot_id IS NULL) OR
       (lot_presse_id IS NULL AND lot_filtration_id IS NOT NULL AND lot_id IS NULL) OR
       (lot_presse_id IS NULL AND lot_filtration_id IS NULL AND lot_id IS NOT NULL)
     )',
  'SELECT "Nouvelle contrainte déjà en place" AS info'
);
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SELECT COUNT(*) AS lignes_existantes FROM conditionnement_sources;
