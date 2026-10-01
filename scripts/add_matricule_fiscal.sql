-- ============================================================================
-- Mise à jour ciblée : matricule fiscal pour fournisseurs et clients
-- ============================================================================
-- À exécuter UNE FOIS sur votre base existante (ne recrée rien, ne supprime
-- aucune donnée). Contrairement à un `npm run migrate` complet (qui échouerait
-- car les tables existent déjà), ce script se contente d'ajuster les 2 tables
-- concernées.
--
-- Usage :
--   mysql -u <user> -p <votre_base> < add_matricule_fiscal.sql
-- ============================================================================

-- 1. Fournisseurs : la colonne n'existait pas du tout, on l'ajoute (si absente).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs' AND COLUMN_NAME = 'matricule_fiscal'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE fournisseurs ADD COLUMN matricule_fiscal VARCHAR(30) AFTER type',
  'SELECT "fournisseurs.matricule_fiscal déjà en place" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Clients : la colonne existait déjà sous le nom `matricule` (déjà utilisée
--    par l'interface), on la renomme simplement pour la cohérence avec
--    fournisseurs — aucune donnée n'est perdue, les valeurs existantes suivent.
--    Protégé : ne renomme que si `matricule` existe encore (pas déjà fait).
SET @old_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'matricule'
);
SET @sql2 := IF(@old_exists > 0,
  'ALTER TABLE clients CHANGE COLUMN matricule matricule_fiscal VARCHAR(30)',
  'SELECT "clients.matricule_fiscal déjà en place" AS info'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Vérification (affiche la structure des 2 tables après modification)
DESCRIBE fournisseurs;
DESCRIBE clients;
