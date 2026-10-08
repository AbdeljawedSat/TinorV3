-- ============================================================================
-- TinOR V3 — base MariaDB / MySQL : DÉMONSTRATION (base vierge + jeu de données d'exemple complet)
-- Structure : identique à la version initiale (tinor_erp_v3_schema.sql, 45 tables).
-- Seul changement : la colonne sequences.last_value est écrite `last_value`
-- (mot réservé en MySQL 8) — même nom, même type, rien d'autre ne change.
-- Testé à l'import sur MariaDB 10.11 et MySQL 8.4.
-- Compte : admin / changeme — À CHANGER après la première connexion.
--
-- Import dans une base VIDE (ex. tinor_v3) :
--   mysql -u tinor -p tinor_v3 < tinor_v3_demo.sql
--   ou phpMyAdmin / HeidiSQL : sélectionner la base → Importer ce fichier.
-- ============================================================================

-- ---------------------------------------------------------------- Structure
-- ============================================================================
-- TinOR ERP — Schéma cible V5 (lots, locaux et traçabilité employés)
-- Base : tinor_erp (MariaDB 10.11+ / InnoDB / utf8mb4)
--
-- PRINCIPE : reconstruction propre, pas de patch sur l'ancienne base.
-- Respecte l'architecture du rapport (référentiel unique, lots génériques,
-- stock par mouvements, achats/réceptions génériques, traçabilité amont/aval)
-- tout en conservant les règles métier TinOR qui ne sont PAS dans le rapport
-- générique :
--   - la grille de prix dynamique par huile (coût matière, rendement, marge,
--     overrides manuels) — remplace oils/cost_history/cout_overrides/
--     detail_overrides, rattachée au référentiel unifié via grille_huiles ;
--   - le protocole de numérotation de lot "TT-SSS" (code produit 2 chiffres +
--     séquence 3 chiffres) — conservé via lot_sequences, simplifié pour
--     s'appuyer directement sur produits.id au lieu d'une clé d'identité texte ;
--   - le système de remises pourcentage/lot déjà en place — inchangé.
--
-- Simplifications assumées par rapport au rapport d'origine (à valider) :
--   - users/roles : le modèle simple (users.role = gerant/vendeur) est
--     conservé plutôt que roles/user_roles/audit_log — TinOR n'a pas
--     aujourd'hui de besoin de permissions granulaires. Facile à ajouter
--     plus tard sans impact sur le reste.
--   - depots/emplacements sont remplacés par un référentiel générique de locaux,
--     utilisable pour stock, réception, production, pressage, filtration, Bio, etc.
--   - une table employes est ajoutée pour identifier l'opérateur/responsable de chaque opération.
--   - users.employe_id permet de relier ultérieurement un compte logiciel à un employé,
--     sans imposer aujourd'hui un module RH/paie.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. RÉFÉRENTIEL
-- ============================================================================

CREATE TABLE categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30) NOT NULL UNIQUE,
  nom           VARCHAR(100) NOT NULL,
  type_category VARCHAR(15) NOT NULL
                CHECK (type_category IN ('MATIERE','INGREDIENT','CONSOMMABLE','EMBALLAGE','PRODUIT','SOUS_PRODUIT','AUTRE')),
  actif         BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE unites (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  code    VARCHAR(20) NOT NULL UNIQUE,
  nom     VARCHAR(50) NOT NULL,
  symbole VARCHAR(10),
  actif   BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE formats (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  code     VARCHAR(30) NOT NULL UNIQUE,          -- '10ml','30ml','100ml','250ml','1000ml','60g','80g'...
  nom      VARCHAR(100) NOT NULL,
  volume   DECIMAL(12,3) NULL,
  poids    DECIMAL(12,3) NULL,
  unite_id INT NULL,
  actif    BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (unite_id) REFERENCES unites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Catalogue article central — remplace oils / matieres_vrac / produits(ancien)
-- Une ligne = une identité vendable/stockable/fabricable, PAS une instance
-- physique (ça, c'est le rôle de "lots"). Ex: "Sésame — 30 ml" est UN produit
-- catalogue ; chaque flacon produit est un lot distinct de ce produit.
-- ----------------------------------------------------------------------------
CREATE TABLE produits (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(10) NOT NULL UNIQUE,      -- code 2 chiffres, protocole TT existant
  barcode       VARCHAR(100) NULL UNIQUE,
  nom           VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  categorie_id  INT NOT NULL,
  unite_id      INT NOT NULL,
  format_id     INT NULL,
  type_article  VARCHAR(20) NOT NULL
                CHECK (type_article IN (
                  'MATIERE_PREMIERE','INGREDIENT','CONSOMMABLE','EMBALLAGE',
                  'PRODUIT_FABRIQUE','PRODUIT_ACHETE','PRODUIT_REVENDE',
                  'SOUS_PRODUIT','DECHET'
                )),
  -- Pour un produit fini issu d'une huile (ex: "Sésame 30ml"), pointe vers la
  -- fiche vrac de la même huile (ex: "Sésame — Vrac") qui porte la grille de
  -- prix dynamique. NULL pour tout ce qui n'est pas de la filière huile.
  -- Pour un produit conditionné (ex: "Sésame 30ml", "Savon Rond 80g"), pointe
  -- vers son produit source en vrac ("Sésame — Vrac", "Savon Rond — Vrac").
  -- Généralisé à tout type d'article (pas seulement l'huile) — permet de
  -- regrouper stock/traçabilité par famille sans dépendre du nommage.
  produit_source_id INT NULL,
  vendable      BOOLEAN NOT NULL DEFAULT FALSE,
  achetable     BOOLEAN NOT NULL DEFAULT FALSE,
  fabriquable   BOOLEAN NOT NULL DEFAULT FALSE,
  stockable     BOOLEAN NOT NULL DEFAULT TRUE,
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  bio_eligible  BOOLEAN NOT NULL DEFAULT FALSE,
  prix_vente    DECIMAL(12,3) NULL,                -- prix catalogue statique (TTC) ; NULL si géré par grille_huiles
  cout_standard DECIMAL(12,3) NULL,
  stock_min     DECIMAL(12,3) NULL, -- seuil d'alerte stock bas (optionnel) — tableau de bord
  tva           DECIMAL(5,2) NOT NULL DEFAULT 19,
  notes         TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categorie_id) REFERENCES categories(id),
  FOREIGN KEY (unite_id) REFERENCES unites(id),
  FOREIGN KEY (format_id) REFERENCES formats(id),
  FOREIGN KEY (produit_source_id) REFERENCES produits(id),
  INDEX idx_produits_type (type_article),
  INDEX idx_produits_source (produit_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Grille de prix dynamique par huile — remplace oils + cost_history +
-- cout_overrides + detail_overrides. Une ligne par fiche "huile vrac"
-- (produits.type_article='MATIERE_PREMIERE' ou 'PRODUIT_FABRIQUE' selon le cas).
-- ----------------------------------------------------------------------------
CREATE TABLE grille_huiles (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  produit_id          INT NOT NULL UNIQUE,
  matiere             DECIMAL(10,3) NOT NULL,   -- coût matière première (DT/L)
  prod                DECIMAL(10,2) NOT NULL,   -- rendement (L/ouvrier/jour)
  amortissement       DECIMAL(10,3) NOT NULL DEFAULT 5,   -- DT/L, configurable (remplace la constante fixe)
  electricite_par_litre DECIMAL(10,3) NOT NULL DEFAULT 0, -- DT/L
  detail30_marche     DECIMAL(10,3),
  detail30_tableau    DECIMAL(10,3),
  t100                DECIMAL(10,3),
  t250                DECIMAL(10,3),
  t1000               DECIMAL(10,3),
  is_custom           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grille_historique (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  grille_id      INT NOT NULL,
  date_effet     DATE NOT NULL,
  cout_matiere   DECIMAL(10,3) NOT NULL,
  rendement_jour DECIMAL(10,2) NOT NULL,
  note           TEXT,
  FOREIGN KEY (grille_id) REFERENCES grille_huiles(id) ON DELETE CASCADE,
  INDEX idx_grille_historique_date (grille_id, date_effet DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grille_cout_overrides (
  grille_id INT PRIMARY KEY,
  valeur    DECIMAL(10,3) NOT NULL,
  FOREIGN KEY (grille_id) REFERENCES grille_huiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grille_detail_overrides (
  grille_id  INT NOT NULL,
  format_key VARCHAR(10) NOT NULL CHECK (format_key IN ('10ml','30ml','100ml','250ml','1000ml')),
  valeur     DECIMAL(10,3) NOT NULL,
  PRIMARY KEY (grille_id, format_key),
  FOREIGN KEY (grille_id) REFERENCES grille_huiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 2. TIERS
-- ============================================================================

CREATE TABLE remises (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  type        VARCHAR(15) NOT NULL CHECK (type IN ('pourcentage','lot')),
  pourcentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  achete      INT,
  gratuit     INT,
  protege     BOOLEAN NOT NULL DEFAULT FALSE,
  categorie   VARCHAR(15) NOT NULL DEFAULT 'client'
              CHECK (categorie IN ('client','promo','saisonnier','autre'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE clients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(150) NOT NULL,
  tel        VARCHAR(30),
  ville      VARCHAR(100),
  matricule_fiscal  VARCHAR(30),
  type       VARCHAR(15) NOT NULL DEFAULT 'particulier'
             CHECK (type IN ('particulier','pharmacie','revendeur','export')),
  remise_id  INT,
  notes      TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (remise_id) REFERENCES remises(id) ON DELETE SET NULL,
  INDEX idx_clients_nom (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE certificats_bio (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  numero          VARCHAR(50) NOT NULL,
  organisme       VARCHAR(30) NOT NULL CHECK (organisme IN ('INNORPI','ECOCERT','BCS','AUTRE')),
  date_delivrance DATE NOT NULL,
  date_expiration DATE NOT NULL,
  portee          TEXT,
  document_ref    VARCHAR(255),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fournisseurs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nom               VARCHAR(150) NOT NULL,
  type              VARCHAR(25) NOT NULL DEFAULT 'fournisseur_externe'
                    CHECK (type IN ('parcelle','fournisseur_externe','emballage','consommable','produit_revendu','service','autre')),
  matricule_fiscal  VARCHAR(30),
  localisation      VARCHAR(200),
  statut_bio        VARCHAR(20) NOT NULL DEFAULT 'conversion' CHECK (statut_bio IN ('certifie','conversion','non_bio')),
  certificat_id     INT,
  telephone         VARCHAR(30),
  email             VARCHAR(150),
  notes             TEXT,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (certificat_id) REFERENCES certificats_bio(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Employés : module minimal dédié à la traçabilité des opérations.
-- Extensible plus tard vers contrats, présence, congés et paie.
CREATE TABLE employes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  matricule   VARCHAR(30) NOT NULL UNIQUE,
  nom         VARCHAR(100) NOT NULL,
  prenom      VARCHAR(100) NOT NULL,
  fonction    VARCHAR(100),
  telephone   VARCHAR(30),
  email       VARCHAR(150),
  date_entree DATE,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employes_nom (nom, prenom),
  INDEX idx_employes_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 3. STOCK — LOCAUX, LOTS, MOUVEMENTS
-- ============================================================================

CREATE TABLE locaux (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  nom         VARCHAR(100) NOT NULL,
  type_local  VARCHAR(30) NOT NULL CHECK (type_local IN ('STOCK','RECEPTION','PRODUCTION','PRESSAGE','FILTRATION','CONDITIONNEMENT','QUARANTAINE','BIO','BOUTIQUE','EXPEDITION','AUTRE')),
  description TEXT,
  adresse     TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE local_zones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  local_id    INT NOT NULL,
  code        VARCHAR(30) NOT NULL,
  nom         VARCHAR(100) NOT NULL,
  description TEXT,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_local_zone (local_id, code),
  FOREIGN KEY (local_id) REFERENCES locaux(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Registre central de traçabilité — lots génériques, statut et local courant.
-- employe_id identifie l'opérateur/responsable de création du lot.
-- portés directement par l'ancienne table produits.
CREATE TABLE lots (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  produit_id        INT NOT NULL,
  numero_lot        VARCHAR(20) NOT NULL UNIQUE,     -- protocole "TT-SSS" conservé
  origine           VARCHAR(20) NOT NULL
                    CHECK (origine IN ('ACHAT','RECEPTION_MP','PRESSE','FILTRATION','CONDITIONNEMENT','PRODUCTION_RECETTE','INVENTAIRE','AUTRE')),
  fournisseur_id    INT NULL,
  lot_fournisseur   VARCHAR(100) NULL,
  certificat_bio_id INT NULL,
  bio_status        VARCHAR(15) NOT NULL DEFAULT 'A_VERIFIER'
                    CHECK (bio_status IN ('NON_BIO','BIO','EN_CONVERSION','A_VERIFIER','BLOQUE')),
  local_id          INT NULL,
  zone_id    INT NULL,
  date_production   DATE NULL,
  date_expiration   DATE NULL,
  quantite_initiale DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantite_actuelle DECIMAL(12,3) NOT NULL DEFAULT 0,
  statut            VARCHAR(15) NOT NULL DEFAULT 'LIBERE'
                    CHECK (statut IN ('QUARANTAINE','LIBERE','BLOQUE','REJETE','EXPIRE','EPUISE','CLOTURE')),
  notes             TEXT,
  champs_perso      JSON NULL, -- valeurs des champs personnalisés définis dans Structure des lots
  employe_id     INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
  FOREIGN KEY (certificat_bio_id) REFERENCES certificats_bio(id),
  FOREIGN KEY (local_id) REFERENCES locaux(id),
  FOREIGN KEY (zone_id) REFERENCES local_zones(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_lots_produit (produit_id),
  INDEX idx_lots_bio (bio_status),
  INDEX idx_lots_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique des changements de statut d'un lot — permet de saisir un statut
-- à tout moment (même une succession complexe : LIBERE -> BLOQUE -> LIBERE ->
-- EPUISE) avec motif et responsable, sans avoir à représenter deux états
-- simultanés dans lots.statut. lots.statut reste TOUJOURS le statut courant
-- (dernière ligne de cet historique) — source rapide pour les listes/filtres ;
-- cette table est la source de vérité pour "pourquoi/quand/qui" a changé quoi.
CREATE TABLE lot_statuts_historique (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  lot_id       BIGINT NOT NULL,
  statut       VARCHAR(15) NOT NULL
               CHECK (statut IN ('QUARANTAINE','LIBERE','BLOQUE','REJETE','EXPIRE','EPUISE','CLOTURE')),
  motif        TEXT,
  employe_id   INT NULL,
  date_debut   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE,
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_lot_statuts_historique_lot (lot_id, date_debut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Protocole de numérotation "TT-SSS" conservé, simplifié : une séquence par
-- produit catalogue (au lieu d'une clé d'identité texte à part).
CREATE TABLE lot_sequences (
  produit_id INT NOT NULL,
  origine    VARCHAR(20) NOT NULL DEFAULT '', -- '' = séquence partagée (mode par défaut) ; sinon une ligne par origine
  last_seq   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (produit_id, origine),
  FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_mouvements (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  numero         VARCHAR(40) NOT NULL UNIQUE,
  date_mouvement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type_mouvement VARCHAR(20) NOT NULL
                 CHECK (type_mouvement IN (
                   'ACHAT','RECEPTION','VENTE','PRODUCTION','CONDITIONNEMENT','CONSOMMATION',
                   'TRANSFERT','AJUSTEMENT','INVENTAIRE','RETOUR_CLIENT',
                   'RETOUR_FOURNISSEUR','PERTE','CASSE','DESTRUCTION','AUTRE'
                 )),
  sens           VARCHAR(10) NOT NULL CHECK (sens IN ('ENTREE','SORTIE','NEUTRE')),
  produit_id     INT NOT NULL,
  lot_id         BIGINT NULL,
  local_id       INT NULL,
  zone_id INT NULL,
  zone_source_id INT NULL,
  zone_destination_id INT NULL,
  quantite       DECIMAL(12,3) NOT NULL,
  source_type    VARCHAR(50),          -- ex: 'commande','achat','conditionnement','production_recette'
  source_id      BIGINT NULL,
  group_id       CHAR(36) NULL,        -- relie les mouvements d'une même opération (ex: sortie vrac + entrée format)
  note           TEXT,
  employe_id     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (local_id) REFERENCES locaux(id),
  FOREIGN KEY (zone_id) REFERENCES local_zones(id),
  FOREIGN KEY (zone_source_id) REFERENCES local_zones(id),
  FOREIGN KEY (zone_destination_id) REFERENCES local_zones(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_mouvements_produit_date (produit_id, date_mouvement),
  INDEX idx_mouvements_lot_date (lot_id, date_mouvement),
  INDEX idx_mouvements_local_date (local_id, date_mouvement),
  INDEX idx_mouvements_source (source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 4. ACHATS & RÉCEPTIONS
-- ============================================================================

CREATE TABLE achats (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  numero         VARCHAR(20) NOT NULL UNIQUE,
  fournisseur_id INT NOT NULL,
  date_achat     DATE NOT NULL,
  statut         VARCHAR(15) NOT NULL DEFAULT 'brouillon'
                 CHECK (statut IN ('brouillon','commande','partiel','receptionne','annule','cloture')),
  total_ht       DECIMAL(12,3) NOT NULL DEFAULT 0,
  tva            DECIMAL(12,3) NOT NULL DEFAULT 0,
  total_ttc      DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes          TEXT,
  employe_id     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_achats_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE achat_lignes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  achat_id        INT NOT NULL,
  produit_id      INT NOT NULL,
  quantite        DECIMAL(12,3) NOT NULL,
  prix_unitaire   DECIMAL(12,3) NOT NULL DEFAULT 0,
  total_ht        DECIMAL(12,3) NOT NULL DEFAULT 0,
  lot_fournisseur VARCHAR(100),
  date_expiration DATE NULL,
  lot_id          BIGINT NULL,          -- rempli à la réception
  FOREIGN KEY (achat_id) REFERENCES achats(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE receptions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  numero         VARCHAR(20) NOT NULL UNIQUE,
  fournisseur_id INT NOT NULL,
  achat_id       INT NULL,
  date_reception DATE NOT NULL,
  local_id       INT NOT NULL,
  statut         VARCHAR(15) NOT NULL DEFAULT 'receptionnee'
                 CHECK (statut IN ('receptionnee','controle','liberee','partielle','rejetee')),
  notes          TEXT,
  employe_id     INT NULL,
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
  FOREIGN KEY (achat_id) REFERENCES achats(id),
  FOREIGN KEY (local_id) REFERENCES locaux(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_receptions_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reception_lignes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  reception_id      INT NOT NULL,
  produit_id        INT NOT NULL,
  lot_id            BIGINT NULL,
  quantite          DECIMAL(12,3) NOT NULL,
  lot_fournisseur   VARCHAR(100),
  date_expiration   DATE NULL,
  certificat_bio_id INT NULL,
  zone_id    INT NULL,
  FOREIGN KEY (reception_id) REFERENCES receptions(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (certificat_bio_id) REFERENCES certificats_bio(id),
  FOREIGN KEY (zone_id) REFERENCES local_zones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 5. FILIÈRE HUILE SPÉCIALISÉE (conservée, rattachée aux lots génériques)
-- ============================================================================

CREATE TABLE lots_presse (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  date                      DATE NOT NULL,
  produit_id                INT NOT NULL,        -- la fiche "huile vrac"
  reception_id              INT NULL,
  lot_id                    BIGINT NOT NULL,      -- le lot générique créé pour ce pressage
  quantite_matiere_utilisee DECIMAL(10,3),
  quantite_tourteau         DECIMAL(10,3),
  quantite_produite         DECIMAL(10,3) NOT NULL,
  rendement_reel            DECIMAL(10,4),
  numero_lot                VARCHAR(20) NOT NULL UNIQUE,
  notes                     TEXT,
  employe_id     INT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (reception_id) REFERENCES receptions(id) ON DELETE SET NULL,
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_lots_presse_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lots_filtration (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  date              DATE NOT NULL,
  produit_id        INT NOT NULL,
  lot_id            BIGINT NOT NULL,
  filtre_utilise    VARCHAR(100),
  quantite_dechet   DECIMAL(10,3),
  quantite_produite DECIMAL(10,3) NOT NULL,
  rendement_reel    DECIMAL(10,4),
  numero_lot        VARCHAR(20) NOT NULL UNIQUE,
  notes             TEXT,
  employe_id     INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_lots_filtration_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lots_filtration_sources (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  lot_filtration_id INT NOT NULL,
  lot_presse_id     INT NOT NULL,
  quantite_utilisee DECIMAL(10,3) NOT NULL,
  FOREIGN KEY (lot_filtration_id) REFERENCES lots_filtration(id) ON DELETE CASCADE,
  FOREIGN KEY (lot_presse_id) REFERENCES lots_presse(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conditionnements (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  date                      DATE NOT NULL,
  produit_id                INT NOT NULL,        -- le produit fini conditionné (ex: "Sésame 30ml")
  format_id                 INT NULL,            -- format RÉELLEMENT choisi pour cette opération —
                                                    -- figé ici pour ne jamais dépendre du format
                                                    -- courant du produit (qui peut changer après coup)
  lot_id                    BIGINT NOT NULL,     -- le lot du produit fini créé
  qty                       DECIMAL(10,2) NOT NULL,
  quantite_source_utilisee  DECIMAL(10,3) NOT NULL,
  note                      TEXT,
  employe_id     INT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (format_id) REFERENCES formats(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_conditionnements_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conditionnement_sources (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  conditionnement_id INT NOT NULL,
  lot_presse_id      INT NULL,
  lot_filtration_id  INT NULL,
  lot_id             BIGINT NULL, -- vrac reçu directement (achat/réception), sans passage par presse/filtration
  quantite_utilisee  DECIMAL(10,3) NOT NULL,
  FOREIGN KEY (conditionnement_id) REFERENCES conditionnements(id) ON DELETE CASCADE,
  FOREIGN KEY (lot_presse_id) REFERENCES lots_presse(id),
  FOREIGN KEY (lot_filtration_id) REFERENCES lots_filtration(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  CHECK (
    (lot_presse_id IS NOT NULL AND lot_filtration_id IS NULL AND lot_id IS NULL) OR
    (lot_presse_id IS NULL AND lot_filtration_id IS NOT NULL AND lot_id IS NULL) OR
    (lot_presse_id IS NULL AND lot_filtration_id IS NULL AND lot_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 6. PRODUCTION GÉNÉRALE (savons, sérums, composés — hors filière huile)
-- ============================================================================

CREATE TABLE recettes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  produit_id INT NOT NULL UNIQUE,     -- le produit fini catalogue (ex: "Savon 80g Rond")
  notes      TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recette_ingredients (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  recette_id         INT NOT NULL,
  ingredient_id      INT NOT NULL,      -- produit (matière/consommable/emballage)
  quantite_par_unite DECIMAL(12,4) NOT NULL,
  FOREIGN KEY (recette_id) REFERENCES recettes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES produits(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ordres_production (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  recette_id   INT NOT NULL,
  lot_id       BIGINT NOT NULL,          -- le lot de produit fini créé par cette production
  date         DATE NOT NULL,
  qty_produite DECIMAL(12,3) NOT NULL,
  notes        TEXT,
  employe_id     INT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recette_id) REFERENCES recettes(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_ordres_production_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Traçabilité ascendante générique — relie n'importe quel lot fils à ses
-- lots sources (utile pour les produits composés/sérums en dehors de la
-- filière huile, qui a déjà ses propres tables *_sources ci-dessus).
CREATE TABLE lot_origines (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  lot_fils_id       BIGINT NOT NULL,
  lot_source_id     BIGINT NOT NULL,
  quantite_utilisee DECIMAL(12,3) NULL,
  FOREIGN KEY (lot_fils_id) REFERENCES lots(id) ON DELETE CASCADE,
  FOREIGN KEY (lot_source_id) REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 7. VENTES, FACTURATION
-- ============================================================================

CREATE TABLE commandes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  numero     VARCHAR(20) NOT NULL UNIQUE,
  client_id  INT NOT NULL,
  date_iso   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  statut     VARCHAR(15) NOT NULL DEFAULT 'confirmee'
             CHECK (statut IN ('en_attente','confirmee','livree','payee','annulee')),
  notes      TEXT,
  total      DECIMAL(12,3) NOT NULL DEFAULT 0,
  created_by INT,
  employe_id     INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_commandes_client (client_id),
  INDEX idx_commandes_date (date_iso),
  INDEX idx_commandes_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE commande_lignes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  commande_id  INT NOT NULL,
  produit_id   INT NOT NULL,
  lot_id       BIGINT NULL,             -- lot précis vendu, si traçabilité fine requise
  qty          DECIMAL(10,2) NOT NULL,
  qty_livree   DECIMAL(10,2) NOT NULL DEFAULT 0, -- quantité déjà livrée (bons de livraison)
  prix_detail  DECIMAL(10,3) NOT NULL,
  unit_price   DECIMAL(10,3) NOT NULL,
  total        DECIMAL(12,3) NOT NULL,
  remise_id    INT,
  remise_nom   VARCHAR(100),
  remise_pct   DECIMAL(5,2),
  remise_type  VARCHAR(15),
  free_units   INT DEFAULT 0,
  cumule       BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (remise_id) REFERENCES remises(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE factures (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  numero          VARCHAR(20) NOT NULL UNIQUE,
  statut          VARCHAR(10) NOT NULL DEFAULT 'emise' CHECK (statut IN ('emise','annulee')),
  commande_id     INT,
  commande_numero VARCHAR(20) NOT NULL,
  client_id       INT NOT NULL,
  client_nom      VARCHAR(150) NOT NULL,
  date_emission   DATE NOT NULL DEFAULT (CURRENT_DATE),
  tva_rate        DECIMAL(5,2) NOT NULL,
  fodec_montant   DECIMAL(12,3) NOT NULL DEFAULT 0,
  droit_timbre    DECIMAL(6,3) NOT NULL DEFAULT 0,
  total_ht        DECIMAL(12,3) NOT NULL,
  montant_tva     DECIMAL(12,3) NOT NULL,
  total_ttc       DECIMAL(12,3) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE facture_lignes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  facture_id  INT NOT NULL,
  designation VARCHAR(255) NOT NULL,
  prix_detail DECIMAL(10,3) NOT NULL,
  unit_price  DECIMAL(10,3) NOT NULL,
  qty         DECIMAL(10,2) NOT NULL,
  total       DECIMAL(12,3) NOT NULL,
  remise_nom  VARCHAR(100),
  remise_pct  DECIMAL(5,2),
  FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE paiements (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  facture_id    INT NOT NULL,
  date_paiement DATE NOT NULL,
  montant       DECIMAL(12,3) NOT NULL,
  mode          VARCHAR(20) NOT NULL DEFAULT 'especes' CHECK (mode IN ('especes','cheque','virement','carte','autre')),
  reference     VARCHAR(100),
  notes         TEXT,
  annule_le     DATETIME NULL,
  annule_motif  VARCHAR(255) NULL,
  annule_par    INT NULL,
  FOREIGN KEY (facture_id) REFERENCES factures(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Avoirs (factures d'avoir) : une facture émise ne s'annule pas, on la
-- corrige par un avoir numéroté AV-xxxx, total ou partiel.
CREATE TABLE avoirs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  numero          VARCHAR(20) NOT NULL UNIQUE,
  facture_id      INT NOT NULL,
  client_id       INT NULL,
  client_nom      VARCHAR(150) NULL,
  date_emission   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motif           VARCHAR(255) NOT NULL,
  remise_en_stock TINYINT(1) NOT NULL DEFAULT 1,
  total_ht        DECIMAL(12,3) NOT NULL DEFAULT 0,
  fodec_montant   DECIMAL(12,3) NOT NULL DEFAULT 0,
  montant_tva     DECIMAL(12,3) NOT NULL DEFAULT 0,
  droit_timbre    DECIMAL(12,3) NOT NULL DEFAULT 0,
  total_ttc       DECIMAL(12,3) NOT NULL DEFAULT 0,
  created_by      INT NULL,
  FOREIGN KEY (facture_id) REFERENCES factures(id),
  INDEX idx_avoirs_facture (facture_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE avoir_lignes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  avoir_id          INT NOT NULL,
  commande_ligne_id INT NULL,
  produit_id        INT NULL,
  lot_id            INT NULL,
  designation       VARCHAR(255) NOT NULL,
  qty               DECIMAL(12,3) NOT NULL,
  unit_price        DECIMAL(12,3) NOT NULL,
  total             DECIMAL(12,3) NOT NULL,
  FOREIGN KEY (avoir_id) REFERENCES avoirs(id) ON DELETE CASCADE,
  INDEX idx_avoir_lignes_cmd (commande_ligne_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 8. INVENTAIRE & QUALITÉ
-- ============================================================================

CREATE TABLE inventaires (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  numero   VARCHAR(20) NOT NULL UNIQUE,
  date     DATE NOT NULL,
  local_id INT NOT NULL,
  statut   VARCHAR(15) NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','cloture')),
  notes    TEXT,
  employe_id     INT NULL,
  FOREIGN KEY (local_id) REFERENCES locaux(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_inventaires_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventaire_lignes (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  inventaire_id           INT NOT NULL,
  produit_id              INT NOT NULL,
  lot_id                  BIGINT NULL,
  quantite_theorique      DECIMAL(12,3) NOT NULL,
  quantite_physique       DECIMAL(12,3) NOT NULL,
  ecart                   DECIMAL(12,3) NOT NULL,
  mouvement_ajustement_id BIGINT NULL,
  FOREIGN KEY (inventaire_id) REFERENCES inventaires(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (mouvement_ajustement_id) REFERENCES stock_mouvements(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE controles_qualite (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  lot_id        BIGINT NOT NULL,
  date_controle DATE NOT NULL,
  type_controle VARCHAR(100),
  resultat      TEXT,
  decision      VARCHAR(15) NOT NULL CHECK (decision IN ('LIBERE','BLOQUE','REJETE')),
  notes         TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lot_id) REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 8bis. NOTIFICATIONS
-- ============================================================================
-- Alertes créées automatiquement (ex: commande bloquée faute de stock dans un
-- format précis alors que le vrac existe) — restent EN_ATTENTE jusqu'à
-- résolution manuelle ou automatique.
-- Chaîne de vente (V3.3) : bons de livraison (une commande peut être livrée en
-- plusieurs fois) et factures en attente (pro forma, sans numéro légal).
CREATE TABLE IF NOT EXISTS bons_livraison (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  numero          VARCHAR(20) NOT NULL UNIQUE,
  commande_id     INT NOT NULL,
  client_id       INT NOT NULL,
  date_livraison  DATE NOT NULL,
  statut          VARCHAR(10) NOT NULL DEFAULT 'emis' CHECK (statut IN ('emis','annule')),
  notes           TEXT NULL,
  annule_motif    VARCHAR(255) NULL,
  employe_id      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (commande_id) REFERENCES commandes(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_bl_commande (commande_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bl_lignes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  bl_id              INT NOT NULL,
  commande_ligne_id  INT NOT NULL,
  produit_id         INT NOT NULL,
  lot_id             BIGINT NULL,
  qty                DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (bl_id) REFERENCES bons_livraison(id) ON DELETE CASCADE,
  FOREIGN KEY (commande_ligne_id) REFERENCES commande_lignes(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id),
  FOREIGN KEY (lot_id) REFERENCES lots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS proformas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  numero          VARCHAR(20) NOT NULL UNIQUE,
  commande_id     INT NOT NULL,
  client_id       INT NOT NULL,
  date_proforma   DATE NOT NULL,
  statut          VARCHAR(12) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','validee','annulee')),
  tva_rate        DECIMAL(5,2) NOT NULL DEFAULT 19,
  total_ht        DECIMAL(12,3) NOT NULL DEFAULT 0,
  fodec_montant   DECIMAL(12,3) NOT NULL DEFAULT 0,
  montant_tva     DECIMAL(12,3) NOT NULL DEFAULT 0,
  droit_timbre    DECIMAL(6,3) NOT NULL DEFAULT 0,
  total_ttc       DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes           TEXT NULL,
  facture_id      INT NULL,
  employe_id      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (commande_id) REFERENCES commandes(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE SET NULL,
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL,
  INDEX idx_proformas_commande (commande_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS proforma_lignes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  proforma_id        INT NOT NULL,
  commande_ligne_id  INT NULL,
  produit_id         INT NOT NULL,
  designation        VARCHAR(200) NOT NULL,
  qty                DECIMAL(10,2) NOT NULL,
  unit_price         DECIMAL(10,3) NOT NULL,
  total              DECIMAL(12,3) NOT NULL,
  FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
  FOREIGN KEY (commande_ligne_id) REFERENCES commande_lignes(id) ON DELETE SET NULL,
  FOREIGN KEY (produit_id) REFERENCES produits(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Anti-doublon des opérations envoyées par les téléphones (mode hors ligne) :
-- une opération renvoyée après une coupure réseau n'est pas enregistrée deux fois.
CREATE TABLE IF NOT EXISTS operations_sync (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  methode     VARCHAR(10) NOT NULL,
  chemin      VARCHAR(200) NOT NULL,
  statut      VARCHAR(10) NOT NULL DEFAULT 'EN_COURS',
  code_http   INT NULL,
  reponse     MEDIUMTEXT NULL,
  cree_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  termine_le  DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type         VARCHAR(40) NOT NULL,   -- ex: 'STOCK_FORMAT_MANQUANT'
  titre        VARCHAR(150) NOT NULL,
  message      TEXT NOT NULL,
  commande_id  INT NULL,
  produit_id   INT NULL,
  statut       VARCHAR(15) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','RESOLUE')),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at  DATETIME NULL,
  FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE SET NULL,
  INDEX idx_notifications_statut (statut, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 9. SYSTÈME
-- ============================================================================

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  employe_id    INT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'vendeur' CHECK (role IN ('gerant','vendeur')),
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sequences (
  name       VARCHAR(50) PRIMARY KEY,
  `last_value` INT NOT NULL DEFAULT 0  -- entre accents graves : mot réservé en MySQL 8 (LAST_VALUE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settings (
  id             TINYINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salaire        DECIMAL(10,2) NOT NULL DEFAULT 40,
  matiere_pct    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  rend_pct       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  marge          DECIMAL(5,2)  NOT NULL DEFAULT 45,
  tva            DECIMAL(5,2)  NOT NULL DEFAULT 19,
  ref_source     VARCHAR(10)   NOT NULL DEFAULT 'tableau' CHECK (ref_source IN ('tableau','marche')),
  prix_remise_id INT,
  cumuler_lot    BOOLEAN NOT NULL DEFAULT TRUE,
  offre_achete   INT NOT NULL DEFAULT 9,
  offre_gratuit  INT NOT NULL DEFAULT 1,
  fodec_rate     DECIMAL(5,2) NOT NULL DEFAULT 1.00,   -- FODEC = HT × ce taux (%)
  droit_timbre   DECIMAL(6,3) NOT NULL DEFAULT 1.000,  -- montant fixe, pas un %
  timbre_seuil   DECIMAL(10,3) NOT NULL DEFAULT 1000.000, -- timbre appliqué seulement si TTC >= ce seuil
  -- Identité de facturation — utilisée pour générer une facture imprimable/PDF
  -- avec le logo et les coordonnées réelles de l'entreprise.
  entreprise_nom            VARCHAR(150),
  entreprise_adresse        TEXT,
  entreprise_telephone      VARCHAR(30),
  entreprise_email          VARCHAR(150),
  entreprise_matricule_fiscal VARCHAR(30),
  entreprise_logo           LONGTEXT,  -- image encodée en base64 (data URL)
  facture_couleur           VARCHAR(9) NOT NULL DEFAULT '#17231D', -- couleur principale du modèle de facture
  -- Format de numérotation des lots — paramétrable plutôt que figé dans le code.
  lot_format_style   VARCHAR(20) NOT NULL DEFAULT 'code_origine_seq'
                     CHECK (lot_format_style IN ('code_origine_seq', 'origine_code_seq')),
  lot_seq_par_origine BOOLEAN NOT NULL DEFAULT FALSE, -- si vrai, la séquence repart de 001 pour chaque origine (achat/presse/filtration/...)
  FOREIGN KEY (prix_remise_id) REFERENCES remises(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 10. STRUCTURE DES LOTS (configuration des champs par type de lot)
-- ============================================================================
-- Rend persistante la fenêtre "Structure des lots" de l'interface : pour
-- chaque type de lot (aligné sur lots.origine), la liste des champs à
-- saisir, leur type, s'ils sont obligatoires, et s'ils sont verrouillés
-- (les 3 champs communs — N° de lot, Produit, Date — ne sont jamais
-- supprimables, cohérence de la traçabilité oblige).
CREATE TABLE lot_type_champs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type_lot     VARCHAR(20) NOT NULL
               CHECK (type_lot IN ('ACHAT','RECEPTION_MP','PRESSE','FILTRATION','CONDITIONNEMENT','PRODUCTION_RECETTE','INVENTAIRE','AUTRE')),
  nom          VARCHAR(100) NOT NULL,
  type_champ   VARCHAR(20) NOT NULL DEFAULT 'texte'
               CHECK (type_champ IN ('texte','nombre','date','liste','case_a_cocher')),
  obligatoire  BOOLEAN NOT NULL DEFAULT FALSE,
  verrouille   BOOLEAN NOT NULL DEFAULT FALSE,
  ordre        INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lot_type_champs_type (type_lot, ordre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;


-- ---------------------------------------------------------------- Données
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
INSERT INTO `achat_lignes` (`id`, `achat_id`, `produit_id`, `quantite`, `prix_unitaire`, `total_ht`, `lot_fournisseur`, `date_expiration`, `lot_id`) VALUES (1,1,10,1000.000,0.350,350.000,NULL,NULL,3),
(2,1,11,2000.000,0.050,100.000,NULL,NULL,4);
INSERT INTO `achats` (`id`, `numero`, `fournisseur_id`, `date_achat`, `statut`, `total_ht`, `tva`, `total_ttc`, `notes`, `employe_id`, `created_at`) VALUES (1,'ACH-0001',2,'2026-08-01','receptionne',450.000,85.500,535.500,NULL,NULL,'2026-10-03 18:36:50');
INSERT INTO `categories` (`id`, `code`, `nom`, `type_category`, `actif`) VALUES (1,'HUILE','Huiles','PRODUIT',1),
(2,'CONS','Consommables','CONSOMMABLE',1),
(3,'EMBALLAGE','Emballages','EMBALLAGE',1),
(4,'SAVON','Savons','PRODUIT',1),
(5,'COMPOSE','Produits composés','PRODUIT',1);
INSERT INTO `certificats_bio` (`id`, `numero`, `organisme`, `date_delivrance`, `date_expiration`, `portee`, `document_ref`, `created_at`) VALUES (1,'BIO-2026-014','ECOCERT','2026-01-01','2027-01-01','Huiles vierges — parcelles Djerba Midoun',NULL,'2026-10-03 18:36:50');
INSERT INTO `clients` (`id`, `nom`, `tel`, `ville`, `matricule_fiscal`, `type`, `remise_id`, `notes`, `created_at`) VALUES (1,'Pharmacie El Menzah','71 234 567','Ariana','9988776/C/M/000','pharmacie',1,NULL,'2026-10-03 18:36:50'),
(2,'Amira Ben Salah','22 345 678','Tunis',NULL,'particulier',NULL,NULL,'2026-10-03 18:36:50'),
(3,'Boutique Bio Sud',NULL,'Djerba','4433221/D/M/000','revendeur',2,NULL,'2026-10-03 18:36:50');
INSERT INTO `commande_lignes` (`id`, `commande_id`, `produit_id`, `lot_id`, `qty`, `prix_detail`, `unit_price`, `total`, `remise_id`, `remise_nom`, `remise_pct`, `remise_type`, `free_units`, `cumule`) VALUES (1,1,6,8,20.00,9.500,8.550,171.000,1,'Gros volume',10.00,'pourcentage',0,0),
(2,1,9,12,50.00,4.200,3.780,189.000,1,'Gros volume',10.00,'pourcentage',0,0),
(3,2,7,9,3.00,4.500,4.500,13.500,NULL,NULL,NULL,NULL,0,0),
(4,2,8,10,1.00,12.000,12.000,12.000,NULL,NULL,NULL,NULL,0,0),
(5,3,9,12,100.00,4.200,3.990,399.000,2,'Client fidèle',5.00,'pourcentage',0,0);
INSERT INTO `commandes` (`id`, `numero`, `client_id`, `date_iso`, `statut`, `notes`, `total`, `created_by`, `employe_id`, `created_at`) VALUES (1,'CMD-0001',1,'2026-10-03 18:36:50','livree',NULL,360.000,NULL,NULL,'2026-10-03 18:36:50'),
(2,'CMD-0002',2,'2026-10-03 18:36:50','livree',NULL,25.500,NULL,NULL,'2026-10-03 18:36:50'),
(3,'CMD-0003',3,'2026-10-03 18:36:50','livree',NULL,399.000,NULL,NULL,'2026-10-03 18:36:50');
INSERT INTO `conditionnement_sources` (`id`, `conditionnement_id`, `lot_presse_id`, `lot_filtration_id`, `lot_id`, `quantite_utilisee`) VALUES (1,1,NULL,1,NULL,24.000),
(2,2,NULL,1,NULL,5.000),
(3,3,2,NULL,NULL,12.000),
(4,4,NULL,NULL,11,72.000);
INSERT INTO `conditionnements` (`id`, `date`, `produit_id`, `format_id`, `lot_id`, `qty`, `quantite_source_utilisee`, `note`, `employe_id`, `created_at`) VALUES (1,'2026-08-07',6,2,8,800.00,24.000,NULL,3,'2026-10-03 18:36:50'),
(2,'2026-08-08',7,1,9,500.00,5.000,NULL,3,'2026-10-03 18:36:50'),
(3,'2026-08-09',8,2,10,400.00,12.000,NULL,3,'2026-10-03 18:36:50'),
(4,'2026-08-11',9,6,12,900.00,72.000,NULL,3,'2026-10-03 18:36:50');
INSERT INTO `employes` (`id`, `matricule`, `nom`, `prenom`, `fonction`, `telephone`, `email`, `date_entree`, `actif`, `created_at`, `updated_at`) VALUES (1,'EMP-000','Admin','Compte','Gérant',NULL,NULL,NULL,1,'2026-10-03 18:36:49','2026-10-03 18:36:49'),
(2,'EMP-001','Ben Salah','Karim',NULL,NULL,NULL,NULL,1,'2026-10-03 18:36:50','2026-10-03 18:36:50'),
(3,'EMP-002','Trabelsi','Sami',NULL,NULL,NULL,NULL,1,'2026-10-03 18:36:50','2026-10-03 18:36:50');
INSERT INTO `facture_lignes` (`id`, `facture_id`, `designation`, `prix_detail`, `unit_price`, `qty`, `total`, `remise_nom`, `remise_pct`) VALUES (1,1,'Huile de Sésame — Flacon 30ml',9.500,8.550,20.00,171.000,'Gros volume',10.00),
(2,1,'Savon Olive — 80g',4.200,3.780,50.00,189.000,'Gros volume',10.00),
(3,2,'Huile de Sésame — Flacon 10ml',4.500,4.500,3.00,13.500,NULL,NULL),
(4,2,'Huile de Nigelle — Flacon 30ml',12.000,12.000,1.00,12.000,NULL,NULL),
(5,3,'Savon Olive — 80g',4.200,3.990,100.00,399.000,'Client fidèle',5.00);
INSERT INTO `factures` (`id`, `numero`, `statut`, `commande_id`, `commande_numero`, `client_id`, `client_nom`, `date_emission`, `tva_rate`, `fodec_montant`, `droit_timbre`, `total_ht`, `montant_tva`, `total_ttc`, `created_at`) VALUES (1,'FAC-0001','emise',1,'CMD-0001',1,'Pharmacie El Menzah','2026-10-03',19.00,3.025,0.000,302.521,58.054,363.600,'2026-10-03 18:36:50'),
(2,'FAC-0002','emise',2,'CMD-0002',2,'Amira Ben Salah','2026-10-03',19.00,0.214,0.000,21.429,4.112,25.755,'2026-10-03 18:36:50'),
(3,'FAC-0003','emise',3,'CMD-0003',3,'Boutique Bio Sud','2026-10-03',19.00,3.353,0.000,335.294,64.343,402.990,'2026-10-03 18:36:50');
INSERT INTO `formats` (`id`, `code`, `nom`, `volume`, `poids`, `unite_id`, `actif`) VALUES (1,'10ml','10 ml',10.000,NULL,2,1),
(2,'30ml','30 ml',30.000,NULL,2,1),
(3,'100ml','100 ml',100.000,NULL,2,1),
(4,'250ml','250 ml',250.000,NULL,2,1),
(5,'1000ml','1000 ml',1000.000,NULL,2,1),
(6,'80g','80 g',NULL,80.000,3,1);
INSERT INTO `fournisseurs` (`id`, `nom`, `type`, `matricule_fiscal`, `localisation`, `statut_bio`, `certificat_id`, `telephone`, `email`, `notes`, `created_at`) VALUES (1,'Parcelle Sésame Djerba','parcelle',NULL,'Midoun, Djerba','certifie',1,'98 111 222',NULL,NULL,'2026-10-03 18:36:50'),
(2,'Emballages du Sud SARL','emballage','1122334/A/M/000','Sfax','conversion',NULL,'74 555 666',NULL,NULL,'2026-10-03 18:36:50'),
(3,'Négoce Huiles Tunisie','fournisseur_externe','5566778/B/M/000','Tunis','conversion',NULL,NULL,NULL,NULL,'2026-10-03 18:36:50');
INSERT INTO `locaux` (`id`, `code`, `nom`, `type_local`, `description`, `adresse`, `actif`, `created_at`) VALUES (1,'ATELIER','Atelier Djerba','PRODUCTION',NULL,NULL,1,'2026-10-03 18:36:49'),
(2,'STOCK1','Entrepôt Principal','STOCK',NULL,NULL,1,'2026-10-03 18:36:49');
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
INSERT INTO `lot_statuts_historique` (`id`, `lot_id`, `statut`, `motif`, `employe_id`, `date_debut`) VALUES (1,1,'LIBERE','Création via réception',NULL,'2026-10-03 18:36:50'),
(2,2,'LIBERE','Création via réception',NULL,'2026-10-03 18:36:50'),
(3,3,'LIBERE','Création via réception',NULL,'2026-10-03 18:36:50'),
(4,4,'LIBERE','Création via réception',NULL,'2026-10-03 18:36:50'),
(5,5,'LIBERE','Création via pressage',2,'2026-10-03 18:36:50'),
(6,6,'LIBERE','Création via pressage',2,'2026-10-03 18:36:50'),
(7,7,'LIBERE','Création via filtration',2,'2026-10-03 18:36:50'),
(8,8,'LIBERE','Création via conditionnement',3,'2026-10-03 18:36:50'),
(9,9,'LIBERE','Création via conditionnement',3,'2026-10-03 18:36:50'),
(10,10,'LIBERE','Création via conditionnement',3,'2026-10-03 18:36:50'),
(11,11,'LIBERE','Création via réception',NULL,'2026-10-03 18:36:50'),
(12,12,'LIBERE','Création via conditionnement',3,'2026-10-03 18:36:50');
INSERT INTO `lot_type_champs` (`id`, `type_lot`, `nom`, `type_champ`, `obligatoire`, `verrouille`, `ordre`, `created_at`) VALUES (1,'ACHAT','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(2,'ACHAT','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(3,'ACHAT','Date','date',1,1,2,'2026-10-03 18:36:49'),
(4,'RECEPTION_MP','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(5,'RECEPTION_MP','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(6,'RECEPTION_MP','Date','date',1,1,2,'2026-10-03 18:36:49'),
(7,'PRESSE','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(8,'PRESSE','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(9,'PRESSE','Date','date',1,1,2,'2026-10-03 18:36:49'),
(10,'FILTRATION','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(11,'FILTRATION','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(12,'FILTRATION','Date','date',1,1,2,'2026-10-03 18:36:49'),
(13,'CONDITIONNEMENT','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(14,'CONDITIONNEMENT','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(15,'CONDITIONNEMENT','Date','date',1,1,2,'2026-10-03 18:36:49'),
(16,'PRODUCTION_RECETTE','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(17,'PRODUCTION_RECETTE','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(18,'PRODUCTION_RECETTE','Date','date',1,1,2,'2026-10-03 18:36:49'),
(19,'INVENTAIRE','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(20,'INVENTAIRE','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(21,'INVENTAIRE','Date','date',1,1,2,'2026-10-03 18:36:49'),
(22,'AUTRE','N° de lot','texte',1,1,0,'2026-10-03 18:36:49'),
(23,'AUTRE','Produit','liste',1,1,1,'2026-10-03 18:36:49'),
(24,'AUTRE','Date','date',1,1,2,'2026-10-03 18:36:49');
INSERT INTO `lots` (`id`, `produit_id`, `numero_lot`, `origine`, `fournisseur_id`, `lot_fournisseur`, `certificat_bio_id`, `bio_status`, `local_id`, `zone_id`, `date_production`, `date_expiration`, `quantite_initiale`, `quantite_actuelle`, `statut`, `notes`, `champs_perso`, `employe_id`, `created_at`) VALUES (1,1,'01-MP-001','RECEPTION_MP',1,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,300.000,100.000,'LIBERE',NULL,NULL,NULL,'2026-10-03 18:36:50'),
(2,2,'02-MP-001','RECEPTION_MP',1,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,150.000,50.000,'LIBERE',NULL,NULL,NULL,'2026-10-03 18:36:50'),
(3,10,'10-A-001','ACHAT',2,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,1000.000,1000.000,'LIBERE',NULL,NULL,NULL,'2026-10-03 18:36:50'),
(4,11,'11-A-001','ACHAT',2,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,2000.000,2000.000,'LIBERE',NULL,NULL,NULL,'2026-10-03 18:36:50'),
(5,3,'03-P-001','PRESSE',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,70.000,10.000,'LIBERE',NULL,NULL,2,'2026-10-03 18:36:50'),
(6,4,'04-P-001','PRESSE',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,32.000,20.000,'LIBERE',NULL,NULL,2,'2026-10-03 18:36:50'),
(7,3,'03-F-002','FILTRATION',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,55.000,26.000,'LIBERE',NULL,NULL,2,'2026-10-03 18:36:50'),
(8,6,'06-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,800.000,780.000,'LIBERE',NULL,NULL,3,'2026-10-03 18:36:50'),
(9,7,'07-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,500.000,497.000,'LIBERE',NULL,NULL,3,'2026-10-03 18:36:50'),
(10,8,'08-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,400.000,399.000,'LIBERE',NULL,NULL,3,'2026-10-03 18:36:50'),
(11,5,'05-A-001','ACHAT',3,NULL,NULL,'A_VERIFIER',2,NULL,NULL,NULL,76.000,4.000,'LIBERE',NULL,NULL,NULL,'2026-10-03 18:36:50'),
(12,9,'09-PF-001','CONDITIONNEMENT',NULL,NULL,NULL,'A_VERIFIER',NULL,NULL,NULL,NULL,900.000,750.000,'LIBERE',NULL,NULL,3,'2026-10-03 18:36:50');
INSERT INTO `lots_filtration` (`id`, `date`, `produit_id`, `lot_id`, `filtre_utilise`, `quantite_dechet`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2026-08-06',3,7,NULL,NULL,55.000,0.9167,'03-F-002',NULL,2,'2026-10-03 18:36:50');
INSERT INTO `lots_filtration_sources` (`id`, `lot_filtration_id`, `lot_presse_id`, `quantite_utilisee`) VALUES (1,1,1,60.000);
INSERT INTO `lots_presse` (`id`, `date`, `produit_id`, `reception_id`, `lot_id`, `quantite_matiere_utilisee`, `quantite_tourteau`, `quantite_produite`, `rendement_reel`, `numero_lot`, `notes`, `employe_id`, `created_at`) VALUES (1,'2026-08-04',3,NULL,5,200.000,NULL,70.000,0.3500,'03-P-001',NULL,2,'2026-10-03 18:36:50'),
(2,'2026-08-05',4,NULL,6,100.000,NULL,32.000,0.3200,'04-P-001',NULL,2,'2026-10-03 18:36:50');
INSERT INTO `paiements` (`id`, `facture_id`, `date_paiement`, `montant`, `mode`, `reference`, `notes`) VALUES (1,1,'2026-08-12',363.600,'virement','VIR-0012',NULL),
(2,2,'2026-08-13',12.878,'especes',NULL,NULL);
INSERT INTO `produits` (`id`, `code`, `barcode`, `nom`, `description`, `categorie_id`, `unite_id`, `format_id`, `type_article`, `produit_source_id`, `vendable`, `achetable`, `fabriquable`, `stockable`, `actif`, `bio_eligible`, `prix_vente`, `cout_standard`, `stock_min`, `tva`, `notes`, `created_at`) VALUES (1,'01',NULL,'Graines de Sésame',NULL,1,3,NULL,'MATIERE_PREMIERE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(2,'02',NULL,'Graines de Nigelle',NULL,1,3,NULL,'MATIERE_PREMIERE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(3,'03',NULL,'Huile de Sésame — Vrac',NULL,1,1,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(4,'04',NULL,'Huile de Nigelle — Vrac',NULL,1,1,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(5,'05',NULL,'Pâte à Savon Olive — Vrac',NULL,4,3,NULL,'PRODUIT_FABRIQUE',NULL,0,0,1,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(6,'06',NULL,'Huile de Sésame — Flacon 30ml',NULL,1,5,2,'PRODUIT_FABRIQUE',3,1,0,0,1,1,0,9.500,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(7,'07',NULL,'Huile de Sésame — Flacon 10ml',NULL,1,5,1,'PRODUIT_FABRIQUE',3,1,0,0,1,1,0,4.500,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(8,'08',NULL,'Huile de Nigelle — Flacon 30ml',NULL,1,5,2,'PRODUIT_FABRIQUE',4,1,0,0,1,1,0,12.000,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(9,'09',NULL,'Savon Olive — 80g',NULL,4,5,6,'PRODUIT_FABRIQUE',5,1,0,0,1,1,0,4.200,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(10,'10',NULL,'Flacon verre 30ml',NULL,3,5,2,'EMBALLAGE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50'),
(11,'11',NULL,'Étiquette adhésive',NULL,2,5,NULL,'CONSOMMABLE',NULL,0,1,0,1,1,0,NULL,NULL,NULL,19.00,NULL,'2026-10-03 18:36:50');
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
('mouvement_seq',19),
('produit_code_seq',11),
('reception_seq',4);
INSERT INTO `settings` (`id`, `salaire`, `matiere_pct`, `rend_pct`, `marge`, `tva`, `ref_source`, `prix_remise_id`, `cumuler_lot`, `offre_achete`, `offre_gratuit`, `fodec_rate`, `droit_timbre`, `timbre_seuil`, `entreprise_nom`, `entreprise_adresse`, `entreprise_telephone`, `entreprise_email`, `entreprise_matricule_fiscal`, `entreprise_logo`, `facture_couleur`, `lot_format_style`, `lot_seq_par_origine`) VALUES (1,40.00,0.00,0.00,45.00,19.00,'tableau',NULL,1,9,1,1.00,1.000,1000.000,'STE JAS — Les Jardins de Jerba','Djerba Midoun, Tunisie','93 340 008','contact@lesjardinsdejerba.com','0985207/N/NM',NULL,'#A97D2F','code_origine_seq',0);
INSERT INTO `stock_mouvements` (`id`, `numero`, `date_mouvement`, `type_mouvement`, `sens`, `produit_id`, `lot_id`, `local_id`, `zone_id`, `zone_source_id`, `zone_destination_id`, `quantite`, `source_type`, `source_id`, `group_id`, `note`, `employe_id`, `created_at`) VALUES (1,'MVT-0001','2026-10-03 18:36:50','RECEPTION','ENTREE',1,1,NULL,NULL,NULL,NULL,300.000,'reception',1,NULL,NULL,NULL,'2026-10-03 18:36:50'),
(2,'MVT-0002','2026-10-03 18:36:50','RECEPTION','ENTREE',2,2,NULL,NULL,NULL,NULL,150.000,'reception',2,NULL,NULL,NULL,'2026-10-03 18:36:50'),
(3,'MVT-0003','2026-10-03 18:36:50','ACHAT','ENTREE',10,3,NULL,NULL,NULL,NULL,1000.000,'reception',3,NULL,NULL,NULL,'2026-10-03 18:36:50'),
(4,'MVT-0004','2026-10-03 18:36:50','ACHAT','ENTREE',11,4,NULL,NULL,NULL,NULL,2000.000,'reception',3,NULL,NULL,NULL,'2026-10-03 18:36:50'),
(5,'MVT-0005','2026-10-03 18:36:50','CONSOMMATION','SORTIE',1,1,NULL,NULL,NULL,NULL,200.000,'lots_presse',5,'59558855-1463-4356-9e8e-e625484faee2',NULL,2,'2026-10-03 18:36:50'),
(6,'MVT-0006','2026-10-03 18:36:50','PRODUCTION','ENTREE',3,5,NULL,NULL,NULL,NULL,70.000,'lots_presse',5,'59558855-1463-4356-9e8e-e625484faee2',NULL,2,'2026-10-03 18:36:50'),
(7,'MVT-0007','2026-10-03 18:36:50','CONSOMMATION','SORTIE',2,2,NULL,NULL,NULL,NULL,100.000,'lots_presse',6,'5cb63809-4b60-4314-ab0e-eed41bd7afb9',NULL,2,'2026-10-03 18:36:50'),
(8,'MVT-0008','2026-10-03 18:36:50','PRODUCTION','ENTREE',4,6,NULL,NULL,NULL,NULL,32.000,'lots_presse',6,'5cb63809-4b60-4314-ab0e-eed41bd7afb9',NULL,2,'2026-10-03 18:36:50'),
(9,'MVT-0009-OUT-1','2026-10-03 18:36:50','CONSOMMATION','SORTIE',3,5,NULL,NULL,NULL,NULL,60.000,'lots_filtration',1,'fc62358f-5184-4280-a150-80fd5ae43dcf',NULL,2,'2026-10-03 18:36:50'),
(10,'MVT-0009-IN','2026-10-03 18:36:50','PRODUCTION','ENTREE',3,7,NULL,NULL,NULL,NULL,55.000,'lots_filtration',1,'fc62358f-5184-4280-a150-80fd5ae43dcf',NULL,2,'2026-10-03 18:36:50'),
(11,'MVT-0010-OUT-filtration-1','2026-10-03 18:36:50','CONSOMMATION','SORTIE',3,7,NULL,NULL,NULL,NULL,24.000,'conditionnement',1,'e1980ec7-c958-456b-a251-764197ddcb33',NULL,3,'2026-10-03 18:36:50'),
(12,'MVT-0010-IN','2026-10-03 18:36:50','CONDITIONNEMENT','ENTREE',6,8,NULL,NULL,NULL,NULL,800.000,'conditionnement',1,'e1980ec7-c958-456b-a251-764197ddcb33',NULL,3,'2026-10-03 18:36:50'),
(13,'MVT-0011-OUT-filtration-1','2026-10-03 18:36:50','CONSOMMATION','SORTIE',3,7,NULL,NULL,NULL,NULL,5.000,'conditionnement',2,'0863e76e-6a9d-4a70-b3d3-3e668a293c4e',NULL,3,'2026-10-03 18:36:50'),
(14,'MVT-0011-IN','2026-10-03 18:36:50','CONDITIONNEMENT','ENTREE',7,9,NULL,NULL,NULL,NULL,500.000,'conditionnement',2,'0863e76e-6a9d-4a70-b3d3-3e668a293c4e',NULL,3,'2026-10-03 18:36:50'),
(15,'MVT-0012-OUT-presse-2','2026-10-03 18:36:50','CONSOMMATION','SORTIE',4,6,NULL,NULL,NULL,NULL,12.000,'conditionnement',3,'8e460142-d6fe-49c9-aad6-07e0f4ed481b',NULL,3,'2026-10-03 18:36:50'),
(16,'MVT-0012-IN','2026-10-03 18:36:50','CONDITIONNEMENT','ENTREE',8,10,NULL,NULL,NULL,NULL,400.000,'conditionnement',3,'8e460142-d6fe-49c9-aad6-07e0f4ed481b',NULL,3,'2026-10-03 18:36:50'),
(17,'MVT-0013','2026-10-03 18:36:50','RECEPTION','ENTREE',5,11,NULL,NULL,NULL,NULL,76.000,'reception',4,NULL,NULL,NULL,'2026-10-03 18:36:50'),
(18,'MVT-0014-OUT-direct-11','2026-10-03 18:36:50','CONSOMMATION','SORTIE',5,11,NULL,NULL,NULL,NULL,72.000,'conditionnement',4,'caa7c1bc-3f39-4132-88d6-cf8551728c9e',NULL,3,'2026-10-03 18:36:50'),
(19,'MVT-0014-IN','2026-10-03 18:36:50','CONDITIONNEMENT','ENTREE',9,12,NULL,NULL,NULL,NULL,900.000,'conditionnement',4,'caa7c1bc-3f39-4132-88d6-cf8551728c9e',NULL,3,'2026-10-03 18:36:50'),
(20,'MVT-0015','2026-10-03 18:36:50','VENTE','SORTIE',6,8,NULL,NULL,NULL,NULL,20.000,'commande',1,'286c570f-cf66-468b-b4fb-64203344b513',NULL,NULL,'2026-10-03 18:36:50'),
(21,'MVT-0016','2026-10-03 18:36:50','VENTE','SORTIE',9,12,NULL,NULL,NULL,NULL,50.000,'commande',1,'286c570f-cf66-468b-b4fb-64203344b513',NULL,NULL,'2026-10-03 18:36:50'),
(22,'MVT-0017','2026-10-03 18:36:50','VENTE','SORTIE',7,9,NULL,NULL,NULL,NULL,3.000,'commande',2,'784bb0c2-d442-4f2b-91d0-3854623e3314',NULL,NULL,'2026-10-03 18:36:50'),
(23,'MVT-0018','2026-10-03 18:36:50','VENTE','SORTIE',8,10,NULL,NULL,NULL,NULL,1.000,'commande',2,'784bb0c2-d442-4f2b-91d0-3854623e3314',NULL,NULL,'2026-10-03 18:36:50'),
(24,'MVT-0019','2026-10-03 18:36:50','VENTE','SORTIE',9,12,NULL,NULL,NULL,NULL,100.000,'commande',3,'989e1971-8446-4318-aa07-af2295fdbcf1',NULL,NULL,'2026-10-03 18:36:50');
INSERT INTO `unites` (`id`, `code`, `nom`, `symbole`, `actif`) VALUES (1,'litre','Litre','L',1),
(2,'ml','Millilitre','ml',1),
(3,'kg','Kilogramme','kg',1),
(4,'g','Gramme','g',1),
(5,'unite','Unité','u',1);
INSERT INTO `users` (`id`, `username`, `password_hash`, `employe_id`, `role`, `actif`, `created_at`) VALUES (1,'admin','$2b$10$AxRfngrGUh5/WoyVhItRVeFukmhaq7sGt2VCYB55w.aJ6Frrwahr.',1,'gerant',1,'2026-10-03 18:36:49');
-- Commandes de démonstration livrées et facturées : quantités entièrement livrées.
UPDATE commande_lignes cl JOIN commandes c ON c.id = cl.commande_id SET cl.qty_livree = cl.qty
  WHERE c.statut IN ('livree','payee') OR EXISTS (SELECT 1 FROM factures f WHERE f.commande_id = c.id AND f.statut = 'emise');
SET FOREIGN_KEY_CHECKS = 1;
