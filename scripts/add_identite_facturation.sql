-- ============================================================================
-- Ajoute les champs d'identité de facturation (logo, coordonnées, couleur) à
-- la table settings — nécessaires pour générer une facture professionnelle.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_identite_facturation.sql
-- ============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'entreprise_nom'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE settings
     ADD COLUMN entreprise_nom VARCHAR(150),
     ADD COLUMN entreprise_adresse TEXT,
     ADD COLUMN entreprise_telephone VARCHAR(30),
     ADD COLUMN entreprise_email VARCHAR(150),
     ADD COLUMN entreprise_matricule_fiscal VARCHAR(30),
     ADD COLUMN entreprise_logo LONGTEXT,
     ADD COLUMN facture_couleur VARCHAR(9) NOT NULL DEFAULT ''#17231D''',
  'SELECT "Champs déjà en place, rien à faire" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT entreprise_nom, facture_couleur FROM settings WHERE id = 1;
