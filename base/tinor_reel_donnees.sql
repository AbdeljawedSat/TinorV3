-- ============================================================================
-- TinOR V3.3 — REMPLISSAGE de la base RÉELLE « tinor_reel » avec l'historique des
-- registres papier (classeur BD_tinorexel.xlsx) :
--   pépins → presse → filtration → mélange / flaconnage → sorties (ventes).
-- À exécuter UNE SEULE FOIS, sur la base créée par base/tinor_reel_creation.sql
-- (HeidiSQL : Fichier › Exécuter un fichier SQL ; ou mysql -u root -p < base\tinor_reel_donnees.sql).
-- Contrôle d'évaluation et corrections de saisie : base/RAPPORT_IMPORT_REGISTRES.md
-- Régénérable : node scripts/importer-registres.js (sur une base neuve) puis export.
-- ============================================================================
USE tinor_reel;

-- Garde : s'arrête (erreur « Duplicate entry ») si la base contient déjà des produits ou des lots.
CREATE TEMPORARY TABLE _garde_import (x INT PRIMARY KEY);
INSERT INTO _garde_import VALUES (1);
INSERT INTO _garde_import SELECT 1 WHERE (SELECT COUNT(*) FROM produits) + (SELECT COUNT(*) FROM lots) > 0;

/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
START TRANSACTION;
/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `categories` (`id`, `code`, `nom`, `type_category`, `actif`) VALUES (6,'MP','Matières premières','MATIERE',1);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `remises` (`id`, `nom`, `type`, `pourcentage`, `achete`, `gratuit`, `protege`, `categorie`) VALUES (1,'Remise 19 %','pourcentage',19.00,NULL,NULL,0,'client');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `produits` (`id`, `code`, `barcode`, `nom`, `description`, `categorie_id`, `unite_id`, `format_id`, `type_article`, `produit_source_id`, `vendable`, `achetable`, `fabriquable`, `stockable`, `actif`, `bio_eligible`, `prix_vente`, `cout_standard`, `stock_min`, `tva`, `notes`, `created_at`) VALUES (1,'01',NULL,'Pépins de figue de barbarie',NULL,6,3,NULL,'MATIERE_PREMIERE',NULL,0,1,0,1,1,1,NULL,NULL,NULL,19.00,NULL,'2026-10-11 20:26:54'),
(2,'02',NULL,'Huile de pépins de figue de barbarie — Vrac',NULL,1,1,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,1,NULL,NULL,NULL,19.00,NULL,'2026-10-11 20:26:54'),
(3,'03',NULL,'Huile de pépins de figue de barbarie — Filtrée',NULL,1,1,NULL,'PRODUIT_FABRIQUE',2,0,0,1,1,1,1,NULL,NULL,NULL,19.00,NULL,'2026-10-11 20:26:54'),
(4,'04',NULL,'Huile de pépins de figue de barbarie — Flacon 10ml',NULL,1,5,1,'PRODUIT_FABRIQUE',2,1,0,1,1,1,1,24.700,NULL,NULL,19.00,NULL,'2026-10-11 20:26:54'),
(5,'05',NULL,'Huile de pépins de figue de barbarie — Flacon 30ml',NULL,1,5,2,'PRODUIT_FABRIQUE',2,1,0,1,1,1,1,76.500,NULL,NULL,19.00,NULL,'2026-10-11 20:26:54');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `clients` (`id`, `nom`, `tel`, `ville`, `matricule_fiscal`, `type`, `remise_id`, `notes`, `created_at`) VALUES (1,'Gisel',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(2,'Client particulier',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(3,'Berntrard',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(4,'louccy',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(5,'Gosef',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(6,'client Passage',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(7,'ben abdesslem',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(8,'artisanet',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(9,'omran khaled',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(10,'Relax and spay',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(11,'biojerba',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(12,'client',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(13,'bernard',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(14,'client passaget',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(15,'passaget claude',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:26:54'),
(16,'Client à identifier',NULL,'Djerba',NULL,'particulier',NULL,'Sortie du 04/05/2025 sans client au registre : à rattacher au bon client','2026-10-11 20:26:54');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `lots` (`id`, `produit_id`, `numero_lot`, `origine`, `fournisseur_id`, `lot_fournisseur`, `certificat_bio_id`, `bio_status`, `local_id`, `zone_id`, `date_production`, `date_expiration`, `quantite_initiale`, `quantite_actuelle`, `statut`, `notes`, `champs_perso`, `employe_id`, `created_at`, `reprise_id`) VALUES (1,1,'2314','RECEPTION_MP',NULL,'2314',NULL,'A_VERIFIER',1,NULL,NULL,NULL,50.000,0.000,'EPUISE','Quantité reçue non renseignée dans les registres : égale au total pressé (à corriger par un inventaire)','{\"etape_reprise\":\"MP\"}',NULL,'2023-12-17 00:00:00',NULL),
(2,2,'01-2314-20231217H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-17',NULL,1.000,0.100,'LIBERE','Registre de presse n° 1 · outil n° 15','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-17 00:00:00',NULL),
(3,3,'01-2314-20231217','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-17',NULL,0.760,0.000,'EPUISE','N° saisi dans le registre : 01-2312-20231217','{\"etape_reprise\":\"FILTRATION\"}',NULL,'2023-12-17 00:00:00',NULL),
(4,1,'GJ01/2023','RECEPTION_MP',NULL,'GJ01/2023',NULL,'A_VERIFIER',1,NULL,NULL,NULL,398.800,0.000,'EPUISE','Quantité reçue non renseignée dans les registres : égale au total pressé (à corriger par un inventaire)','{\"etape_reprise\":\"MP\"}',NULL,'2023-12-18 00:00:00',NULL),
(5,2,'02-2314-20231218H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-18',NULL,0.600,0.000,'EPUISE','Registre de presse n° 2 · outil n° 15','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-18 00:00:00',NULL),
(6,2,'03-GJ01/2023-20231218H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-18',NULL,0.400,0.000,'EPUISE','Registre de presse n° 3 · outil n° 15','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-18 00:00:00',NULL),
(7,2,'04-GJ01/2023-20231219H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-19',NULL,1.000,0.000,'EPUISE','Registre de presse n° 4 · outil n° 15','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-19 00:00:00',NULL),
(8,2,'05-GJ01/2023-20231224H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-24',NULL,1.000,0.000,'EPUISE','Registre de presse n° 5 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-24 00:00:00',NULL),
(9,3,'05-GJ01/2023-20231224','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-24',NULL,0.890,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2023-12-24 00:00:00',NULL),
(10,2,'06-GJ01/2023-20231225H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-25',NULL,0.750,0.000,'EPUISE','Registre de presse n° 6 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-25 00:00:00',NULL),
(11,2,'07-GJ01/2023-20231226H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2023-12-26',NULL,1.000,1.000,'LIBERE','Registre de presse n° 7 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2023-12-26 00:00:00',NULL),
(12,1,'2313','RECEPTION_MP',NULL,'2313',NULL,'A_VERIFIER',1,NULL,NULL,NULL,150.000,0.000,'EPUISE','Quantité reçue non renseignée dans les registres : égale au total pressé (à corriger par un inventaire)','{\"etape_reprise\":\"MP\"}',NULL,'2024-02-10 00:00:00',NULL),
(13,2,'08-2313-20240210H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-02-10',NULL,0.720,0.000,'EPUISE','Registre de presse n° 9 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-02-10 00:00:00',NULL),
(14,2,'08-GJ01/2023-20240210H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-02-10',NULL,0.290,0.069,'LIBERE','Registre de presse n° 8 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-02-10 00:00:00',NULL),
(15,2,'09-2313-20240211H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-02-11',NULL,1.090,0.000,'EPUISE','Registre de presse n° 10 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-02-11 00:00:00',NULL),
(16,2,'10-2313-20240217H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-02-17',NULL,1.090,0.000,'EPUISE','Registre de presse n° 11 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-02-17 00:00:00',NULL),
(17,2,'11-2313-20240318H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-18',NULL,1.000,0.000,'EPUISE','Registre de presse n° 12 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-18 00:00:00',NULL),
(18,2,'12-2313-20240319H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-19',NULL,1.000,1.000,'LIBERE','Registre de presse n° 13 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-19 00:00:00',NULL),
(19,2,'13-2313-20240320H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-20',NULL,0.300,0.300,'LIBERE','Registre de presse n° 14 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-20 00:00:00',NULL),
(20,2,'14-GJ01/2023-20240320H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-20',NULL,0.700,0.700,'LIBERE','Registre de presse n° 15 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-20 00:00:00',NULL),
(21,2,'15-GJ01/2023-20240321H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-21',NULL,1.000,0.000,'EPUISE','Registre de presse n° 16 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-21 00:00:00',NULL),
(22,3,'15-GJ01/2023-20240321','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-21',NULL,0.830,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-03-21 00:00:00',NULL),
(23,2,'16-GJ01/2023-20240323H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-23',NULL,1.000,1.000,'LIBERE','Registre de presse n° 17 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-23 00:00:00',NULL),
(24,2,'17-GJ01/2023-20240324H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-24',NULL,1.000,1.000,'LIBERE','Registre de presse n° 18 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-24 00:00:00',NULL),
(25,2,'18-GJ01/2023-20240325H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-25',NULL,1.000,0.000,'EPUISE','Registre de presse n° 19 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-25 00:00:00',NULL),
(26,3,'18-GJ01/2023-20240325','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-25',NULL,0.900,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-03-25 00:00:00',NULL),
(27,2,'19-GJ01/2023-20240326H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-26',NULL,1.000,0.000,'EPUISE','Registre de presse n° 20 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-26 00:00:00',NULL),
(28,2,'20-GJ01/2023-20240327H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-27',NULL,1.080,0.000,'EPUISE','Registre de presse n° 21 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-27 00:00:00',NULL),
(29,2,'21-GJ01/2023-20240328H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-28',NULL,1.040,1.040,'LIBERE','Registre de presse n° 22 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-28 00:00:00',NULL),
(30,2,'22-GJ01/2023-20240329H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-29',NULL,0.800,0.800,'LIBERE','Registre de presse n° 23 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-29 00:00:00',NULL),
(31,1,'2312','RECEPTION_MP',NULL,'2312',NULL,'A_VERIFIER',1,NULL,NULL,NULL,200.000,0.000,'EPUISE','Quantité reçue non renseignée dans les registres : égale au total pressé (à corriger par un inventaire)','{\"etape_reprise\":\"MP\"}',NULL,'2024-03-31 00:00:00',NULL),
(32,2,'23-2312-20240331H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-31',NULL,1.100,0.000,'EPUISE','Registre de presse n° 24 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-03-31 00:00:00',NULL),
(33,3,'23-2312-20240331','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-03-31',NULL,0.960,0.560,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-03-31 00:00:00',NULL),
(34,2,'24-2312-20240407H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-04-07',NULL,1.200,0.000,'EPUISE','Registre de presse n° 25 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-04-07 00:00:00',NULL),
(35,3,'24-2312-20240407','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-04-07',NULL,1.020,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-04-07 00:00:00',NULL),
(36,2,'25-2312-20240427H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-04-27',NULL,1.000,0.000,'EPUISE','Registre de presse n° 26 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-04-27 00:00:00',NULL),
(37,3,'25-2312-20240427','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-04-27',NULL,0.820,0.000,'EPUISE','N° saisi dans le registre : 25-2312-20242704','{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-04-27 00:00:00',NULL),
(38,2,'26-2312-20240428H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-04-28',NULL,0.900,0.900,'LIBERE','Registre de presse n° 27 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-04-28 00:00:00',NULL),
(39,2,'27-2312-20240505H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-05-05',NULL,0.950,0.000,'EPUISE','Registre de presse n° 28 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-05-05 00:00:00',NULL),
(40,3,'27-2312-20240505','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-05-05',NULL,0.710,0.710,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-05-05 00:00:00',NULL),
(41,2,'28-2312-20240506H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-05-06',NULL,0.730,0.000,'EPUISE','Registre de presse n° 29 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-05-06 00:00:00',NULL),
(42,3,'28-2312-20240506','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-05-06',NULL,0.595,0.595,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-05-06 00:00:00',NULL),
(43,2,'29-2312-20240702H','PRESSE',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-07-02',NULL,0.900,0.000,'EPUISE','Registre de presse n° 30 · outil n° 12','{\"etape_reprise\":\"PRESSE\"}',NULL,'2024-07-02 00:00:00',NULL),
(44,3,'29-2312-20240711','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-07-11',NULL,0.800,0.800,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-07-11 00:00:00',NULL),
(45,4,'011823','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2024-09-22','2027-09-22',80.000,0.000,'EPUISE','Lot fini 011823 (mélange du 2024-09-22, 800 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"011823\"}',NULL,'2024-09-22 00:00:00',NULL),
(46,4,'021825','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2024-09-23','2027-09-23',23.000,0.000,'EPUISE','Lot fini 021825 (mélange du 2024-09-23, 800 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"021825\"}',NULL,'2024-09-23 00:00:00',NULL),
(47,5,'021825-2','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2024-09-23','2027-09-23',19.000,0.000,'EPUISE','Lot fini 021825 (mélange du 2024-09-23, 800 ml) — flacons de 30 ml. Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"021825\"}',NULL,'2024-09-23 00:00:00',NULL),
(48,3,'02-2314-20241009','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-10-09',NULL,0.490,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-10-09 00:00:00',NULL),
(49,3,'08-2313-20241105','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-11-05',NULL,0.028,0.000,'EPUISE','N° saisi dans le registre : 08-2312-20241105','{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-11-05 00:00:00',NULL),
(50,3,'08-GJ01/2023-20241105','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2024-11-05',NULL,0.027,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2024-11-05 00:00:00',NULL),
(51,3,'03-GJ01/2023-20250115','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-01-15',NULL,0.340,0.000,'EPUISE','N° saisi dans le registre : 03-JG01/2023-20251105','{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-01-15 00:00:00',NULL),
(52,5,'042505','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2025-01-15','2028-01-15',28.000,0.000,'EPUISE','Lot fini 042505 (mélange du 2025-01-15, 840 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"042505\"}',NULL,'2025-01-15 00:00:00',NULL),
(53,3,'08-GJ01/2023-20250122','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-01-22',NULL,0.171,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-01-22 00:00:00',NULL),
(54,3,'08-2313-20250123','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-01-23',NULL,0.581,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-01-23 00:00:00',NULL),
(55,5,'061803','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2025-04-03','2028-04-03',7.000,0.000,'EPUISE','Lot fini 061803 (mélange du 2025-04-03, 210 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"061803\"}',NULL,'2025-04-03 00:00:00',NULL),
(56,5,'050502','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2025-04-10','2028-04-10',32.000,0.000,'EPUISE','Lot fini 050502 (mélange du 2025-03-10, 960 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"050502\"}',NULL,'2025-04-10 00:00:00',NULL),
(57,5,'070324','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2025-04-15','2028-04-15',14.000,0.000,'EPUISE','Lot fini 070324 (mélange du 2025-04-15, 420 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"070324\"}',NULL,'2025-04-15 00:00:00',NULL),
(58,5,'082415','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2025-05-04','2028-05-04',4.000,0.000,'EPUISE','Lot fini 082415 (mélange du 2025-04-27, 1660 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"082415\"}',NULL,'2025-05-04 00:00:00',NULL),
(59,4,'082415-2','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2025-08-05','2028-08-05',154.000,0.000,'EPUISE','Lot fini 082415 (mélange du 2025-04-27, 1660 ml) — flacons de 10 ml. Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"082415\"}',NULL,'2025-08-05 00:00:00',NULL),
(60,3,'04-GJ01/2023-20251020','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-10-20',NULL,0.907,0.907,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-10-20 00:00:00',NULL),
(61,3,'09-2313-20251021','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-10-21',NULL,0.977,0.977,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-10-21 00:00:00',NULL),
(62,3,'11-2313-20251023','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-10-23',NULL,0.879,0.879,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-10-23 00:00:00',NULL),
(63,3,'19-GJ01/2023-20251026','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-10-26',NULL,0.911,0.911,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-10-26 00:00:00',NULL),
(64,3,'20-GJ01/2023-20251028','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-10-28',NULL,0.988,0.988,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-10-28 00:00:00',NULL),
(65,3,'10-2313-20251103','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-11-03',NULL,0.872,0.872,'LIBERE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-11-03 00:00:00',NULL),
(66,3,'06-GJ01/2023-20251105','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',1,NULL,'2025-11-05',NULL,0.610,0.000,'EPUISE',NULL,'{\"etape_reprise\":\"FILTRATION\"}',NULL,'2025-11-05 00:00:00',NULL),
(67,5,'090808','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2026-02-01','2029-02-01',16.000,0.000,'EPUISE','Lot fini 090808 (mélange du 2025-05-01, 752 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"090808\"}',NULL,'2026-02-01 00:00:00',NULL),
(68,4,'090808-2','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2026-02-01','2029-02-01',27.000,0.000,'EPUISE','Lot fini 090808 (mélange du 2025-05-01, 752 ml) — flacons de 10 ml. Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"090808\"}',NULL,'2026-02-01 00:00:00',NULL),
(69,5,'030808','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2026-05-09','2029-05-09',1.000,0.000,'EPUISE','Lot fini 030808 (mélange du 2024-09-24, 55 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"030808\"}',NULL,'2026-05-09 00:00:00',NULL),
(70,4,'030808-2','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2026-05-09','2029-05-09',2.000,0.000,'EPUISE','Lot fini 030808 (mélange du 2024-09-24, 55 ml) — flacons de 10 ml. Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"030808\"}',NULL,'2026-05-09 00:00:00',NULL),
(71,5,'100106','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2026-05-10','2029-05-10',26.000,0.000,'EPUISE','Lot fini 100106 (mélange du 2026-05-20, 1370 ml). Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"100106\"}',NULL,'2026-05-10 00:00:00',NULL),
(72,4,'100106-2','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',2,NULL,'2026-05-11','2029-05-11',59.000,0.000,'EPUISE','Lot fini 100106 (mélange du 2026-05-20, 1370 ml) — flacons de 10 ml. Péremption = production + 3 ans (colonne « Date d\'expiration » = 3 du registre)','{\"etape_reprise\":\"CONDITIONNEMENT\",\"lot_fini_registre\":\"100106\"}',NULL,'2026-05-11 00:00:00',NULL);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `lots_presse` (`id`, `date`, `produit_id`, `reception_id`, `lot_id`, `quantite_matiere_utilisee`, `quantite_tourteau`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2023-12-17',2,NULL,2,32.000,NULL,1.000,0.0313,'01-2314-20231217H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(2,'2023-12-18',2,NULL,5,18.000,NULL,0.600,0.0333,'02-2314-20231218H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(3,'2023-12-18',2,NULL,6,12.000,NULL,0.400,0.0333,'03-GJ01/2023-20231218H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(4,'2023-12-19',2,NULL,7,32.000,NULL,1.000,0.0313,'04-GJ01/2023-20231219H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(5,'2023-12-24',2,NULL,8,31.000,NULL,1.000,0.0323,'05-GJ01/2023-20231224H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(6,'2023-12-25',2,NULL,10,25.000,NULL,0.750,0.0300,'06-GJ01/2023-20231225H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(7,'2023-12-26',2,NULL,11,30.000,NULL,1.000,0.0333,'07-GJ01/2023-20231226H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(8,'2024-02-10',2,NULL,13,22.200,NULL,0.720,0.0324,'08-2313-20240210H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(9,'2024-02-10',2,NULL,14,7.800,NULL,0.290,0.0372,'08-GJ01/2023-20240210H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(10,'2024-02-11',2,NULL,15,30.000,NULL,1.090,0.0363,'09-2313-20240211H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(11,'2024-02-17',2,NULL,16,30.000,NULL,1.090,0.0363,'10-2313-20240217H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(12,'2024-03-18',2,NULL,17,30.000,NULL,1.000,0.0333,'11-2313-20240318H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(13,'2024-03-19',2,NULL,18,30.000,NULL,1.000,0.0333,'12-2313-20240319H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(14,'2024-03-20',2,NULL,19,7.800,NULL,0.300,0.0385,'13-2313-20240320H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(15,'2024-03-20',2,NULL,20,21.000,NULL,0.700,0.0333,'14-GJ01/2023-20240320H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(16,'2024-03-21',2,NULL,21,30.000,NULL,1.000,0.0333,'15-GJ01/2023-20240321H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(17,'2024-03-23',2,NULL,23,30.000,NULL,1.000,0.0333,'16-GJ01/2023-20240323H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(18,'2024-03-24',2,NULL,24,30.000,NULL,1.000,0.0333,'17-GJ01/2023-20240324H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(19,'2024-03-25',2,NULL,25,30.000,NULL,1.000,0.0333,'18-GJ01/2023-20240325H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(20,'2024-03-26',2,NULL,27,30.000,NULL,1.000,0.0333,'19-GJ01/2023-20240326H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(21,'2024-03-27',2,NULL,28,30.000,NULL,1.080,0.0360,'20-GJ01/2023-20240327H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(22,'2024-03-28',2,NULL,29,30.000,NULL,1.040,0.0347,'21-GJ01/2023-20240328H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(23,'2024-03-29',2,NULL,30,30.000,NULL,0.800,0.0267,'22-GJ01/2023-20240329H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(24,'2024-03-31',2,NULL,32,30.000,NULL,1.100,0.0367,'23-2312-20240331H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(25,'2024-04-07',2,NULL,34,30.000,NULL,1.200,0.0400,'24-2312-20240407H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(26,'2024-04-27',2,NULL,36,30.000,NULL,1.000,0.0333,'25-2312-20240427H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(27,'2024-04-28',2,NULL,38,30.000,NULL,0.900,0.0300,'26-2312-20240428H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(28,'2024-05-05',2,NULL,39,30.000,NULL,0.950,0.0317,'27-2312-20240505H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(29,'2024-05-06',2,NULL,41,20.000,NULL,0.730,0.0365,'28-2312-20240506H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54'),
(30,'2024-07-02',2,NULL,43,30.000,NULL,0.900,0.0300,'29-2312-20240702H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:26:54');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `lots_filtration` (`id`, `date`, `produit_id`, `lot_id`, `filtre_utilise`, `quantite_dechet`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2023-12-17',3,3,'ST60',0.140,0.760,0.8444,'01-2314-20231217','N° d\'ordre du registre de filtration : 1',NULL,'2026-10-11 20:26:54'),
(2,'2023-12-24',3,9,'ST60',0.110,0.890,0.8900,'05-GJ01/2023-20231224','N° d\'ordre du registre de filtration : 11',NULL,'2026-10-11 20:26:54'),
(3,'2024-03-21',3,22,'ST60',0.170,0.830,0.8300,'15-GJ01/2023-20240321','N° d\'ordre du registre de filtration : 3',NULL,'2026-10-11 20:26:54'),
(4,'2024-03-25',3,26,'ST60',0.100,0.900,0.9000,'18-GJ01/2023-20240325','N° d\'ordre du registre de filtration : 4',NULL,'2026-10-11 20:26:54'),
(5,'2024-03-31',3,33,'ST60',0.140,0.960,0.8727,'23-2312-20240331','N° d\'ordre du registre de filtration : 5',NULL,'2026-10-11 20:26:54'),
(6,'2024-04-07',3,35,'ST60',0.180,1.020,0.8500,'24-2312-20240407','N° d\'ordre du registre de filtration : 6',NULL,'2026-10-11 20:26:54'),
(7,'2024-04-27',3,37,'ST60',0.180,0.820,0.8200,'25-2312-20240427','N° d\'ordre du registre de filtration : 7',NULL,'2026-10-11 20:26:54'),
(8,'2024-05-05',3,40,'ST60',0.240,0.710,0.7474,'27-2312-20240505','N° d\'ordre du registre de filtration : 8',NULL,'2026-10-11 20:26:54'),
(9,'2024-05-06',3,42,'watman4',0.135,0.595,0.8151,'28-2312-20240506','N° d\'ordre du registre de filtration : 10',NULL,'2026-10-11 20:26:54'),
(10,'2024-07-11',3,44,'watman4',0.100,0.800,0.8889,'29-2312-20240711','N° d\'ordre du registre de filtration : 9',NULL,'2026-10-11 20:26:54'),
(11,'2024-10-09',3,48,'watman4',0.110,0.490,0.8167,'02-2314-20241009','N° d\'ordre du registre de filtration : 2',NULL,'2026-10-11 20:26:54'),
(12,'2024-11-05',3,49,'watman4',0.002,0.028,0.9333,'08-2313-20241105','N° d\'ordre du registre de filtration : 13',NULL,'2026-10-11 20:26:54'),
(13,'2024-11-05',3,50,'watman4',0.003,0.027,0.9000,'08-GJ01/2023-20241105','N° d\'ordre du registre de filtration : 12',NULL,'2026-10-11 20:26:54'),
(14,'2025-01-15',3,51,'watman4',0.060,0.340,0.8500,'03-GJ01/2023-20250115','N° d\'ordre du registre de filtration : 14',NULL,'2026-10-11 20:26:54'),
(15,'2025-01-22',3,53,'watman4',0.020,0.171,0.8953,'08-GJ01/2023-20250122','N° d\'ordre du registre de filtration : 15',NULL,'2026-10-11 20:26:54'),
(16,'2025-01-23',3,54,'watman4',0.109,0.581,0.8420,'08-2313-20250123','N° d\'ordre du registre de filtration : 16',NULL,'2026-10-11 20:26:54'),
(17,'2025-10-20',3,60,'watman4',0.093,0.907,0.9070,'04-GJ01/2023-20251020','N° d\'ordre du registre de filtration : 17',NULL,'2026-10-11 20:26:54'),
(18,'2025-10-21',3,61,'watman4',0.113,0.977,0.8963,'09-2313-20251021','N° d\'ordre du registre de filtration : 18',NULL,'2026-10-11 20:26:54'),
(19,'2025-10-23',3,62,'watman4',0.121,0.879,0.8790,'11-2313-20251023','N° d\'ordre du registre de filtration : 19',NULL,'2026-10-11 20:26:54'),
(20,'2025-10-26',3,63,'watman4',0.089,0.911,0.9110,'19-GJ01/2023-20251026','N° d\'ordre du registre de filtration : 20',NULL,'2026-10-11 20:26:54'),
(21,'2025-10-28',3,64,'watman4',0.092,0.988,0.9148,'20-GJ01/2023-20251028','N° d\'ordre du registre de filtration : 21',NULL,'2026-10-11 20:26:54'),
(22,'2025-11-03',3,65,'watman4',0.218,0.872,0.8000,'10-2313-20251103','N° d\'ordre du registre de filtration : 22',NULL,'2026-10-11 20:26:54'),
(23,'2025-11-05',3,66,'watman4',0.140,0.610,0.8133,'06-GJ01/2023-20251105','N° d\'ordre du registre de filtration : 23',NULL,'2026-10-11 20:26:54');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `lots_filtration_sources` (`id`, `lot_filtration_id`, `lot_presse_id`, `quantite_utilisee`) VALUES (1,1,1,0.900),
(2,2,5,1.000),
(3,3,16,1.000),
(4,4,19,1.000),
(5,5,24,1.100),
(6,6,25,1.200),
(7,7,26,1.000),
(8,8,28,0.950),
(9,9,29,0.730),
(10,10,30,0.900),
(11,11,2,0.600),
(12,12,8,0.030),
(13,13,9,0.030),
(14,14,3,0.400),
(15,15,9,0.191),
(16,16,8,0.690),
(17,17,4,1.000),
(18,18,10,1.090),
(19,19,12,1.000),
(20,20,20,1.000),
(21,21,21,1.080),
(22,22,11,1.090),
(23,23,6,0.750);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `lot_origines` (`id`, `lot_fils_id`, `lot_source_id`, `quantite_utilisee`) VALUES (1,2,1,32.000),
(2,3,2,0.900),
(3,5,1,18.000),
(4,6,4,12.000),
(5,7,4,32.000),
(6,8,4,31.000),
(7,9,8,1.000),
(8,10,4,25.000),
(9,11,4,30.000),
(10,13,12,22.200),
(11,14,4,7.800),
(12,15,12,30.000),
(13,16,12,30.000),
(14,17,12,30.000),
(15,18,12,30.000),
(16,19,12,7.800),
(17,20,4,21.000),
(18,21,4,30.000),
(19,22,21,1.000),
(20,23,4,30.000),
(21,24,4,30.000),
(22,25,4,30.000),
(23,26,25,1.000),
(24,27,4,30.000),
(25,28,4,30.000),
(26,29,4,30.000),
(27,30,4,30.000),
(28,32,31,30.000),
(29,33,32,1.100),
(30,34,31,30.000),
(31,35,34,1.200),
(32,36,31,30.000),
(33,37,36,1.000),
(34,38,31,30.000),
(35,39,31,30.000),
(36,40,39,0.950),
(37,41,31,20.000),
(38,42,41,0.730),
(39,43,31,30.000),
(40,44,43,0.900),
(41,45,33,0.400),
(42,45,26,0.400),
(43,46,37,0.105),
(44,46,26,0.105),
(45,47,37,0.285),
(46,47,26,0.285),
(47,46,37,0.010),
(48,46,26,0.010),
(49,48,5,0.600),
(50,49,13,0.030),
(51,50,14,0.030),
(52,51,6,0.400),
(53,52,37,0.420),
(54,52,9,0.420),
(55,53,14,0.191),
(56,54,13,0.690),
(57,55,26,0.100),
(58,55,51,0.110),
(59,56,9,0.470),
(60,56,48,0.490),
(61,57,51,0.230),
(62,57,35,0.190),
(63,58,35,0.060),
(64,58,22,0.060),
(65,59,35,0.100),
(66,59,22,0.100),
(67,60,7,1.000),
(68,61,15,1.090),
(69,62,17,1.000),
(70,63,27,1.000),
(71,64,28,1.080),
(72,65,16,1.090),
(73,66,10,0.750),
(74,59,35,0.670),
(75,59,22,0.670),
(76,67,53,0.068),
(77,67,54,0.232),
(78,68,53,0.018),
(79,68,54,0.062),
(80,67,53,0.041),
(81,67,54,0.139),
(82,68,53,0.044),
(83,68,54,0.148),
(84,69,50,0.015),
(85,69,49,0.015),
(86,70,50,0.012),
(87,70,49,0.013),
(88,71,3,0.433),
(89,71,66,0.347),
(90,72,3,0.327),
(91,72,66,0.263);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `lot_statuts_historique` (`id`, `lot_id`, `statut`, `motif`, `employe_id`, `date_debut`) VALUES (1,1,'LIBERE','Reprise des registres papier',NULL,'2023-12-17 00:00:00'),
(2,2,'LIBERE','Reprise des registres papier',NULL,'2023-12-17 00:00:00'),
(3,3,'LIBERE','Reprise des registres papier',NULL,'2023-12-17 00:00:00'),
(4,4,'LIBERE','Reprise des registres papier',NULL,'2023-12-17 00:00:00'),
(5,5,'LIBERE','Reprise des registres papier',NULL,'2023-12-18 00:00:00'),
(6,1,'EPUISE','Stock épuisé après consommation en production',NULL,'2023-12-18 00:00:00'),
(7,6,'LIBERE','Reprise des registres papier',NULL,'2023-12-18 00:00:00'),
(8,7,'LIBERE','Reprise des registres papier',NULL,'2023-12-19 00:00:00'),
(9,8,'LIBERE','Reprise des registres papier',NULL,'2023-12-24 00:00:00'),
(10,9,'LIBERE','Reprise des registres papier',NULL,'2023-12-24 00:00:00'),
(11,8,'EPUISE','Stock épuisé après consommation en production',NULL,'2023-12-24 00:00:00'),
(12,10,'LIBERE','Reprise des registres papier',NULL,'2023-12-25 00:00:00'),
(13,11,'LIBERE','Reprise des registres papier',NULL,'2023-12-26 00:00:00'),
(14,12,'LIBERE','Reprise des registres papier',NULL,'2023-12-17 00:00:00'),
(15,13,'LIBERE','Reprise des registres papier',NULL,'2024-02-10 00:00:00'),
(16,14,'LIBERE','Reprise des registres papier',NULL,'2024-02-10 00:00:00'),
(17,15,'LIBERE','Reprise des registres papier',NULL,'2024-02-11 00:00:00'),
(18,16,'LIBERE','Reprise des registres papier',NULL,'2024-02-17 00:00:00'),
(19,17,'LIBERE','Reprise des registres papier',NULL,'2024-03-18 00:00:00'),
(20,18,'LIBERE','Reprise des registres papier',NULL,'2024-03-19 00:00:00'),
(21,19,'LIBERE','Reprise des registres papier',NULL,'2024-03-20 00:00:00'),
(22,12,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-03-20 00:00:00'),
(23,20,'LIBERE','Reprise des registres papier',NULL,'2024-03-20 00:00:00'),
(24,21,'LIBERE','Reprise des registres papier',NULL,'2024-03-21 00:00:00'),
(25,22,'LIBERE','Reprise des registres papier',NULL,'2024-03-21 00:00:00'),
(26,21,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-03-21 00:00:00'),
(27,23,'LIBERE','Reprise des registres papier',NULL,'2024-03-23 00:00:00'),
(28,24,'LIBERE','Reprise des registres papier',NULL,'2024-03-24 00:00:00'),
(29,25,'LIBERE','Reprise des registres papier',NULL,'2024-03-25 00:00:00'),
(30,26,'LIBERE','Reprise des registres papier',NULL,'2024-03-25 00:00:00'),
(31,25,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-03-25 00:00:00'),
(32,27,'LIBERE','Reprise des registres papier',NULL,'2024-03-26 00:00:00'),
(33,28,'LIBERE','Reprise des registres papier',NULL,'2024-03-27 00:00:00'),
(34,29,'LIBERE','Reprise des registres papier',NULL,'2024-03-28 00:00:00'),
(35,30,'LIBERE','Reprise des registres papier',NULL,'2024-03-29 00:00:00'),
(36,4,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-03-29 00:00:00'),
(37,31,'LIBERE','Reprise des registres papier',NULL,'2023-12-17 00:00:00'),
(38,32,'LIBERE','Reprise des registres papier',NULL,'2024-03-31 00:00:00'),
(39,33,'LIBERE','Reprise des registres papier',NULL,'2024-03-31 00:00:00'),
(40,32,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-03-31 00:00:00'),
(41,34,'LIBERE','Reprise des registres papier',NULL,'2024-04-07 00:00:00'),
(42,35,'LIBERE','Reprise des registres papier',NULL,'2024-04-07 00:00:00'),
(43,34,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-04-07 00:00:00'),
(44,36,'LIBERE','Reprise des registres papier',NULL,'2024-04-27 00:00:00'),
(45,37,'LIBERE','Reprise des registres papier',NULL,'2024-04-27 00:00:00'),
(46,36,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-04-27 00:00:00'),
(47,38,'LIBERE','Reprise des registres papier',NULL,'2024-04-28 00:00:00'),
(48,39,'LIBERE','Reprise des registres papier',NULL,'2024-05-05 00:00:00'),
(49,40,'LIBERE','Reprise des registres papier',NULL,'2024-05-05 00:00:00'),
(50,39,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-05-05 00:00:00'),
(51,41,'LIBERE','Reprise des registres papier',NULL,'2024-05-06 00:00:00'),
(52,42,'LIBERE','Reprise des registres papier',NULL,'2024-05-06 00:00:00'),
(53,41,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-05-06 00:00:00'),
(54,43,'LIBERE','Reprise des registres papier',NULL,'2024-07-02 00:00:00'),
(55,31,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-07-02 00:00:00'),
(56,44,'LIBERE','Reprise des registres papier',NULL,'2024-07-11 00:00:00'),
(57,43,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-07-11 00:00:00'),
(58,45,'LIBERE','Reprise des registres papier',NULL,'2024-09-22 00:00:00'),
(59,46,'LIBERE','Reprise des registres papier',NULL,'2024-09-23 00:00:00'),
(60,47,'LIBERE','Reprise des registres papier',NULL,'2024-09-23 00:00:00'),
(61,48,'LIBERE','Reprise des registres papier',NULL,'2024-10-09 00:00:00'),
(62,5,'EPUISE','Stock épuisé après consommation en production',NULL,'2024-10-09 00:00:00'),
(63,49,'LIBERE','Reprise des registres papier',NULL,'2024-11-05 00:00:00'),
(64,50,'LIBERE','Reprise des registres papier',NULL,'2024-11-05 00:00:00'),
(65,51,'LIBERE','Reprise des registres papier',NULL,'2025-01-15 00:00:00'),
(66,6,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-01-15 00:00:00'),
(67,52,'LIBERE','Reprise des registres papier',NULL,'2025-01-15 00:00:00'),
(68,37,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-01-15 00:00:00'),
(69,53,'LIBERE','Reprise des registres papier',NULL,'2025-01-22 00:00:00'),
(70,54,'LIBERE','Reprise des registres papier',NULL,'2025-01-23 00:00:00'),
(71,13,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-01-23 00:00:00'),
(72,55,'LIBERE','Reprise des registres papier',NULL,'2025-04-03 00:00:00'),
(73,26,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-04-03 00:00:00'),
(74,56,'LIBERE','Reprise des registres papier',NULL,'2025-04-10 00:00:00'),
(75,9,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-04-10 00:00:00'),
(76,48,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-04-10 00:00:00'),
(77,57,'LIBERE','Reprise des registres papier',NULL,'2025-04-15 00:00:00'),
(78,51,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-04-15 00:00:00'),
(79,58,'LIBERE','Reprise des registres papier',NULL,'2025-05-04 00:00:00'),
(80,58,'EPUISE','Stock épuisé après vente',NULL,'2025-05-04 00:00:00'),
(81,59,'LIBERE','Reprise des registres papier',NULL,'2025-08-05 00:00:00'),
(82,47,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
(83,52,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
(84,55,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
(85,56,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
(86,57,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
(87,59,'EPUISE','Stock épuisé après vente',NULL,'2025-08-19 00:00:00'),
(88,45,'EPUISE','Stock épuisé après vente',NULL,'2025-09-15 00:00:00'),
(89,60,'LIBERE','Reprise des registres papier',NULL,'2025-10-20 00:00:00'),
(90,7,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-10-20 00:00:00'),
(91,61,'LIBERE','Reprise des registres papier',NULL,'2025-10-21 00:00:00'),
(92,15,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-10-21 00:00:00'),
(93,62,'LIBERE','Reprise des registres papier',NULL,'2025-10-23 00:00:00'),
(94,17,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-10-23 00:00:00'),
(95,63,'LIBERE','Reprise des registres papier',NULL,'2025-10-26 00:00:00'),
(96,27,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-10-26 00:00:00'),
(97,64,'LIBERE','Reprise des registres papier',NULL,'2025-10-28 00:00:00'),
(98,28,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-10-28 00:00:00'),
(99,65,'LIBERE','Reprise des registres papier',NULL,'2025-11-03 00:00:00'),
(100,16,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-11-03 00:00:00'),
(101,66,'LIBERE','Reprise des registres papier',NULL,'2025-11-05 00:00:00'),
(102,10,'EPUISE','Stock épuisé après consommation en production',NULL,'2025-11-05 00:00:00'),
(103,46,'EPUISE','Stock épuisé après vente',NULL,'2025-11-15 00:00:00'),
(104,35,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-01-01 00:00:00'),
(105,22,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-01-01 00:00:00'),
(106,67,'LIBERE','Reprise des registres papier',NULL,'2026-02-01 00:00:00'),
(107,68,'LIBERE','Reprise des registres papier',NULL,'2026-02-01 00:00:00'),
(108,59,'EPUISE','Stock épuisé après vente',NULL,'2026-02-19 00:00:00'),
(109,67,'EPUISE','Stock épuisé après vente',NULL,'2026-03-14 00:00:00'),
(110,68,'EPUISE','Stock épuisé après vente',NULL,'2026-03-14 00:00:00'),
(111,53,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-04-08 00:00:00'),
(112,54,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-04-08 00:00:00'),
(113,69,'LIBERE','Reprise des registres papier',NULL,'2026-05-09 00:00:00'),
(114,70,'LIBERE','Reprise des registres papier',NULL,'2026-05-09 00:00:00'),
(115,50,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-05-09 00:00:00'),
(116,49,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-05-09 00:00:00'),
(117,71,'LIBERE','Reprise des registres papier',NULL,'2026-05-10 00:00:00'),
(118,72,'LIBERE','Reprise des registres papier',NULL,'2026-05-11 00:00:00'),
(119,3,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-05-11 00:00:00'),
(120,66,'EPUISE','Stock épuisé après consommation en production',NULL,'2026-05-11 00:00:00'),
(121,69,'EPUISE','Stock épuisé après vente',NULL,'2026-05-22 00:00:00'),
(122,70,'EPUISE','Stock épuisé après vente',NULL,'2026-05-22 00:00:00'),
(123,67,'EPUISE','Stock épuisé après vente',NULL,'2026-05-26 00:00:00'),
(124,68,'EPUISE','Stock épuisé après vente',NULL,'2026-05-26 00:00:00'),
(125,71,'EPUISE','Stock épuisé après vente',NULL,'2026-07-19 00:00:00'),
(126,72,'EPUISE','Stock épuisé après vente',NULL,'2026-07-19 00:00:00');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `conditionnements` (`id`, `date`, `produit_id`, `format_id`, `lot_id`, `qty`, `quantite_source_utilisee`, `note`, `employe_id`, `created_at`) VALUES (1,'2024-09-22',4,1,45,80.00,0.800,'Lot fini 011823',NULL,'2026-10-11 20:26:54'),
(2,'2024-09-23',4,1,46,21.00,0.210,'Lot fini 021825',NULL,'2026-10-11 20:26:54'),
(3,'2024-09-23',5,2,47,19.00,0.570,'Lot fini 021825',NULL,'2026-10-11 20:26:54'),
(4,'2024-09-24',4,1,46,2.00,0.020,'Lot fini 021825',NULL,'2026-10-11 20:26:54'),
(5,'2025-01-15',5,2,52,28.00,0.840,'Lot fini 042505',NULL,'2026-10-11 20:26:54'),
(6,'2025-04-03',5,2,55,7.00,0.210,'Lot fini 061803',NULL,'2026-10-11 20:26:54'),
(7,'2025-04-10',5,2,56,32.00,0.960,'Lot fini 050502',NULL,'2026-10-11 20:26:54'),
(8,'2025-04-15',5,2,57,14.00,0.420,'Lot fini 070324',NULL,'2026-10-11 20:26:54'),
(9,'2025-05-04',5,2,58,4.00,0.120,'Lot fini 082415',NULL,'2026-10-11 20:26:54'),
(10,'2025-08-05',4,1,59,20.00,0.200,'Lot fini 082415',NULL,'2026-10-11 20:26:54'),
(11,'2026-01-01',4,1,59,134.00,1.340,'Lot fini 082415',NULL,'2026-10-11 20:26:54'),
(12,'2026-02-01',5,2,67,10.00,0.300,'Lot fini 090808',NULL,'2026-10-11 20:26:54'),
(13,'2026-02-01',4,1,68,8.00,0.080,'Lot fini 090808',NULL,'2026-10-11 20:26:54'),
(14,'2026-04-07',5,2,67,6.00,0.180,'Lot fini 090808',NULL,'2026-10-11 20:26:54'),
(15,'2026-04-08',4,1,68,19.00,0.192,'2 ml de perte · Lot fini 090808',NULL,'2026-10-11 20:26:54'),
(16,'2026-05-09',5,2,69,1.00,0.030,'Lot fini 030808',NULL,'2026-10-11 20:26:54'),
(17,'2026-05-09',4,1,70,2.00,0.025,'5 ml de perte · Lot fini 030808',NULL,'2026-10-11 20:26:54'),
(18,'2026-05-10',5,2,71,26.00,0.780,'Lot fini 100106',NULL,'2026-10-11 20:26:54'),
(19,'2026-05-11',4,1,72,59.00,0.590,'Lot fini 100106',NULL,'2026-10-11 20:26:54');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `conditionnement_sources` (`id`, `conditionnement_id`, `lot_presse_id`, `lot_filtration_id`, `lot_id`, `quantite_utilisee`) VALUES (1,1,NULL,5,NULL,0.400),
(2,1,NULL,4,NULL,0.400),
(3,2,NULL,7,NULL,0.105),
(4,2,NULL,4,NULL,0.105),
(5,3,NULL,7,NULL,0.285),
(6,3,NULL,4,NULL,0.285),
(7,4,NULL,7,NULL,0.010),
(8,4,NULL,4,NULL,0.010),
(9,5,NULL,7,NULL,0.420),
(10,5,NULL,2,NULL,0.420),
(11,6,NULL,4,NULL,0.100),
(12,6,NULL,14,NULL,0.110),
(13,7,NULL,2,NULL,0.470),
(14,7,NULL,11,NULL,0.490),
(15,8,NULL,14,NULL,0.230),
(16,8,NULL,6,NULL,0.190),
(17,9,NULL,6,NULL,0.060),
(18,9,NULL,3,NULL,0.060),
(19,10,NULL,6,NULL,0.100),
(20,10,NULL,3,NULL,0.100),
(21,11,NULL,6,NULL,0.670),
(22,11,NULL,3,NULL,0.670),
(23,12,NULL,15,NULL,0.068),
(24,12,NULL,16,NULL,0.232),
(25,13,NULL,15,NULL,0.018),
(26,13,NULL,16,NULL,0.062),
(27,14,NULL,15,NULL,0.041),
(28,14,NULL,16,NULL,0.139),
(29,15,NULL,15,NULL,0.044),
(30,15,NULL,16,NULL,0.148),
(31,16,NULL,13,NULL,0.015),
(32,16,NULL,12,NULL,0.015),
(33,17,NULL,13,NULL,0.012),
(34,17,NULL,12,NULL,0.013),
(35,18,NULL,1,NULL,0.433),
(36,18,NULL,23,NULL,0.347),
(37,19,NULL,1,NULL,0.327),
(38,19,NULL,23,NULL,0.263);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `commandes` (`id`, `numero`, `client_id`, `date_iso`, `statut`, `notes`, `total`, `created_by`, `employe_id`, `created_at`) VALUES (1,'BC-0001',16,'2025-05-04 00:00:00','payee','Vente registre n° — · client non renseigné · sortie du registre mélange (04/05/2025), absente du registre des ventes',247.860,NULL,NULL,'2025-05-04 00:00:00'),
(2,'BC-0002',1,'2025-06-10 00:00:00','payee','Vente registre n° 3 · client : Gisel · paiement : espèces · livraison : Djerba',1549.125,NULL,NULL,'2025-06-10 00:00:00'),
(3,'BC-0003',2,'2025-07-10 00:00:00','payee','Vente registre n° 2 · client : Client particulier · paiement : espèces · livraison : Djerba',40.014,NULL,NULL,'2025-07-10 00:00:00'),
(4,'BC-0004',3,'2025-08-14 00:00:00','payee','Vente registre n° 1 · client : Berntrard · paiement : espèces · livraison : Djerba',1549.125,NULL,NULL,'2025-08-14 00:00:00'),
(5,'BC-0005',4,'2025-08-14 00:00:00','payee','Vente registre n° 4 · client : louccy · paiement : espèces · livraison : Djerba',1549.125,NULL,NULL,'2025-08-14 00:00:00'),
(6,'BC-0006',5,'2025-08-14 00:00:00','payee','Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',1549.125,NULL,NULL,'2025-08-14 00:00:00'),
(7,'BC-0007',6,'2025-08-19 00:00:00','payee','Vente registre n° 6 · client : client Passage · paiement : espèces · livraison : Djerba · registre : « 6*30=180 + 2*10=20 » (200 ml) ; enregistré en 20 flacons de 10 ml (le lot n\'a que 4 flacons de 30 ml, déjà sortis le 04/05)',400.140,NULL,NULL,'2025-08-19 00:00:00'),
(8,'BC-0008',7,'2025-09-06 00:00:00','payee','Vente registre n° 7 · client : ben abdesslem · paiement : espèces · livraison : Djerba',400.140,NULL,NULL,'2025-09-06 00:00:00'),
(9,'BC-0009',8,'2025-09-10 00:00:00','payee','Vente registre n° 8 · client : artisanet · paiement : espèces · livraison : Djerba',600.210,NULL,NULL,'2025-09-10 00:00:00'),
(10,'BC-0010',9,'2025-09-15 00:00:00','payee','Vente registre n° 9 · client : omran khaled · paiement : espèces · livraison : Djerba',600.210,NULL,NULL,'2025-09-15 00:00:00'),
(11,'BC-0011',4,'2025-11-15 00:00:00','payee','Vente registre n° 10 · client : louccy · paiement : espèces · livraison : Djerba',420.147,NULL,NULL,'2025-11-15 00:00:00'),
(12,'BC-0012',7,'2026-01-09 00:00:00','payee','Vente registre n° 11 · client : ben abdesslem · paiement : espèces · livraison : Djerba',600.210,NULL,NULL,'2026-01-09 00:00:00'),
(13,'BC-0013',9,'2026-01-16 00:00:00','payee','Vente registre n° 12 · client : omran khaled · paiement : espèces · livraison : Djerba',1000.350,NULL,NULL,'2026-01-16 00:00:00'),
(14,'BC-0014',10,'2026-01-26 00:00:00','payee','Vente registre n° 13 · client : Relax and spay · paiement : espèces · livraison : Djerba',420.147,NULL,NULL,'2026-01-26 00:00:00'),
(15,'BC-0015',11,'2026-02-18 00:00:00','payee','Vente registre n° 14 · client : biojerba · paiement : espèces · livraison : Djerba',400.140,NULL,NULL,'2026-02-18 00:00:00'),
(16,'BC-0016',8,'2026-02-19 00:00:00','payee','Vente registre n° 15 · client : artisanet · paiement : espèces · livraison : Djerba',260.091,NULL,NULL,'2026-02-19 00:00:00'),
(17,'BC-0017',12,'2026-02-21 00:00:00','payee','Vente registre n° 16 · client : client · paiement : espèces · livraison : Djerba',245.916,NULL,NULL,'2026-02-21 00:00:00'),
(18,'BC-0018',13,'2026-02-23 00:00:00','payee','Vente registre n° 17 · client : bernard · paiement : espèces · livraison : Djerba',327.888,NULL,NULL,'2026-02-23 00:00:00'),
(19,'BC-0019',9,'2026-03-14 00:00:00','payee','Vente registre n° 18 · client : omran khaled · paiement : espèces · livraison : Djerba',205.902,NULL,NULL,'2026-03-14 00:00:00'),
(20,'BC-0020',14,'2026-05-22 00:00:00','payee','Vente registre n° 18 · client : client passaget · paiement : espèces · livraison : Djerba',101.979,NULL,NULL,'2026-05-22 00:00:00'),
(21,'BC-0021',8,'2026-05-26 00:00:00','payee','Vente registre n° 18 · client : artisanet · paiement : espèces · livraison : Djerba',751.923,NULL,NULL,'2026-05-26 00:00:00'),
(22,'BC-0022',15,'2026-07-19 00:00:00','payee','Vente registre n° 18 · client : passaget claude · paiement : espèces · livraison : Djerba',2791.503,NULL,NULL,'2026-07-19 00:00:00');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `commande_lignes` (`id`, `commande_id`, `produit_id`, `lot_id`, `qty`, `qty_livree`, `prix_detail`, `unit_price`, `total`, `remise_id`, `remise_nom`, `remise_pct`, `remise_type`, `free_units`, `cumule`) VALUES (1,1,5,58,4.00,4.00,76.500,61.965,247.860,1,'Remise 19 %',19.00,'pourcentage',0,0),
(2,2,5,52,22.00,22.00,76.500,61.965,1363.230,1,'Remise 19 %',19.00,'pourcentage',0,0),
(3,2,5,56,3.00,3.00,76.500,61.965,185.895,1,'Remise 19 %',19.00,'pourcentage',0,0),
(4,3,4,46,2.00,2.00,24.700,20.007,40.014,1,'Remise 19 %',19.00,'pourcentage',0,0),
(5,4,5,47,19.00,19.00,76.500,61.965,1177.335,1,'Remise 19 %',19.00,'pourcentage',0,0),
(6,4,5,52,6.00,6.00,76.500,61.965,371.790,1,'Remise 19 %',19.00,'pourcentage',0,0),
(7,5,5,56,25.00,25.00,76.500,61.965,1549.125,1,'Remise 19 %',19.00,'pourcentage',0,0),
(8,6,5,55,7.00,7.00,76.500,61.965,433.755,1,'Remise 19 %',19.00,'pourcentage',0,0),
(9,6,5,56,4.00,4.00,76.500,61.965,247.860,1,'Remise 19 %',19.00,'pourcentage',0,0),
(10,6,5,57,14.00,14.00,76.500,61.965,867.510,1,'Remise 19 %',19.00,'pourcentage',0,0),
(11,7,4,59,20.00,20.00,24.700,20.007,400.140,1,'Remise 19 %',19.00,'pourcentage',0,0),
(12,8,4,45,20.00,20.00,24.700,20.007,400.140,1,'Remise 19 %',19.00,'pourcentage',0,0),
(13,9,4,45,30.00,30.00,24.700,20.007,600.210,1,'Remise 19 %',19.00,'pourcentage',0,0),
(14,10,4,45,30.00,30.00,24.700,20.007,600.210,1,'Remise 19 %',19.00,'pourcentage',0,0),
(15,11,4,46,21.00,21.00,24.700,20.007,420.147,1,'Remise 19 %',19.00,'pourcentage',0,0),
(16,12,4,59,30.00,30.00,24.700,20.007,600.210,1,'Remise 19 %',19.00,'pourcentage',0,0),
(17,13,4,59,50.00,50.00,24.700,20.007,1000.350,1,'Remise 19 %',19.00,'pourcentage',0,0),
(18,14,4,59,21.00,21.00,24.700,20.007,420.147,1,'Remise 19 %',19.00,'pourcentage',0,0),
(19,15,4,59,20.00,20.00,24.700,20.007,400.140,1,'Remise 19 %',19.00,'pourcentage',0,0),
(20,16,4,59,13.00,13.00,24.700,20.007,260.091,1,'Remise 19 %',19.00,'pourcentage',0,0),
(21,17,5,67,3.00,3.00,76.500,61.965,185.895,1,'Remise 19 %',19.00,'pourcentage',0,0),
(22,17,4,68,3.00,3.00,24.700,20.007,60.021,1,'Remise 19 %',19.00,'pourcentage',0,0),
(23,18,5,67,4.00,4.00,76.500,61.965,247.860,1,'Remise 19 %',19.00,'pourcentage',0,0),
(24,18,4,68,4.00,4.00,24.700,20.007,80.028,1,'Remise 19 %',19.00,'pourcentage',0,0),
(25,19,5,67,3.00,3.00,76.500,61.965,185.895,1,'Remise 19 %',19.00,'pourcentage',0,0),
(26,19,4,68,1.00,1.00,24.700,20.007,20.007,1,'Remise 19 %',19.00,'pourcentage',0,0),
(27,20,5,69,1.00,1.00,76.500,61.965,61.965,1,'Remise 19 %',19.00,'pourcentage',0,0),
(28,20,4,70,2.00,2.00,24.700,20.007,40.014,1,'Remise 19 %',19.00,'pourcentage',0,0),
(29,21,5,67,6.00,6.00,76.500,61.965,371.790,1,'Remise 19 %',19.00,'pourcentage',0,0),
(30,21,4,68,19.00,19.00,24.700,20.007,380.133,1,'Remise 19 %',19.00,'pourcentage',0,0),
(31,22,5,71,26.00,26.00,76.500,61.965,1611.090,1,'Remise 19 %',19.00,'pourcentage',0,0),
(32,22,4,72,59.00,59.00,24.700,20.007,1180.413,1,'Remise 19 %',19.00,'pourcentage',0,0);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `bons_livraison` (`id`, `numero`, `commande_id`, `client_id`, `date_livraison`, `statut`, `notes`, `annule_motif`, `employe_id`, `created_at`) VALUES (1,'BL-0001',1,16,'2025-05-04','emis','Repris du registre des ventes',NULL,NULL,'2025-05-04 00:00:00'),
(2,'BL-0002',2,1,'2025-06-10','emis','Repris du registre des ventes',NULL,NULL,'2025-06-10 00:00:00'),
(3,'BL-0003',3,2,'2025-07-10','emis','Repris du registre des ventes',NULL,NULL,'2025-07-10 00:00:00'),
(4,'BL-0004',4,3,'2025-08-14','emis','Repris du registre des ventes',NULL,NULL,'2025-08-14 00:00:00'),
(5,'BL-0005',5,4,'2025-08-14','emis','Repris du registre des ventes',NULL,NULL,'2025-08-14 00:00:00'),
(6,'BL-0006',6,5,'2025-08-14','emis','Repris du registre des ventes',NULL,NULL,'2025-08-14 00:00:00'),
(7,'BL-0007',7,6,'2025-08-19','emis','Repris du registre des ventes',NULL,NULL,'2025-08-19 00:00:00'),
(8,'BL-0008',8,7,'2025-09-06','emis','Repris du registre des ventes',NULL,NULL,'2025-09-06 00:00:00'),
(9,'BL-0009',9,8,'2025-09-10','emis','Repris du registre des ventes',NULL,NULL,'2025-09-10 00:00:00'),
(10,'BL-0010',10,9,'2025-09-15','emis','Repris du registre des ventes',NULL,NULL,'2025-09-15 00:00:00'),
(11,'BL-0011',11,4,'2025-11-15','emis','Repris du registre des ventes',NULL,NULL,'2025-11-15 00:00:00'),
(12,'BL-0012',12,7,'2026-01-09','emis','Repris du registre des ventes',NULL,NULL,'2026-01-09 00:00:00'),
(13,'BL-0013',13,9,'2026-01-16','emis','Repris du registre des ventes',NULL,NULL,'2026-01-16 00:00:00'),
(14,'BL-0014',14,10,'2026-01-26','emis','Repris du registre des ventes',NULL,NULL,'2026-01-26 00:00:00'),
(15,'BL-0015',15,11,'2026-02-18','emis','Repris du registre des ventes',NULL,NULL,'2026-02-18 00:00:00'),
(16,'BL-0016',16,8,'2026-02-19','emis','Repris du registre des ventes',NULL,NULL,'2026-02-19 00:00:00'),
(17,'BL-0017',17,12,'2026-02-21','emis','Repris du registre des ventes',NULL,NULL,'2026-02-21 00:00:00'),
(18,'BL-0018',18,13,'2026-02-23','emis','Repris du registre des ventes',NULL,NULL,'2026-02-23 00:00:00'),
(19,'BL-0019',19,9,'2026-03-14','emis','Repris du registre des ventes',NULL,NULL,'2026-03-14 00:00:00'),
(20,'BL-0020',20,14,'2026-05-22','emis','Repris du registre des ventes',NULL,NULL,'2026-05-22 00:00:00'),
(21,'BL-0021',21,8,'2026-05-26','emis','Repris du registre des ventes',NULL,NULL,'2026-05-26 00:00:00'),
(22,'BL-0022',22,15,'2026-07-19','emis','Repris du registre des ventes',NULL,NULL,'2026-07-19 00:00:00');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `bl_lignes` (`id`, `bl_id`, `commande_ligne_id`, `produit_id`, `lot_id`, `qty`) VALUES (1,1,1,5,58,4.00),
(2,2,2,5,52,22.00),
(3,2,3,5,56,3.00),
(4,3,4,4,46,2.00),
(5,4,5,5,47,19.00),
(6,4,6,5,52,6.00),
(7,5,7,5,56,25.00),
(8,6,8,5,55,7.00),
(9,6,9,5,56,4.00),
(10,6,10,5,57,14.00),
(11,7,11,4,59,20.00),
(12,8,12,4,45,20.00),
(13,9,13,4,45,30.00),
(14,10,14,4,45,30.00),
(15,11,15,4,46,21.00),
(16,12,16,4,59,30.00),
(17,13,17,4,59,50.00),
(18,14,18,4,59,21.00),
(19,15,19,4,59,20.00),
(20,16,20,4,59,13.00),
(21,17,21,5,67,3.00),
(22,17,22,4,68,3.00),
(23,18,23,5,67,4.00),
(24,18,24,4,68,4.00),
(25,19,25,5,67,3.00),
(26,19,26,4,68,1.00),
(27,20,27,5,69,1.00),
(28,20,28,4,70,2.00),
(29,21,29,5,67,6.00),
(30,21,30,4,68,19.00),
(31,22,31,5,71,26.00),
(32,22,32,4,72,59.00);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `factures` (`id`, `numero`, `statut`, `commande_id`, `commande_numero`, `client_id`, `client_nom`, `date_emission`, `tva_rate`, `fodec_montant`, `droit_timbre`, `total_ht`, `montant_tva`, `total_ttc`, `created_at`) VALUES (1,'FAC-0001','emise',1,'BC-0001',16,'Client à identifier','2025-05-04',19.00,2.083,0.000,208.286,39.970,250.339,'2025-05-04 00:00:00'),
(2,'FAC-0002','emise',2,'BC-0002',1,'Gisel','2025-06-10',19.00,13.018,1.000,1301.786,249.813,1565.616,'2025-06-10 00:00:00'),
(3,'FAC-0003','emise',3,'BC-0003',2,'Client particulier','2025-07-10',19.00,0.336,0.000,33.625,6.453,40.414,'2025-07-10 00:00:00'),
(4,'FAC-0004','emise',4,'BC-0004',3,'Berntrard','2025-08-14',19.00,13.018,1.000,1301.786,249.813,1565.616,'2025-08-14 00:00:00'),
(5,'FAC-0005','emise',5,'BC-0005',4,'louccy','2025-08-14',19.00,13.018,1.000,1301.786,249.813,1565.616,'2025-08-14 00:00:00'),
(6,'FAC-0006','emise',6,'BC-0006',5,'Gosef','2025-08-14',19.00,13.018,1.000,1301.786,249.813,1565.616,'2025-08-14 00:00:00'),
(7,'FAC-0007','emise',7,'BC-0007',6,'client Passage','2025-08-19',19.00,3.363,0.000,336.252,64.527,404.141,'2025-08-19 00:00:00'),
(8,'FAC-0008','emise',8,'BC-0008',7,'ben abdesslem','2025-09-06',19.00,3.363,0.000,336.252,64.527,404.141,'2025-09-06 00:00:00'),
(9,'FAC-0009','emise',9,'BC-0009',8,'artisanet','2025-09-10',19.00,5.044,0.000,504.378,96.790,606.212,'2025-09-10 00:00:00'),
(10,'FAC-0010','emise',10,'BC-0010',9,'omran khaled','2025-09-15',19.00,5.044,0.000,504.378,96.790,606.212,'2025-09-15 00:00:00'),
(11,'FAC-0011','emise',11,'BC-0011',4,'louccy','2025-11-15',19.00,3.531,0.000,353.065,67.753,424.348,'2025-11-15 00:00:00'),
(12,'FAC-0012','emise',12,'BC-0012',7,'ben abdesslem','2026-01-09',19.00,5.044,0.000,504.378,96.790,606.212,'2026-01-09 00:00:00'),
(13,'FAC-0013','emise',13,'BC-0013',9,'omran khaled','2026-01-16',19.00,8.406,1.000,840.630,161.317,1011.354,'2026-01-16 00:00:00'),
(14,'FAC-0014','emise',14,'BC-0014',10,'Relax and spay','2026-01-26',19.00,3.531,0.000,353.065,67.753,424.348,'2026-01-26 00:00:00'),
(15,'FAC-0015','emise',15,'BC-0015',11,'biojerba','2026-02-18',19.00,3.363,0.000,336.252,64.527,404.141,'2026-02-18 00:00:00'),
(16,'FAC-0016','emise',16,'BC-0016',8,'artisanet','2026-02-19',19.00,2.186,0.000,218.564,41.942,262.692,'2026-02-19 00:00:00'),
(17,'FAC-0017','emise',17,'BC-0017',12,'client','2026-02-21',19.00,2.067,0.000,206.652,39.657,248.375,'2026-02-21 00:00:00'),
(18,'FAC-0018','emise',18,'BC-0018',13,'bernard','2026-02-23',19.00,2.755,0.000,275.536,52.875,331.167,'2026-02-23 00:00:00'),
(19,'FAC-0019','emise',19,'BC-0019',9,'omran khaled','2026-03-14',19.00,1.730,0.000,173.027,33.204,207.961,'2026-03-14 00:00:00'),
(20,'FAC-0020','emise',20,'BC-0020',14,'client passaget','2026-05-22',19.00,0.857,0.000,85.697,16.445,102.999,'2026-05-22 00:00:00'),
(21,'FAC-0021','emise',21,'BC-0021',8,'artisanet','2026-05-26',19.00,6.319,0.000,631.868,121.255,759.442,'2026-05-26 00:00:00'),
(22,'FAC-0022','emise',22,'BC-0022',15,'passaget claude','2026-07-19',19.00,23.458,1.000,2345.801,450.159,2820.418,'2026-07-19 00:00:00');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `facture_lignes` (`id`, `facture_id`, `designation`, `prix_detail`, `unit_price`, `qty`, `total`, `remise_nom`, `remise_pct`) VALUES (1,1,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 082415)',76.500,61.965,4.00,247.860,'Remise 19 %',19.00),
(2,2,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 042505)',76.500,61.965,22.00,1363.230,'Remise 19 %',19.00),
(3,2,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 050502)',76.500,61.965,3.00,185.895,'Remise 19 %',19.00),
(4,3,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 021825)',24.700,20.007,2.00,40.014,'Remise 19 %',19.00),
(5,4,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 021825-2)',76.500,61.965,19.00,1177.335,'Remise 19 %',19.00),
(6,4,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 042505)',76.500,61.965,6.00,371.790,'Remise 19 %',19.00),
(7,5,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 050502)',76.500,61.965,25.00,1549.125,'Remise 19 %',19.00),
(8,6,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 061803)',76.500,61.965,7.00,433.755,'Remise 19 %',19.00),
(9,6,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 050502)',76.500,61.965,4.00,247.860,'Remise 19 %',19.00),
(10,6,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 070324)',76.500,61.965,14.00,867.510,'Remise 19 %',19.00),
(11,7,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 082415-2)',24.700,20.007,20.00,400.140,'Remise 19 %',19.00),
(12,8,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 011823)',24.700,20.007,20.00,400.140,'Remise 19 %',19.00),
(13,9,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 011823)',24.700,20.007,30.00,600.210,'Remise 19 %',19.00),
(14,10,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 011823)',24.700,20.007,30.00,600.210,'Remise 19 %',19.00),
(15,11,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 021825)',24.700,20.007,21.00,420.147,'Remise 19 %',19.00),
(16,12,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 082415-2)',24.700,20.007,30.00,600.210,'Remise 19 %',19.00),
(17,13,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 082415-2)',24.700,20.007,50.00,1000.350,'Remise 19 %',19.00),
(18,14,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 082415-2)',24.700,20.007,21.00,420.147,'Remise 19 %',19.00),
(19,15,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 082415-2)',24.700,20.007,20.00,400.140,'Remise 19 %',19.00),
(20,16,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 082415-2)',24.700,20.007,13.00,260.091,'Remise 19 %',19.00),
(21,17,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 090808)',76.500,61.965,3.00,185.895,'Remise 19 %',19.00),
(22,17,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 090808-2)',24.700,20.007,3.00,60.021,'Remise 19 %',19.00),
(23,18,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 090808)',76.500,61.965,4.00,247.860,'Remise 19 %',19.00),
(24,18,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 090808-2)',24.700,20.007,4.00,80.028,'Remise 19 %',19.00),
(25,19,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 090808)',76.500,61.965,3.00,185.895,'Remise 19 %',19.00),
(26,19,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 090808-2)',24.700,20.007,1.00,20.007,'Remise 19 %',19.00),
(27,20,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 030808)',76.500,61.965,1.00,61.965,'Remise 19 %',19.00),
(28,20,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 030808-2)',24.700,20.007,2.00,40.014,'Remise 19 %',19.00),
(29,21,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 090808)',76.500,61.965,6.00,371.790,'Remise 19 %',19.00),
(30,21,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 090808-2)',24.700,20.007,19.00,380.133,'Remise 19 %',19.00),
(31,22,'Huile de pépins de figue de barbarie — Flacon 30ml (lot 100106)',76.500,61.965,26.00,1611.090,'Remise 19 %',19.00),
(32,22,'Huile de pépins de figue de barbarie — Flacon 10ml (lot 100106-2)',24.700,20.007,59.00,1180.413,'Remise 19 %',19.00);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `paiements` (`id`, `facture_id`, `date_paiement`, `montant`, `mode`, `reference`, `notes`, `annule_le`, `annule_motif`, `annule_par`) VALUES (1,1,'2025-05-04',250.339,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(2,2,'2025-06-10',1565.616,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(3,3,'2025-07-10',40.414,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(4,4,'2025-08-14',1565.616,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(5,5,'2025-08-14',1565.616,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(6,6,'2025-08-14',1565.616,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(7,7,'2025-08-19',404.141,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(8,8,'2025-09-06',404.141,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(9,9,'2025-09-10',606.212,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(10,10,'2025-09-15',606.212,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(11,11,'2025-11-15',424.348,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(12,12,'2026-01-09',606.212,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(13,13,'2026-01-16',1011.354,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(14,14,'2026-01-26',424.348,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(15,15,'2026-02-18',404.141,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(16,16,'2026-02-19',262.692,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(17,17,'2026-02-21',248.375,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(18,18,'2026-02-23',331.167,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(19,19,'2026-03-14',207.961,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(20,20,'2026-05-22',102.999,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(21,21,'2026-05-26',759.442,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL),
(22,22,'2026-07-19',2820.418,'especes',NULL,'Espèces — repris du registre des ventes',NULL,NULL,NULL);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

INSERT INTO `stock_mouvements` (`id`, `numero`, `date_mouvement`, `type_mouvement`, `sens`, `produit_id`, `lot_id`, `local_id`, `zone_id`, `zone_source_id`, `zone_destination_id`, `quantite`, `source_type`, `source_id`, `group_id`, `note`, `employe_id`, `created_at`) VALUES (1,'MVT-0001','2023-12-17 00:00:00','RECEPTION','ENTREE',1,1,NULL,NULL,NULL,NULL,50.000,'reception_registre',1,'fead049d-1403-4dcc-aee4-2a66f2d98e3f',NULL,NULL,'2026-10-11 20:26:54'),
(2,'MVT-0002','2023-12-17 00:00:00','CONSOMMATION','SORTIE',1,1,NULL,NULL,NULL,NULL,32.000,'lots_presse',2,'6a8942fa-957f-4bfc-8f91-9bc48b2d841e',NULL,NULL,'2026-10-11 20:26:54'),
(3,'MVT-0003','2023-12-17 00:00:00','PRODUCTION','ENTREE',2,2,NULL,NULL,NULL,NULL,1.000,'lots_presse',2,'6a8942fa-957f-4bfc-8f91-9bc48b2d841e',NULL,NULL,'2026-10-11 20:26:54'),
(4,'MVT-0004','2023-12-17 00:00:00','CONSOMMATION','SORTIE',2,2,NULL,NULL,NULL,NULL,0.900,'lots_filtration',1,'58fffdaa-c632-47f9-a9f6-44720ec32ecb',NULL,NULL,'2026-10-11 20:26:54'),
(5,'MVT-0005','2023-12-17 00:00:00','PRODUCTION','ENTREE',3,3,NULL,NULL,NULL,NULL,0.760,'lots_filtration',1,'58fffdaa-c632-47f9-a9f6-44720ec32ecb',NULL,NULL,'2026-10-11 20:26:54'),
(6,'MVT-0006','2023-12-18 00:00:00','RECEPTION','ENTREE',1,4,NULL,NULL,NULL,NULL,398.800,'reception_registre',4,'2b0c246b-1ae4-4b7a-8f72-1792bff09d78',NULL,NULL,'2026-10-11 20:26:54'),
(7,'MVT-0007','2023-12-18 00:00:00','CONSOMMATION','SORTIE',1,1,NULL,NULL,NULL,NULL,18.000,'lots_presse',5,'875c4828-34d8-43df-b57b-48d2d115148a',NULL,NULL,'2026-10-11 20:26:54'),
(8,'MVT-0008','2023-12-18 00:00:00','PRODUCTION','ENTREE',2,5,NULL,NULL,NULL,NULL,0.600,'lots_presse',5,'875c4828-34d8-43df-b57b-48d2d115148a',NULL,NULL,'2026-10-11 20:26:54'),
(9,'MVT-0009','2023-12-18 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,12.000,'lots_presse',6,'b3c1b094-ddd0-4bc2-b5fd-c526c86db997',NULL,NULL,'2026-10-11 20:26:54'),
(10,'MVT-0010','2023-12-18 00:00:00','PRODUCTION','ENTREE',2,6,NULL,NULL,NULL,NULL,0.400,'lots_presse',6,'b3c1b094-ddd0-4bc2-b5fd-c526c86db997',NULL,NULL,'2026-10-11 20:26:54'),
(11,'MVT-0011','2023-12-19 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,32.000,'lots_presse',7,'579b6e14-48a7-4b86-a4de-bbdf6f433c5f',NULL,NULL,'2026-10-11 20:26:54'),
(12,'MVT-0012','2023-12-19 00:00:00','PRODUCTION','ENTREE',2,7,NULL,NULL,NULL,NULL,1.000,'lots_presse',7,'579b6e14-48a7-4b86-a4de-bbdf6f433c5f',NULL,NULL,'2026-10-11 20:26:54'),
(13,'MVT-0013','2023-12-24 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,31.000,'lots_presse',8,'3c5e93f3-2280-4d73-87ee-74bf54d5a877',NULL,NULL,'2026-10-11 20:26:54'),
(14,'MVT-0014','2023-12-24 00:00:00','PRODUCTION','ENTREE',2,8,NULL,NULL,NULL,NULL,1.000,'lots_presse',8,'3c5e93f3-2280-4d73-87ee-74bf54d5a877',NULL,NULL,'2026-10-11 20:26:54'),
(15,'MVT-0015','2023-12-24 00:00:00','CONSOMMATION','SORTIE',2,8,NULL,NULL,NULL,NULL,1.000,'lots_filtration',2,'b2220db0-7465-44fb-8326-7c367c3630e5',NULL,NULL,'2026-10-11 20:26:54'),
(16,'MVT-0016','2023-12-24 00:00:00','PRODUCTION','ENTREE',3,9,NULL,NULL,NULL,NULL,0.890,'lots_filtration',2,'b2220db0-7465-44fb-8326-7c367c3630e5',NULL,NULL,'2026-10-11 20:26:54'),
(17,'MVT-0017','2023-12-25 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,25.000,'lots_presse',10,'6bb588eb-160a-4d4c-94f1-889d6be7a487',NULL,NULL,'2026-10-11 20:26:54'),
(18,'MVT-0018','2023-12-25 00:00:00','PRODUCTION','ENTREE',2,10,NULL,NULL,NULL,NULL,0.750,'lots_presse',10,'6bb588eb-160a-4d4c-94f1-889d6be7a487',NULL,NULL,'2026-10-11 20:26:54'),
(19,'MVT-0019','2023-12-26 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',11,'55bc73aa-1546-458a-a874-a65ff6f22f76',NULL,NULL,'2026-10-11 20:26:54'),
(20,'MVT-0020','2023-12-26 00:00:00','PRODUCTION','ENTREE',2,11,NULL,NULL,NULL,NULL,1.000,'lots_presse',11,'55bc73aa-1546-458a-a874-a65ff6f22f76',NULL,NULL,'2026-10-11 20:26:54'),
(21,'MVT-0021','2024-02-10 00:00:00','RECEPTION','ENTREE',1,12,NULL,NULL,NULL,NULL,150.000,'reception_registre',12,'7730ed66-6e65-4a3e-9395-f1ecd67ead37',NULL,NULL,'2026-10-11 20:26:54'),
(22,'MVT-0022','2024-02-10 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,22.200,'lots_presse',13,'09a5d57b-19d6-4a7e-944f-9f9f529f5e4a',NULL,NULL,'2026-10-11 20:26:54'),
(23,'MVT-0023','2024-02-10 00:00:00','PRODUCTION','ENTREE',2,13,NULL,NULL,NULL,NULL,0.720,'lots_presse',13,'09a5d57b-19d6-4a7e-944f-9f9f529f5e4a',NULL,NULL,'2026-10-11 20:26:54'),
(24,'MVT-0024','2024-02-10 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,7.800,'lots_presse',14,'33bcc2e1-a3d8-4828-a1f5-8e7975ed04fe',NULL,NULL,'2026-10-11 20:26:54'),
(25,'MVT-0025','2024-02-10 00:00:00','PRODUCTION','ENTREE',2,14,NULL,NULL,NULL,NULL,0.290,'lots_presse',14,'33bcc2e1-a3d8-4828-a1f5-8e7975ed04fe',NULL,NULL,'2026-10-11 20:26:54'),
(26,'MVT-0026','2024-02-11 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',15,'b201691a-9e30-481a-aef4-4c3802ca7bce',NULL,NULL,'2026-10-11 20:26:54'),
(27,'MVT-0027','2024-02-11 00:00:00','PRODUCTION','ENTREE',2,15,NULL,NULL,NULL,NULL,1.090,'lots_presse',15,'b201691a-9e30-481a-aef4-4c3802ca7bce',NULL,NULL,'2026-10-11 20:26:54'),
(28,'MVT-0028','2024-02-17 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',16,'ef0d15ba-e0e4-4e44-a27a-96e8f5c983a0',NULL,NULL,'2026-10-11 20:26:54'),
(29,'MVT-0029','2024-02-17 00:00:00','PRODUCTION','ENTREE',2,16,NULL,NULL,NULL,NULL,1.090,'lots_presse',16,'ef0d15ba-e0e4-4e44-a27a-96e8f5c983a0',NULL,NULL,'2026-10-11 20:26:54'),
(30,'MVT-0030','2024-03-18 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',17,'f2da6982-8d0c-4717-b306-f60c1fff0fc6',NULL,NULL,'2026-10-11 20:26:54'),
(31,'MVT-0031','2024-03-18 00:00:00','PRODUCTION','ENTREE',2,17,NULL,NULL,NULL,NULL,1.000,'lots_presse',17,'f2da6982-8d0c-4717-b306-f60c1fff0fc6',NULL,NULL,'2026-10-11 20:26:54'),
(32,'MVT-0032','2024-03-19 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',18,'f0740478-72a0-4f13-8120-a48f7a9fe635',NULL,NULL,'2026-10-11 20:26:54'),
(33,'MVT-0033','2024-03-19 00:00:00','PRODUCTION','ENTREE',2,18,NULL,NULL,NULL,NULL,1.000,'lots_presse',18,'f0740478-72a0-4f13-8120-a48f7a9fe635',NULL,NULL,'2026-10-11 20:26:54'),
(34,'MVT-0034','2024-03-20 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,7.800,'lots_presse',19,'d8a4e701-a1db-40fb-bd46-892167fe1f1f',NULL,NULL,'2026-10-11 20:26:54'),
(35,'MVT-0035','2024-03-20 00:00:00','PRODUCTION','ENTREE',2,19,NULL,NULL,NULL,NULL,0.300,'lots_presse',19,'d8a4e701-a1db-40fb-bd46-892167fe1f1f',NULL,NULL,'2026-10-11 20:26:54'),
(36,'MVT-0036','2024-03-20 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,21.000,'lots_presse',20,'2357e5a5-8cea-4fa7-b250-4b4338d0dcec',NULL,NULL,'2026-10-11 20:26:54'),
(37,'MVT-0037','2024-03-20 00:00:00','PRODUCTION','ENTREE',2,20,NULL,NULL,NULL,NULL,0.700,'lots_presse',20,'2357e5a5-8cea-4fa7-b250-4b4338d0dcec',NULL,NULL,'2026-10-11 20:26:54'),
(38,'MVT-0038','2024-03-21 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',21,'7647d28c-40ec-4317-a844-53f8ba563c45',NULL,NULL,'2026-10-11 20:26:54'),
(39,'MVT-0039','2024-03-21 00:00:00','PRODUCTION','ENTREE',2,21,NULL,NULL,NULL,NULL,1.000,'lots_presse',21,'7647d28c-40ec-4317-a844-53f8ba563c45',NULL,NULL,'2026-10-11 20:26:54'),
(40,'MVT-0040','2024-03-21 00:00:00','CONSOMMATION','SORTIE',2,21,NULL,NULL,NULL,NULL,1.000,'lots_filtration',3,'0c5f14b7-65cc-42b7-9289-83564c80a48b',NULL,NULL,'2026-10-11 20:26:54'),
(41,'MVT-0041','2024-03-21 00:00:00','PRODUCTION','ENTREE',3,22,NULL,NULL,NULL,NULL,0.830,'lots_filtration',3,'0c5f14b7-65cc-42b7-9289-83564c80a48b',NULL,NULL,'2026-10-11 20:26:54'),
(42,'MVT-0042','2024-03-23 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',23,'9334011b-d93a-4abb-853b-5fc277acbe00',NULL,NULL,'2026-10-11 20:26:54'),
(43,'MVT-0043','2024-03-23 00:00:00','PRODUCTION','ENTREE',2,23,NULL,NULL,NULL,NULL,1.000,'lots_presse',23,'9334011b-d93a-4abb-853b-5fc277acbe00',NULL,NULL,'2026-10-11 20:26:54'),
(44,'MVT-0044','2024-03-24 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',24,'98ae0042-7fac-4425-ad23-fa8bc68a9db1',NULL,NULL,'2026-10-11 20:26:54'),
(45,'MVT-0045','2024-03-24 00:00:00','PRODUCTION','ENTREE',2,24,NULL,NULL,NULL,NULL,1.000,'lots_presse',24,'98ae0042-7fac-4425-ad23-fa8bc68a9db1',NULL,NULL,'2026-10-11 20:26:54'),
(46,'MVT-0046','2024-03-25 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',25,'7058811f-0fcb-4b2d-a379-64b197c89c49',NULL,NULL,'2026-10-11 20:26:54'),
(47,'MVT-0047','2024-03-25 00:00:00','PRODUCTION','ENTREE',2,25,NULL,NULL,NULL,NULL,1.000,'lots_presse',25,'7058811f-0fcb-4b2d-a379-64b197c89c49',NULL,NULL,'2026-10-11 20:26:54'),
(48,'MVT-0048','2024-03-25 00:00:00','CONSOMMATION','SORTIE',2,25,NULL,NULL,NULL,NULL,1.000,'lots_filtration',4,'366a3859-b603-45d6-b75d-5834c3e5fa63',NULL,NULL,'2026-10-11 20:26:54'),
(49,'MVT-0049','2024-03-25 00:00:00','PRODUCTION','ENTREE',3,26,NULL,NULL,NULL,NULL,0.900,'lots_filtration',4,'366a3859-b603-45d6-b75d-5834c3e5fa63',NULL,NULL,'2026-10-11 20:26:54'),
(50,'MVT-0050','2024-03-26 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',27,'298e9ca6-ed01-4c14-a59f-7ef2ed8a9852',NULL,NULL,'2026-10-11 20:26:54'),
(51,'MVT-0051','2024-03-26 00:00:00','PRODUCTION','ENTREE',2,27,NULL,NULL,NULL,NULL,1.000,'lots_presse',27,'298e9ca6-ed01-4c14-a59f-7ef2ed8a9852',NULL,NULL,'2026-10-11 20:26:54'),
(52,'MVT-0052','2024-03-27 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',28,'86e6214e-f2fe-4761-bd3d-a230feeb89bb',NULL,NULL,'2026-10-11 20:26:54'),
(53,'MVT-0053','2024-03-27 00:00:00','PRODUCTION','ENTREE',2,28,NULL,NULL,NULL,NULL,1.080,'lots_presse',28,'86e6214e-f2fe-4761-bd3d-a230feeb89bb',NULL,NULL,'2026-10-11 20:26:54'),
(54,'MVT-0054','2024-03-28 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',29,'76346bef-d0c8-4a6b-9589-5ce9d7f51cd0',NULL,NULL,'2026-10-11 20:26:54'),
(55,'MVT-0055','2024-03-28 00:00:00','PRODUCTION','ENTREE',2,29,NULL,NULL,NULL,NULL,1.040,'lots_presse',29,'76346bef-d0c8-4a6b-9589-5ce9d7f51cd0',NULL,NULL,'2026-10-11 20:26:54'),
(56,'MVT-0056','2024-03-29 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',30,'ccd88e28-3d37-4c33-9135-4cf36f9787b4',NULL,NULL,'2026-10-11 20:26:54'),
(57,'MVT-0057','2024-03-29 00:00:00','PRODUCTION','ENTREE',2,30,NULL,NULL,NULL,NULL,0.800,'lots_presse',30,'ccd88e28-3d37-4c33-9135-4cf36f9787b4',NULL,NULL,'2026-10-11 20:26:54'),
(58,'MVT-0058','2024-03-31 00:00:00','RECEPTION','ENTREE',1,31,NULL,NULL,NULL,NULL,200.000,'reception_registre',31,'d43c0473-594d-4686-b909-c407d413a852',NULL,NULL,'2026-10-11 20:26:54'),
(59,'MVT-0059','2024-03-31 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',32,'e74b8bec-e511-4c27-8f17-fb73844efacd',NULL,NULL,'2026-10-11 20:26:54'),
(60,'MVT-0060','2024-03-31 00:00:00','PRODUCTION','ENTREE',2,32,NULL,NULL,NULL,NULL,1.100,'lots_presse',32,'e74b8bec-e511-4c27-8f17-fb73844efacd',NULL,NULL,'2026-10-11 20:26:54'),
(61,'MVT-0061','2024-03-31 00:00:00','CONSOMMATION','SORTIE',2,32,NULL,NULL,NULL,NULL,1.100,'lots_filtration',5,'e256d5c6-ad92-4e2e-b332-98211c4c51fc',NULL,NULL,'2026-10-11 20:26:54'),
(62,'MVT-0062','2024-03-31 00:00:00','PRODUCTION','ENTREE',3,33,NULL,NULL,NULL,NULL,0.960,'lots_filtration',5,'e256d5c6-ad92-4e2e-b332-98211c4c51fc',NULL,NULL,'2026-10-11 20:26:54'),
(63,'MVT-0063','2024-04-07 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',34,'52d57d4d-5221-4ad5-8287-97b9f8189650',NULL,NULL,'2026-10-11 20:26:54'),
(64,'MVT-0064','2024-04-07 00:00:00','PRODUCTION','ENTREE',2,34,NULL,NULL,NULL,NULL,1.200,'lots_presse',34,'52d57d4d-5221-4ad5-8287-97b9f8189650',NULL,NULL,'2026-10-11 20:26:54'),
(65,'MVT-0065','2024-04-07 00:00:00','CONSOMMATION','SORTIE',2,34,NULL,NULL,NULL,NULL,1.200,'lots_filtration',6,'8142ffde-28a0-44a1-9efb-894fd3040b48',NULL,NULL,'2026-10-11 20:26:54'),
(66,'MVT-0066','2024-04-07 00:00:00','PRODUCTION','ENTREE',3,35,NULL,NULL,NULL,NULL,1.020,'lots_filtration',6,'8142ffde-28a0-44a1-9efb-894fd3040b48',NULL,NULL,'2026-10-11 20:26:54'),
(67,'MVT-0067','2024-04-27 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',36,'60d6cb5a-005e-4286-9579-b67463bf16ea',NULL,NULL,'2026-10-11 20:26:54'),
(68,'MVT-0068','2024-04-27 00:00:00','PRODUCTION','ENTREE',2,36,NULL,NULL,NULL,NULL,1.000,'lots_presse',36,'60d6cb5a-005e-4286-9579-b67463bf16ea',NULL,NULL,'2026-10-11 20:26:54'),
(69,'MVT-0069','2024-04-27 00:00:00','CONSOMMATION','SORTIE',2,36,NULL,NULL,NULL,NULL,1.000,'lots_filtration',7,'651b3e59-2347-4f8c-870f-a5b72cee9aa5',NULL,NULL,'2026-10-11 20:26:54'),
(70,'MVT-0070','2024-04-27 00:00:00','PRODUCTION','ENTREE',3,37,NULL,NULL,NULL,NULL,0.820,'lots_filtration',7,'651b3e59-2347-4f8c-870f-a5b72cee9aa5',NULL,NULL,'2026-10-11 20:26:54'),
(71,'MVT-0071','2024-04-28 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',38,'092e2925-1a03-40d7-bbf1-b77f370c1d2d',NULL,NULL,'2026-10-11 20:26:54'),
(72,'MVT-0072','2024-04-28 00:00:00','PRODUCTION','ENTREE',2,38,NULL,NULL,NULL,NULL,0.900,'lots_presse',38,'092e2925-1a03-40d7-bbf1-b77f370c1d2d',NULL,NULL,'2026-10-11 20:26:54'),
(73,'MVT-0073','2024-05-05 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',39,'a8603ff4-24f0-4efa-9d73-e26f507fb305',NULL,NULL,'2026-10-11 20:26:54'),
(74,'MVT-0074','2024-05-05 00:00:00','PRODUCTION','ENTREE',2,39,NULL,NULL,NULL,NULL,0.950,'lots_presse',39,'a8603ff4-24f0-4efa-9d73-e26f507fb305',NULL,NULL,'2026-10-11 20:26:54'),
(75,'MVT-0075','2024-05-05 00:00:00','CONSOMMATION','SORTIE',2,39,NULL,NULL,NULL,NULL,0.950,'lots_filtration',8,'e9c47718-b946-4574-81f5-c5336f8aa2c2',NULL,NULL,'2026-10-11 20:26:54'),
(76,'MVT-0076','2024-05-05 00:00:00','PRODUCTION','ENTREE',3,40,NULL,NULL,NULL,NULL,0.710,'lots_filtration',8,'e9c47718-b946-4574-81f5-c5336f8aa2c2',NULL,NULL,'2026-10-11 20:26:54'),
(77,'MVT-0077','2024-05-06 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,20.000,'lots_presse',41,'ec92d0ae-888a-42b1-94d1-ce724d2dd1de',NULL,NULL,'2026-10-11 20:26:54'),
(78,'MVT-0078','2024-05-06 00:00:00','PRODUCTION','ENTREE',2,41,NULL,NULL,NULL,NULL,0.730,'lots_presse',41,'ec92d0ae-888a-42b1-94d1-ce724d2dd1de',NULL,NULL,'2026-10-11 20:26:54'),
(79,'MVT-0079','2024-05-06 00:00:00','CONSOMMATION','SORTIE',2,41,NULL,NULL,NULL,NULL,0.730,'lots_filtration',9,'830aeaa2-c392-4eec-a5b0-97ecbb412eb0',NULL,NULL,'2026-10-11 20:26:54'),
(80,'MVT-0080','2024-05-06 00:00:00','PRODUCTION','ENTREE',3,42,NULL,NULL,NULL,NULL,0.595,'lots_filtration',9,'830aeaa2-c392-4eec-a5b0-97ecbb412eb0',NULL,NULL,'2026-10-11 20:26:54'),
(81,'MVT-0081','2024-07-02 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',43,'5f1bbd32-81fd-4586-bfbd-96f08981d0d1',NULL,NULL,'2026-10-11 20:26:54'),
(82,'MVT-0082','2024-07-02 00:00:00','PRODUCTION','ENTREE',2,43,NULL,NULL,NULL,NULL,0.900,'lots_presse',43,'5f1bbd32-81fd-4586-bfbd-96f08981d0d1',NULL,NULL,'2026-10-11 20:26:54'),
(83,'MVT-0083','2024-07-11 00:00:00','CONSOMMATION','SORTIE',2,43,NULL,NULL,NULL,NULL,0.900,'lots_filtration',10,'5224ad93-1666-463e-9276-241651b41173',NULL,NULL,'2026-10-11 20:26:54'),
(84,'MVT-0084','2024-07-11 00:00:00','PRODUCTION','ENTREE',3,44,NULL,NULL,NULL,NULL,0.800,'lots_filtration',10,'5224ad93-1666-463e-9276-241651b41173',NULL,NULL,'2026-10-11 20:26:54'),
(85,'MVT-0085-OUT-filtration-5','2024-09-22 00:00:00','CONSOMMATION','SORTIE',3,33,NULL,NULL,NULL,NULL,0.400,'conditionnement',1,'573642ec-ef12-4eee-8168-515907e31144',NULL,NULL,'2026-10-11 20:26:54'),
(86,'MVT-0085-OUT-filtration-4','2024-09-22 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.400,'conditionnement',1,'573642ec-ef12-4eee-8168-515907e31144',NULL,NULL,'2026-10-11 20:26:54'),
(87,'MVT-0085-IN','2024-09-22 00:00:00','CONDITIONNEMENT','ENTREE',4,45,NULL,NULL,NULL,NULL,80.000,'conditionnement',1,'573642ec-ef12-4eee-8168-515907e31144',NULL,NULL,'2026-10-11 20:26:54'),
(88,'MVT-0086-OUT-filtration-7','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.105,'conditionnement',2,'95a4c5f5-aca4-4eba-8e3f-7995de37b11f',NULL,NULL,'2026-10-11 20:26:54'),
(89,'MVT-0086-OUT-filtration-4','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.105,'conditionnement',2,'95a4c5f5-aca4-4eba-8e3f-7995de37b11f',NULL,NULL,'2026-10-11 20:26:54'),
(90,'MVT-0086-IN','2024-09-23 00:00:00','CONDITIONNEMENT','ENTREE',4,46,NULL,NULL,NULL,NULL,21.000,'conditionnement',2,'95a4c5f5-aca4-4eba-8e3f-7995de37b11f',NULL,NULL,'2026-10-11 20:26:54'),
(91,'MVT-0087-OUT-filtration-7','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.285,'conditionnement',3,'c88032ba-027c-41a4-a577-6d45327ae9f0',NULL,NULL,'2026-10-11 20:26:54'),
(92,'MVT-0087-OUT-filtration-4','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.285,'conditionnement',3,'c88032ba-027c-41a4-a577-6d45327ae9f0',NULL,NULL,'2026-10-11 20:26:54'),
(93,'MVT-0087-IN','2024-09-23 00:00:00','CONDITIONNEMENT','ENTREE',5,47,NULL,NULL,NULL,NULL,19.000,'conditionnement',3,'c88032ba-027c-41a4-a577-6d45327ae9f0',NULL,NULL,'2026-10-11 20:26:54'),
(94,'MVT-0088-OUT-filtration-7','2024-09-24 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.010,'conditionnement',4,'f09bf7df-c589-4602-a59c-2ab2ff8fae41',NULL,NULL,'2026-10-11 20:26:54'),
(95,'MVT-0088-OUT-filtration-4','2024-09-24 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.010,'conditionnement',4,'f09bf7df-c589-4602-a59c-2ab2ff8fae41',NULL,NULL,'2026-10-11 20:26:54'),
(96,'MVT-0088-IN','2024-09-24 00:00:00','CONDITIONNEMENT','ENTREE',4,46,NULL,NULL,NULL,NULL,2.000,'conditionnement',4,'f09bf7df-c589-4602-a59c-2ab2ff8fae41',NULL,NULL,'2026-10-11 20:26:54'),
(97,'MVT-0089','2024-10-09 00:00:00','CONSOMMATION','SORTIE',2,5,NULL,NULL,NULL,NULL,0.600,'lots_filtration',11,'18f78a9c-3ec7-4d91-a018-03ce3847dc60',NULL,NULL,'2026-10-11 20:26:54'),
(98,'MVT-0090','2024-10-09 00:00:00','PRODUCTION','ENTREE',3,48,NULL,NULL,NULL,NULL,0.490,'lots_filtration',11,'18f78a9c-3ec7-4d91-a018-03ce3847dc60',NULL,NULL,'2026-10-11 20:26:54'),
(99,'MVT-0091','2024-11-05 00:00:00','CONSOMMATION','SORTIE',2,13,NULL,NULL,NULL,NULL,0.030,'lots_filtration',12,'83c547d0-97fb-4f90-84e7-09e296307f00',NULL,NULL,'2026-10-11 20:26:54'),
(100,'MVT-0092','2024-11-05 00:00:00','PRODUCTION','ENTREE',3,49,NULL,NULL,NULL,NULL,0.028,'lots_filtration',12,'83c547d0-97fb-4f90-84e7-09e296307f00',NULL,NULL,'2026-10-11 20:26:54'),
(101,'MVT-0093','2024-11-05 00:00:00','CONSOMMATION','SORTIE',2,14,NULL,NULL,NULL,NULL,0.030,'lots_filtration',13,'5c0012ac-a209-4a8c-94f6-627470d225ec',NULL,NULL,'2026-10-11 20:26:54'),
(102,'MVT-0094','2024-11-05 00:00:00','PRODUCTION','ENTREE',3,50,NULL,NULL,NULL,NULL,0.027,'lots_filtration',13,'5c0012ac-a209-4a8c-94f6-627470d225ec',NULL,NULL,'2026-10-11 20:26:54'),
(103,'MVT-0095','2025-01-15 00:00:00','CONSOMMATION','SORTIE',2,6,NULL,NULL,NULL,NULL,0.400,'lots_filtration',14,'cecf2848-366e-4b3b-b32d-8258aedf2e98',NULL,NULL,'2026-10-11 20:26:54'),
(104,'MVT-0096','2025-01-15 00:00:00','PRODUCTION','ENTREE',3,51,NULL,NULL,NULL,NULL,0.340,'lots_filtration',14,'cecf2848-366e-4b3b-b32d-8258aedf2e98',NULL,NULL,'2026-10-11 20:26:54'),
(105,'MVT-0097-OUT-filtration-7','2025-01-15 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.420,'conditionnement',5,'9f861fb8-916c-46d0-9afb-df4811a04889',NULL,NULL,'2026-10-11 20:26:54'),
(106,'MVT-0097-OUT-filtration-2','2025-01-15 00:00:00','CONSOMMATION','SORTIE',3,9,NULL,NULL,NULL,NULL,0.420,'conditionnement',5,'9f861fb8-916c-46d0-9afb-df4811a04889',NULL,NULL,'2026-10-11 20:26:54'),
(107,'MVT-0097-IN','2025-01-15 00:00:00','CONDITIONNEMENT','ENTREE',5,52,NULL,NULL,NULL,NULL,28.000,'conditionnement',5,'9f861fb8-916c-46d0-9afb-df4811a04889',NULL,NULL,'2026-10-11 20:26:54'),
(108,'MVT-0098','2025-01-22 00:00:00','CONSOMMATION','SORTIE',2,14,NULL,NULL,NULL,NULL,0.191,'lots_filtration',15,'d44c0325-ab3b-4c62-a784-d9cb80a42a81',NULL,NULL,'2026-10-11 20:26:54'),
(109,'MVT-0099','2025-01-22 00:00:00','PRODUCTION','ENTREE',3,53,NULL,NULL,NULL,NULL,0.171,'lots_filtration',15,'d44c0325-ab3b-4c62-a784-d9cb80a42a81',NULL,NULL,'2026-10-11 20:26:54'),
(110,'MVT-0100','2025-01-23 00:00:00','CONSOMMATION','SORTIE',2,13,NULL,NULL,NULL,NULL,0.690,'lots_filtration',16,'515498b2-0116-4681-8e7a-eb8886e0df1e',NULL,NULL,'2026-10-11 20:26:54'),
(111,'MVT-0101','2025-01-23 00:00:00','PRODUCTION','ENTREE',3,54,NULL,NULL,NULL,NULL,0.581,'lots_filtration',16,'515498b2-0116-4681-8e7a-eb8886e0df1e',NULL,NULL,'2026-10-11 20:26:54'),
(112,'MVT-0102-OUT-filtration-4','2025-04-03 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.100,'conditionnement',6,'0e48dd8e-9f24-49ff-872a-dc7f54181e1c',NULL,NULL,'2026-10-11 20:26:54'),
(113,'MVT-0102-OUT-filtration-14','2025-04-03 00:00:00','CONSOMMATION','SORTIE',3,51,NULL,NULL,NULL,NULL,0.110,'conditionnement',6,'0e48dd8e-9f24-49ff-872a-dc7f54181e1c',NULL,NULL,'2026-10-11 20:26:54'),
(114,'MVT-0102-IN','2025-04-03 00:00:00','CONDITIONNEMENT','ENTREE',5,55,NULL,NULL,NULL,NULL,7.000,'conditionnement',6,'0e48dd8e-9f24-49ff-872a-dc7f54181e1c',NULL,NULL,'2026-10-11 20:26:54'),
(115,'MVT-0103-OUT-filtration-2','2025-04-10 00:00:00','CONSOMMATION','SORTIE',3,9,NULL,NULL,NULL,NULL,0.470,'conditionnement',7,'942446a3-2eff-462a-9dcd-f74f40dc2bc8',NULL,NULL,'2026-10-11 20:26:54'),
(116,'MVT-0103-OUT-filtration-11','2025-04-10 00:00:00','CONSOMMATION','SORTIE',3,48,NULL,NULL,NULL,NULL,0.490,'conditionnement',7,'942446a3-2eff-462a-9dcd-f74f40dc2bc8',NULL,NULL,'2026-10-11 20:26:54'),
(117,'MVT-0103-IN','2025-04-10 00:00:00','CONDITIONNEMENT','ENTREE',5,56,NULL,NULL,NULL,NULL,32.000,'conditionnement',7,'942446a3-2eff-462a-9dcd-f74f40dc2bc8',NULL,NULL,'2026-10-11 20:26:54'),
(118,'MVT-0104-OUT-filtration-14','2025-04-15 00:00:00','CONSOMMATION','SORTIE',3,51,NULL,NULL,NULL,NULL,0.230,'conditionnement',8,'3a62cee0-dea1-4396-924c-636af7095b0c',NULL,NULL,'2026-10-11 20:26:54'),
(119,'MVT-0104-OUT-filtration-6','2025-04-15 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.190,'conditionnement',8,'3a62cee0-dea1-4396-924c-636af7095b0c',NULL,NULL,'2026-10-11 20:26:54'),
(120,'MVT-0104-IN','2025-04-15 00:00:00','CONDITIONNEMENT','ENTREE',5,57,NULL,NULL,NULL,NULL,14.000,'conditionnement',8,'3a62cee0-dea1-4396-924c-636af7095b0c',NULL,NULL,'2026-10-11 20:26:54'),
(121,'MVT-0105-OUT-filtration-6','2025-05-04 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.060,'conditionnement',9,'29f91fbf-bed5-453f-b95a-7c9ec7859158',NULL,NULL,'2026-10-11 20:26:54'),
(122,'MVT-0105-OUT-filtration-3','2025-05-04 00:00:00','CONSOMMATION','SORTIE',3,22,NULL,NULL,NULL,NULL,0.060,'conditionnement',9,'29f91fbf-bed5-453f-b95a-7c9ec7859158',NULL,NULL,'2026-10-11 20:26:54'),
(123,'MVT-0105-IN','2025-05-04 00:00:00','CONDITIONNEMENT','ENTREE',5,58,NULL,NULL,NULL,NULL,4.000,'conditionnement',9,'29f91fbf-bed5-453f-b95a-7c9ec7859158',NULL,NULL,'2026-10-11 20:26:54'),
(124,'MVT-0106','2025-05-04 00:00:00','VENTE','SORTIE',5,58,NULL,NULL,NULL,NULL,4.000,'commande',1,NULL,'Vente registre n° — · client non renseigné · sortie du registre mélange (04/05/2025), absente du registre des ventes',NULL,'2026-10-11 20:26:54'),
(125,'MVT-0107','2025-06-10 00:00:00','VENTE','SORTIE',5,52,NULL,NULL,NULL,NULL,22.000,'commande',2,NULL,'Vente registre n° 3 · client : Gisel · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(126,'MVT-0108','2025-06-10 00:00:00','VENTE','SORTIE',5,56,NULL,NULL,NULL,NULL,3.000,'commande',2,NULL,'Vente registre n° 3 · client : Gisel · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(127,'MVT-0109','2025-07-10 00:00:00','VENTE','SORTIE',4,46,NULL,NULL,NULL,NULL,2.000,'commande',3,NULL,'Vente registre n° 2 · client : Client particulier · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(128,'MVT-0110-OUT-filtration-6','2025-08-05 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.100,'conditionnement',10,'d11db408-0dd2-4f54-b42c-c077444111f6',NULL,NULL,'2026-10-11 20:26:54'),
(129,'MVT-0110-OUT-filtration-3','2025-08-05 00:00:00','CONSOMMATION','SORTIE',3,22,NULL,NULL,NULL,NULL,0.100,'conditionnement',10,'d11db408-0dd2-4f54-b42c-c077444111f6',NULL,NULL,'2026-10-11 20:26:54'),
(130,'MVT-0110-IN','2025-08-05 00:00:00','CONDITIONNEMENT','ENTREE',4,59,NULL,NULL,NULL,NULL,20.000,'conditionnement',10,'d11db408-0dd2-4f54-b42c-c077444111f6',NULL,NULL,'2026-10-11 20:26:54'),
(131,'MVT-0111','2025-08-14 00:00:00','VENTE','SORTIE',5,47,NULL,NULL,NULL,NULL,19.000,'commande',4,NULL,'Vente registre n° 1 · client : Berntrard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(132,'MVT-0112','2025-08-14 00:00:00','VENTE','SORTIE',5,52,NULL,NULL,NULL,NULL,6.000,'commande',4,NULL,'Vente registre n° 1 · client : Berntrard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(133,'MVT-0113','2025-08-14 00:00:00','VENTE','SORTIE',5,56,NULL,NULL,NULL,NULL,25.000,'commande',5,NULL,'Vente registre n° 4 · client : louccy · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(134,'MVT-0114','2025-08-14 00:00:00','VENTE','SORTIE',5,55,NULL,NULL,NULL,NULL,7.000,'commande',6,NULL,'Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(135,'MVT-0115','2025-08-14 00:00:00','VENTE','SORTIE',5,56,NULL,NULL,NULL,NULL,4.000,'commande',6,NULL,'Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(136,'MVT-0116','2025-08-14 00:00:00','VENTE','SORTIE',5,57,NULL,NULL,NULL,NULL,14.000,'commande',6,NULL,'Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(137,'MVT-0117','2025-08-19 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,20.000,'commande',7,NULL,'Vente registre n° 6 · client : client Passage · paiement : espèces · livraison : Djerba · registre : « 6*30=180 + 2*10=20 » (200 ml) ; enregistré en 20 flacons de 10 ml (le lot n\'a que 4 flacons de 30 ml, déjà sortis le 04/05)',NULL,'2026-10-11 20:26:54'),
(138,'MVT-0118','2025-09-06 00:00:00','VENTE','SORTIE',4,45,NULL,NULL,NULL,NULL,20.000,'commande',8,NULL,'Vente registre n° 7 · client : ben abdesslem · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(139,'MVT-0119','2025-09-10 00:00:00','VENTE','SORTIE',4,45,NULL,NULL,NULL,NULL,30.000,'commande',9,NULL,'Vente registre n° 8 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(140,'MVT-0120','2025-09-15 00:00:00','VENTE','SORTIE',4,45,NULL,NULL,NULL,NULL,30.000,'commande',10,NULL,'Vente registre n° 9 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(141,'MVT-0121','2025-10-20 00:00:00','CONSOMMATION','SORTIE',2,7,NULL,NULL,NULL,NULL,1.000,'lots_filtration',17,'2876c95f-96d2-4d55-ba6f-0ab4548b176b',NULL,NULL,'2026-10-11 20:26:54'),
(142,'MVT-0122','2025-10-20 00:00:00','PRODUCTION','ENTREE',3,60,NULL,NULL,NULL,NULL,0.907,'lots_filtration',17,'2876c95f-96d2-4d55-ba6f-0ab4548b176b',NULL,NULL,'2026-10-11 20:26:54'),
(143,'MVT-0123','2025-10-21 00:00:00','CONSOMMATION','SORTIE',2,15,NULL,NULL,NULL,NULL,1.090,'lots_filtration',18,'10ec7695-cbf4-4970-a4d4-a9aac7a4de55',NULL,NULL,'2026-10-11 20:26:54'),
(144,'MVT-0124','2025-10-21 00:00:00','PRODUCTION','ENTREE',3,61,NULL,NULL,NULL,NULL,0.977,'lots_filtration',18,'10ec7695-cbf4-4970-a4d4-a9aac7a4de55',NULL,NULL,'2026-10-11 20:26:54'),
(145,'MVT-0125','2025-10-23 00:00:00','CONSOMMATION','SORTIE',2,17,NULL,NULL,NULL,NULL,1.000,'lots_filtration',19,'a6f6fca3-ac53-457d-849c-35e3d92bbcae',NULL,NULL,'2026-10-11 20:26:54'),
(146,'MVT-0126','2025-10-23 00:00:00','PRODUCTION','ENTREE',3,62,NULL,NULL,NULL,NULL,0.879,'lots_filtration',19,'a6f6fca3-ac53-457d-849c-35e3d92bbcae',NULL,NULL,'2026-10-11 20:26:54'),
(147,'MVT-0127','2025-10-26 00:00:00','CONSOMMATION','SORTIE',2,27,NULL,NULL,NULL,NULL,1.000,'lots_filtration',20,'a80ecb83-1444-466b-8167-ad765afd526d',NULL,NULL,'2026-10-11 20:26:54'),
(148,'MVT-0128','2025-10-26 00:00:00','PRODUCTION','ENTREE',3,63,NULL,NULL,NULL,NULL,0.911,'lots_filtration',20,'a80ecb83-1444-466b-8167-ad765afd526d',NULL,NULL,'2026-10-11 20:26:54'),
(149,'MVT-0129','2025-10-28 00:00:00','CONSOMMATION','SORTIE',2,28,NULL,NULL,NULL,NULL,1.080,'lots_filtration',21,'ff440346-4201-43eb-8537-e1ad564011cd',NULL,NULL,'2026-10-11 20:26:54'),
(150,'MVT-0130','2025-10-28 00:00:00','PRODUCTION','ENTREE',3,64,NULL,NULL,NULL,NULL,0.988,'lots_filtration',21,'ff440346-4201-43eb-8537-e1ad564011cd',NULL,NULL,'2026-10-11 20:26:54'),
(151,'MVT-0131','2025-11-03 00:00:00','CONSOMMATION','SORTIE',2,16,NULL,NULL,NULL,NULL,1.090,'lots_filtration',22,'b380addb-0e79-47a9-b844-09322b0d06fb',NULL,NULL,'2026-10-11 20:26:54'),
(152,'MVT-0132','2025-11-03 00:00:00','PRODUCTION','ENTREE',3,65,NULL,NULL,NULL,NULL,0.872,'lots_filtration',22,'b380addb-0e79-47a9-b844-09322b0d06fb',NULL,NULL,'2026-10-11 20:26:54'),
(153,'MVT-0133','2025-11-05 00:00:00','CONSOMMATION','SORTIE',2,10,NULL,NULL,NULL,NULL,0.750,'lots_filtration',23,'09bd6fe4-1f10-4bf8-aa15-503165bfa5a6',NULL,NULL,'2026-10-11 20:26:54'),
(154,'MVT-0134','2025-11-05 00:00:00','PRODUCTION','ENTREE',3,66,NULL,NULL,NULL,NULL,0.610,'lots_filtration',23,'09bd6fe4-1f10-4bf8-aa15-503165bfa5a6',NULL,NULL,'2026-10-11 20:26:54'),
(155,'MVT-0135','2025-11-15 00:00:00','VENTE','SORTIE',4,46,NULL,NULL,NULL,NULL,21.000,'commande',11,NULL,'Vente registre n° 10 · client : louccy · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(156,'MVT-0136-OUT-filtration-6','2026-01-01 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.670,'conditionnement',11,'b878870d-3605-45b0-ac3a-6f1a6843c675',NULL,NULL,'2026-10-11 20:26:54'),
(157,'MVT-0136-OUT-filtration-3','2026-01-01 00:00:00','CONSOMMATION','SORTIE',3,22,NULL,NULL,NULL,NULL,0.670,'conditionnement',11,'b878870d-3605-45b0-ac3a-6f1a6843c675',NULL,NULL,'2026-10-11 20:26:54'),
(158,'MVT-0136-IN','2026-01-01 00:00:00','CONDITIONNEMENT','ENTREE',4,59,NULL,NULL,NULL,NULL,134.000,'conditionnement',11,'b878870d-3605-45b0-ac3a-6f1a6843c675',NULL,NULL,'2026-10-11 20:26:54'),
(159,'MVT-0137','2026-01-09 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,30.000,'commande',12,NULL,'Vente registre n° 11 · client : ben abdesslem · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(160,'MVT-0138','2026-01-16 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,50.000,'commande',13,NULL,'Vente registre n° 12 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(161,'MVT-0139','2026-01-26 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,21.000,'commande',14,NULL,'Vente registre n° 13 · client : Relax and spay · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(162,'MVT-0140-OUT-filtration-15','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.068,'conditionnement',12,'3654b6b6-3994-41af-99cb-70799a3e94c1',NULL,NULL,'2026-10-11 20:26:54'),
(163,'MVT-0140-OUT-filtration-16','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.232,'conditionnement',12,'3654b6b6-3994-41af-99cb-70799a3e94c1',NULL,NULL,'2026-10-11 20:26:54'),
(164,'MVT-0140-IN','2026-02-01 00:00:00','CONDITIONNEMENT','ENTREE',5,67,NULL,NULL,NULL,NULL,10.000,'conditionnement',12,'3654b6b6-3994-41af-99cb-70799a3e94c1',NULL,NULL,'2026-10-11 20:26:54'),
(165,'MVT-0141-OUT-filtration-15','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.018,'conditionnement',13,'fa4d44e4-af19-4022-8b8a-9037aa369f35',NULL,NULL,'2026-10-11 20:26:54'),
(166,'MVT-0141-OUT-filtration-16','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.062,'conditionnement',13,'fa4d44e4-af19-4022-8b8a-9037aa369f35',NULL,NULL,'2026-10-11 20:26:54'),
(167,'MVT-0141-IN','2026-02-01 00:00:00','CONDITIONNEMENT','ENTREE',4,68,NULL,NULL,NULL,NULL,8.000,'conditionnement',13,'fa4d44e4-af19-4022-8b8a-9037aa369f35',NULL,NULL,'2026-10-11 20:26:54'),
(168,'MVT-0142','2026-02-18 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,20.000,'commande',15,NULL,'Vente registre n° 14 · client : biojerba · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(169,'MVT-0143','2026-02-19 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,13.000,'commande',16,NULL,'Vente registre n° 15 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(170,'MVT-0144','2026-02-21 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,3.000,'commande',17,NULL,'Vente registre n° 16 · client : client · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(171,'MVT-0145','2026-02-21 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,3.000,'commande',17,NULL,'Vente registre n° 16 · client : client · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(172,'MVT-0146','2026-02-23 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,4.000,'commande',18,NULL,'Vente registre n° 17 · client : bernard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(173,'MVT-0147','2026-02-23 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,4.000,'commande',18,NULL,'Vente registre n° 17 · client : bernard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(174,'MVT-0148','2026-03-14 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,3.000,'commande',19,NULL,'Vente registre n° 18 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(175,'MVT-0149','2026-03-14 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,1.000,'commande',19,NULL,'Vente registre n° 18 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(176,'MVT-0150-OUT-filtration-15','2026-04-07 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.041,'conditionnement',14,'b60cf231-165e-4cc5-9006-2b11b6208ba5',NULL,NULL,'2026-10-11 20:26:54'),
(177,'MVT-0150-OUT-filtration-16','2026-04-07 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.139,'conditionnement',14,'b60cf231-165e-4cc5-9006-2b11b6208ba5',NULL,NULL,'2026-10-11 20:26:54'),
(178,'MVT-0150-IN','2026-04-07 00:00:00','CONDITIONNEMENT','ENTREE',5,67,NULL,NULL,NULL,NULL,6.000,'conditionnement',14,'b60cf231-165e-4cc5-9006-2b11b6208ba5',NULL,NULL,'2026-10-11 20:26:54'),
(179,'MVT-0151-OUT-filtration-15','2026-04-08 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.044,'conditionnement',15,'4cf564e4-49fd-4740-bac1-6ccd57af38c9',NULL,NULL,'2026-10-11 20:26:54'),
(180,'MVT-0151-OUT-filtration-16','2026-04-08 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.148,'conditionnement',15,'4cf564e4-49fd-4740-bac1-6ccd57af38c9',NULL,NULL,'2026-10-11 20:26:54'),
(181,'MVT-0151-IN','2026-04-08 00:00:00','CONDITIONNEMENT','ENTREE',4,68,NULL,NULL,NULL,NULL,19.000,'conditionnement',15,'4cf564e4-49fd-4740-bac1-6ccd57af38c9',NULL,NULL,'2026-10-11 20:26:54'),
(182,'MVT-0152-OUT-filtration-13','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,50,NULL,NULL,NULL,NULL,0.015,'conditionnement',16,'7c8a209e-5d17-43cb-8d09-0497baf0387d',NULL,NULL,'2026-10-11 20:26:54'),
(183,'MVT-0152-OUT-filtration-12','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,49,NULL,NULL,NULL,NULL,0.015,'conditionnement',16,'7c8a209e-5d17-43cb-8d09-0497baf0387d',NULL,NULL,'2026-10-11 20:26:54'),
(184,'MVT-0152-IN','2026-05-09 00:00:00','CONDITIONNEMENT','ENTREE',5,69,NULL,NULL,NULL,NULL,1.000,'conditionnement',16,'7c8a209e-5d17-43cb-8d09-0497baf0387d',NULL,NULL,'2026-10-11 20:26:54'),
(185,'MVT-0153-OUT-filtration-13','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,50,NULL,NULL,NULL,NULL,0.012,'conditionnement',17,'5f1f0a31-4120-4cdb-9952-ca4aada9ec97',NULL,NULL,'2026-10-11 20:26:54'),
(186,'MVT-0153-OUT-filtration-12','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,49,NULL,NULL,NULL,NULL,0.013,'conditionnement',17,'5f1f0a31-4120-4cdb-9952-ca4aada9ec97',NULL,NULL,'2026-10-11 20:26:54'),
(187,'MVT-0153-IN','2026-05-09 00:00:00','CONDITIONNEMENT','ENTREE',4,70,NULL,NULL,NULL,NULL,2.000,'conditionnement',17,'5f1f0a31-4120-4cdb-9952-ca4aada9ec97',NULL,NULL,'2026-10-11 20:26:54'),
(188,'MVT-0154-OUT-filtration-1','2026-05-10 00:00:00','CONSOMMATION','SORTIE',3,3,NULL,NULL,NULL,NULL,0.433,'conditionnement',18,'059d01cf-29fb-4eca-9d60-51428cb78c3e',NULL,NULL,'2026-10-11 20:26:54'),
(189,'MVT-0154-OUT-filtration-23','2026-05-10 00:00:00','CONSOMMATION','SORTIE',3,66,NULL,NULL,NULL,NULL,0.347,'conditionnement',18,'059d01cf-29fb-4eca-9d60-51428cb78c3e',NULL,NULL,'2026-10-11 20:26:54'),
(190,'MVT-0154-IN','2026-05-10 00:00:00','CONDITIONNEMENT','ENTREE',5,71,NULL,NULL,NULL,NULL,26.000,'conditionnement',18,'059d01cf-29fb-4eca-9d60-51428cb78c3e',NULL,NULL,'2026-10-11 20:26:54'),
(191,'MVT-0155-OUT-filtration-1','2026-05-11 00:00:00','CONSOMMATION','SORTIE',3,3,NULL,NULL,NULL,NULL,0.327,'conditionnement',19,'8cb56fa5-cfd3-4457-967c-f618bff4b810',NULL,NULL,'2026-10-11 20:26:54'),
(192,'MVT-0155-OUT-filtration-23','2026-05-11 00:00:00','CONSOMMATION','SORTIE',3,66,NULL,NULL,NULL,NULL,0.263,'conditionnement',19,'8cb56fa5-cfd3-4457-967c-f618bff4b810',NULL,NULL,'2026-10-11 20:26:54'),
(193,'MVT-0155-IN','2026-05-11 00:00:00','CONDITIONNEMENT','ENTREE',4,72,NULL,NULL,NULL,NULL,59.000,'conditionnement',19,'8cb56fa5-cfd3-4457-967c-f618bff4b810',NULL,NULL,'2026-10-11 20:26:54'),
(194,'MVT-0156','2026-05-22 00:00:00','VENTE','SORTIE',5,69,NULL,NULL,NULL,NULL,1.000,'commande',20,NULL,'Vente registre n° 18 · client : client passaget · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(195,'MVT-0157','2026-05-22 00:00:00','VENTE','SORTIE',4,70,NULL,NULL,NULL,NULL,2.000,'commande',20,NULL,'Vente registre n° 18 · client : client passaget · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(196,'MVT-0158','2026-05-26 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,6.000,'commande',21,NULL,'Vente registre n° 18 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(197,'MVT-0159','2026-05-26 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,19.000,'commande',21,NULL,'Vente registre n° 18 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(198,'MVT-0160','2026-07-19 00:00:00','VENTE','SORTIE',5,71,NULL,NULL,NULL,NULL,26.000,'commande',22,NULL,'Vente registre n° 18 · client : passaget claude · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54'),
(199,'MVT-0161','2026-07-19 00:00:00','VENTE','SORTIE',4,72,NULL,NULL,NULL,NULL,59.000,'commande',22,NULL,'Vente registre n° 18 · client : passaget claude · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:26:54');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

REPLACE INTO `sequences` (`name`, `last_value`) VALUES ('bl_seq',22),
('commande_seq',22),
('facture_seq',22),
('lot_jj_fini_2024',3),
('lot_jj_fini_2025',9),
('lot_jj_fini_2026',10),
('lot_jj_presse',29),
('mouvement_seq',161),
('produit_code_seq',5);
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

COMMIT;
SET SQL_MODE=@OLD_SQL_MODE;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
DROP TEMPORARY TABLE _garde_import;
SELECT 'Import des registres terminé' AS resultat, (SELECT COUNT(*) FROM lots) AS lots, (SELECT COUNT(*) FROM stock_mouvements) AS mouvements;
