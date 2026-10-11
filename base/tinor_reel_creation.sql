-- ============================================================================
-- TinOR V3.3 — création de la base RÉELLE « tinor_reel » (vide)
-- Toutes les tables à jour + données de référence (unités, catégories, formats,
-- locaux, compte admin), numérotation des lots « Jardins de Jerba » activée.
-- Aucune donnée de démonstration.
--
-- Exécution : HeidiSQL (connecté en root) → Fichier › Exécuter un fichier SQL,
--             ou : mysql -u root -p < base\tinor_reel_creation.sql
-- Compte : admin / changeme  → À CHANGER dès la première connexion
--          (ou lancer ensuite « npm run creer:reel » qui demande le mot de passe).
-- Remplacez 'tinor' ci-dessous si votre DB_USER (fichier .env) est différent.
-- ============================================================================
CREATE DATABASE IF NOT EXISTS tinor_reel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON tinor_reel.* TO 'tinor'@'localhost';
FLUSH PRIVILEGES;
USE tinor_reel;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `achat_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `achat_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `achat_id` int(11) NOT NULL,
  `produit_id` int(11) NOT NULL,
  `quantite` decimal(12,3) NOT NULL,
  `prix_unitaire` decimal(12,3) NOT NULL DEFAULT 0.000,
  `total_ht` decimal(12,3) NOT NULL DEFAULT 0.000,
  `lot_fournisseur` varchar(100) DEFAULT NULL,
  `date_expiration` date DEFAULT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `achat_id` (`achat_id`),
  KEY `produit_id` (`produit_id`),
  KEY `lot_id` (`lot_id`),
  CONSTRAINT `achat_lignes_ibfk_1` FOREIGN KEY (`achat_id`) REFERENCES `achats` (`id`) ON DELETE CASCADE,
  CONSTRAINT `achat_lignes_ibfk_2` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `achat_lignes_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `achat_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `achat_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `achats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `achats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `fournisseur_id` int(11) NOT NULL,
  `date_achat` date NOT NULL,
  `statut` varchar(15) NOT NULL DEFAULT 'brouillon' CHECK (`statut` in ('brouillon','commande','partiel','receptionne','annule','cloture')),
  `total_ht` decimal(12,3) NOT NULL DEFAULT 0.000,
  `tva` decimal(12,3) NOT NULL DEFAULT 0.000,
  `total_ttc` decimal(12,3) NOT NULL DEFAULT 0.000,
  `notes` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `fournisseur_id` (`fournisseur_id`),
  KEY `idx_achats_employe` (`employe_id`),
  CONSTRAINT `achats_ibfk_1` FOREIGN KEY (`fournisseur_id`) REFERENCES `fournisseurs` (`id`),
  CONSTRAINT `achats_ibfk_2` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `achats` DISABLE KEYS */;
/*!40000 ALTER TABLE `achats` ENABLE KEYS */;
DROP TABLE IF EXISTS `avoir_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `avoir_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `avoir_id` int(11) NOT NULL,
  `commande_ligne_id` int(11) DEFAULT NULL,
  `produit_id` int(11) DEFAULT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `designation` varchar(255) NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `unit_price` decimal(12,3) NOT NULL,
  `total` decimal(12,3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `avoir_id` (`avoir_id`),
  KEY `idx_avoir_lignes_cmd` (`commande_ligne_id`),
  CONSTRAINT `avoir_lignes_ibfk_1` FOREIGN KEY (`avoir_id`) REFERENCES `avoirs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `avoir_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `avoir_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `avoirs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `avoirs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `facture_id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `client_nom` varchar(150) DEFAULT NULL,
  `date_emission` datetime NOT NULL DEFAULT current_timestamp(),
  `motif` varchar(255) NOT NULL,
  `remise_en_stock` tinyint(1) NOT NULL DEFAULT 1,
  `total_ht` decimal(12,3) NOT NULL DEFAULT 0.000,
  `fodec_montant` decimal(12,3) NOT NULL DEFAULT 0.000,
  `montant_tva` decimal(12,3) NOT NULL DEFAULT 0.000,
  `droit_timbre` decimal(12,3) NOT NULL DEFAULT 0.000,
  `total_ttc` decimal(12,3) NOT NULL DEFAULT 0.000,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `idx_avoirs_facture` (`facture_id`),
  CONSTRAINT `avoirs_ibfk_1` FOREIGN KEY (`facture_id`) REFERENCES `factures` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `avoirs` DISABLE KEYS */;
/*!40000 ALTER TABLE `avoirs` ENABLE KEYS */;
DROP TABLE IF EXISTS `bl_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `bl_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bl_id` int(11) NOT NULL,
  `commande_ligne_id` int(11) NOT NULL,
  `produit_id` int(11) NOT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  `qty` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `bl_id` (`bl_id`),
  KEY `commande_ligne_id` (`commande_ligne_id`),
  KEY `produit_id` (`produit_id`),
  KEY `lot_id` (`lot_id`),
  CONSTRAINT `bl_lignes_ibfk_1` FOREIGN KEY (`bl_id`) REFERENCES `bons_livraison` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bl_lignes_ibfk_2` FOREIGN KEY (`commande_ligne_id`) REFERENCES `commande_lignes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bl_lignes_ibfk_3` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `bl_lignes_ibfk_4` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `bl_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `bl_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `bons_livraison`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `bons_livraison` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `commande_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `date_livraison` date NOT NULL,
  `statut` varchar(10) NOT NULL DEFAULT 'emis' CHECK (`statut` in ('emis','annule')),
  `notes` text DEFAULT NULL,
  `annule_motif` varchar(255) DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `client_id` (`client_id`),
  KEY `employe_id` (`employe_id`),
  KEY `idx_bl_commande` (`commande_id`),
  CONSTRAINT `bons_livraison_ibfk_1` FOREIGN KEY (`commande_id`) REFERENCES `commandes` (`id`),
  CONSTRAINT `bons_livraison_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `bons_livraison_ibfk_3` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `bons_livraison` DISABLE KEYS */;
/*!40000 ALTER TABLE `bons_livraison` ENABLE KEYS */;
DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `type_category` varchar(15) NOT NULL CHECK (`type_category` in ('MATIERE','INGREDIENT','CONSOMMABLE','EMBALLAGE','PRODUIT','SOUS_PRODUIT','AUTRE')),
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES
(1,'HUILE','Huiles','PRODUIT',1),
(2,'CONS','Consommables','CONSOMMABLE',1),
(3,'EMBALLAGE','Emballages','EMBALLAGE',1),
(4,'SAVON','Savons','PRODUIT',1),
(5,'COMPOSE','Produits composés','PRODUIT',1);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
DROP TABLE IF EXISTS `certificats_bio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `certificats_bio` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(50) NOT NULL,
  `organisme` varchar(30) NOT NULL CHECK (`organisme` in ('INNORPI','ECOCERT','BCS','AUTRE')),
  `date_delivrance` date NOT NULL,
  `date_expiration` date NOT NULL,
  `portee` text DEFAULT NULL,
  `document_ref` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `certificats_bio` DISABLE KEYS */;
/*!40000 ALTER TABLE `certificats_bio` ENABLE KEYS */;
DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(150) NOT NULL,
  `tel` varchar(30) DEFAULT NULL,
  `ville` varchar(100) DEFAULT NULL,
  `matricule_fiscal` varchar(30) DEFAULT NULL,
  `type` varchar(15) NOT NULL DEFAULT 'particulier' CHECK (`type` in ('particulier','pharmacie','revendeur','export')),
  `remise_id` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `remise_id` (`remise_id`),
  KEY `idx_clients_nom` (`nom`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`remise_id`) REFERENCES `remises` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
DROP TABLE IF EXISTS `commande_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `commande_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `commande_id` int(11) NOT NULL,
  `produit_id` int(11) NOT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  `qty` decimal(10,2) NOT NULL,
  `qty_livree` decimal(10,2) NOT NULL DEFAULT 0.00,
  `prix_detail` decimal(10,3) NOT NULL,
  `unit_price` decimal(10,3) NOT NULL,
  `total` decimal(12,3) NOT NULL,
  `remise_id` int(11) DEFAULT NULL,
  `remise_nom` varchar(100) DEFAULT NULL,
  `remise_pct` decimal(5,2) DEFAULT NULL,
  `remise_type` varchar(15) DEFAULT NULL,
  `free_units` int(11) DEFAULT 0,
  `cumule` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `commande_id` (`commande_id`),
  KEY `produit_id` (`produit_id`),
  KEY `lot_id` (`lot_id`),
  KEY `remise_id` (`remise_id`),
  CONSTRAINT `commande_lignes_ibfk_1` FOREIGN KEY (`commande_id`) REFERENCES `commandes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `commande_lignes_ibfk_2` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `commande_lignes_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `commande_lignes_ibfk_4` FOREIGN KEY (`remise_id`) REFERENCES `remises` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `commande_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `commande_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `commandes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `commandes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `client_id` int(11) NOT NULL,
  `date_iso` datetime NOT NULL DEFAULT current_timestamp(),
  `statut` varchar(15) NOT NULL DEFAULT 'confirmee' CHECK (`statut` in ('en_attente','confirmee','livree','payee','annulee')),
  `notes` text DEFAULT NULL,
  `total` decimal(12,3) NOT NULL DEFAULT 0.000,
  `created_by` int(11) DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `idx_commandes_client` (`client_id`),
  KEY `idx_commandes_date` (`date_iso`),
  KEY `idx_commandes_employe` (`employe_id`),
  CONSTRAINT `commandes_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `commandes_ibfk_2` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `commandes` DISABLE KEYS */;
/*!40000 ALTER TABLE `commandes` ENABLE KEYS */;
DROP TABLE IF EXISTS `conditionnement_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `conditionnement_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conditionnement_id` int(11) NOT NULL,
  `lot_presse_id` int(11) DEFAULT NULL,
  `lot_filtration_id` int(11) DEFAULT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  `quantite_utilisee` decimal(10,3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `conditionnement_id` (`conditionnement_id`),
  KEY `lot_presse_id` (`lot_presse_id`),
  KEY `lot_filtration_id` (`lot_filtration_id`),
  KEY `lot_id` (`lot_id`),
  CONSTRAINT `conditionnement_sources_ibfk_1` FOREIGN KEY (`conditionnement_id`) REFERENCES `conditionnements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conditionnement_sources_ibfk_2` FOREIGN KEY (`lot_presse_id`) REFERENCES `lots_presse` (`id`),
  CONSTRAINT `conditionnement_sources_ibfk_3` FOREIGN KEY (`lot_filtration_id`) REFERENCES `lots_filtration` (`id`),
  CONSTRAINT `conditionnement_sources_ibfk_4` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`lot_presse_id` is not null and `lot_filtration_id` is null and `lot_id` is null or `lot_presse_id` is null and `lot_filtration_id` is not null and `lot_id` is null or `lot_presse_id` is null and `lot_filtration_id` is null and `lot_id` is not null)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `conditionnement_sources` DISABLE KEYS */;
/*!40000 ALTER TABLE `conditionnement_sources` ENABLE KEYS */;
DROP TABLE IF EXISTS `conditionnements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `conditionnements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `produit_id` int(11) NOT NULL,
  `format_id` int(11) DEFAULT NULL,
  `lot_id` bigint(20) NOT NULL,
  `qty` decimal(10,2) NOT NULL,
  `quantite_source_utilisee` decimal(10,3) NOT NULL,
  `note` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `produit_id` (`produit_id`),
  KEY `format_id` (`format_id`),
  KEY `lot_id` (`lot_id`),
  KEY `idx_conditionnements_employe` (`employe_id`),
  CONSTRAINT `conditionnements_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `conditionnements_ibfk_2` FOREIGN KEY (`format_id`) REFERENCES `formats` (`id`),
  CONSTRAINT `conditionnements_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `conditionnements_ibfk_4` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `conditionnements` DISABLE KEYS */;
/*!40000 ALTER TABLE `conditionnements` ENABLE KEYS */;
DROP TABLE IF EXISTS `controles_qualite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `controles_qualite` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_id` bigint(20) NOT NULL,
  `date_controle` date NOT NULL,
  `type_controle` varchar(100) DEFAULT NULL,
  `resultat` text DEFAULT NULL,
  `decision` varchar(15) NOT NULL CHECK (`decision` in ('LIBERE','BLOQUE','REJETE')),
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lot_id` (`lot_id`),
  CONSTRAINT `controles_qualite_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `controles_qualite` DISABLE KEYS */;
/*!40000 ALTER TABLE `controles_qualite` ENABLE KEYS */;
DROP TABLE IF EXISTS `employes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `employes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `matricule` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) NOT NULL,
  `fonction` varchar(100) DEFAULT NULL,
  `telephone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `date_entree` date DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `matricule` (`matricule`),
  KEY `idx_employes_nom` (`nom`,`prenom`),
  KEY `idx_employes_actif` (`actif`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `employes` DISABLE KEYS */;
INSERT INTO `employes` VALUES
(1,'EMP-000','Admin','Compte','Gérant',NULL,NULL,NULL,1,'2026-10-11 11:50:04','2026-10-11 11:50:04');
/*!40000 ALTER TABLE `employes` ENABLE KEYS */;
DROP TABLE IF EXISTS `facture_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `facture_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facture_id` int(11) NOT NULL,
  `designation` varchar(255) NOT NULL,
  `prix_detail` decimal(10,3) NOT NULL,
  `unit_price` decimal(10,3) NOT NULL,
  `qty` decimal(10,2) NOT NULL,
  `total` decimal(12,3) NOT NULL,
  `remise_nom` varchar(100) DEFAULT NULL,
  `remise_pct` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `facture_id` (`facture_id`),
  CONSTRAINT `facture_lignes_ibfk_1` FOREIGN KEY (`facture_id`) REFERENCES `factures` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `facture_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `facture_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `factures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `factures` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `statut` varchar(10) NOT NULL DEFAULT 'emise' CHECK (`statut` in ('emise','annulee')),
  `commande_id` int(11) DEFAULT NULL,
  `commande_numero` varchar(20) NOT NULL,
  `client_id` int(11) NOT NULL,
  `client_nom` varchar(150) NOT NULL,
  `date_emission` date NOT NULL DEFAULT curdate(),
  `tva_rate` decimal(5,2) NOT NULL,
  `fodec_montant` decimal(12,3) NOT NULL DEFAULT 0.000,
  `droit_timbre` decimal(6,3) NOT NULL DEFAULT 0.000,
  `total_ht` decimal(12,3) NOT NULL,
  `montant_tva` decimal(12,3) NOT NULL,
  `total_ttc` decimal(12,3) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `commande_id` (`commande_id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `factures_ibfk_1` FOREIGN KEY (`commande_id`) REFERENCES `commandes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `factures_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `factures` DISABLE KEYS */;
/*!40000 ALTER TABLE `factures` ENABLE KEYS */;
DROP TABLE IF EXISTS `formats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `formats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `volume` decimal(12,3) DEFAULT NULL,
  `poids` decimal(12,3) DEFAULT NULL,
  `unite_id` int(11) DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `unite_id` (`unite_id`),
  CONSTRAINT `formats_ibfk_1` FOREIGN KEY (`unite_id`) REFERENCES `unites` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `formats` DISABLE KEYS */;
INSERT INTO `formats` VALUES
(1,'10ml','10 ml',10.000,NULL,2,1),
(2,'30ml','30 ml',30.000,NULL,2,1),
(3,'100ml','100 ml',100.000,NULL,2,1),
(4,'250ml','250 ml',250.000,NULL,2,1),
(5,'1000ml','1000 ml',1000.000,NULL,2,1);
/*!40000 ALTER TABLE `formats` ENABLE KEYS */;
DROP TABLE IF EXISTS `fournisseurs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fournisseurs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(150) NOT NULL,
  `type` varchar(25) NOT NULL DEFAULT 'fournisseur_externe' CHECK (`type` in ('parcelle','fournisseur_externe','emballage','consommable','produit_revendu','service','autre')),
  `matricule_fiscal` varchar(30) DEFAULT NULL,
  `localisation` varchar(200) DEFAULT NULL,
  `statut_bio` varchar(20) NOT NULL DEFAULT 'conversion' CHECK (`statut_bio` in ('certifie','conversion','non_bio')),
  `certificat_id` int(11) DEFAULT NULL,
  `telephone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `certificat_id` (`certificat_id`),
  CONSTRAINT `fournisseurs_ibfk_1` FOREIGN KEY (`certificat_id`) REFERENCES `certificats_bio` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `fournisseurs` DISABLE KEYS */;
/*!40000 ALTER TABLE `fournisseurs` ENABLE KEYS */;
DROP TABLE IF EXISTS `grille_cout_overrides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grille_cout_overrides` (
  `grille_id` int(11) NOT NULL,
  `valeur` decimal(10,3) NOT NULL,
  PRIMARY KEY (`grille_id`),
  CONSTRAINT `grille_cout_overrides_ibfk_1` FOREIGN KEY (`grille_id`) REFERENCES `grille_huiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `grille_cout_overrides` DISABLE KEYS */;
/*!40000 ALTER TABLE `grille_cout_overrides` ENABLE KEYS */;
DROP TABLE IF EXISTS `grille_detail_overrides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grille_detail_overrides` (
  `grille_id` int(11) NOT NULL,
  `format_key` varchar(10) NOT NULL CHECK (`format_key` in ('10ml','30ml','100ml','250ml','1000ml')),
  `valeur` decimal(10,3) NOT NULL,
  PRIMARY KEY (`grille_id`,`format_key`),
  CONSTRAINT `grille_detail_overrides_ibfk_1` FOREIGN KEY (`grille_id`) REFERENCES `grille_huiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `grille_detail_overrides` DISABLE KEYS */;
/*!40000 ALTER TABLE `grille_detail_overrides` ENABLE KEYS */;
DROP TABLE IF EXISTS `grille_historique`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grille_historique` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grille_id` int(11) NOT NULL,
  `date_effet` date NOT NULL,
  `cout_matiere` decimal(10,3) NOT NULL,
  `rendement_jour` decimal(10,2) NOT NULL,
  `note` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_grille_historique_date` (`grille_id`,`date_effet` DESC),
  CONSTRAINT `grille_historique_ibfk_1` FOREIGN KEY (`grille_id`) REFERENCES `grille_huiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `grille_historique` DISABLE KEYS */;
/*!40000 ALTER TABLE `grille_historique` ENABLE KEYS */;
DROP TABLE IF EXISTS `grille_huiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grille_huiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `produit_id` int(11) NOT NULL,
  `matiere` decimal(10,3) NOT NULL,
  `prod` decimal(10,2) NOT NULL,
  `amortissement` decimal(10,3) NOT NULL DEFAULT 5.000,
  `electricite_par_litre` decimal(10,3) NOT NULL DEFAULT 0.000,
  `detail30_marche` decimal(10,3) DEFAULT NULL,
  `detail30_tableau` decimal(10,3) DEFAULT NULL,
  `t100` decimal(10,3) DEFAULT NULL,
  `t250` decimal(10,3) DEFAULT NULL,
  `t1000` decimal(10,3) DEFAULT NULL,
  `is_custom` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `produit_id` (`produit_id`),
  CONSTRAINT `grille_huiles_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `grille_huiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `grille_huiles` ENABLE KEYS */;
DROP TABLE IF EXISTS `inventaire_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventaire_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inventaire_id` int(11) NOT NULL,
  `produit_id` int(11) NOT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  `quantite_theorique` decimal(12,3) NOT NULL,
  `quantite_physique` decimal(12,3) NOT NULL,
  `ecart` decimal(12,3) NOT NULL,
  `mouvement_ajustement_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inventaire_id` (`inventaire_id`),
  KEY `produit_id` (`produit_id`),
  KEY `lot_id` (`lot_id`),
  KEY `mouvement_ajustement_id` (`mouvement_ajustement_id`),
  CONSTRAINT `inventaire_lignes_ibfk_1` FOREIGN KEY (`inventaire_id`) REFERENCES `inventaires` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventaire_lignes_ibfk_2` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `inventaire_lignes_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `inventaire_lignes_ibfk_4` FOREIGN KEY (`mouvement_ajustement_id`) REFERENCES `stock_mouvements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `inventaire_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventaire_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `inventaires`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventaires` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `date` date NOT NULL,
  `local_id` int(11) NOT NULL,
  `statut` varchar(15) NOT NULL DEFAULT 'en_cours' CHECK (`statut` in ('en_cours','cloture')),
  `notes` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `local_id` (`local_id`),
  KEY `idx_inventaires_employe` (`employe_id`),
  CONSTRAINT `inventaires_ibfk_1` FOREIGN KEY (`local_id`) REFERENCES `locaux` (`id`),
  CONSTRAINT `inventaires_ibfk_2` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `inventaires` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventaires` ENABLE KEYS */;
DROP TABLE IF EXISTS `local_zones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `local_zones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `local_id` int(11) NOT NULL,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_local_zone` (`local_id`,`code`),
  CONSTRAINT `local_zones_ibfk_1` FOREIGN KEY (`local_id`) REFERENCES `locaux` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `local_zones` DISABLE KEYS */;
/*!40000 ALTER TABLE `local_zones` ENABLE KEYS */;
DROP TABLE IF EXISTS `locaux`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `locaux` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `type_local` varchar(30) NOT NULL CHECK (`type_local` in ('STOCK','RECEPTION','PRODUCTION','PRESSAGE','FILTRATION','CONDITIONNEMENT','QUARANTAINE','BIO','BOUTIQUE','EXPEDITION','AUTRE')),
  `description` text DEFAULT NULL,
  `adresse` text DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `locaux` DISABLE KEYS */;
INSERT INTO `locaux` VALUES
(1,'ATELIER','Atelier Djerba','PRODUCTION',NULL,NULL,1,'2026-10-11 11:50:04'),
(2,'STOCK1','Entrepôt Principal','STOCK',NULL,NULL,1,'2026-10-11 11:50:04');
/*!40000 ALTER TABLE `locaux` ENABLE KEYS */;
DROP TABLE IF EXISTS `lot_origines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_origines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_fils_id` bigint(20) NOT NULL,
  `lot_source_id` bigint(20) NOT NULL,
  `quantite_utilisee` decimal(12,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lot_fils_id` (`lot_fils_id`),
  KEY `lot_source_id` (`lot_source_id`),
  CONSTRAINT `lot_origines_ibfk_1` FOREIGN KEY (`lot_fils_id`) REFERENCES `lots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lot_origines_ibfk_2` FOREIGN KEY (`lot_source_id`) REFERENCES `lots` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lot_origines` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_origines` ENABLE KEYS */;
DROP TABLE IF EXISTS `lot_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_sequences` (
  `produit_id` int(11) NOT NULL,
  `origine` varchar(20) NOT NULL DEFAULT '',
  `last_seq` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`produit_id`,`origine`),
  CONSTRAINT `lot_sequences_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lot_sequences` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_sequences` ENABLE KEYS */;
DROP TABLE IF EXISTS `lot_statuts_historique`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_statuts_historique` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `lot_id` bigint(20) NOT NULL,
  `statut` varchar(15) NOT NULL CHECK (`statut` in ('QUARANTAINE','LIBERE','BLOQUE','REJETE','EXPIRE','EPUISE','CLOTURE')),
  `motif` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `date_debut` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `employe_id` (`employe_id`),
  KEY `idx_lot_statuts_historique_lot` (`lot_id`,`date_debut`),
  CONSTRAINT `lot_statuts_historique_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lot_statuts_historique_ibfk_2` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lot_statuts_historique` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_statuts_historique` ENABLE KEYS */;
DROP TABLE IF EXISTS `lot_type_champs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_type_champs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type_lot` varchar(20) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `type_champ` varchar(20) NOT NULL DEFAULT 'texte' CHECK (`type_champ` in ('texte','nombre','date','liste','case_a_cocher')),
  `obligatoire` tinyint(1) NOT NULL DEFAULT 0,
  `verrouille` tinyint(1) NOT NULL DEFAULT 0,
  `ordre` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lot_type_champs_type` (`type_lot`,`ordre`),
  CONSTRAINT `lot_type_champs_type_chk` CHECK (`type_lot` in ('ACHAT','RECEPTION_MP','PRESSE','FILTRATION','CONDITIONNEMENT','PRODUCTION_RECETTE','INVENTAIRE','AUTRE','REPRISE'))
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lot_type_champs` DISABLE KEYS */;
INSERT INTO `lot_type_champs` VALUES
(1,'ACHAT','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(2,'ACHAT','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(3,'ACHAT','Date','date',1,1,2,'2026-10-11 11:50:04'),
(4,'RECEPTION_MP','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(5,'RECEPTION_MP','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(6,'RECEPTION_MP','Date','date',1,1,2,'2026-10-11 11:50:04'),
(7,'PRESSE','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(8,'PRESSE','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(9,'PRESSE','Date','date',1,1,2,'2026-10-11 11:50:04'),
(10,'FILTRATION','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(11,'FILTRATION','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(12,'FILTRATION','Date','date',1,1,2,'2026-10-11 11:50:04'),
(13,'CONDITIONNEMENT','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(14,'CONDITIONNEMENT','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(15,'CONDITIONNEMENT','Date','date',1,1,2,'2026-10-11 11:50:04'),
(16,'PRODUCTION_RECETTE','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(17,'PRODUCTION_RECETTE','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(18,'PRODUCTION_RECETTE','Date','date',1,1,2,'2026-10-11 11:50:04'),
(19,'INVENTAIRE','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(20,'INVENTAIRE','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(21,'INVENTAIRE','Date','date',1,1,2,'2026-10-11 11:50:04'),
(22,'AUTRE','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(23,'AUTRE','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(24,'AUTRE','Date','date',1,1,2,'2026-10-11 11:50:04'),
(25,'REPRISE','N° de lot','texte',1,1,0,'2026-10-11 11:50:04'),
(26,'REPRISE','Produit','liste',1,1,1,'2026-10-11 11:50:04'),
(27,'REPRISE','Date','date',1,1,2,'2026-10-11 11:50:04');
/*!40000 ALTER TABLE `lot_type_champs` ENABLE KEYS */;
DROP TABLE IF EXISTS `lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lots` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `produit_id` int(11) NOT NULL,
  `numero_lot` varchar(60) NOT NULL,
  `origine` varchar(20) NOT NULL,
  `fournisseur_id` int(11) DEFAULT NULL,
  `lot_fournisseur` varchar(100) DEFAULT NULL,
  `certificat_bio_id` int(11) DEFAULT NULL,
  `bio_status` varchar(15) NOT NULL DEFAULT 'A_VERIFIER' CHECK (`bio_status` in ('NON_BIO','BIO','EN_CONVERSION','A_VERIFIER','BLOQUE')),
  `local_id` int(11) DEFAULT NULL,
  `zone_id` int(11) DEFAULT NULL,
  `date_production` date DEFAULT NULL,
  `date_expiration` date DEFAULT NULL,
  `quantite_initiale` decimal(12,3) NOT NULL DEFAULT 0.000,
  `quantite_actuelle` decimal(12,3) NOT NULL DEFAULT 0.000,
  `statut` varchar(15) NOT NULL DEFAULT 'LIBERE' CHECK (`statut` in ('QUARANTAINE','LIBERE','BLOQUE','REJETE','EXPIRE','EPUISE','CLOTURE')),
  `notes` text DEFAULT NULL,
  `champs_perso` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`champs_perso`)),
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reprise_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_lot` (`numero_lot`),
  KEY `fournisseur_id` (`fournisseur_id`),
  KEY `certificat_bio_id` (`certificat_bio_id`),
  KEY `local_id` (`local_id`),
  KEY `zone_id` (`zone_id`),
  KEY `employe_id` (`employe_id`),
  KEY `idx_lots_produit` (`produit_id`),
  KEY `idx_lots_bio` (`bio_status`),
  KEY `idx_lots_statut` (`statut`),
  KEY `idx_lots_reprise` (`reprise_id`),
  CONSTRAINT `lots_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `lots_ibfk_2` FOREIGN KEY (`fournisseur_id`) REFERENCES `fournisseurs` (`id`),
  CONSTRAINT `lots_ibfk_3` FOREIGN KEY (`certificat_bio_id`) REFERENCES `certificats_bio` (`id`),
  CONSTRAINT `lots_ibfk_4` FOREIGN KEY (`local_id`) REFERENCES `locaux` (`id`),
  CONSTRAINT `lots_ibfk_5` FOREIGN KEY (`zone_id`) REFERENCES `local_zones` (`id`),
  CONSTRAINT `lots_ibfk_6` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lots_origine_chk` CHECK (`origine` in ('ACHAT','RECEPTION_MP','PRESSE','FILTRATION','CONDITIONNEMENT','PRODUCTION_RECETTE','INVENTAIRE','AUTRE','REPRISE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lots` DISABLE KEYS */;
/*!40000 ALTER TABLE `lots` ENABLE KEYS */;
DROP TABLE IF EXISTS `lots_filtration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lots_filtration` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `produit_id` int(11) NOT NULL,
  `lot_id` bigint(20) NOT NULL,
  `filtre_utilise` varchar(100) DEFAULT NULL,
  `quantite_dechet` decimal(10,3) DEFAULT NULL,
  `quantite_produite` decimal(10,3) NOT NULL,
  `rendement_reel` decimal(10,4) DEFAULT NULL,
  `numero_lot` varchar(60) NOT NULL,
  `notes` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_lot` (`numero_lot`),
  KEY `produit_id` (`produit_id`),
  KEY `lot_id` (`lot_id`),
  KEY `idx_lots_filtration_employe` (`employe_id`),
  CONSTRAINT `lots_filtration_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `lots_filtration_ibfk_2` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `lots_filtration_ibfk_3` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lots_filtration` DISABLE KEYS */;
/*!40000 ALTER TABLE `lots_filtration` ENABLE KEYS */;
DROP TABLE IF EXISTS `lots_filtration_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lots_filtration_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_filtration_id` int(11) NOT NULL,
  `lot_presse_id` int(11) NOT NULL,
  `quantite_utilisee` decimal(10,3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `lot_filtration_id` (`lot_filtration_id`),
  KEY `lot_presse_id` (`lot_presse_id`),
  CONSTRAINT `lots_filtration_sources_ibfk_1` FOREIGN KEY (`lot_filtration_id`) REFERENCES `lots_filtration` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lots_filtration_sources_ibfk_2` FOREIGN KEY (`lot_presse_id`) REFERENCES `lots_presse` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lots_filtration_sources` DISABLE KEYS */;
/*!40000 ALTER TABLE `lots_filtration_sources` ENABLE KEYS */;
DROP TABLE IF EXISTS `lots_presse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lots_presse` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `produit_id` int(11) NOT NULL,
  `reception_id` int(11) DEFAULT NULL,
  `lot_id` bigint(20) NOT NULL,
  `quantite_matiere_utilisee` decimal(10,3) DEFAULT NULL,
  `quantite_tourteau` decimal(10,3) DEFAULT NULL,
  `quantite_produite` decimal(10,3) NOT NULL,
  `rendement_reel` decimal(10,4) DEFAULT NULL,
  `numero_lot` varchar(60) NOT NULL,
  `notes` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_lot` (`numero_lot`),
  KEY `produit_id` (`produit_id`),
  KEY `reception_id` (`reception_id`),
  KEY `lot_id` (`lot_id`),
  KEY `idx_lots_presse_employe` (`employe_id`),
  CONSTRAINT `lots_presse_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `lots_presse_ibfk_2` FOREIGN KEY (`reception_id`) REFERENCES `receptions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lots_presse_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `lots_presse_ibfk_4` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `lots_presse` DISABLE KEYS */;
/*!40000 ALTER TABLE `lots_presse` ENABLE KEYS */;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(40) NOT NULL,
  `titre` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `commande_id` int(11) DEFAULT NULL,
  `produit_id` int(11) DEFAULT NULL,
  `statut` varchar(15) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (`statut` in ('EN_ATTENTE','RESOLUE')),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `commande_id` (`commande_id`),
  KEY `produit_id` (`produit_id`),
  KEY `idx_notifications_statut` (`statut`,`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`commande_id`) REFERENCES `commandes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
DROP TABLE IF EXISTS `operations_sync`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `operations_sync` (
  `id` varchar(64) NOT NULL,
  `methode` varchar(10) NOT NULL,
  `chemin` varchar(200) NOT NULL,
  `statut` varchar(10) NOT NULL DEFAULT 'EN_COURS',
  `code_http` int(11) DEFAULT NULL,
  `reponse` mediumtext DEFAULT NULL,
  `cree_le` datetime NOT NULL DEFAULT current_timestamp(),
  `termine_le` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `operations_sync` DISABLE KEYS */;
/*!40000 ALTER TABLE `operations_sync` ENABLE KEYS */;
DROP TABLE IF EXISTS `ordres_production`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ordres_production` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `recette_id` int(11) NOT NULL,
  `lot_id` bigint(20) NOT NULL,
  `date` date NOT NULL,
  `qty_produite` decimal(12,3) NOT NULL,
  `notes` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `recette_id` (`recette_id`),
  KEY `lot_id` (`lot_id`),
  KEY `idx_ordres_production_employe` (`employe_id`),
  CONSTRAINT `ordres_production_ibfk_1` FOREIGN KEY (`recette_id`) REFERENCES `recettes` (`id`),
  CONSTRAINT `ordres_production_ibfk_2` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `ordres_production_ibfk_3` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `ordres_production` DISABLE KEYS */;
/*!40000 ALTER TABLE `ordres_production` ENABLE KEYS */;
DROP TABLE IF EXISTS `paiements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `paiements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facture_id` int(11) NOT NULL,
  `date_paiement` date NOT NULL,
  `montant` decimal(12,3) NOT NULL,
  `mode` varchar(20) NOT NULL DEFAULT 'especes' CHECK (`mode` in ('especes','cheque','virement','carte','autre')),
  `reference` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `annule_le` datetime DEFAULT NULL,
  `annule_motif` varchar(255) DEFAULT NULL,
  `annule_par` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `facture_id` (`facture_id`),
  CONSTRAINT `paiements_ibfk_1` FOREIGN KEY (`facture_id`) REFERENCES `factures` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `paiements` DISABLE KEYS */;
/*!40000 ALTER TABLE `paiements` ENABLE KEYS */;
DROP TABLE IF EXISTS `produits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `produits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `nom` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `categorie_id` int(11) NOT NULL,
  `unite_id` int(11) NOT NULL,
  `format_id` int(11) DEFAULT NULL,
  `type_article` varchar(20) NOT NULL CHECK (`type_article` in ('MATIERE_PREMIERE','INGREDIENT','CONSOMMABLE','EMBALLAGE','PRODUIT_FABRIQUE','PRODUIT_ACHETE','PRODUIT_REVENDE','SOUS_PRODUIT','DECHET')),
  `produit_source_id` int(11) DEFAULT NULL,
  `vendable` tinyint(1) NOT NULL DEFAULT 0,
  `achetable` tinyint(1) NOT NULL DEFAULT 0,
  `fabriquable` tinyint(1) NOT NULL DEFAULT 0,
  `stockable` tinyint(1) NOT NULL DEFAULT 1,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `bio_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `prix_vente` decimal(12,3) DEFAULT NULL,
  `cout_standard` decimal(12,3) DEFAULT NULL,
  `stock_min` decimal(12,3) DEFAULT NULL,
  `tva` decimal(5,2) NOT NULL DEFAULT 19.00,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `barcode` (`barcode`),
  KEY `categorie_id` (`categorie_id`),
  KEY `unite_id` (`unite_id`),
  KEY `format_id` (`format_id`),
  KEY `idx_produits_type` (`type_article`),
  KEY `idx_produits_source` (`produit_source_id`),
  CONSTRAINT `produits_ibfk_1` FOREIGN KEY (`categorie_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `produits_ibfk_2` FOREIGN KEY (`unite_id`) REFERENCES `unites` (`id`),
  CONSTRAINT `produits_ibfk_3` FOREIGN KEY (`format_id`) REFERENCES `formats` (`id`),
  CONSTRAINT `produits_ibfk_4` FOREIGN KEY (`produit_source_id`) REFERENCES `produits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `produits` DISABLE KEYS */;
/*!40000 ALTER TABLE `produits` ENABLE KEYS */;
DROP TABLE IF EXISTS `proforma_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proforma_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proforma_id` int(11) NOT NULL,
  `commande_ligne_id` int(11) DEFAULT NULL,
  `produit_id` int(11) NOT NULL,
  `designation` varchar(200) NOT NULL,
  `qty` decimal(10,2) NOT NULL,
  `unit_price` decimal(10,3) NOT NULL,
  `total` decimal(12,3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `proforma_id` (`proforma_id`),
  KEY `commande_ligne_id` (`commande_ligne_id`),
  KEY `produit_id` (`produit_id`),
  CONSTRAINT `proforma_lignes_ibfk_1` FOREIGN KEY (`proforma_id`) REFERENCES `proformas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `proforma_lignes_ibfk_2` FOREIGN KEY (`commande_ligne_id`) REFERENCES `commande_lignes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `proforma_lignes_ibfk_3` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `proforma_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `proforma_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `proformas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proformas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `commande_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `date_proforma` date NOT NULL,
  `statut` varchar(12) NOT NULL DEFAULT 'en_attente' CHECK (`statut` in ('en_attente','validee','annulee')),
  `tva_rate` decimal(5,2) NOT NULL DEFAULT 19.00,
  `total_ht` decimal(12,3) NOT NULL DEFAULT 0.000,
  `fodec_montant` decimal(12,3) NOT NULL DEFAULT 0.000,
  `montant_tva` decimal(12,3) NOT NULL DEFAULT 0.000,
  `droit_timbre` decimal(6,3) NOT NULL DEFAULT 0.000,
  `total_ttc` decimal(12,3) NOT NULL DEFAULT 0.000,
  `notes` text DEFAULT NULL,
  `facture_id` int(11) DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `client_id` (`client_id`),
  KEY `facture_id` (`facture_id`),
  KEY `employe_id` (`employe_id`),
  KEY `idx_proformas_commande` (`commande_id`),
  CONSTRAINT `proformas_ibfk_1` FOREIGN KEY (`commande_id`) REFERENCES `commandes` (`id`),
  CONSTRAINT `proformas_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `proformas_ibfk_3` FOREIGN KEY (`facture_id`) REFERENCES `factures` (`id`) ON DELETE SET NULL,
  CONSTRAINT `proformas_ibfk_4` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `proformas` DISABLE KEYS */;
/*!40000 ALTER TABLE `proformas` ENABLE KEYS */;
DROP TABLE IF EXISTS `reception_lignes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reception_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reception_id` int(11) NOT NULL,
  `produit_id` int(11) NOT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  `quantite` decimal(12,3) NOT NULL,
  `lot_fournisseur` varchar(100) DEFAULT NULL,
  `date_expiration` date DEFAULT NULL,
  `certificat_bio_id` int(11) DEFAULT NULL,
  `zone_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reception_id` (`reception_id`),
  KEY `produit_id` (`produit_id`),
  KEY `lot_id` (`lot_id`),
  KEY `certificat_bio_id` (`certificat_bio_id`),
  KEY `zone_id` (`zone_id`),
  CONSTRAINT `reception_lignes_ibfk_1` FOREIGN KEY (`reception_id`) REFERENCES `receptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reception_lignes_ibfk_2` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `reception_lignes_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `reception_lignes_ibfk_4` FOREIGN KEY (`certificat_bio_id`) REFERENCES `certificats_bio` (`id`),
  CONSTRAINT `reception_lignes_ibfk_5` FOREIGN KEY (`zone_id`) REFERENCES `local_zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `reception_lignes` DISABLE KEYS */;
/*!40000 ALTER TABLE `reception_lignes` ENABLE KEYS */;
DROP TABLE IF EXISTS `receptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `receptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `fournisseur_id` int(11) NOT NULL,
  `achat_id` int(11) DEFAULT NULL,
  `date_reception` date NOT NULL,
  `local_id` int(11) NOT NULL,
  `statut` varchar(15) NOT NULL DEFAULT 'receptionnee' CHECK (`statut` in ('receptionnee','controle','liberee','partielle','rejetee')),
  `notes` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `fournisseur_id` (`fournisseur_id`),
  KEY `achat_id` (`achat_id`),
  KEY `local_id` (`local_id`),
  KEY `idx_receptions_employe` (`employe_id`),
  CONSTRAINT `receptions_ibfk_1` FOREIGN KEY (`fournisseur_id`) REFERENCES `fournisseurs` (`id`),
  CONSTRAINT `receptions_ibfk_2` FOREIGN KEY (`achat_id`) REFERENCES `achats` (`id`),
  CONSTRAINT `receptions_ibfk_3` FOREIGN KEY (`local_id`) REFERENCES `locaux` (`id`),
  CONSTRAINT `receptions_ibfk_4` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `receptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `receptions` ENABLE KEYS */;
DROP TABLE IF EXISTS `recette_ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `recette_ingredients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `recette_id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `quantite_par_unite` decimal(12,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `recette_id` (`recette_id`),
  KEY `ingredient_id` (`ingredient_id`),
  CONSTRAINT `recette_ingredients_ibfk_1` FOREIGN KEY (`recette_id`) REFERENCES `recettes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `recette_ingredients_ibfk_2` FOREIGN KEY (`ingredient_id`) REFERENCES `produits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `recette_ingredients` DISABLE KEYS */;
/*!40000 ALTER TABLE `recette_ingredients` ENABLE KEYS */;
DROP TABLE IF EXISTS `recettes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `recettes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `produit_id` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `produit_id` (`produit_id`),
  CONSTRAINT `recettes_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `recettes` DISABLE KEYS */;
/*!40000 ALTER TABLE `recettes` ENABLE KEYS */;
DROP TABLE IF EXISTS `remises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `remises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `type` varchar(15) NOT NULL CHECK (`type` in ('pourcentage','lot')),
  `pourcentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `achete` int(11) DEFAULT NULL,
  `gratuit` int(11) DEFAULT NULL,
  `protege` tinyint(1) NOT NULL DEFAULT 0,
  `categorie` varchar(15) NOT NULL DEFAULT 'client' CHECK (`categorie` in ('client','promo','saisonnier','autre')),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `remises` DISABLE KEYS */;
/*!40000 ALTER TABLE `remises` ENABLE KEYS */;
DROP TABLE IF EXISTS `reprises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reprises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `date_reprise` date NOT NULL,
  `fichier` varchar(255) DEFAULT NULL,
  `nb_lots` int(11) NOT NULL DEFAULT 0,
  `employe_id` int(11) DEFAULT NULL,
  `annulee_le` datetime DEFAULT NULL,
  `annule_motif` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `reprises` DISABLE KEYS */;
/*!40000 ALTER TABLE `reprises` ENABLE KEYS */;
DROP TABLE IF EXISTS `sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sequences` (
  `name` varchar(50) NOT NULL,
  `last_value` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `sequences` DISABLE KEYS */;
INSERT INTO `sequences` VALUES
('produit_code_seq',0);
/*!40000 ALTER TABLE `sequences` ENABLE KEYS */;
DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` tinyint(4) NOT NULL DEFAULT 1 CHECK (`id` = 1),
  `salaire` decimal(10,2) NOT NULL DEFAULT 40.00,
  `matiere_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `rend_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `marge` decimal(5,2) NOT NULL DEFAULT 45.00,
  `tva` decimal(5,2) NOT NULL DEFAULT 19.00,
  `ref_source` varchar(10) NOT NULL DEFAULT 'tableau' CHECK (`ref_source` in ('tableau','marche')),
  `prix_remise_id` int(11) DEFAULT NULL,
  `cumuler_lot` tinyint(1) NOT NULL DEFAULT 1,
  `offre_achete` int(11) NOT NULL DEFAULT 9,
  `offre_gratuit` int(11) NOT NULL DEFAULT 1,
  `fodec_rate` decimal(5,2) NOT NULL DEFAULT 1.00,
  `droit_timbre` decimal(6,3) NOT NULL DEFAULT 1.000,
  `timbre_seuil` decimal(10,3) NOT NULL DEFAULT 1000.000,
  `entreprise_nom` varchar(150) DEFAULT NULL,
  `entreprise_adresse` text DEFAULT NULL,
  `entreprise_telephone` varchar(30) DEFAULT NULL,
  `entreprise_email` varchar(150) DEFAULT NULL,
  `entreprise_matricule_fiscal` varchar(30) DEFAULT NULL,
  `entreprise_logo` longtext DEFAULT NULL,
  `facture_couleur` varchar(9) NOT NULL DEFAULT '#17231D',
  `lot_format_style` varchar(20) NOT NULL DEFAULT 'code_origine_seq',
  `lot_seq_par_origine` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `prix_remise_id` (`prix_remise_id`),
  CONSTRAINT `settings_ibfk_1` FOREIGN KEY (`prix_remise_id`) REFERENCES `remises` (`id`),
  CONSTRAINT `settings_lot_format_chk` CHECK (`lot_format_style` in ('code_origine_seq','origine_code_seq','jardins_jerba'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES
(1,40.00,0.00,0.00,45.00,19.00,'tableau',NULL,1,9,1,1.00,1.000,1000.000,NULL,NULL,NULL,NULL,NULL,NULL,'#17231D','jardins_jerba',0);
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
DROP TABLE IF EXISTS `stock_mouvements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_mouvements` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `numero` varchar(40) NOT NULL,
  `date_mouvement` datetime NOT NULL DEFAULT current_timestamp(),
  `type_mouvement` varchar(20) NOT NULL,
  `sens` varchar(10) NOT NULL CHECK (`sens` in ('ENTREE','SORTIE','NEUTRE')),
  `produit_id` int(11) NOT NULL,
  `lot_id` bigint(20) DEFAULT NULL,
  `local_id` int(11) DEFAULT NULL,
  `zone_id` int(11) DEFAULT NULL,
  `zone_source_id` int(11) DEFAULT NULL,
  `zone_destination_id` int(11) DEFAULT NULL,
  `quantite` decimal(12,3) NOT NULL,
  `source_type` varchar(50) DEFAULT NULL,
  `source_id` bigint(20) DEFAULT NULL,
  `group_id` char(36) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`),
  KEY `zone_id` (`zone_id`),
  KEY `zone_source_id` (`zone_source_id`),
  KEY `zone_destination_id` (`zone_destination_id`),
  KEY `employe_id` (`employe_id`),
  KEY `idx_mouvements_produit_date` (`produit_id`,`date_mouvement`),
  KEY `idx_mouvements_lot_date` (`lot_id`,`date_mouvement`),
  KEY `idx_mouvements_local_date` (`local_id`,`date_mouvement`),
  KEY `idx_mouvements_source` (`source_type`,`source_id`),
  CONSTRAINT `stock_mouvements_ibfk_1` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`),
  CONSTRAINT `stock_mouvements_ibfk_2` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`),
  CONSTRAINT `stock_mouvements_ibfk_3` FOREIGN KEY (`local_id`) REFERENCES `locaux` (`id`),
  CONSTRAINT `stock_mouvements_ibfk_4` FOREIGN KEY (`zone_id`) REFERENCES `local_zones` (`id`),
  CONSTRAINT `stock_mouvements_ibfk_5` FOREIGN KEY (`zone_source_id`) REFERENCES `local_zones` (`id`),
  CONSTRAINT `stock_mouvements_ibfk_6` FOREIGN KEY (`zone_destination_id`) REFERENCES `local_zones` (`id`),
  CONSTRAINT `stock_mouvements_ibfk_7` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_mouvements_type_chk` CHECK (`type_mouvement` in ('ACHAT','RECEPTION','VENTE','PRODUCTION','CONDITIONNEMENT','CONSOMMATION','TRANSFERT','AJUSTEMENT','INVENTAIRE','RETOUR_CLIENT','RETOUR_FOURNISSEUR','PERTE','CASSE','DESTRUCTION','AUTRE','REPRISE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `stock_mouvements` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_mouvements` ENABLE KEYS */;
DROP TABLE IF EXISTS `unites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `unites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `nom` varchar(50) NOT NULL,
  `symbole` varchar(10) DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `unites` DISABLE KEYS */;
INSERT INTO `unites` VALUES
(1,'litre','Litre','L',1),
(2,'ml','Millilitre','ml',1),
(3,'kg','Kilogramme','kg',1),
(4,'g','Gramme','g',1),
(5,'unite','Unité','u',1);
/*!40000 ALTER TABLE `unites` ENABLE KEYS */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `employe_id` int(11) DEFAULT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'vendeur' CHECK (`role` in ('gerant','vendeur')),
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `employe_id` (`employe_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`employe_id`) REFERENCES `employes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'admin','$2b$10$VRaxeTLuI6Hrgd/ro8hgq.exVY1n8HKUgdTMpvGgw9pNnpB/iq3U6',1,'gerant',1,'2026-10-11 11:50:04');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

