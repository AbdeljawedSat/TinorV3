-- Versions de paramètres et de barèmes saisies dans l'application (s'ajoutent au fichier parametres-tn.json).
-- Jamais de modification d'une version existante : une nouvelle valeur = une nouvelle ligne avec sa date d'effet.
CREATE TABLE IF NOT EXISTS paie_parametres_versions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(60)  NOT NULL COMMENT 'Code paramètre, ou BAREME:IRPP',
  debut         DATE         NOT NULL COMMENT 'Premier jour du mois d effet',
  fin           DATE         NULL,
  valeur        VARCHAR(400) NULL COMMENT 'Valeur décimale (taux en fraction : 0.0918) ou texte',
  tranches_json TEXT         NULL COMMENT 'Barème : [{"de":"0","a":"5000","taux":"0"}, ...]',
  source        VARCHAR(300) NOT NULL COMMENT 'Texte officiel de référence',
  note          VARCHAR(300) NULL,
  cree_par      VARCHAR(60)  NOT NULL,
  cree_le       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paie_pv (code, debut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO paie_schema_version (version, description) VALUES (2, 'Versions de paramètres saisies dans l application');
