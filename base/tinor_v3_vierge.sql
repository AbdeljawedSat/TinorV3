-- ============================================================================
-- TinOR V3 — base MariaDB / MySQL : VIERGE (tables + données de référence + compte admin)
-- Structure : identique à la version initiale (tinor_erp_v3_schema.sql, 45 tables).
-- Seul changement : la colonne sequences.last_value est écrite `last_value`
-- (mot réservé en MySQL 8) — même nom, même type, rien d'autre ne change.
-- Testé à l'import sur MariaDB 10.11 et MySQL 8.4.
-- Compte : admin / changeme — À CHANGER après la première connexion.
--
-- Import dans une base VIDE (ex. tinor_v3) :
--   mysql -u tinor -p tinor_v3 < tinor_v3_vierge.sql
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
INSERT INTO `categories` (`id`, `code`, `nom`, `type_category`, `actif`) VALUES (1,'HUILE','Huiles','PRODUIT',1),
(2,'CONS','Consommables','CONSOMMABLE',1),
(3,'EMBALLAGE','Emballages','EMBALLAGE',1),
(4,'SAVON','Savons','PRODUIT',1),
(5,'COMPOSE','Produits composés','PRODUIT',1);
INSERT INTO `employes` (`id`, `matricule`, `nom`, `prenom`, `fonction`, `telephone`, `email`, `date_entree`, `actif`, `created_at`, `updated_at`) VALUES (1,'EMP-000','Admin','Compte','Gérant',NULL,NULL,NULL,1,'2026-10-02 21:53:43','2026-10-02 21:53:43');
INSERT INTO `formats` (`id`, `code`, `nom`, `volume`, `poids`, `unite_id`, `actif`) VALUES (1,'10ml','10 ml',10.000,NULL,2,1),
(2,'30ml','30 ml',30.000,NULL,2,1),
(3,'100ml','100 ml',100.000,NULL,2,1),
(4,'250ml','250 ml',250.000,NULL,2,1),
(5,'1000ml','1000 ml',1000.000,NULL,2,1);
INSERT INTO `locaux` (`id`, `code`, `nom`, `type_local`, `description`, `adresse`, `actif`, `created_at`) VALUES (1,'ATELIER','Atelier Djerba','PRODUCTION',NULL,NULL,1,'2026-10-02 21:53:43'),
(2,'STOCK1','Entrepôt Principal','STOCK',NULL,NULL,1,'2026-10-02 21:53:43');
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
INSERT INTO `sequences` (`name`, `last_value`) VALUES ('produit_code_seq',0);
INSERT INTO `settings` (`id`, `salaire`, `matiere_pct`, `rend_pct`, `marge`, `tva`, `ref_source`, `prix_remise_id`, `cumuler_lot`, `offre_achete`, `offre_gratuit`, `fodec_rate`, `droit_timbre`, `timbre_seuil`, `entreprise_nom`, `entreprise_adresse`, `entreprise_telephone`, `entreprise_email`, `entreprise_matricule_fiscal`, `entreprise_logo`, `facture_couleur`, `lot_format_style`, `lot_seq_par_origine`) VALUES (1,40.00,0.00,0.00,45.00,19.00,'tableau',NULL,1,9,1,1.00,1.000,1000.000,NULL,NULL,NULL,NULL,NULL,NULL,'#17231D','code_origine_seq',0);
INSERT INTO `unites` (`id`, `code`, `nom`, `symbole`, `actif`) VALUES (1,'litre','Litre','L',1),
(2,'ml','Millilitre','ml',1),
(3,'kg','Kilogramme','kg',1),
(4,'g','Gramme','g',1),
(5,'unite','Unité','u',1);
INSERT INTO `users` (`id`, `username`, `password_hash`, `employe_id`, `role`, `actif`, `created_at`) VALUES (1,'admin','$2b$10$HR2pIfMBY564orJkzTlsSuLphdz9Zfn7UMc63YtLeGPE4erkMBYEy',1,'gerant',1,'2026-10-02 21:53:43');
SET FOREIGN_KEY_CHECKS = 1;
