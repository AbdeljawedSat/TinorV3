-- Module Paie Tunisie — schéma commun (Java & TinOR JS)
-- MariaDB 10.5+ / MySQL 8+. Tous les montants en DECIMAL(15,3) (millimes).
-- Tables préfixées paie_ pour cohabiter avec une base existante (ex. BD Gestion Commerciale V3).

CREATE TABLE IF NOT EXISTS paie_schema_version (
  version     INT          NOT NULL PRIMARY KEY,
  description VARCHAR(200) NOT NULL,
  applique_le DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_entreprise (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  raison_sociale     VARCHAR(200) NOT NULL,
  matricule_fiscal   VARCHAR(50)  NULL,
  num_employeur_cnss VARCHAR(50)  NULL,
  adresse            VARCHAR(300) NULL,
  taux_at            DECIMAL(7,5) NULL COMMENT 'Taux accident du travail notifié (ex 0.00400)',
  taux_tfp           DECIMAL(7,5) NULL COMMENT 'Taux TFP (0.01 ou 0.02)',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_salaries (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  matricule             VARCHAR(30)  NOT NULL,
  nom                   VARCHAR(100) NOT NULL,
  prenom                VARCHAR(100) NOT NULL,
  fonction              VARCHAR(100) NULL,
  categorie             VARCHAR(50)  NULL,
  num_cnss              VARCHAR(30)  NULL,
  date_entree           DATE         NOT NULL,
  date_sortie           DATE         NULL,
  regime                VARCHAR(20)  NOT NULL DEFAULT 'CNSS_RSNA' COMMENT 'Seul CNSS_RSNA (régime général non agricole) est calculé en V1',
  chef_famille          TINYINT(1)   NOT NULL DEFAULT 0,
  nb_enfants            TINYINT      NOT NULL DEFAULT 0 COMMENT 'Enfants à charge ordinaires',
  nb_enfants_etudiants  TINYINT      NOT NULL DEFAULT 0,
  nb_enfants_handicapes TINYINT      NOT NULL DEFAULT 0,
  mode_paiement         VARCHAR(20)  NOT NULL DEFAULT 'VIREMENT',
  rib                   VARCHAR(30)  NULL,
  actif                 TINYINT(1)   NOT NULL DEFAULT 1,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paie_sal_matricule (matricule),
  KEY idx_paie_sal_nom (nom, prenom),
  CONSTRAINT ck_paie_sal_enfants CHECK (nb_enfants >= 0 AND nb_enfants_etudiants >= 0 AND nb_enfants_handicapes >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_contrats (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  salarie_id      INT           NOT NULL,
  type_contrat    VARCHAR(20)   NOT NULL DEFAULT 'CDI' COMMENT 'CDI, CDD, SIVP, KARAMA...',
  date_debut      DATE          NOT NULL,
  date_fin        DATE          NULL,
  salaire_base    DECIMAL(15,3) NOT NULL,
  horaire_mensuel DECIMAL(7,2)  NOT NULL DEFAULT 208.00 COMMENT '208 h = 48 h/sem ; 173.33 h = 40 h/sem',
  taux_horaire    DECIMAL(15,3) NULL COMMENT 'Si NULL : salaire_base / horaire_mensuel',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paie_ctr_sal (salarie_id, date_debut),
  CONSTRAINT fk_paie_ctr_sal FOREIGN KEY (salarie_id) REFERENCES paie_salaries(id) ON DELETE RESTRICT,
  CONSTRAINT ck_paie_ctr_sal CHECK (salaire_base >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_periodes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  annee        SMALLINT    NOT NULL,
  mois         TINYINT     NOT NULL,
  statut       VARCHAR(12) NOT NULL DEFAULT 'OUVERTE' COMMENT 'OUVERTE, CALCULEE, VALIDEE, CLOTUREE',
  calcule_par  VARCHAR(60) NULL,
  calcule_le   DATETIME    NULL,
  validee_par  VARCHAR(60) NULL,
  validee_le   DATETIME    NULL,
  cloturee_par VARCHAR(60) NULL,
  cloturee_le  DATETIME    NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paie_per (annee, mois),
  CONSTRAINT ck_paie_per_mois CHECK (mois BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_variables (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  periode_id    INT           NOT NULL,
  salarie_id    INT           NOT NULL,
  rubrique_code VARCHAR(30)   NOT NULL,
  quantite      DECIMAL(15,3) NULL,
  taux          DECIMAL(15,3) NULL,
  montant       DECIMAL(15,3) NULL,
  commentaire   VARCHAR(200)  NULL,
  created_by    VARCHAR(60)   NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paie_var (periode_id, salarie_id),
  CONSTRAINT fk_paie_var_per FOREIGN KEY (periode_id) REFERENCES paie_periodes(id) ON DELETE CASCADE,
  CONSTRAINT fk_paie_var_sal FOREIGN KEY (salarie_id) REFERENCES paie_salaries(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_calculs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  periode_id     INT           NOT NULL,
  salarie_id     INT           NOT NULL,
  version        INT           NOT NULL,
  statut         VARCHAR(12)   NOT NULL DEFAULT 'SIMULATION' COMMENT 'SIMULATION, VALIDE, REMPLACE',
  brut           DECIMAL(15,3) NOT NULL,
  cnss_sal       DECIMAL(15,3) NOT NULL,
  irpp           DECIMAL(15,3) NOT NULL,
  css            DECIMAL(15,3) NOT NULL,
  net            DECIMAL(15,3) NOT NULL,
  charges_pat    DECIMAL(15,3) NOT NULL,
  cout_employeur DECIMAL(15,3) NOT NULL,
  certifiable    TINYINT(1)    NOT NULL DEFAULT 0,
  moteur         VARCHAR(20)   NOT NULL COMMENT 'java ou js + version',
  params_version VARCHAR(30)   NOT NULL,
  resultat_json  LONGTEXT      NOT NULL,
  calcule_par    VARCHAR(60)   NULL,
  calcule_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paie_calc (periode_id, salarie_id, version),
  CONSTRAINT fk_paie_calc_per FOREIGN KEY (periode_id) REFERENCES paie_periodes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_paie_calc_sal FOREIGN KEY (salarie_id) REFERENCES paie_salaries(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Validation des paramètres / rubriques par un professionnel (code = code paramètre, 'BAREME:IRPP' ou 'RUB:<code>')
CREATE TABLE IF NOT EXISTS paie_validations_param (
  code        VARCHAR(60)  NOT NULL,
  debut       DATE         NOT NULL,
  valeur      VARCHAR(400) NOT NULL COMMENT 'Valeur validée : invalide automatiquement si la valeur change',
  valide_par  VARCHAR(100) NOT NULL,
  valide_le   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference   VARCHAR(300) NULL COMMENT 'Référence JORT / note commune consultée',
  PRIMARY KEY (code, debut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_documents (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  periode_id  INT          NOT NULL,
  salarie_id  INT          NULL,
  type_doc    VARCHAR(30)  NOT NULL COMMENT 'BULLETIN, LIVRE_PAIE, ETAT_CNSS...',
  calcul_id   INT          NULL,
  fichier     VARCHAR(300) NOT NULL,
  sha256      CHAR(64)     NOT NULL,
  cree_par    VARCHAR(60)  NULL,
  cree_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paie_doc (periode_id, salarie_id),
  CONSTRAINT fk_paie_doc_per FOREIGN KEY (periode_id) REFERENCES paie_periodes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paie_audit (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  horodatage  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  utilisateur VARCHAR(60)  NOT NULL,
  action      VARCHAR(40)  NOT NULL,
  entite      VARCHAR(40)  NOT NULL,
  entite_id   VARCHAR(40)  NULL,
  details     TEXT         NULL,
  KEY idx_paie_audit (entite, entite_id),
  KEY idx_paie_audit_date (horodatage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Utilisateurs : utilisé par l'application Java autonome. TinOR utilise sa propre authentification.
CREATE TABLE IF NOT EXISTS paie_utilisateurs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  login      VARCHAR(60)  NOT NULL,
  hash       VARCHAR(200) NOT NULL COMMENT 'PBKDF2WithHmacSHA256',
  role       VARCHAR(20)  NOT NULL COMMENT 'ADMIN, GESTIONNAIRE, VALIDEUR, CONSULTATION',
  actif      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paie_user (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO paie_schema_version (version, description) VALUES (1, 'Schéma initial paie Tunisie');
