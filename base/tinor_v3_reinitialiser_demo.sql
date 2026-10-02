-- ============================================================================
-- TinOR V3 — REMISE À ZÉRO + DONNÉES DE DÉMONSTRATION
--
-- ⚠ EFFACE TOUT LE CONTENU des 45 tables (produits, lots, commandes,
--   factures, utilisateurs…), puis charge le jeu de démonstration.
--   La structure des tables n'est pas modifiée.
--   FAIRE UNE SAUVEGARDE AVANT (phpMyAdmin › Exporter, ou npm run backup).
--
-- À exécuter sur une base TinOR V3 EXISTANTE (tables déjà créées) :
--   phpMyAdmin / HeidiSQL : sélectionner la base → Importer ce fichier
--   ou : mysql -u tinor -p tinor_v3 < base/tinor_v3_reinitialiser_demo.sql
--   ou : npm run reset:demo -- --confirmer
-- Après : se connecter avec admin / changeme (l'ancien compte est effacé).
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------- Vidage
TRUNCATE TABLE `categories`;
TRUNCATE TABLE `unites`;
TRUNCATE TABLE `formats`;
TRUNCATE TABLE `produits`;
TRUNCATE TABLE `grille_huiles`;
TRUNCATE TABLE `grille_historique`;
TRUNCATE TABLE `grille_cout_overrides`;
TRUNCATE TABLE `grille_detail_overrides`;
TRUNCATE TABLE `remises`;
TRUNCATE TABLE `clients`;
TRUNCATE TABLE `certificats_bio`;
TRUNCATE TABLE `fournisseurs`;
TRUNCATE TABLE `employes`;
TRUNCATE TABLE `locaux`;
TRUNCATE TABLE `local_zones`;
TRUNCATE TABLE `lots`;
TRUNCATE TABLE `lot_statuts_historique`;
TRUNCATE TABLE `lot_sequences`;
TRUNCATE TABLE `stock_mouvements`;
TRUNCATE TABLE `achats`;
TRUNCATE TABLE `achat_lignes`;
TRUNCATE TABLE `receptions`;
TRUNCATE TABLE `reception_lignes`;
TRUNCATE TABLE `lots_presse`;
TRUNCATE TABLE `lots_filtration`;
TRUNCATE TABLE `lots_filtration_sources`;
TRUNCATE TABLE `conditionnements`;
TRUNCATE TABLE `conditionnement_sources`;
TRUNCATE TABLE `recettes`;
TRUNCATE TABLE `recette_ingredients`;
TRUNCATE TABLE `ordres_production`;
TRUNCATE TABLE `lot_origines`;
TRUNCATE TABLE `commandes`;
TRUNCATE TABLE `commande_lignes`;
TRUNCATE TABLE `factures`;
TRUNCATE TABLE `facture_lignes`;
TRUNCATE TABLE `paiements`;
TRUNCATE TABLE `inventaires`;
TRUNCATE TABLE `inventaire_lignes`;
TRUNCATE TABLE `controles_qualite`;
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `sequences`;
TRUNCATE TABLE `settings`;
TRUNCATE TABLE `lot_type_champs`;

-- ---------------------------------------------------------------- Données de démonstration
INSERT INTO `achat_lignes` (`id`, `achat_id`, `produit_id`, `quantite`, `prix_unitaire`, `total_ht`, `lot_fournisseur`, `date_expiration`, `lot_id`) VALUES (1,1,10,1000.000,0.350,350.000,NULL,NULL,3),
(2,1,11,2000.000,0.050,100.000,NULL,NULL,4);
INSERT INTO `achats` (`id`, `numero`, `fournisseur_id`, `date_achat`, `statut`, `total_ht`, `tva`, `total_ttc`, `notes`, `employe_id`, `created_at`) VALUES (1,'ACH-0001',2,'2026-08-01','receptionne',450.000,85.500,535.500,NULL,NULL,'2026-10-02 21:53:45');
INSERT INTO `categories` (`id`, `code`, `nom`, `type_category`, `actif`) VALUES (1,'HUILE','Huiles','PRODUIT',1),
(2,'CONS','Consommables','CONSOMMABLE',1),
(3,'EMBALLAGE','Emballages','EMBALLAGE',1),
(4,'SAVON','Savons','PRODUIT',1),
(5,'COMPOSE','Produits composés','PRODUIT',1);
INSERT INTO `certificats_bio` (`id`, `numero`, `organisme`, `date_delivrance`, `date_expiration`, `portee`, `document_ref`, `created_at`) VALUES (1,'BIO-2026-014','ECOCERT','2026-01-01','2027-01-01','Huiles vierges — parcelles Djerba Midoun',NULL,'2026-10-02 21:53:45');
INSERT INTO `clients` (`id`, `nom`, `tel`, `ville`, `matricule_fiscal`, `type`, `remise_id`, `notes`, `created_at`) VALUES (1,'Pharmacie El Menzah','71 234 567','Ariana','9988776/C/M/000','pharmacie',1,NULL,'2026-10-02 21:53:45'),
(2,'Amira Ben Salah','22 345 678','Tunis',NULL,'particulier',NULL,NULL,'2026-10-02 21:53:45'),
(3,'Boutique Bio Sud',NULL,'Djerba','4433221/D/M/000','revendeur',2,NULL,'2026-10-02 21:53:45');
INSERT INTO `commande_lignes` (`id`, `commande_id`, `produit_id`, `lot_id`, `qty`, `prix_detail`, `unit_price`, `total`, `remise_id`, `remise_nom`, `remise_pct`, `remise_type`, `free_units`, `cumule`) VALUES (1,1,6,8,20.00,9.500,8.550,171.000,1,'Gros volume',10.00,'pourcentage',0,0),
(2,1,9,12,50.00,4.200,3.780,189.000,1,'Gros volume',10.00,'pourcentage',0,0),
(3,2,7,9,3.00,4.500,4.500,13.500,NULL,NULL,NULL,NULL,0,0),
(4,2,8,10,1.00,12.000,12.000,12.000,NULL,NULL,NULL,NULL,0,0),
(5,3,9,12,100.00,4.200,3.990,399.000,2,'Client fidèle',5.00,'pourcentage',0,0);
INSERT INTO `commandes` (`id`, `numero`, `client_id`, `date_iso`, `statut`, `notes`, `total`, `created_by`, `employe_id`, `created_at`) VALUES (1,'CMD-0001',1,'2026-10-02 21:53:45','livree',NULL,360.000,NULL,NULL,'2026-10-02 21:53:45'),
(2,'CMD-0002',2,'2026-10-02 21:53:45','livree',NULL,25.500,NULL,NULL,'2026-10-02 21:53:45'),
(3,'CMD-0003',3,'2026-10-02 21:53:45','livree',NULL,399.000,NULL,NULL,'2026-10-02 21:53:45');
INSERT INTO `conditionnement_sources` (`id`, `conditionnement_id`, `lot_presse_id`, `lot_filtration_id`, `lot_id`, `quantite_utilisee`) VALUES (1,1,NULL,1,NULL,24.000),
(2,2,NULL,1,NULL,5.000),
(3,3,2,NULL,NULL,12.000),
(4,4,NULL,NULL,11,72.000);
INSERT INTO `conditionnements` (`id`, `date`, `produit_id`, `format_id`, `lot_id`, `qty`, `quantite_source_utilisee`, `note`, `employe_id`, `created_at`) VALUES (1,'2026-08-07',6,2,8,800.00,24.000,NULL,3,'2026-10-02 21:53:45'),
(2,'2026-08-08',7,1,9,500.00,5.000,NULL,3,'2026-10-02 21:53:45'),
(3,'2026-08-09',8,2,10,400.00,12.000,NULL,3,'2026-10-02 21:53:45'),
(4,'2026-08-11',9,6,12,900.00,72.000,NULL,3,'2026-10-02 21:53:45');
INSERT INTO `employes` (`id`, `matricule`, `nom`, `prenom`, `fonction`, `telephone`, `email`, `date_entree`, `actif`, `created_at`, `updated_at`) VALUES (1,'EMP-000','Admin','Compte','Gérant',NULL,NULL,NULL,1,'2026-10-02 21:53:43','2026-10-02 21:53:43'),
(2,'EMP-001','Ben Salah','Karim',NULL,NULL,NULL,NULL,1,'2026-10-02 21:53:45','2026-10-02 21:53:45'),
(3,'EMP-002','Trabelsi','Sami',NULL,NULL,NULL,NULL,1,'2026-10-02 21:53:45','2026-10-02 21:53:45');
INSERT INTO `facture_lignes` (`id`, `facture_id`, `designation`, `prix_detail`, `unit_price`, `qty`, `total`, `remise_nom`, `remise_pct`) VALUES (1,1,'Huile de Sésame — Flacon 30ml',9.500,8.550,20.00,171.000,'Gros volume',10.00),
(2,1,'Savon Olive — 80g',4.200,3.780,50.00,189.000,'Gros volume',10.00),
(3,2,'Huile de Sésame — Flacon 10ml',4.500,4.500,3.00,13.500,NULL,NULL),
(4,2,'Huile de Nigelle — Flacon 30ml',12.000,12.000,1.00,12.000,NULL,NULL),
(5,3,'Savon Olive — 80g',4.200,3.990,100.00,399.000,'Client fidèle',5.00);
INSERT INTO `factures` (`id`, `numero`, `statut`, `commande_id`, `commande_numero`, `client_id`, `client_nom`, `date_emission`, `tva_rate`, `fodec_montant`, `droit_timbre`, `total_ht`, `montant_tva`, `total_ttc`, `created_at`) VALUES (1,'FAC-0001','emise',1,'CMD-0001',1,'Pharmacie El Menzah','2026-10-02',19.00,3.025,0.000,302.521,58.054,363.600,'2026-10-02 21:53:45'),
(2,'FAC-0002','emise',2,'CMD-0002',2,'Amira Ben Salah','2026-10-02',19.00,0.214,0.000,21.429,4.112,25.755,'2026-10-02 21:53:45'),
(3,'FAC-0003','emise',3,'CMD-0003',3,'Boutique Bio Sud','2026-10-02',19.00,3.353,0.000,335.294,64.343,402.990,'2026-10-02 21:53:45');
INSERT INTO `formats` (`id`, `code`, `nom`, `volume`, `poids`, `unite_id`, `actif`) VALUES (1,'10ml','10 ml',10.000,NULL,2,1),
(2,'30ml','30 ml',30.000,NULL,2,1),
(3,'100ml','100 ml',100.000,NULL,2,1),
(4,'250ml','250 ml',250.000,NULL,2,1),
(5,'1000ml','1000 ml',1000.000,NULL,2,1),
(6,'80g','80 g',NULL,80.000,3,1);
INSERT INTO `fournisseurs` (`id`, `nom`, `type`, `matricule_fiscal`, `localisation`, `statut_bio`, `certificat_id`, `telephone`, `email`, `notes`, `created_at`) VALUES (1,'Parcelle Sésame Djerba','parcelle',NULL,'Midoun, Djerba','certifie',1,'98 111 222',NULL,NULL,'2026-10-02 21:53:45'),
(2,'Emballages du Sud SARL','emballage','1122334/A/M/000','Sfax','conversion',NULL,'74 555 666',NULL,NULL,'2026-10-02 21:53:45'),
(3,'Négoce Huiles Tunisie','fournisseur_externe','5566778/B/M/000','Tunis','conversion',NULL,NULL,NULL,NULL,'2026-10-02 21:53:45');
INSERT INTO `locaux` (`id`, `code`, `nom`, `type_local`, `description`, `adresse`, `actif`, `created_at`) VALUES (1,'ATELIER','Atelier Djerba','PRODUCTION',NULL,NULL,1,'2026-10-02 21:53:43'),
(2,'STOCK1','Entrepôt Principal','STOCK',NULL,NULL,1,'2026-10-02 21:53:43');
INSERT INTO `lot_origines` (`id`, `lot_fils_id`, `lot_source_id`, `quantite_utilisee`) VALUES (1,5,1,200.000),
(2,6,2,100.000),
(3,7,5,60.000),
(4,8,7,24.000),
(5,9,7,5.000),
(6,10,6,12.000),
(7,12,11,72.000);
INSERT INTO `lot_sequences` (`produit_id`, `origine`, `last_seq`) VALUES (1,'',1),
(2,'',1),
(3,'',2),
(4,'',1),
(5,'',1),
(6,'',1),
(7,'',1),
(8,'',1),
(9,'',1),
(10,'',1),
(11,'',1);
INSERT INTO `lot_statuts_historique` (`id`, `lot_id`, `statut`, `motif`, `employe_id`, `date_debut`) VALUES (1,1,'LIBERE','Création via réception',NULL,'2026-10-02 21:53:45'),
(2,2,'LIBERE','Création via réception',NULL,'2026-10-02 21:53:45'),
(3,3,'LIBERE','Création via réception',NULL,'2026-10-02 21:53:45'),
(4,4,'LIBERE','Création via réception',NULL,'2026-10-02 21:53:45'),
(5,5,'LIBERE','Création via pressage',2,'2026-10-02 21:53:45'),
(6,6,'LIBERE','Création via pressage',2,'2026-10-02 21:53:45'),
(7,7,'LIBERE','Création via filtration',2,'2026-10-02 21:53:45'),
(8,8,'LIBERE','Création via conditionnement',3,'2026-10-02 21:53:45'),
(9,9,'LIBERE','Création via conditionnement',3,'2026-10-02 21:53:45'),
(10,10,'LIBERE','Création via conditionnement',3,'2026-10-02 21:53:45'),
(11,11,'LIBERE','Création via réception',NULL,'2026-10-02 21:53:45'),
(12,12,'LIBERE','Création via conditionnement',3,'2026-10-02 21:53:45');
INSERT INTO `lot_type_champs` (`id`, `type_lot`, `nom`, `type_champ`, `obligatoire`, `verrouille`, `ordre`, `created_at`) VALUES (1,'ACHAT','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(2,'ACHAT','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(3,'ACHAT','Date','date',1,1,2,'2026-10-02 21:53:43'),
(4,'RECEPTION_MP','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(5,'RECEPTION_MP','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(6,'RECEPTION_MP','Date','date',1,1,2,'2026-10-02 21:53:43'),
(7,'PRESSE','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(8,'PRESSE','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(9,'PRESSE','Date','date',1,1,2,'2026-10-02 21:53:43'),
(10,'FILTRATION','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(11,'FILTRATION','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(12,'FILTRATION','Date','date',1,1,2,'2026-10-02 21:53:43'),
(13,'CONDITIONNEMENT','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(14,'CONDITIONNEMENT','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(15,'CONDITIONNEMENT','Date','date',1,1,2,'2026-10-02 21:53:43'),
(16,'PRODUCTION_RECETTE','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(17,'PRODUCTION_RECETTE','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(18,'PRODUCTION_RECETTE','Date','date',1,1,2,'2026-10-02 21:53:43'),
(19,'INVENTAIRE','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(20,'INVENTAIRE','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(21,'INVENTAIRE','Date','date',1,1,2,'2026-10-02 21:53:43'),
(22,'AUTRE','N° de lot','texte',1,1,0,'2026-10-02 21:53:43'),
(23,'AUTRE','Produit','liste',1,1,1,'2026-10-02 21:53:43'),
(24,'AUTRE','Date','date',1,1,2,'2026-10-02 21:53:43');
INSERT INTO `lots` (`id`, `produit_id`, `numero_lot`, `origine`, `fournisseur_id`, `lot_fournisseur`, `certificat_bio_id`, `bio_status`, `local_id`, `zone_id`, `date_production`, `date_expiration`, `quantite_initiale`, `quantite_actuelle`, `statut`, `notes`, `champs_perso`, `employe_id`, `created_at`) VALUES (1,1,'01-MP-001','RECEPTION_MP',1,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,300.000,100.000,'LIBERE',NULL,NULL,NULL,'2026-10-02 21:53:45'),
(2,2,'02-MP-001','RECEPTION_MP',1,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,150.000,50.000,'LIBERE',NULL,NULL,NULL,'2026-10-02 21:53:45'),
(3,10,'10-A-001','ACHAT',2,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,1000.000,1000.000,'LIBERE',NULL,NULL,NULL,'2026-10-02 21:53:45'),
(4,11,'11-A-001','ACHAT',2,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,2000.000,2000.000,'LIBERE',NULL,NULL,NULL,'2026-10-02 21:53:45'),
(5,3,'03-P-001','PRESSE',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,70.000,10.000,'LIBERE',NULL,NULL,2,'2026-10-02 21:53:45'),
(6,4,'04-P-001','PRESSE',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,32.000,20.000,'LIBERE',NULL,NULL,2,'2026-10-02 21:53:45'),
(7,3,'03-F-002','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,55.000,26.000,'LIBERE',NULL,NULL,2,'2026-10-02 21:53:45'),
(8,6,'06-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,800.000,780.000,'LIBERE',NULL,NULL,3,'2026-10-02 21:53:45'),
(9,7,'07-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,500.000,497.000,'LIBERE',NULL,NULL,3,'2026-10-02 21:53:45'),
(10,8,'08-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,400.000,399.000,'LIBERE',NULL,NULL,3,'2026-10-02 21:53:45'),
(11,5,'05-A-001','ACHAT',3,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,76.000,4.000,'LIBERE',NULL,NULL,NULL,'2026-10-02 21:53:45'),
(12,9,'09-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,900.000,750.000,'LIBERE',NULL,NULL,3,'2026-10-02 21:53:45');
INSERT INTO `lots_filtration` (`id`, `date`, `produit_id`, `lot_id`, `filtre_utilise`, `quantite_dechet`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2026-08-06',3,7,NULL,NULL,55.000,0.9167,'03-F-002',NULL,2,'2026-10-02 21:53:45');
INSERT INTO `lots_filtration_sources` (`id`, `lot_filtration_id`, `lot_presse_id`, `quantite_utilisee`) VALUES (1,1,1,60.000);
INSERT INTO `lots_presse` (`id`, `date`, `produit_id`, `reception_id`, `lot_id`, `quantite_matiere_utilisee`, `quantite_tourteau`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2026-08-04',3,NULL,5,200.000,NULL,70.000,0.3500,'03-P-001',NULL,2,'2026-10-02 21:53:45'),
(2,'2026-08-05',4,NULL,6,100.000,NULL,32.000,0.3200,'04-P-001',NULL,2,'2026-10-02 21:53:45');
INSERT INTO `paiements` (`id`, `facture_id`, `date_paiement`, `montant`, `mode`, `reference`, `notes`) VALUES (1,1,'2026-08-12',363.600,'virement','VIR-0012',NULL),
(2,2,'2026-08-13',12.878,'especes',NULL,NULL);
INSERT INTO `produits` (`id`, `code`, `barcode`, `nom`, `description`, `categorie_id`, `unite_id`, `format_id`, `type_article`, `produit_source_id`, `vendable`, `achetable`, `fabriquable`, `stockable`, `actif`, `bio_eligible`, `prix_vente`, `cout_standard`, `stock_min`, `tva`, `notes`, `created_at`) VALUES (1,'01',NULL,'Graines de Sésame',NULL,1,3,NULL,'MATIERE_PREMIERE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(2,'02',NULL,'Graines de Nigelle',NULL,1,3,NULL,'MATIERE_PREMIERE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(3,'03',NULL,'Huile de Sésame — Vrac',NULL,1,1,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(4,'04',NULL,'Huile de Nigelle — Vrac',NULL,1,1,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(5,'05',NULL,'Pâte à Savon Olive — Vrac',NULL,4,3,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(6,'06',NULL,'Huile de Sésame — Flacon 30ml',NULL,1,5,2,'PRODUIT_FABRIQUE',3,1,0,0,1,1,0,9.500,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(7,'07',NULL,'Huile de Sésame — Flacon 10ml',NULL,1,5,1,'PRODUIT_FABRIQUE',3,1,0,0,1,1,0,4.500,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(8,'08',NULL,'Huile de Nigelle — Flacon 30ml',NULL,1,5,2,'PRODUIT_FABRIQUE',4,1,0,0,1,1,0,12.000,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(9,'09',NULL,'Savon Olive — 80g',NULL,4,5,6,'PRODUIT_FABRIQUE',5,1,0,0,1,1,0,4.200,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(10,'10',NULL,'Flacon verre 30ml',NULL,3,5,2,'EMBALLAGE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45'),
(11,'11',NULL,'Étiquette adhésive',NULL,2,5,NULL,'CONSOMMABLE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-02 21:53:45');
INSERT INTO `reception_lignes` (`id`, `reception_id`, `produit_id`, `lot_id`, `quantite`, `lot_fournisseur`, `date_expiration`, `certificat_bio_id`, `zone_id`) VALUES (1,1,1,1,300.000,NULL,NULL,NULL,NULL),
(2,2,2,2,150.000,NULL,NULL,NULL,NULL),
(3,3,10,3,1000.000,NULL,NULL,NULL,NULL),
(4,3,11,4,2000.000,NULL,NULL,NULL,NULL),
(5,4,5,11,76.000,NULL,NULL,NULL,NULL);
INSERT INTO `receptions` (`id`, `numero`, `fournisseur_id`, `achat_id`, `date_reception`, `local_id`, `statut`, `notes`, `employe_id`) VALUES (1,'REC-0001',1,NULL,'2026-08-01',2,'receptionnee',NULL,NULL),
(2,'REC-0002',1,NULL,'2026-08-02',2,'receptionnee',NULL,NULL),
(3,'REC-0003',2,1,'2026-08-03',2,'receptionnee',NULL,NULL),
(4,'REC-0004',3,NULL,'2026-08-05',2,'receptionnee',NULL,NULL);
INSERT INTO `remises` (`id`, `nom`, `type`, `pourcentage`, `achete`, `gratuit`, `protege`, `categorie`) VALUES (1,'Gros volume','pourcentage',10.00,NULL,NULL,0,'client'),
(2,'Client fidèle','pourcentage',5.00,NULL,NULL,0,'client');
INSERT INTO `sequences` (`name`, `last_value`) VALUES ('achat_seq',1),
('commande_seq',3),
('facture_seq',3),
('mouvement_seq',17),
('produit_code_seq',11),
('reception_seq',4);
INSERT INTO `settings` (`id`, `salaire`, `matiere_pct`, `rend_pct`, `marge`, `tva`, `ref_source`, `prix_remise_id`, `cumuler_lot`, `offre_achete`, `offre_gratuit`, `fodec_rate`, `droit_timbre`, `timbre_seuil`, `entreprise_nom`, `entreprise_adresse`, `entreprise_telephone`, `entreprise_email`, `entreprise_matricule_fiscal`, `entreprise_logo`, `facture_couleur`, `lot_format_style`, `lot_seq_par_origine`) VALUES (1,40.00,0.00,0.00,45.00,19.00,'tableau',NULL,1,9,1,1.00,1.000,1000.000,'STE JAS — Les Jardins de Jerba','Djerba Midoun, Tunisie','93 340 008','contact@lesjardinsdejerba.com','0985207/N/NM',NULL,'#A97D2F','code_origine_seq',0);
INSERT INTO `stock_mouvements` (`id`, `numero`, `date_mouvement`, `type_mouvement`, `sens`, `produit_id`, `lot_id`, `local_id`, `zone_id`, `zone_source_id`, `zone_destination_id`, `quantite`, `source_type`, `source_id`, `group_id`, `note`, `employe_id`, `created_at`) VALUES (1,'MVT-0001','2026-10-02 21:53:45','RECEPTION','ENTREE',1,1,NULL,NULL,NULL,NULL,300.000,'reception',1,NULL,NULL,NULL,'2026-10-02 21:53:45'),
(2,'MVT-0002','2026-10-02 21:53:45','RECEPTION','ENTREE',2,2,NULL,NULL,NULL,NULL,150.000,'reception',2,NULL,NULL,NULL,'2026-10-02 21:53:45'),
(3,'MVT-0003','2026-10-02 21:53:45','ACHAT','ENTREE',10,3,NULL,NULL,NULL,NULL,1000.000,'reception',3,NULL,NULL,NULL,'2026-10-02 21:53:45'),
(4,'MVT-0004','2026-10-02 21:53:45','ACHAT','ENTREE',11,4,NULL,NULL,NULL,NULL,2000.000,'reception',3,NULL,NULL,NULL,'2026-10-02 21:53:45'),
(5,'MVT-0005-OUT','2026-10-02 21:53:45','CONSOMMATION','SORTIE',1,1,NULL,NULL,NULL,NULL,200.000,'lots_presse',5,'8489b591-5d25-445c-8a3f-ec4810071040',NULL,2,'2026-10-02 21:53:45'),
(6,'MVT-0005-IN','2026-10-02 21:53:45','PRODUCTION','ENTREE',3,5,NULL,NULL,NULL,NULL,70.000,'lots_presse',5,'8489b591-5d25-445c-8a3f-ec4810071040',NULL,2,'2026-10-02 21:53:45'),
(7,'MVT-0006-OUT','2026-10-02 21:53:45','CONSOMMATION','SORTIE',2,2,NULL,NULL,NULL,NULL,100.000,'lots_presse',6,'68bf6158-c32a-49d8-8356-bca3168715e7',NULL,2,'2026-10-02 21:53:45'),
(8,'MVT-0006-IN','2026-10-02 21:53:45','PRODUCTION','ENTREE',4,6,NULL,NULL,NULL,NULL,32.000,'lots_presse',6,'68bf6158-c32a-49d8-8356-bca3168715e7',NULL,2,'2026-10-02 21:53:45'),
(9,'MVT-0007-OUT-1','2026-10-02 21:53:45','CONSOMMATION','SORTIE',3,5,NULL,NULL,NULL,NULL,60.000,'lots_filtration',1,'e308d593-24c7-46c6-96cc-1ad9f1d4de75',NULL,2,'2026-10-02 21:53:45'),
(10,'MVT-0007-IN','2026-10-02 21:53:45','PRODUCTION','ENTREE',3,7,NULL,NULL,NULL,NULL,55.000,'lots_filtration',1,'e308d593-24c7-46c6-96cc-1ad9f1d4de75',NULL,2,'2026-10-02 21:53:45'),
(11,'MVT-0008-OUT-filtration-1','2026-10-02 21:53:45','CONSOMMATION','SORTIE',3,7,NULL,NULL,NULL,NULL,24.000,'conditionnement',1,'eaf16d5e-203d-420a-8f71-d89e8f9fb4b1',NULL,3,'2026-10-02 21:53:45'),
(12,'MVT-0008-IN','2026-10-02 21:53:45','CONDITIONNEMENT','ENTREE',6,8,NULL,NULL,NULL,NULL,800.000,'conditionnement',1,'eaf16d5e-203d-420a-8f71-d89e8f9fb4b1',NULL,3,'2026-10-02 21:53:45'),
(13,'MVT-0009-OUT-filtration-1','2026-10-02 21:53:45','CONSOMMATION','SORTIE',3,7,NULL,NULL,NULL,NULL,5.000,'conditionnement',2,'12709710-e926-4f98-8ba7-f7c9d144acc2',NULL,3,'2026-10-02 21:53:45'),
(14,'MVT-0009-IN','2026-10-02 21:53:45','CONDITIONNEMENT','ENTREE',7,9,NULL,NULL,NULL,NULL,500.000,'conditionnement',2,'12709710-e926-4f98-8ba7-f7c9d144acc2',NULL,3,'2026-10-02 21:53:45'),
(15,'MVT-0010-OUT-presse-2','2026-10-02 21:53:45','CONSOMMATION','SORTIE',4,6,NULL,NULL,NULL,NULL,12.000,'conditionnement',3,'96bcd65a-792d-49a8-8566-ae05d8929b39',NULL,3,'2026-10-02 21:53:45'),
(16,'MVT-0010-IN','2026-10-02 21:53:45','CONDITIONNEMENT','ENTREE',8,10,NULL,NULL,NULL,NULL,400.000,'conditionnement',3,'96bcd65a-792d-49a8-8566-ae05d8929b39',NULL,3,'2026-10-02 21:53:45'),
(17,'MVT-0011','2026-10-02 21:53:45','RECEPTION','ENTREE',5,11,NULL,NULL,NULL,NULL,76.000,'reception',4,NULL,NULL,NULL,'2026-10-02 21:53:45'),
(18,'MVT-0012-OUT-direct-11','2026-10-02 21:53:45','CONSOMMATION','SORTIE',5,11,NULL,NULL,NULL,NULL,72.000,'conditionnement',4,'b633947c-80a5-4242-b0ea-8543ce76a5e2',NULL,3,'2026-10-02 21:53:45'),
(19,'MVT-0012-IN','2026-10-02 21:53:45','CONDITIONNEMENT','ENTREE',9,12,NULL,NULL,NULL,NULL,900.000,'conditionnement',4,'b633947c-80a5-4242-b0ea-8543ce76a5e2',NULL,3,'2026-10-02 21:53:45'),
(20,'MVT-0013','2026-10-02 21:53:45','VENTE','SORTIE',6,8,NULL,NULL,NULL,NULL,20.000,'commande',1,'bcbbae94-985f-4354-bd24-08ba68bf2e8f',NULL,NULL,'2026-10-02 21:53:45'),
(21,'MVT-0014','2026-10-02 21:53:45','VENTE','SORTIE',9,12,NULL,NULL,NULL,NULL,50.000,'commande',1,'bcbbae94-985f-4354-bd24-08ba68bf2e8f',NULL,NULL,'2026-10-02 21:53:45'),
(22,'MVT-0015','2026-10-02 21:53:45','VENTE','SORTIE',7,9,NULL,NULL,NULL,NULL,3.000,'commande',2,'2f843ce0-cb6c-485b-acb9-14fb311dc83f',NULL,NULL,'2026-10-02 21:53:45'),
(23,'MVT-0016','2026-10-02 21:53:45','VENTE','SORTIE',8,10,NULL,NULL,NULL,NULL,1.000,'commande',2,'2f843ce0-cb6c-485b-acb9-14fb311dc83f',NULL,NULL,'2026-10-02 21:53:45'),
(24,'MVT-0017','2026-10-02 21:53:45','VENTE','SORTIE',9,12,NULL,NULL,NULL,NULL,100.000,'commande',3,'e17fc7de-a76a-4a26-87d5-2e8eb48f899d',NULL,NULL,'2026-10-02 21:53:45');
INSERT INTO `unites` (`id`, `code`, `nom`, `symbole`, `actif`) VALUES (1,'litre','Litre','L',1),
(2,'ml','Millilitre','ml',1),
(3,'kg','Kilogramme','kg',1),
(4,'g','Gramme','g',1),
(5,'unite','Unité','u',1);
INSERT INTO `users` (`id`, `username`, `password_hash`, `employe_id`, `role`, `actif`, `created_at`) VALUES (1,'admin','$2b$10$HR2pIfMBY564orJkzTlsSuLphdz9Zfn7UMc63YtLeGPE4erkMBYEy',1,'gerant',1,'2026-10-02 21:53:43');
SET FOREIGN_KEY_CHECKS = 1;
