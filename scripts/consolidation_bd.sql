-- ============================================================================
-- Consolidation de toutes les modifications de structure apportées à la BD
-- depuis votre installation initiale — sûr à exécuter même si une partie a
-- déjà été appliquée (utilise IF NOT EXISTS / vérifications avant chaque
-- changement, aucune donnée existante n'est supprimée).
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts/consolidation_bd.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fournisseurs : ajout du matricule fiscal (absent du schéma initial)
-- ----------------------------------------------------------------------------
ALTER TABLE fournisseurs
  ADD COLUMN IF NOT EXISTS matricule_fiscal VARCHAR(30) AFTER type;

-- ----------------------------------------------------------------------------
-- 2. Clients : la colonne existait déjà sous le nom `matricule` — renommage
--    en `matricule_fiscal` pour cohérence avec fournisseurs. Protégé : ne
--    s'exécute que si l'ancienne colonne existe encore (sinon déjà fait).
-- ----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'matricule'
);
SET @sql := IF(@col_exists > 0,
  'ALTER TABLE clients CHANGE COLUMN matricule matricule_fiscal VARCHAR(30)',
  'SELECT "clients.matricule_fiscal déjà en place, rien à faire" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 3. Settings : la Grille de prix a besoin d'une ligne de configuration par
--    défaut (salaire, marge, TVA, offre spéciale 9+1...) — absente si votre
--    installation date d'avant l'ajout du module Grille de prix.
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO settings (id) VALUES (1);

-- Vérification (affiche l'état final des 3 points ci-dessus)
SELECT 'fournisseurs' AS table_name, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs' AND COLUMN_NAME = 'matricule_fiscal'
UNION ALL
SELECT 'clients', COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'matricule_fiscal';

SELECT * FROM settings WHERE id = 1;
