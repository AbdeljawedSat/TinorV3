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

INSERT INTO `produits` (`id`, `code`, `barcode`, `nom`, `description`, `categorie_id`, `unite_id`, `format_id`, `type_article`, `produit_source_id`, `vendable`, `achetable`, `fabriquable`, `stockable`, `actif`, `bio_eligible`, `prix_vente`, `cout_standard`, `stock_min`, `tva`, `notes`, `created_at`) VALUES (1,'01',NULL,'Pépins de figue de barbarie',NULL,6,3,NULL,'MATIERE_PREMIERE',NULL,0,1,0,1,1,1,NULL,NULL,NULL,19.00,NULL,'2026-10-11 20:24:28'),
(2,'02',NULL,'Huile de pépins de figue de barbarie — Vrac',NULL,1,1,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,1,NULL,NULL,NULL,19.00,NULL,'2026-10-11 20:24:28'),
(3,'03',NULL,'Huile de pépins de figue de barbarie — Filtrée',NULL,1,1,NULL,'PRODUIT_FABRIQUE',2,0,0,1,1,1,1,NULL,NULL,NULL,19.00,NULL,'2026-10-11 20:24:28'),
(4,'04',NULL,'Huile de pépins de figue de barbarie — Flacon 10ml',NULL,1,5,1,'PRODUIT_FABRIQUE',2,1,0,1,1,1,1,20.000,NULL,NULL,19.00,NULL,'2026-10-11 20:24:28'),
(5,'05',NULL,'Huile de pépins de figue de barbarie — Flacon 30ml',NULL,1,5,2,'PRODUIT_FABRIQUE',2,1,0,1,1,1,1,76.000,NULL,NULL,19.00,NULL,'2026-10-11 20:24:28');
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

INSERT INTO `clients` (`id`, `nom`, `tel`, `ville`, `matricule_fiscal`, `type`, `remise_id`, `notes`, `created_at`) VALUES (1,'Gisel',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(2,'Client particulier',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(3,'Berntrard',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(4,'louccy',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(5,'Gosef',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(6,'client Passage',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(7,'ben abdesslem',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(8,'artisanet',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(9,'omran khaled',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(10,'Relax and spay',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(11,'biojerba',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(12,'client',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(13,'bernard',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(14,'client passaget',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28'),
(15,'passaget claude',NULL,'Djerba',NULL,'particulier',NULL,'Repris du registre des ventes (type et coordonnées à compléter)','2026-10-11 20:24:28');
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

INSERT INTO `lots_presse` (`id`, `date`, `produit_id`, `reception_id`, `lot_id`, `quantite_matiere_utilisee`, `quantite_tourteau`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2023-12-17',2,NULL,2,32.000,NULL,1.000,0.0313,'01-2314-20231217H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(2,'2023-12-18',2,NULL,5,18.000,NULL,0.600,0.0333,'02-2314-20231218H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(3,'2023-12-18',2,NULL,6,12.000,NULL,0.400,0.0333,'03-GJ01/2023-20231218H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(4,'2023-12-19',2,NULL,7,32.000,NULL,1.000,0.0313,'04-GJ01/2023-20231219H','Outil n° 15 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(5,'2023-12-24',2,NULL,8,31.000,NULL,1.000,0.0323,'05-GJ01/2023-20231224H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(6,'2023-12-25',2,NULL,10,25.000,NULL,0.750,0.0300,'06-GJ01/2023-20231225H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(7,'2023-12-26',2,NULL,11,30.000,NULL,1.000,0.0333,'07-GJ01/2023-20231226H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(8,'2024-02-10',2,NULL,13,22.200,NULL,0.720,0.0324,'08-2313-20240210H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(9,'2024-02-10',2,NULL,14,7.800,NULL,0.290,0.0372,'08-GJ01/2023-20240210H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(10,'2024-02-11',2,NULL,15,30.000,NULL,1.090,0.0363,'09-2313-20240211H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(11,'2024-02-17',2,NULL,16,30.000,NULL,1.090,0.0363,'10-2313-20240217H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(12,'2024-03-18',2,NULL,17,30.000,NULL,1.000,0.0333,'11-2313-20240318H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(13,'2024-03-19',2,NULL,18,30.000,NULL,1.000,0.0333,'12-2313-20240319H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(14,'2024-03-20',2,NULL,19,7.800,NULL,0.300,0.0385,'13-2313-20240320H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(15,'2024-03-20',2,NULL,20,21.000,NULL,0.700,0.0333,'14-GJ01/2023-20240320H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(16,'2024-03-21',2,NULL,21,30.000,NULL,1.000,0.0333,'15-GJ01/2023-20240321H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(17,'2024-03-23',2,NULL,23,30.000,NULL,1.000,0.0333,'16-GJ01/2023-20240323H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(18,'2024-03-24',2,NULL,24,30.000,NULL,1.000,0.0333,'17-GJ01/2023-20240324H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(19,'2024-03-25',2,NULL,25,30.000,NULL,1.000,0.0333,'18-GJ01/2023-20240325H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(20,'2024-03-26',2,NULL,27,30.000,NULL,1.000,0.0333,'19-GJ01/2023-20240326H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(21,'2024-03-27',2,NULL,28,30.000,NULL,1.080,0.0360,'20-GJ01/2023-20240327H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(22,'2024-03-28',2,NULL,29,30.000,NULL,1.040,0.0347,'21-GJ01/2023-20240328H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(23,'2024-03-29',2,NULL,30,30.000,NULL,0.800,0.0267,'22-GJ01/2023-20240329H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(24,'2024-03-31',2,NULL,32,30.000,NULL,1.100,0.0367,'23-2312-20240331H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(25,'2024-04-07',2,NULL,34,30.000,NULL,1.200,0.0400,'24-2312-20240407H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(26,'2024-04-27',2,NULL,36,30.000,NULL,1.000,0.0333,'25-2312-20240427H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(27,'2024-04-28',2,NULL,38,30.000,NULL,0.900,0.0300,'26-2312-20240428H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(28,'2024-05-05',2,NULL,39,30.000,NULL,0.950,0.0317,'27-2312-20240505H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(29,'2024-05-06',2,NULL,41,20.000,NULL,0.730,0.0365,'28-2312-20240506H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28'),
(30,'2024-07-02',2,NULL,43,30.000,NULL,0.900,0.0300,'29-2312-20240702H','Outil n° 12 (registre de presse)',NULL,'2026-10-11 20:24:28');
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

INSERT INTO `lots_filtration` (`id`, `date`, `produit_id`, `lot_id`, `filtre_utilise`, `quantite_dechet`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2023-12-17',3,3,'ST60',0.140,0.760,0.8444,'01-2314-20231217','N° d\'ordre du registre de filtration : 1',NULL,'2026-10-11 20:24:28'),
(2,'2023-12-24',3,9,'ST60',0.110,0.890,0.8900,'05-GJ01/2023-20231224','N° d\'ordre du registre de filtration : 11',NULL,'2026-10-11 20:24:28'),
(3,'2024-03-21',3,22,'ST60',0.170,0.830,0.8300,'15-GJ01/2023-20240321','N° d\'ordre du registre de filtration : 3',NULL,'2026-10-11 20:24:28'),
(4,'2024-03-25',3,26,'ST60',0.100,0.900,0.9000,'18-GJ01/2023-20240325','N° d\'ordre du registre de filtration : 4',NULL,'2026-10-11 20:24:28'),
(5,'2024-03-31',3,33,'ST60',0.140,0.960,0.8727,'23-2312-20240331','N° d\'ordre du registre de filtration : 5',NULL,'2026-10-11 20:24:28'),
(6,'2024-04-07',3,35,'ST60',0.180,1.020,0.8500,'24-2312-20240407','N° d\'ordre du registre de filtration : 6',NULL,'2026-10-11 20:24:28'),
(7,'2024-04-27',3,37,'ST60',0.180,0.820,0.8200,'25-2312-20240427','N° d\'ordre du registre de filtration : 7',NULL,'2026-10-11 20:24:28'),
(8,'2024-05-05',3,40,'ST60',0.240,0.710,0.7474,'27-2312-20240505','N° d\'ordre du registre de filtration : 8',NULL,'2026-10-11 20:24:28'),
(9,'2024-05-06',3,42,'watman4',0.135,0.595,0.8151,'28-2312-20240506','N° d\'ordre du registre de filtration : 10',NULL,'2026-10-11 20:24:28'),
(10,'2024-07-11',3,44,'watman4',0.100,0.800,0.8889,'29-2312-20240711','N° d\'ordre du registre de filtration : 9',NULL,'2026-10-11 20:24:28'),
(11,'2024-10-09',3,48,'watman4',0.110,0.490,0.8167,'02-2314-20241009','N° d\'ordre du registre de filtration : 2',NULL,'2026-10-11 20:24:28'),
(12,'2024-11-05',3,49,'watman4',0.002,0.028,0.9333,'08-2313-20241105','N° d\'ordre du registre de filtration : 13',NULL,'2026-10-11 20:24:28'),
(13,'2024-11-05',3,50,'watman4',0.003,0.027,0.9000,'08-GJ01/2023-20241105','N° d\'ordre du registre de filtration : 12',NULL,'2026-10-11 20:24:28'),
(14,'2025-01-15',3,51,'watman4',0.060,0.340,0.8500,'03-GJ01/2023-20250115','N° d\'ordre du registre de filtration : 14',NULL,'2026-10-11 20:24:28'),
(15,'2025-01-22',3,53,'watman4',0.020,0.171,0.8953,'08-GJ01/2023-20250122','N° d\'ordre du registre de filtration : 15',NULL,'2026-10-11 20:24:28'),
(16,'2025-01-23',3,54,'watman4',0.109,0.581,0.8420,'08-2313-20250123','N° d\'ordre du registre de filtration : 16',NULL,'2026-10-11 20:24:28'),
(17,'2025-10-20',3,60,'watman4',0.093,0.907,0.9070,'04-GJ01/2023-20251020','N° d\'ordre du registre de filtration : 17',NULL,'2026-10-11 20:24:28'),
(18,'2025-10-21',3,61,'watman4',0.113,0.977,0.8963,'09-2313-20251021','N° d\'ordre du registre de filtration : 18',NULL,'2026-10-11 20:24:28'),
(19,'2025-10-23',3,62,'watman4',0.121,0.879,0.8790,'11-2313-20251023','N° d\'ordre du registre de filtration : 19',NULL,'2026-10-11 20:24:28'),
(20,'2025-10-26',3,63,'watman4',0.089,0.911,0.9110,'19-GJ01/2023-20251026','N° d\'ordre du registre de filtration : 20',NULL,'2026-10-11 20:24:28'),
(21,'2025-10-28',3,64,'watman4',0.092,0.988,0.9148,'20-GJ01/2023-20251028','N° d\'ordre du registre de filtration : 21',NULL,'2026-10-11 20:24:28'),
(22,'2025-11-03',3,65,'watman4',0.218,0.872,0.8000,'10-2313-20251103','N° d\'ordre du registre de filtration : 22',NULL,'2026-10-11 20:24:28'),
(23,'2025-11-05',3,66,'watman4',0.140,0.610,0.8133,'06-GJ01/2023-20251105','N° d\'ordre du registre de filtration : 23',NULL,'2026-10-11 20:24:28');
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
(84,56,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
(85,55,'EPUISE','Stock épuisé après vente',NULL,'2025-08-14 00:00:00'),
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
(109,68,'EPUISE','Stock épuisé après vente',NULL,'2026-03-14 00:00:00'),
(110,67,'EPUISE','Stock épuisé après vente',NULL,'2026-03-14 00:00:00'),
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
(121,70,'EPUISE','Stock épuisé après vente',NULL,'2026-05-22 00:00:00'),
(122,69,'EPUISE','Stock épuisé après vente',NULL,'2026-05-22 00:00:00'),
(123,68,'EPUISE','Stock épuisé après vente',NULL,'2026-05-26 00:00:00'),
(124,67,'EPUISE','Stock épuisé après vente',NULL,'2026-05-26 00:00:00'),
(125,72,'EPUISE','Stock épuisé après vente',NULL,'2026-07-19 00:00:00'),
(126,71,'EPUISE','Stock épuisé après vente',NULL,'2026-07-19 00:00:00');
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

INSERT INTO `conditionnements` (`id`, `date`, `produit_id`, `format_id`, `lot_id`, `qty`, `quantite_source_utilisee`, `note`, `employe_id`, `created_at`) VALUES (1,'2024-09-22',4,1,45,80.00,0.800,'Lot fini 011823',NULL,'2026-10-11 20:24:28'),
(2,'2024-09-23',4,1,46,21.00,0.210,'Lot fini 021825',NULL,'2026-10-11 20:24:28'),
(3,'2024-09-23',5,2,47,19.00,0.570,'Lot fini 021825',NULL,'2026-10-11 20:24:28'),
(4,'2024-09-24',4,1,46,2.00,0.020,'Lot fini 021825',NULL,'2026-10-11 20:24:28'),
(5,'2025-01-15',5,2,52,28.00,0.840,'Lot fini 042505',NULL,'2026-10-11 20:24:28'),
(6,'2025-04-03',5,2,55,7.00,0.210,'Lot fini 061803',NULL,'2026-10-11 20:24:28'),
(7,'2025-04-10',5,2,56,32.00,0.960,'Lot fini 050502',NULL,'2026-10-11 20:24:28'),
(8,'2025-04-15',5,2,57,14.00,0.420,'Lot fini 070324',NULL,'2026-10-11 20:24:28'),
(9,'2025-05-04',5,2,58,4.00,0.120,'Lot fini 082415',NULL,'2026-10-11 20:24:28'),
(10,'2025-08-05',4,1,59,20.00,0.200,'Lot fini 082415',NULL,'2026-10-11 20:24:28'),
(11,'2026-01-01',4,1,59,134.00,1.340,'Lot fini 082415',NULL,'2026-10-11 20:24:28'),
(12,'2026-02-01',5,2,67,10.00,0.300,'Lot fini 090808',NULL,'2026-10-11 20:24:28'),
(13,'2026-02-01',4,1,68,8.00,0.080,'Lot fini 090808',NULL,'2026-10-11 20:24:28'),
(14,'2026-04-07',5,2,67,6.00,0.180,'Lot fini 090808',NULL,'2026-10-11 20:24:28'),
(15,'2026-04-08',4,1,68,19.00,0.192,'2 ml de perte · Lot fini 090808',NULL,'2026-10-11 20:24:28'),
(16,'2026-05-09',5,2,69,1.00,0.030,'Lot fini 030808',NULL,'2026-10-11 20:24:28'),
(17,'2026-05-09',4,1,70,2.00,0.025,'5 ml de perte · Lot fini 030808',NULL,'2026-10-11 20:24:28'),
(18,'2026-05-10',5,2,71,26.00,0.780,'Lot fini 100106',NULL,'2026-10-11 20:24:28'),
(19,'2026-05-11',4,1,72,59.00,0.590,'Lot fini 100106',NULL,'2026-10-11 20:24:28');
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

INSERT INTO `stock_mouvements` (`id`, `numero`, `date_mouvement`, `type_mouvement`, `sens`, `produit_id`, `lot_id`, `local_id`, `zone_id`, `zone_source_id`, `zone_destination_id`, `quantite`, `source_type`, `source_id`, `group_id`, `note`, `employe_id`, `created_at`) VALUES (1,'MVT-0001','2023-12-17 00:00:00','RECEPTION','ENTREE',1,1,NULL,NULL,NULL,NULL,50.000,'reception_registre',1,'0dd7a10a-043b-4c48-a520-b54478646be4',NULL,NULL,'2026-10-11 20:24:28'),
(2,'MVT-0002','2023-12-17 00:00:00','CONSOMMATION','SORTIE',1,1,NULL,NULL,NULL,NULL,32.000,'lots_presse',2,'ec543b34-70eb-4a7e-9ba3-9d642d0999e6',NULL,NULL,'2026-10-11 20:24:28'),
(3,'MVT-0003','2023-12-17 00:00:00','PRODUCTION','ENTREE',2,2,NULL,NULL,NULL,NULL,1.000,'lots_presse',2,'ec543b34-70eb-4a7e-9ba3-9d642d0999e6',NULL,NULL,'2026-10-11 20:24:28'),
(4,'MVT-0004','2023-12-17 00:00:00','CONSOMMATION','SORTIE',2,2,NULL,NULL,NULL,NULL,0.900,'lots_filtration',1,'b2428c8b-7445-4057-8892-beb4115e2970',NULL,NULL,'2026-10-11 20:24:28'),
(5,'MVT-0005','2023-12-17 00:00:00','PRODUCTION','ENTREE',3,3,NULL,NULL,NULL,NULL,0.760,'lots_filtration',1,'b2428c8b-7445-4057-8892-beb4115e2970',NULL,NULL,'2026-10-11 20:24:28'),
(6,'MVT-0006','2023-12-18 00:00:00','RECEPTION','ENTREE',1,4,NULL,NULL,NULL,NULL,398.800,'reception_registre',4,'0a5947fd-981a-4bbe-b940-5e152451311e',NULL,NULL,'2026-10-11 20:24:28'),
(7,'MVT-0007','2023-12-18 00:00:00','CONSOMMATION','SORTIE',1,1,NULL,NULL,NULL,NULL,18.000,'lots_presse',5,'09d8eedf-c867-4792-bcba-4cccff2c6202',NULL,NULL,'2026-10-11 20:24:28'),
(8,'MVT-0008','2023-12-18 00:00:00','PRODUCTION','ENTREE',2,5,NULL,NULL,NULL,NULL,0.600,'lots_presse',5,'09d8eedf-c867-4792-bcba-4cccff2c6202',NULL,NULL,'2026-10-11 20:24:28'),
(9,'MVT-0009','2023-12-18 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,12.000,'lots_presse',6,'32e43e18-e3dd-426e-8636-dcfd8f162193',NULL,NULL,'2026-10-11 20:24:28'),
(10,'MVT-0010','2023-12-18 00:00:00','PRODUCTION','ENTREE',2,6,NULL,NULL,NULL,NULL,0.400,'lots_presse',6,'32e43e18-e3dd-426e-8636-dcfd8f162193',NULL,NULL,'2026-10-11 20:24:28'),
(11,'MVT-0011','2023-12-19 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,32.000,'lots_presse',7,'8aa4f6a2-11f8-4036-8659-9d3b1e07dbdc',NULL,NULL,'2026-10-11 20:24:28'),
(12,'MVT-0012','2023-12-19 00:00:00','PRODUCTION','ENTREE',2,7,NULL,NULL,NULL,NULL,1.000,'lots_presse',7,'8aa4f6a2-11f8-4036-8659-9d3b1e07dbdc',NULL,NULL,'2026-10-11 20:24:28'),
(13,'MVT-0013','2023-12-24 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,31.000,'lots_presse',8,'5698f338-1ead-410e-aae0-2c66abb5abdb',NULL,NULL,'2026-10-11 20:24:28'),
(14,'MVT-0014','2023-12-24 00:00:00','PRODUCTION','ENTREE',2,8,NULL,NULL,NULL,NULL,1.000,'lots_presse',8,'5698f338-1ead-410e-aae0-2c66abb5abdb',NULL,NULL,'2026-10-11 20:24:28'),
(15,'MVT-0015','2023-12-24 00:00:00','CONSOMMATION','SORTIE',2,8,NULL,NULL,NULL,NULL,1.000,'lots_filtration',2,'114b7647-d4a7-4992-b66f-0999199b6e0b',NULL,NULL,'2026-10-11 20:24:28'),
(16,'MVT-0016','2023-12-24 00:00:00','PRODUCTION','ENTREE',3,9,NULL,NULL,NULL,NULL,0.890,'lots_filtration',2,'114b7647-d4a7-4992-b66f-0999199b6e0b',NULL,NULL,'2026-10-11 20:24:28'),
(17,'MVT-0017','2023-12-25 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,25.000,'lots_presse',10,'bc65376b-e441-4c45-bfce-712b85401fd0',NULL,NULL,'2026-10-11 20:24:28'),
(18,'MVT-0018','2023-12-25 00:00:00','PRODUCTION','ENTREE',2,10,NULL,NULL,NULL,NULL,0.750,'lots_presse',10,'bc65376b-e441-4c45-bfce-712b85401fd0',NULL,NULL,'2026-10-11 20:24:28'),
(19,'MVT-0019','2023-12-26 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',11,'89d5f79b-7b91-4d90-bc4c-7e5b67b16b84',NULL,NULL,'2026-10-11 20:24:28'),
(20,'MVT-0020','2023-12-26 00:00:00','PRODUCTION','ENTREE',2,11,NULL,NULL,NULL,NULL,1.000,'lots_presse',11,'89d5f79b-7b91-4d90-bc4c-7e5b67b16b84',NULL,NULL,'2026-10-11 20:24:28'),
(21,'MVT-0021','2024-02-10 00:00:00','RECEPTION','ENTREE',1,12,NULL,NULL,NULL,NULL,150.000,'reception_registre',12,'fbfad6a2-7207-4575-99b3-3c3569f5fc55',NULL,NULL,'2026-10-11 20:24:28'),
(22,'MVT-0022','2024-02-10 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,22.200,'lots_presse',13,'790e0fee-1e9b-44df-b3de-b8e106b998e0',NULL,NULL,'2026-10-11 20:24:28'),
(23,'MVT-0023','2024-02-10 00:00:00','PRODUCTION','ENTREE',2,13,NULL,NULL,NULL,NULL,0.720,'lots_presse',13,'790e0fee-1e9b-44df-b3de-b8e106b998e0',NULL,NULL,'2026-10-11 20:24:28'),
(24,'MVT-0024','2024-02-10 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,7.800,'lots_presse',14,'3e999611-1d46-4225-acfe-b3a4e1359245',NULL,NULL,'2026-10-11 20:24:28'),
(25,'MVT-0025','2024-02-10 00:00:00','PRODUCTION','ENTREE',2,14,NULL,NULL,NULL,NULL,0.290,'lots_presse',14,'3e999611-1d46-4225-acfe-b3a4e1359245',NULL,NULL,'2026-10-11 20:24:28'),
(26,'MVT-0026','2024-02-11 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',15,'ae8f4ff2-f588-400c-b2f2-d54dc0f9895a',NULL,NULL,'2026-10-11 20:24:28'),
(27,'MVT-0027','2024-02-11 00:00:00','PRODUCTION','ENTREE',2,15,NULL,NULL,NULL,NULL,1.090,'lots_presse',15,'ae8f4ff2-f588-400c-b2f2-d54dc0f9895a',NULL,NULL,'2026-10-11 20:24:28'),
(28,'MVT-0028','2024-02-17 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',16,'083b0a81-719e-4ed1-b3c3-e1f623372a57',NULL,NULL,'2026-10-11 20:24:28'),
(29,'MVT-0029','2024-02-17 00:00:00','PRODUCTION','ENTREE',2,16,NULL,NULL,NULL,NULL,1.090,'lots_presse',16,'083b0a81-719e-4ed1-b3c3-e1f623372a57',NULL,NULL,'2026-10-11 20:24:28'),
(30,'MVT-0030','2024-03-18 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',17,'a99ab614-e50f-4733-901a-e6d511771205',NULL,NULL,'2026-10-11 20:24:28'),
(31,'MVT-0031','2024-03-18 00:00:00','PRODUCTION','ENTREE',2,17,NULL,NULL,NULL,NULL,1.000,'lots_presse',17,'a99ab614-e50f-4733-901a-e6d511771205',NULL,NULL,'2026-10-11 20:24:28'),
(32,'MVT-0032','2024-03-19 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,30.000,'lots_presse',18,'f2c8445f-72c8-4905-ac10-ec74b7a55882',NULL,NULL,'2026-10-11 20:24:28'),
(33,'MVT-0033','2024-03-19 00:00:00','PRODUCTION','ENTREE',2,18,NULL,NULL,NULL,NULL,1.000,'lots_presse',18,'f2c8445f-72c8-4905-ac10-ec74b7a55882',NULL,NULL,'2026-10-11 20:24:28'),
(34,'MVT-0034','2024-03-20 00:00:00','CONSOMMATION','SORTIE',1,12,NULL,NULL,NULL,NULL,7.800,'lots_presse',19,'072f57a4-8d9b-42d6-830e-e13daf9fbc69',NULL,NULL,'2026-10-11 20:24:28'),
(35,'MVT-0035','2024-03-20 00:00:00','PRODUCTION','ENTREE',2,19,NULL,NULL,NULL,NULL,0.300,'lots_presse',19,'072f57a4-8d9b-42d6-830e-e13daf9fbc69',NULL,NULL,'2026-10-11 20:24:28'),
(36,'MVT-0036','2024-03-20 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,21.000,'lots_presse',20,'aa19c426-63c7-49cd-ac14-c11494168527',NULL,NULL,'2026-10-11 20:24:28'),
(37,'MVT-0037','2024-03-20 00:00:00','PRODUCTION','ENTREE',2,20,NULL,NULL,NULL,NULL,0.700,'lots_presse',20,'aa19c426-63c7-49cd-ac14-c11494168527',NULL,NULL,'2026-10-11 20:24:28'),
(38,'MVT-0038','2024-03-21 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',21,'a55bde0c-0fc0-4f97-ba2a-3cbcd3360537',NULL,NULL,'2026-10-11 20:24:28'),
(39,'MVT-0039','2024-03-21 00:00:00','PRODUCTION','ENTREE',2,21,NULL,NULL,NULL,NULL,1.000,'lots_presse',21,'a55bde0c-0fc0-4f97-ba2a-3cbcd3360537',NULL,NULL,'2026-10-11 20:24:28'),
(40,'MVT-0040','2024-03-21 00:00:00','CONSOMMATION','SORTIE',2,21,NULL,NULL,NULL,NULL,1.000,'lots_filtration',3,'5b8f9e38-5e6e-4d17-a306-f1bf4f2ede5a',NULL,NULL,'2026-10-11 20:24:28'),
(41,'MVT-0041','2024-03-21 00:00:00','PRODUCTION','ENTREE',3,22,NULL,NULL,NULL,NULL,0.830,'lots_filtration',3,'5b8f9e38-5e6e-4d17-a306-f1bf4f2ede5a',NULL,NULL,'2026-10-11 20:24:28'),
(42,'MVT-0042','2024-03-23 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',23,'7b8ee5d4-f2ec-4a70-9c15-30a49c96fd57',NULL,NULL,'2026-10-11 20:24:28'),
(43,'MVT-0043','2024-03-23 00:00:00','PRODUCTION','ENTREE',2,23,NULL,NULL,NULL,NULL,1.000,'lots_presse',23,'7b8ee5d4-f2ec-4a70-9c15-30a49c96fd57',NULL,NULL,'2026-10-11 20:24:28'),
(44,'MVT-0044','2024-03-24 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',24,'8621a04b-1eff-4707-b589-77724ab909b4',NULL,NULL,'2026-10-11 20:24:28'),
(45,'MVT-0045','2024-03-24 00:00:00','PRODUCTION','ENTREE',2,24,NULL,NULL,NULL,NULL,1.000,'lots_presse',24,'8621a04b-1eff-4707-b589-77724ab909b4',NULL,NULL,'2026-10-11 20:24:28'),
(46,'MVT-0046','2024-03-25 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',25,'7600a0d6-9bba-4cf0-a234-b2618c6eb4c6',NULL,NULL,'2026-10-11 20:24:28'),
(47,'MVT-0047','2024-03-25 00:00:00','PRODUCTION','ENTREE',2,25,NULL,NULL,NULL,NULL,1.000,'lots_presse',25,'7600a0d6-9bba-4cf0-a234-b2618c6eb4c6',NULL,NULL,'2026-10-11 20:24:28'),
(48,'MVT-0048','2024-03-25 00:00:00','CONSOMMATION','SORTIE',2,25,NULL,NULL,NULL,NULL,1.000,'lots_filtration',4,'ca21be0c-5212-43fc-b85a-99a988f2a791',NULL,NULL,'2026-10-11 20:24:28'),
(49,'MVT-0049','2024-03-25 00:00:00','PRODUCTION','ENTREE',3,26,NULL,NULL,NULL,NULL,0.900,'lots_filtration',4,'ca21be0c-5212-43fc-b85a-99a988f2a791',NULL,NULL,'2026-10-11 20:24:28'),
(50,'MVT-0050','2024-03-26 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',27,'fe970e18-dd86-4eb8-b8c7-d4e5231da311',NULL,NULL,'2026-10-11 20:24:28'),
(51,'MVT-0051','2024-03-26 00:00:00','PRODUCTION','ENTREE',2,27,NULL,NULL,NULL,NULL,1.000,'lots_presse',27,'fe970e18-dd86-4eb8-b8c7-d4e5231da311',NULL,NULL,'2026-10-11 20:24:28'),
(52,'MVT-0052','2024-03-27 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',28,'0da2fd22-f825-40c8-abdf-5a2e8cd13046',NULL,NULL,'2026-10-11 20:24:28'),
(53,'MVT-0053','2024-03-27 00:00:00','PRODUCTION','ENTREE',2,28,NULL,NULL,NULL,NULL,1.080,'lots_presse',28,'0da2fd22-f825-40c8-abdf-5a2e8cd13046',NULL,NULL,'2026-10-11 20:24:28'),
(54,'MVT-0054','2024-03-28 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',29,'95cba3ff-9f8f-46f0-bcd5-51dda81e9bb3',NULL,NULL,'2026-10-11 20:24:28'),
(55,'MVT-0055','2024-03-28 00:00:00','PRODUCTION','ENTREE',2,29,NULL,NULL,NULL,NULL,1.040,'lots_presse',29,'95cba3ff-9f8f-46f0-bcd5-51dda81e9bb3',NULL,NULL,'2026-10-11 20:24:28'),
(56,'MVT-0056','2024-03-29 00:00:00','CONSOMMATION','SORTIE',1,4,NULL,NULL,NULL,NULL,30.000,'lots_presse',30,'7a7fc392-270e-4ae4-9063-df5c80df103f',NULL,NULL,'2026-10-11 20:24:28'),
(57,'MVT-0057','2024-03-29 00:00:00','PRODUCTION','ENTREE',2,30,NULL,NULL,NULL,NULL,0.800,'lots_presse',30,'7a7fc392-270e-4ae4-9063-df5c80df103f',NULL,NULL,'2026-10-11 20:24:28'),
(58,'MVT-0058','2024-03-31 00:00:00','RECEPTION','ENTREE',1,31,NULL,NULL,NULL,NULL,200.000,'reception_registre',31,'941af0a1-6292-4c80-897c-8f51cdade278',NULL,NULL,'2026-10-11 20:24:28'),
(59,'MVT-0059','2024-03-31 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',32,'3e10953e-bf00-45d2-911b-f15989306d8b',NULL,NULL,'2026-10-11 20:24:28'),
(60,'MVT-0060','2024-03-31 00:00:00','PRODUCTION','ENTREE',2,32,NULL,NULL,NULL,NULL,1.100,'lots_presse',32,'3e10953e-bf00-45d2-911b-f15989306d8b',NULL,NULL,'2026-10-11 20:24:28'),
(61,'MVT-0061','2024-03-31 00:00:00','CONSOMMATION','SORTIE',2,32,NULL,NULL,NULL,NULL,1.100,'lots_filtration',5,'7ce656a9-6286-426c-afda-c6486b4a782a',NULL,NULL,'2026-10-11 20:24:28'),
(62,'MVT-0062','2024-03-31 00:00:00','PRODUCTION','ENTREE',3,33,NULL,NULL,NULL,NULL,0.960,'lots_filtration',5,'7ce656a9-6286-426c-afda-c6486b4a782a',NULL,NULL,'2026-10-11 20:24:28'),
(63,'MVT-0063','2024-04-07 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',34,'a0d07909-b057-460b-a184-6fa85c0da5eb',NULL,NULL,'2026-10-11 20:24:28'),
(64,'MVT-0064','2024-04-07 00:00:00','PRODUCTION','ENTREE',2,34,NULL,NULL,NULL,NULL,1.200,'lots_presse',34,'a0d07909-b057-460b-a184-6fa85c0da5eb',NULL,NULL,'2026-10-11 20:24:28'),
(65,'MVT-0065','2024-04-07 00:00:00','CONSOMMATION','SORTIE',2,34,NULL,NULL,NULL,NULL,1.200,'lots_filtration',6,'41432520-c62c-4b54-bd7a-3cf4a1dc1b34',NULL,NULL,'2026-10-11 20:24:28'),
(66,'MVT-0066','2024-04-07 00:00:00','PRODUCTION','ENTREE',3,35,NULL,NULL,NULL,NULL,1.020,'lots_filtration',6,'41432520-c62c-4b54-bd7a-3cf4a1dc1b34',NULL,NULL,'2026-10-11 20:24:28'),
(67,'MVT-0067','2024-04-27 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',36,'ad5a4ad3-f0ab-4789-b1ef-7716bf2fc8e5',NULL,NULL,'2026-10-11 20:24:28'),
(68,'MVT-0068','2024-04-27 00:00:00','PRODUCTION','ENTREE',2,36,NULL,NULL,NULL,NULL,1.000,'lots_presse',36,'ad5a4ad3-f0ab-4789-b1ef-7716bf2fc8e5',NULL,NULL,'2026-10-11 20:24:28'),
(69,'MVT-0069','2024-04-27 00:00:00','CONSOMMATION','SORTIE',2,36,NULL,NULL,NULL,NULL,1.000,'lots_filtration',7,'4a66fd7c-7ea3-48a4-bb4a-6a582476977a',NULL,NULL,'2026-10-11 20:24:28'),
(70,'MVT-0070','2024-04-27 00:00:00','PRODUCTION','ENTREE',3,37,NULL,NULL,NULL,NULL,0.820,'lots_filtration',7,'4a66fd7c-7ea3-48a4-bb4a-6a582476977a',NULL,NULL,'2026-10-11 20:24:28'),
(71,'MVT-0071','2024-04-28 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',38,'472c0fbf-3455-4e1d-aaeb-83c9c5b485eb',NULL,NULL,'2026-10-11 20:24:28'),
(72,'MVT-0072','2024-04-28 00:00:00','PRODUCTION','ENTREE',2,38,NULL,NULL,NULL,NULL,0.900,'lots_presse',38,'472c0fbf-3455-4e1d-aaeb-83c9c5b485eb',NULL,NULL,'2026-10-11 20:24:28'),
(73,'MVT-0073','2024-05-05 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',39,'d8c26fbe-6db4-4c05-89e7-8e7a4fa37be3',NULL,NULL,'2026-10-11 20:24:28'),
(74,'MVT-0074','2024-05-05 00:00:00','PRODUCTION','ENTREE',2,39,NULL,NULL,NULL,NULL,0.950,'lots_presse',39,'d8c26fbe-6db4-4c05-89e7-8e7a4fa37be3',NULL,NULL,'2026-10-11 20:24:28'),
(75,'MVT-0075','2024-05-05 00:00:00','CONSOMMATION','SORTIE',2,39,NULL,NULL,NULL,NULL,0.950,'lots_filtration',8,'13661b09-8094-4dff-995e-ee87b5807762',NULL,NULL,'2026-10-11 20:24:28'),
(76,'MVT-0076','2024-05-05 00:00:00','PRODUCTION','ENTREE',3,40,NULL,NULL,NULL,NULL,0.710,'lots_filtration',8,'13661b09-8094-4dff-995e-ee87b5807762',NULL,NULL,'2026-10-11 20:24:28'),
(77,'MVT-0077','2024-05-06 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,20.000,'lots_presse',41,'180524fc-68bc-4b43-91a4-06ed1970bacc',NULL,NULL,'2026-10-11 20:24:28'),
(78,'MVT-0078','2024-05-06 00:00:00','PRODUCTION','ENTREE',2,41,NULL,NULL,NULL,NULL,0.730,'lots_presse',41,'180524fc-68bc-4b43-91a4-06ed1970bacc',NULL,NULL,'2026-10-11 20:24:28'),
(79,'MVT-0079','2024-05-06 00:00:00','CONSOMMATION','SORTIE',2,41,NULL,NULL,NULL,NULL,0.730,'lots_filtration',9,'e0bfcfda-eded-43c3-9c65-33f6faef61ea',NULL,NULL,'2026-10-11 20:24:28'),
(80,'MVT-0080','2024-05-06 00:00:00','PRODUCTION','ENTREE',3,42,NULL,NULL,NULL,NULL,0.595,'lots_filtration',9,'e0bfcfda-eded-43c3-9c65-33f6faef61ea',NULL,NULL,'2026-10-11 20:24:28'),
(81,'MVT-0081','2024-07-02 00:00:00','CONSOMMATION','SORTIE',1,31,NULL,NULL,NULL,NULL,30.000,'lots_presse',43,'807d229c-ff24-43a7-accd-1cab73cbc777',NULL,NULL,'2026-10-11 20:24:28'),
(82,'MVT-0082','2024-07-02 00:00:00','PRODUCTION','ENTREE',2,43,NULL,NULL,NULL,NULL,0.900,'lots_presse',43,'807d229c-ff24-43a7-accd-1cab73cbc777',NULL,NULL,'2026-10-11 20:24:28'),
(83,'MVT-0083','2024-07-11 00:00:00','CONSOMMATION','SORTIE',2,43,NULL,NULL,NULL,NULL,0.900,'lots_filtration',10,'43841aee-fe63-4188-b609-22d79820d81c',NULL,NULL,'2026-10-11 20:24:28'),
(84,'MVT-0084','2024-07-11 00:00:00','PRODUCTION','ENTREE',3,44,NULL,NULL,NULL,NULL,0.800,'lots_filtration',10,'43841aee-fe63-4188-b609-22d79820d81c',NULL,NULL,'2026-10-11 20:24:28'),
(85,'MVT-0085-OUT-filtration-5','2024-09-22 00:00:00','CONSOMMATION','SORTIE',3,33,NULL,NULL,NULL,NULL,0.400,'conditionnement',1,'97ffa707-d9d0-46d1-9ea3-093b522f1987',NULL,NULL,'2026-10-11 20:24:28'),
(86,'MVT-0085-OUT-filtration-4','2024-09-22 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.400,'conditionnement',1,'97ffa707-d9d0-46d1-9ea3-093b522f1987',NULL,NULL,'2026-10-11 20:24:28'),
(87,'MVT-0085-IN','2024-09-22 00:00:00','CONDITIONNEMENT','ENTREE',4,45,NULL,NULL,NULL,NULL,80.000,'conditionnement',1,'97ffa707-d9d0-46d1-9ea3-093b522f1987',NULL,NULL,'2026-10-11 20:24:28'),
(88,'MVT-0086-OUT-filtration-7','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.105,'conditionnement',2,'d594e7b1-f791-4906-b230-dd6b8de209e2',NULL,NULL,'2026-10-11 20:24:28'),
(89,'MVT-0086-OUT-filtration-4','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.105,'conditionnement',2,'d594e7b1-f791-4906-b230-dd6b8de209e2',NULL,NULL,'2026-10-11 20:24:28'),
(90,'MVT-0086-IN','2024-09-23 00:00:00','CONDITIONNEMENT','ENTREE',4,46,NULL,NULL,NULL,NULL,21.000,'conditionnement',2,'d594e7b1-f791-4906-b230-dd6b8de209e2',NULL,NULL,'2026-10-11 20:24:28'),
(91,'MVT-0087-OUT-filtration-7','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.285,'conditionnement',3,'1d671457-1a2f-41be-ae66-308d9b2472e2',NULL,NULL,'2026-10-11 20:24:28'),
(92,'MVT-0087-OUT-filtration-4','2024-09-23 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.285,'conditionnement',3,'1d671457-1a2f-41be-ae66-308d9b2472e2',NULL,NULL,'2026-10-11 20:24:28'),
(93,'MVT-0087-IN','2024-09-23 00:00:00','CONDITIONNEMENT','ENTREE',5,47,NULL,NULL,NULL,NULL,19.000,'conditionnement',3,'1d671457-1a2f-41be-ae66-308d9b2472e2',NULL,NULL,'2026-10-11 20:24:28'),
(94,'MVT-0088-OUT-filtration-7','2024-09-24 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.010,'conditionnement',4,'05037d4c-54af-4a39-9f16-63dcd0b99de5',NULL,NULL,'2026-10-11 20:24:28'),
(95,'MVT-0088-OUT-filtration-4','2024-09-24 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.010,'conditionnement',4,'05037d4c-54af-4a39-9f16-63dcd0b99de5',NULL,NULL,'2026-10-11 20:24:28'),
(96,'MVT-0088-IN','2024-09-24 00:00:00','CONDITIONNEMENT','ENTREE',4,46,NULL,NULL,NULL,NULL,2.000,'conditionnement',4,'05037d4c-54af-4a39-9f16-63dcd0b99de5',NULL,NULL,'2026-10-11 20:24:28'),
(97,'MVT-0089','2024-10-09 00:00:00','CONSOMMATION','SORTIE',2,5,NULL,NULL,NULL,NULL,0.600,'lots_filtration',11,'b7d4d4b1-6b2d-47fd-9080-b7280ec4d422',NULL,NULL,'2026-10-11 20:24:28'),
(98,'MVT-0090','2024-10-09 00:00:00','PRODUCTION','ENTREE',3,48,NULL,NULL,NULL,NULL,0.490,'lots_filtration',11,'b7d4d4b1-6b2d-47fd-9080-b7280ec4d422',NULL,NULL,'2026-10-11 20:24:28'),
(99,'MVT-0091','2024-11-05 00:00:00','CONSOMMATION','SORTIE',2,13,NULL,NULL,NULL,NULL,0.030,'lots_filtration',12,'4d0b1e94-543f-4fed-b64e-5e7227c318ac',NULL,NULL,'2026-10-11 20:24:28'),
(100,'MVT-0092','2024-11-05 00:00:00','PRODUCTION','ENTREE',3,49,NULL,NULL,NULL,NULL,0.028,'lots_filtration',12,'4d0b1e94-543f-4fed-b64e-5e7227c318ac',NULL,NULL,'2026-10-11 20:24:28'),
(101,'MVT-0093','2024-11-05 00:00:00','CONSOMMATION','SORTIE',2,14,NULL,NULL,NULL,NULL,0.030,'lots_filtration',13,'f76d6ed1-9db3-499e-9523-e54efd9ea0f2',NULL,NULL,'2026-10-11 20:24:28'),
(102,'MVT-0094','2024-11-05 00:00:00','PRODUCTION','ENTREE',3,50,NULL,NULL,NULL,NULL,0.027,'lots_filtration',13,'f76d6ed1-9db3-499e-9523-e54efd9ea0f2',NULL,NULL,'2026-10-11 20:24:28'),
(103,'MVT-0095','2025-01-15 00:00:00','CONSOMMATION','SORTIE',2,6,NULL,NULL,NULL,NULL,0.400,'lots_filtration',14,'ff1f3bb1-c6c1-4bba-b7f5-9bc7dff1b4dc',NULL,NULL,'2026-10-11 20:24:28'),
(104,'MVT-0096','2025-01-15 00:00:00','PRODUCTION','ENTREE',3,51,NULL,NULL,NULL,NULL,0.340,'lots_filtration',14,'ff1f3bb1-c6c1-4bba-b7f5-9bc7dff1b4dc',NULL,NULL,'2026-10-11 20:24:28'),
(105,'MVT-0097-OUT-filtration-7','2025-01-15 00:00:00','CONSOMMATION','SORTIE',3,37,NULL,NULL,NULL,NULL,0.420,'conditionnement',5,'caebe440-ffab-479a-9745-24faf190f848',NULL,NULL,'2026-10-11 20:24:28'),
(106,'MVT-0097-OUT-filtration-2','2025-01-15 00:00:00','CONSOMMATION','SORTIE',3,9,NULL,NULL,NULL,NULL,0.420,'conditionnement',5,'caebe440-ffab-479a-9745-24faf190f848',NULL,NULL,'2026-10-11 20:24:28'),
(107,'MVT-0097-IN','2025-01-15 00:00:00','CONDITIONNEMENT','ENTREE',5,52,NULL,NULL,NULL,NULL,28.000,'conditionnement',5,'caebe440-ffab-479a-9745-24faf190f848',NULL,NULL,'2026-10-11 20:24:28'),
(108,'MVT-0098','2025-01-22 00:00:00','CONSOMMATION','SORTIE',2,14,NULL,NULL,NULL,NULL,0.191,'lots_filtration',15,'23dda1dc-2e4c-4790-9a06-b76a93a3831b',NULL,NULL,'2026-10-11 20:24:28'),
(109,'MVT-0099','2025-01-22 00:00:00','PRODUCTION','ENTREE',3,53,NULL,NULL,NULL,NULL,0.171,'lots_filtration',15,'23dda1dc-2e4c-4790-9a06-b76a93a3831b',NULL,NULL,'2026-10-11 20:24:28'),
(110,'MVT-0100','2025-01-23 00:00:00','CONSOMMATION','SORTIE',2,13,NULL,NULL,NULL,NULL,0.690,'lots_filtration',16,'d789b3fc-45ab-46bd-90ee-047f391c7b5e',NULL,NULL,'2026-10-11 20:24:28'),
(111,'MVT-0101','2025-01-23 00:00:00','PRODUCTION','ENTREE',3,54,NULL,NULL,NULL,NULL,0.581,'lots_filtration',16,'d789b3fc-45ab-46bd-90ee-047f391c7b5e',NULL,NULL,'2026-10-11 20:24:28'),
(112,'MVT-0102-OUT-filtration-4','2025-04-03 00:00:00','CONSOMMATION','SORTIE',3,26,NULL,NULL,NULL,NULL,0.100,'conditionnement',6,'0843f7e6-9cbc-4220-b2bf-a2e555134a49',NULL,NULL,'2026-10-11 20:24:28'),
(113,'MVT-0102-OUT-filtration-14','2025-04-03 00:00:00','CONSOMMATION','SORTIE',3,51,NULL,NULL,NULL,NULL,0.110,'conditionnement',6,'0843f7e6-9cbc-4220-b2bf-a2e555134a49',NULL,NULL,'2026-10-11 20:24:28'),
(114,'MVT-0102-IN','2025-04-03 00:00:00','CONDITIONNEMENT','ENTREE',5,55,NULL,NULL,NULL,NULL,7.000,'conditionnement',6,'0843f7e6-9cbc-4220-b2bf-a2e555134a49',NULL,NULL,'2026-10-11 20:24:28'),
(115,'MVT-0103-OUT-filtration-2','2025-04-10 00:00:00','CONSOMMATION','SORTIE',3,9,NULL,NULL,NULL,NULL,0.470,'conditionnement',7,'942ffef8-ecb6-4abd-b9f1-997d65f49999',NULL,NULL,'2026-10-11 20:24:28'),
(116,'MVT-0103-OUT-filtration-11','2025-04-10 00:00:00','CONSOMMATION','SORTIE',3,48,NULL,NULL,NULL,NULL,0.490,'conditionnement',7,'942ffef8-ecb6-4abd-b9f1-997d65f49999',NULL,NULL,'2026-10-11 20:24:28'),
(117,'MVT-0103-IN','2025-04-10 00:00:00','CONDITIONNEMENT','ENTREE',5,56,NULL,NULL,NULL,NULL,32.000,'conditionnement',7,'942ffef8-ecb6-4abd-b9f1-997d65f49999',NULL,NULL,'2026-10-11 20:24:28'),
(118,'MVT-0104-OUT-filtration-14','2025-04-15 00:00:00','CONSOMMATION','SORTIE',3,51,NULL,NULL,NULL,NULL,0.230,'conditionnement',8,'beae09c9-1517-440c-9b96-1b273adfa759',NULL,NULL,'2026-10-11 20:24:28'),
(119,'MVT-0104-OUT-filtration-6','2025-04-15 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.190,'conditionnement',8,'beae09c9-1517-440c-9b96-1b273adfa759',NULL,NULL,'2026-10-11 20:24:28'),
(120,'MVT-0104-IN','2025-04-15 00:00:00','CONDITIONNEMENT','ENTREE',5,57,NULL,NULL,NULL,NULL,14.000,'conditionnement',8,'beae09c9-1517-440c-9b96-1b273adfa759',NULL,NULL,'2026-10-11 20:24:28'),
(121,'MVT-0105-OUT-filtration-6','2025-05-04 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.060,'conditionnement',9,'8c0b96cb-fb1f-47f4-9ec3-42ec3fde3494',NULL,NULL,'2026-10-11 20:24:28'),
(122,'MVT-0105-OUT-filtration-3','2025-05-04 00:00:00','CONSOMMATION','SORTIE',3,22,NULL,NULL,NULL,NULL,0.060,'conditionnement',9,'8c0b96cb-fb1f-47f4-9ec3-42ec3fde3494',NULL,NULL,'2026-10-11 20:24:28'),
(123,'MVT-0105-IN','2025-05-04 00:00:00','CONDITIONNEMENT','ENTREE',5,58,NULL,NULL,NULL,NULL,4.000,'conditionnement',9,'8c0b96cb-fb1f-47f4-9ec3-42ec3fde3494',NULL,NULL,'2026-10-11 20:24:28'),
(124,'MVT-0106','2025-05-04 00:00:00','VENTE','SORTIE',5,58,NULL,NULL,NULL,NULL,4.000,'registre_ventes',NULL,NULL,'Vente registre n° — · client non renseigné · sortie du registre mélange (04/05/2025), absente du registre des ventes',NULL,'2026-10-11 20:24:28'),
(125,'MVT-0107','2025-06-10 00:00:00','VENTE','SORTIE',5,52,NULL,NULL,NULL,NULL,22.000,'registre_ventes',1,NULL,'Vente registre n° 3 · client : Gisel · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(126,'MVT-0108','2025-06-10 00:00:00','VENTE','SORTIE',5,56,NULL,NULL,NULL,NULL,3.000,'registre_ventes',1,NULL,'Vente registre n° 3 · client : Gisel · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(127,'MVT-0109','2025-07-10 00:00:00','VENTE','SORTIE',4,46,NULL,NULL,NULL,NULL,2.000,'registre_ventes',2,NULL,'Vente registre n° 2 · client : Client particulier · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(128,'MVT-0110-OUT-filtration-6','2025-08-05 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.100,'conditionnement',10,'606b3f04-0675-4950-8f3d-2d7747018a6b',NULL,NULL,'2026-10-11 20:24:28'),
(129,'MVT-0110-OUT-filtration-3','2025-08-05 00:00:00','CONSOMMATION','SORTIE',3,22,NULL,NULL,NULL,NULL,0.100,'conditionnement',10,'606b3f04-0675-4950-8f3d-2d7747018a6b',NULL,NULL,'2026-10-11 20:24:28'),
(130,'MVT-0110-IN','2025-08-05 00:00:00','CONDITIONNEMENT','ENTREE',4,59,NULL,NULL,NULL,NULL,20.000,'conditionnement',10,'606b3f04-0675-4950-8f3d-2d7747018a6b',NULL,NULL,'2026-10-11 20:24:28'),
(131,'MVT-0111','2025-08-14 00:00:00','VENTE','SORTIE',5,47,NULL,NULL,NULL,NULL,19.000,'registre_ventes',3,NULL,'Vente registre n° 1 · client : Berntrard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(132,'MVT-0112','2025-08-14 00:00:00','VENTE','SORTIE',5,52,NULL,NULL,NULL,NULL,6.000,'registre_ventes',3,NULL,'Vente registre n° 1 · client : Berntrard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(133,'MVT-0113','2025-08-14 00:00:00','VENTE','SORTIE',5,56,NULL,NULL,NULL,NULL,25.000,'registre_ventes',4,NULL,'Vente registre n° 4 · client : louccy · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(134,'MVT-0114','2025-08-14 00:00:00','VENTE','SORTIE',5,56,NULL,NULL,NULL,NULL,4.000,'registre_ventes',5,NULL,'Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(135,'MVT-0115','2025-08-14 00:00:00','VENTE','SORTIE',5,55,NULL,NULL,NULL,NULL,7.000,'registre_ventes',5,NULL,'Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(136,'MVT-0116','2025-08-14 00:00:00','VENTE','SORTIE',5,57,NULL,NULL,NULL,NULL,14.000,'registre_ventes',5,NULL,'Vente registre n° 5 · client : Gosef · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(137,'MVT-0117','2025-08-19 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,20.000,'registre_ventes',6,NULL,'Vente registre n° 6 · client : client Passage · paiement : espèces · livraison : Djerba · registre : « 6*30=180 + 2*10=20 » (200 ml) ; enregistré en 20 flacons de 10 ml (le lot n\'a que 4 flacons de 30 ml, déjà sortis le 04/05)',NULL,'2026-10-11 20:24:28'),
(138,'MVT-0118','2025-09-06 00:00:00','VENTE','SORTIE',4,45,NULL,NULL,NULL,NULL,20.000,'registre_ventes',7,NULL,'Vente registre n° 7 · client : ben abdesslem · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(139,'MVT-0119','2025-09-10 00:00:00','VENTE','SORTIE',4,45,NULL,NULL,NULL,NULL,30.000,'registre_ventes',8,NULL,'Vente registre n° 8 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(140,'MVT-0120','2025-09-15 00:00:00','VENTE','SORTIE',4,45,NULL,NULL,NULL,NULL,30.000,'registre_ventes',9,NULL,'Vente registre n° 9 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(141,'MVT-0121','2025-10-20 00:00:00','CONSOMMATION','SORTIE',2,7,NULL,NULL,NULL,NULL,1.000,'lots_filtration',17,'cb2fa699-85bc-4e25-b083-5670d54d474a',NULL,NULL,'2026-10-11 20:24:28'),
(142,'MVT-0122','2025-10-20 00:00:00','PRODUCTION','ENTREE',3,60,NULL,NULL,NULL,NULL,0.907,'lots_filtration',17,'cb2fa699-85bc-4e25-b083-5670d54d474a',NULL,NULL,'2026-10-11 20:24:28'),
(143,'MVT-0123','2025-10-21 00:00:00','CONSOMMATION','SORTIE',2,15,NULL,NULL,NULL,NULL,1.090,'lots_filtration',18,'8419c80c-13bd-4f62-9e35-02b12d159e20',NULL,NULL,'2026-10-11 20:24:28'),
(144,'MVT-0124','2025-10-21 00:00:00','PRODUCTION','ENTREE',3,61,NULL,NULL,NULL,NULL,0.977,'lots_filtration',18,'8419c80c-13bd-4f62-9e35-02b12d159e20',NULL,NULL,'2026-10-11 20:24:28'),
(145,'MVT-0125','2025-10-23 00:00:00','CONSOMMATION','SORTIE',2,17,NULL,NULL,NULL,NULL,1.000,'lots_filtration',19,'d8838fe4-3f01-4ebf-9a22-5f9a3f47c10f',NULL,NULL,'2026-10-11 20:24:28'),
(146,'MVT-0126','2025-10-23 00:00:00','PRODUCTION','ENTREE',3,62,NULL,NULL,NULL,NULL,0.879,'lots_filtration',19,'d8838fe4-3f01-4ebf-9a22-5f9a3f47c10f',NULL,NULL,'2026-10-11 20:24:28'),
(147,'MVT-0127','2025-10-26 00:00:00','CONSOMMATION','SORTIE',2,27,NULL,NULL,NULL,NULL,1.000,'lots_filtration',20,'e7b6e08b-46ce-432b-894d-9ec88d8b093b',NULL,NULL,'2026-10-11 20:24:28'),
(148,'MVT-0128','2025-10-26 00:00:00','PRODUCTION','ENTREE',3,63,NULL,NULL,NULL,NULL,0.911,'lots_filtration',20,'e7b6e08b-46ce-432b-894d-9ec88d8b093b',NULL,NULL,'2026-10-11 20:24:28'),
(149,'MVT-0129','2025-10-28 00:00:00','CONSOMMATION','SORTIE',2,28,NULL,NULL,NULL,NULL,1.080,'lots_filtration',21,'634657bd-fceb-4e8c-8176-8dc38454223c',NULL,NULL,'2026-10-11 20:24:28'),
(150,'MVT-0130','2025-10-28 00:00:00','PRODUCTION','ENTREE',3,64,NULL,NULL,NULL,NULL,0.988,'lots_filtration',21,'634657bd-fceb-4e8c-8176-8dc38454223c',NULL,NULL,'2026-10-11 20:24:28'),
(151,'MVT-0131','2025-11-03 00:00:00','CONSOMMATION','SORTIE',2,16,NULL,NULL,NULL,NULL,1.090,'lots_filtration',22,'ea30305d-56ae-4479-a254-29f9429f7de8',NULL,NULL,'2026-10-11 20:24:28'),
(152,'MVT-0132','2025-11-03 00:00:00','PRODUCTION','ENTREE',3,65,NULL,NULL,NULL,NULL,0.872,'lots_filtration',22,'ea30305d-56ae-4479-a254-29f9429f7de8',NULL,NULL,'2026-10-11 20:24:28'),
(153,'MVT-0133','2025-11-05 00:00:00','CONSOMMATION','SORTIE',2,10,NULL,NULL,NULL,NULL,0.750,'lots_filtration',23,'80e0d503-315a-4a46-a026-cb332e8d3364',NULL,NULL,'2026-10-11 20:24:28'),
(154,'MVT-0134','2025-11-05 00:00:00','PRODUCTION','ENTREE',3,66,NULL,NULL,NULL,NULL,0.610,'lots_filtration',23,'80e0d503-315a-4a46-a026-cb332e8d3364',NULL,NULL,'2026-10-11 20:24:28'),
(155,'MVT-0135','2025-11-15 00:00:00','VENTE','SORTIE',4,46,NULL,NULL,NULL,NULL,21.000,'registre_ventes',4,NULL,'Vente registre n° 10 · client : louccy · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(156,'MVT-0136-OUT-filtration-6','2026-01-01 00:00:00','CONSOMMATION','SORTIE',3,35,NULL,NULL,NULL,NULL,0.670,'conditionnement',11,'4f63afd7-e2e4-4521-9a61-5c31bf591494',NULL,NULL,'2026-10-11 20:24:28'),
(157,'MVT-0136-OUT-filtration-3','2026-01-01 00:00:00','CONSOMMATION','SORTIE',3,22,NULL,NULL,NULL,NULL,0.670,'conditionnement',11,'4f63afd7-e2e4-4521-9a61-5c31bf591494',NULL,NULL,'2026-10-11 20:24:28'),
(158,'MVT-0136-IN','2026-01-01 00:00:00','CONDITIONNEMENT','ENTREE',4,59,NULL,NULL,NULL,NULL,134.000,'conditionnement',11,'4f63afd7-e2e4-4521-9a61-5c31bf591494',NULL,NULL,'2026-10-11 20:24:28'),
(159,'MVT-0137','2026-01-09 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,30.000,'registre_ventes',7,NULL,'Vente registre n° 11 · client : ben abdesslem · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(160,'MVT-0138','2026-01-16 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,50.000,'registre_ventes',9,NULL,'Vente registre n° 12 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(161,'MVT-0139','2026-01-26 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,21.000,'registre_ventes',10,NULL,'Vente registre n° 13 · client : Relax and spay · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(162,'MVT-0140-OUT-filtration-15','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.068,'conditionnement',12,'a2c9088c-e2c8-4c7e-8487-504ca35902d9',NULL,NULL,'2026-10-11 20:24:28'),
(163,'MVT-0140-OUT-filtration-16','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.232,'conditionnement',12,'a2c9088c-e2c8-4c7e-8487-504ca35902d9',NULL,NULL,'2026-10-11 20:24:28'),
(164,'MVT-0140-IN','2026-02-01 00:00:00','CONDITIONNEMENT','ENTREE',5,67,NULL,NULL,NULL,NULL,10.000,'conditionnement',12,'a2c9088c-e2c8-4c7e-8487-504ca35902d9',NULL,NULL,'2026-10-11 20:24:28'),
(165,'MVT-0141-OUT-filtration-15','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.018,'conditionnement',13,'a473ef63-d1ee-47c2-b91d-7c38bba75ba0',NULL,NULL,'2026-10-11 20:24:28'),
(166,'MVT-0141-OUT-filtration-16','2026-02-01 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.062,'conditionnement',13,'a473ef63-d1ee-47c2-b91d-7c38bba75ba0',NULL,NULL,'2026-10-11 20:24:28'),
(167,'MVT-0141-IN','2026-02-01 00:00:00','CONDITIONNEMENT','ENTREE',4,68,NULL,NULL,NULL,NULL,8.000,'conditionnement',13,'a473ef63-d1ee-47c2-b91d-7c38bba75ba0',NULL,NULL,'2026-10-11 20:24:28'),
(168,'MVT-0142','2026-02-18 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,20.000,'registre_ventes',11,NULL,'Vente registre n° 14 · client : biojerba · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(169,'MVT-0143','2026-02-19 00:00:00','VENTE','SORTIE',4,59,NULL,NULL,NULL,NULL,13.000,'registre_ventes',8,NULL,'Vente registre n° 15 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(170,'MVT-0144','2026-02-21 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,3.000,'registre_ventes',12,NULL,'Vente registre n° 16 · client : client · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(171,'MVT-0145','2026-02-21 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,3.000,'registre_ventes',12,NULL,'Vente registre n° 16 · client : client · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(172,'MVT-0146','2026-02-23 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,4.000,'registre_ventes',13,NULL,'Vente registre n° 17 · client : bernard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(173,'MVT-0147','2026-02-23 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,4.000,'registre_ventes',13,NULL,'Vente registre n° 17 · client : bernard · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(174,'MVT-0148','2026-03-14 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,1.000,'registre_ventes',9,NULL,'Vente registre n° 18 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(175,'MVT-0149','2026-03-14 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,3.000,'registre_ventes',9,NULL,'Vente registre n° 18 · client : omran khaled · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(176,'MVT-0150-OUT-filtration-15','2026-04-07 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.041,'conditionnement',14,'a6303565-aac1-4ec7-9130-74e32f11016d',NULL,NULL,'2026-10-11 20:24:28'),
(177,'MVT-0150-OUT-filtration-16','2026-04-07 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.139,'conditionnement',14,'a6303565-aac1-4ec7-9130-74e32f11016d',NULL,NULL,'2026-10-11 20:24:28'),
(178,'MVT-0150-IN','2026-04-07 00:00:00','CONDITIONNEMENT','ENTREE',5,67,NULL,NULL,NULL,NULL,6.000,'conditionnement',14,'a6303565-aac1-4ec7-9130-74e32f11016d',NULL,NULL,'2026-10-11 20:24:28'),
(179,'MVT-0151-OUT-filtration-15','2026-04-08 00:00:00','CONSOMMATION','SORTIE',3,53,NULL,NULL,NULL,NULL,0.044,'conditionnement',15,'c1b71e18-f296-476e-9ab6-a80583067aa4',NULL,NULL,'2026-10-11 20:24:28'),
(180,'MVT-0151-OUT-filtration-16','2026-04-08 00:00:00','CONSOMMATION','SORTIE',3,54,NULL,NULL,NULL,NULL,0.148,'conditionnement',15,'c1b71e18-f296-476e-9ab6-a80583067aa4',NULL,NULL,'2026-10-11 20:24:28'),
(181,'MVT-0151-IN','2026-04-08 00:00:00','CONDITIONNEMENT','ENTREE',4,68,NULL,NULL,NULL,NULL,19.000,'conditionnement',15,'c1b71e18-f296-476e-9ab6-a80583067aa4',NULL,NULL,'2026-10-11 20:24:28'),
(182,'MVT-0152-OUT-filtration-13','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,50,NULL,NULL,NULL,NULL,0.015,'conditionnement',16,'1e0c93b3-01a7-4768-82cb-7c22f15e3b85',NULL,NULL,'2026-10-11 20:24:28'),
(183,'MVT-0152-OUT-filtration-12','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,49,NULL,NULL,NULL,NULL,0.015,'conditionnement',16,'1e0c93b3-01a7-4768-82cb-7c22f15e3b85',NULL,NULL,'2026-10-11 20:24:28'),
(184,'MVT-0152-IN','2026-05-09 00:00:00','CONDITIONNEMENT','ENTREE',5,69,NULL,NULL,NULL,NULL,1.000,'conditionnement',16,'1e0c93b3-01a7-4768-82cb-7c22f15e3b85',NULL,NULL,'2026-10-11 20:24:28'),
(185,'MVT-0153-OUT-filtration-13','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,50,NULL,NULL,NULL,NULL,0.012,'conditionnement',17,'64c489a1-512a-4316-bcf1-b4bdd56181f0',NULL,NULL,'2026-10-11 20:24:28'),
(186,'MVT-0153-OUT-filtration-12','2026-05-09 00:00:00','CONSOMMATION','SORTIE',3,49,NULL,NULL,NULL,NULL,0.013,'conditionnement',17,'64c489a1-512a-4316-bcf1-b4bdd56181f0',NULL,NULL,'2026-10-11 20:24:28'),
(187,'MVT-0153-IN','2026-05-09 00:00:00','CONDITIONNEMENT','ENTREE',4,70,NULL,NULL,NULL,NULL,2.000,'conditionnement',17,'64c489a1-512a-4316-bcf1-b4bdd56181f0',NULL,NULL,'2026-10-11 20:24:28'),
(188,'MVT-0154-OUT-filtration-1','2026-05-10 00:00:00','CONSOMMATION','SORTIE',3,3,NULL,NULL,NULL,NULL,0.433,'conditionnement',18,'9a086b8a-1ef5-4291-bec8-39806b9a3bc1',NULL,NULL,'2026-10-11 20:24:28'),
(189,'MVT-0154-OUT-filtration-23','2026-05-10 00:00:00','CONSOMMATION','SORTIE',3,66,NULL,NULL,NULL,NULL,0.347,'conditionnement',18,'9a086b8a-1ef5-4291-bec8-39806b9a3bc1',NULL,NULL,'2026-10-11 20:24:28'),
(190,'MVT-0154-IN','2026-05-10 00:00:00','CONDITIONNEMENT','ENTREE',5,71,NULL,NULL,NULL,NULL,26.000,'conditionnement',18,'9a086b8a-1ef5-4291-bec8-39806b9a3bc1',NULL,NULL,'2026-10-11 20:24:28'),
(191,'MVT-0155-OUT-filtration-1','2026-05-11 00:00:00','CONSOMMATION','SORTIE',3,3,NULL,NULL,NULL,NULL,0.327,'conditionnement',19,'a5abdbe0-f340-409a-8c11-b9f0972a211c',NULL,NULL,'2026-10-11 20:24:28'),
(192,'MVT-0155-OUT-filtration-23','2026-05-11 00:00:00','CONSOMMATION','SORTIE',3,66,NULL,NULL,NULL,NULL,0.263,'conditionnement',19,'a5abdbe0-f340-409a-8c11-b9f0972a211c',NULL,NULL,'2026-10-11 20:24:28'),
(193,'MVT-0155-IN','2026-05-11 00:00:00','CONDITIONNEMENT','ENTREE',4,72,NULL,NULL,NULL,NULL,59.000,'conditionnement',19,'a5abdbe0-f340-409a-8c11-b9f0972a211c',NULL,NULL,'2026-10-11 20:24:28'),
(194,'MVT-0156','2026-05-22 00:00:00','VENTE','SORTIE',4,70,NULL,NULL,NULL,NULL,2.000,'registre_ventes',14,NULL,'Vente registre n° 18 · client : client passaget · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(195,'MVT-0157','2026-05-22 00:00:00','VENTE','SORTIE',5,69,NULL,NULL,NULL,NULL,1.000,'registre_ventes',14,NULL,'Vente registre n° 18 · client : client passaget · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(196,'MVT-0158','2026-05-26 00:00:00','VENTE','SORTIE',4,68,NULL,NULL,NULL,NULL,19.000,'registre_ventes',8,NULL,'Vente registre n° 18 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(197,'MVT-0159','2026-05-26 00:00:00','VENTE','SORTIE',5,67,NULL,NULL,NULL,NULL,6.000,'registre_ventes',8,NULL,'Vente registre n° 18 · client : artisanet · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(198,'MVT-0160','2026-07-19 00:00:00','VENTE','SORTIE',4,72,NULL,NULL,NULL,NULL,59.000,'registre_ventes',15,NULL,'Vente registre n° 18 · client : passaget claude · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28'),
(199,'MVT-0161','2026-07-19 00:00:00','VENTE','SORTIE',5,71,NULL,NULL,NULL,NULL,26.000,'registre_ventes',15,NULL,'Vente registre n° 18 · client : passaget claude · paiement : espèces · livraison : Djerba',NULL,'2026-10-11 20:24:28');
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

REPLACE INTO `sequences` (`name`, `last_value`) VALUES ('lot_jj_fini_2024',3),
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
