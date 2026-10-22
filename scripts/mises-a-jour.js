// Mises à jour de structure pour les bases déjà installées (idempotentes :
// sans effet si la base est déjà à jour). Appelées par `npm run migrate` et
// `npm run reset:demo`. Compatibles MariaDB 10.4+ et MySQL 8.0.19+.

async function colonneExiste(conn, table, colonne) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, colonne]
  );
  return r[0].n > 0;
}

async function appliquerMisesAJour(conn, journal = console.log) {
  await miseAJourLots(conn, journal);
  // V3.3 — avoirs : une facture émise ne s'annule plus, elle se corrige par un avoir.
  const [av] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'avoirs'");
  if (!av[0].n) {
    for (const ordre of SQL_AVOIRS.split(';').filter(s => /CREATE TABLE/i.test(s))) await conn.query(ordre);
    journal('✓ Mise à jour : tables des avoirs créées.');
  }

  // V3.3 — une commande non facturée peut être annulée (statut « annulee »).
  const [checks] = await conn.query(`
    SELECT tc.CONSTRAINT_NAME AS nom, cc.CHECK_CLAUSE AS clause
    FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'commandes' AND tc.CONSTRAINT_TYPE = 'CHECK'`);
  const ancien = checks.find(c => /en_attente/.test(c.clause) && /livree/.test(c.clause) && !/annulee/.test(c.clause));
  if (ancien) {
    try {
      await conn.query(`ALTER TABLE commandes DROP CONSTRAINT \`${ancien.nom}\``); // MySQL 8
    } catch {
      // MariaDB : contrainte posée sur la colonne → on redéfinit la colonne sans elle.
      await conn.query(`ALTER TABLE commandes MODIFY statut VARCHAR(15) NOT NULL DEFAULT 'confirmee'`);
    }
    await conn.query(`ALTER TABLE commandes ADD CONSTRAINT commandes_statut_chk CHECK (statut IN ('en_attente','confirmee','livree','payee','annulee'))`);
    journal('✓ Mise à jour : les commandes acceptent le statut « annulée ».');
  }

  // V3.3 — un paiement annulé reste visible avec son motif.
  const colonnes = [
    ['annule_le', 'DATETIME NULL'], ['annule_motif', 'VARCHAR(255) NULL'], ['annule_par', 'INT NULL'],
  ];
  for (const [col, type] of colonnes) {
    if (!(await colonneExiste(conn, 'paiements', col))) {
      await conn.query(`ALTER TABLE paiements ADD COLUMN ${col} ${type}`);
      journal(`✓ Mise à jour : paiements.${col} ajoutée.`);
    }
  }

  // V3.3 — mode hors ligne : anti-doublon des opérations renvoyées par les téléphones.
  const [os] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'operations_sync'");
  if (!os[0].n) {
    await conn.query(SQL_OPERATIONS_SYNC);
    journal('✓ Mise à jour : table operations_sync créée (mode hors ligne).');
  }

  // V4 — contrôle qualité des lots : paramètres avec seuils, analyses (en-tête dans controles_qualite) et leurs résultats.
  for (const [col, type] of [['laboratoire', 'VARCHAR(120) NULL'], ['reference_rapport', 'VARCHAR(60) NULL'], ['profil', 'VARCHAR(20) NULL'],
    ['conforme', 'TINYINT(1) NULL'], ['derogation_motif', 'VARCHAR(255) NULL'], ['created_by', 'INT NULL']]) {
    if (!(await colonneExiste(conn, 'controles_qualite', col))) await conn.query(`ALTER TABLE controles_qualite ADD COLUMN ${col} ${type}`);
  }
  const [qp] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'qualite_parametres'");
  if (!qp[0].n) {
    for (const ordre of SQL_QUALITE.split(';').filter(x => /CREATE TABLE/i.test(x))) await conn.query(ordre);
    for (const [profil, code, nom, unite, min, max, ordreAff] of PARAMETRES_QUALITE_DEFAUT) {
      await conn.query('INSERT INTO qualite_parametres (profil, code, nom, unite, min_valeur, max_valeur, ordre) VALUES (?,?,?,?,?,?,?)', [profil, code, nom, unite, min, max, ordreAff]);
    }
    journal('✓ Mise à jour : contrôle qualité des lots (paramètres et seuils par défaut créés).');
  }
  if (!(await colonneExiste(conn, 'settings', 'qualite_quarantaine_etapes'))) {
    await conn.query("ALTER TABLE settings ADD COLUMN qualite_quarantaine_etapes VARCHAR(100) NOT NULL DEFAULT ''");
  }

  // V4 — journal d'audit (qui a fait quoi).
  const [ja] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'journal_audit'");
  if (!ja[0].n) {
    await conn.query(SQL_JOURNAL_AUDIT);
    journal('✓ Mise à jour : table journal_audit créée (journal d\'audit).');
  }

  // V4 — rôles supplémentaires (magasinier, production, comptable) : la contrainte « gerant ou vendeur » est élargie.
  const [chk] = await conn.query(`
    SELECT tc.CONSTRAINT_NAME AS nom, cc.CHECK_CLAUSE AS clause
    FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'users' AND tc.CONSTRAINT_TYPE = 'CHECK'`);
  const ancienRole = chk.find(c => /gerant/.test(c.clause) && !/magasinier/.test(c.clause));
  if (ancienRole) {
    try { await conn.query(`ALTER TABLE users DROP CONSTRAINT \`${ancienRole.nom}\``); } // MySQL 8
    catch { await conn.query(`ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL DEFAULT 'vendeur'`); } // MariaDB : contrainte portée par la colonne
    await conn.query(`ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (role IN ('gerant','vendeur','magasinier','production','comptable'))`);
    journal('✓ Mise à jour : rôles magasinier, production et comptable acceptés.');
  }

  // V3.3 — numérotation configurable des opérations (format actuel / proposé / personnalisé).
  const [nf] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'numerotation_formats'");
  if (!nf[0].n) {
    await conn.query(SQL_NUMEROTATION_FORMATS);
    journal('✓ Mise à jour : table numerotation_formats créée (numérotation des opérations).');
  }

  // V3.3 — chaîne de vente : quantités livrées, bons de livraison, factures en attente.
  if (!(await colonneExiste(conn, 'commande_lignes', 'qty_livree'))) {
    await conn.query('ALTER TABLE commande_lignes ADD COLUMN qty_livree DECIMAL(10,2) NOT NULL DEFAULT 0');
    // Commandes déjà livrées, payées ou facturées : considérées entièrement livrées.
    await conn.query(`UPDATE commande_lignes cl JOIN commandes c ON c.id = cl.commande_id SET cl.qty_livree = cl.qty
      WHERE c.statut IN ('livree','payee') OR EXISTS (SELECT 1 FROM factures f WHERE f.commande_id = c.id AND f.statut = 'emise')`);
    journal('✓ Mise à jour : commande_lignes.qty_livree ajoutée (commandes livrées/facturées marquées livrées).');
  }
  for (const [table, ordre] of SQL_VENTE.split(/;\s*\n/).map(o => [((o.match(/CREATE TABLE IF NOT EXISTS (\w+)/) || [])[1]), o]).filter(([t]) => t)) {
    const [ex] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
    if (!ex[0].n) { await conn.query(ordre); journal(`✓ Mise à jour : table ${table} créée (chaîne de vente).`); }
  }

  // V3.3 — la filtration donne une huile filtrée, distincte du vrac de presse :
  // « Huile de Sésame — Vrac » reçoit sa fiche « Huile de Sésame — Filtrée ».
  const { estHuileVrac, estHuileFiltree, cleHuileVrac } = require('../src/services/graines');
  const [produits] = await conn.query('SELECT * FROM produits');
  const filtrees = new Set(produits.filter(estHuileFiltree).map(p => cleHuileVrac(p.nom)));
  for (const vrac of produits.filter(p => estHuileVrac(p) && !p.produit_source_id)) {
    if (filtrees.has(cleHuileVrac(vrac.nom))) continue;
    const nom = vrac.nom.replace(/\s*([-–—]\s*vrac|\(vrac\))\s*$/i, '') + ' — Filtrée';
    const codes = new Set(produits.map(p => String(p.code)));
    let n = Math.max(0, ...produits.map(p => Number(p.code) || 0)) + 1;
    while (codes.has(String(n).padStart(2, '0'))) n++;
    const code = String(n).padStart(2, '0');
    await conn.query(
      `INSERT INTO produits (code, nom, categorie_id, unite_id, type_article, produit_source_id, vendable, achetable, fabriquable, stockable, actif, bio_eligible, prix_vente, tva)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 1, ?, ?, ?)`,
      [code, nom, vrac.categorie_id, vrac.unite_id, vrac.type_article, vrac.id, vrac.vendable, vrac.bio_eligible, vrac.prix_vente, vrac.tva]);
    await conn.query("UPDATE sequences SET `last_value` = GREATEST(`last_value`, ?) WHERE name = 'produit_code_seq'", [n]);
    produits.push({ code, nom });
    filtrees.add(cleHuileVrac(vrac.nom));
    journal(`✓ Mise à jour : produit « ${nom} » (code ${code}) créé pour la filtration.`);
  }
}

const SQL_VENTE = `CREATE TABLE IF NOT EXISTS bons_livraison (
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
`;

const SQL_NUMEROTATION_FORMATS = `CREATE TABLE IF NOT EXISTS numerotation_formats (
  cle              VARCHAR(30) NOT NULL PRIMARY KEY,
  mode             VARCHAR(10) NOT NULL DEFAULT 'actuel',
  zones            LONGTEXT NULL,
  date_application DATE NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

// Seuils de départ — à confirmer avec votre laboratoire et votre cahier des charges.
//  OLIVE   : huile d'olive vierge extra, règlement délégué (UE) 2022/2104.
//  GRAINES : huiles vierges pressées à froid (sésame, nigelle…), Codex Stan 210 (indice d'acide ≤ 4 mg KOH/g ; peroxyde ≤ 15 meq O₂/kg).
const PARAMETRES_QUALITE_DEFAUT = [
  ['OLIVE', 'ACIDITE', 'Acidité libre', '% ac. oléique', null, 0.8, 1],
  ['OLIVE', 'PEROXYDE', 'Indice de peroxyde', 'meq O₂/kg', null, 20, 2],
  ['OLIVE', 'K232', 'K232', '', null, 2.5, 3],
  ['OLIVE', 'K270', 'K270', '', null, 0.22, 4],
  ['OLIVE', 'DELTA_K', 'Delta K', '', null, 0.01, 5],
  ['GRAINES', 'INDICE_ACIDE', "Indice d'acide", 'mg KOH/g', null, 4, 1],
  ['GRAINES', 'PEROXYDE', 'Indice de peroxyde', 'meq O₂/kg', null, 15, 2],
];

const SQL_QUALITE = `CREATE TABLE IF NOT EXISTS qualite_parametres (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  profil     VARCHAR(20) NOT NULL,
  code       VARCHAR(30) NOT NULL,
  nom        VARCHAR(80) NOT NULL,
  unite      VARCHAR(30) NOT NULL DEFAULT '',
  min_valeur DECIMAL(12,4) NULL,
  max_valeur DECIMAL(12,4) NULL,
  actif      TINYINT(1) NOT NULL DEFAULT 1,
  ordre      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_qualite_profil_code (profil, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS controle_resultats (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  controle_id INT NOT NULL,
  code        VARCHAR(30) NOT NULL,
  nom         VARCHAR(80) NOT NULL,
  unite       VARCHAR(30) NOT NULL DEFAULT '',
  valeur      DECIMAL(12,4) NOT NULL,
  min_valeur  DECIMAL(12,4) NULL,
  max_valeur  DECIMAL(12,4) NULL,
  conforme    TINYINT(1) NOT NULL,
  FOREIGN KEY (controle_id) REFERENCES controles_qualite(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const SQL_JOURNAL_AUDIT = `CREATE TABLE IF NOT EXISTS journal_audit (
  id          BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cree_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id     INT NULL,
  username    VARCHAR(40) NULL,
  role        VARCHAR(20) NULL,
  methode     VARCHAR(8) NOT NULL,
  chemin      VARCHAR(200) NOT NULL,
  rubrique    VARCHAR(40) NOT NULL DEFAULT '',
  entite_id   VARCHAR(40) NULL,
  statut_http SMALLINT NOT NULL,
  ip          VARCHAR(45) NULL,
  resume      TEXT NULL,
  INDEX idx_audit_date (cree_le),
  INDEX idx_audit_rubrique (rubrique),
  INDEX idx_audit_user (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const SQL_OPERATIONS_SYNC = `CREATE TABLE IF NOT EXISTS operations_sync (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  methode     VARCHAR(10) NOT NULL,
  chemin      VARCHAR(200) NOT NULL,
  statut      VARCHAR(10) NOT NULL DEFAULT 'EN_COURS',
  code_http   INT NULL,
  reponse     MEDIUMTEXT NULL,
  cree_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  termine_le  DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const SQL_AVOIRS = `-- Avoirs (factures d'avoir) : une facture émise ne s'annule pas, on la
-- corrige par un avoir numéroté AV-xxxx, total ou partiel.
CREATE TABLE IF NOT EXISTS avoirs (
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

CREATE TABLE IF NOT EXISTS avoir_lignes (
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
`;


// Contrainte CHECK remplacée par une version élargie (MariaDB : contrainte posée
// sur la colonne → on redéfinit la colonne si DROP CONSTRAINT n'est pas possible).
async function remplacerCheck(conn, table, colonne, definition, nom, clause, estAncienne) {
  const [checks] = await conn.query(`
    SELECT tc.CONSTRAINT_NAME AS nom, cc.CHECK_CLAUSE AS clause
    FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = ? AND tc.CONSTRAINT_TYPE = 'CHECK'`, [table]);
  const anciennes = checks.filter(c => estAncienne(c.clause));
  if (!anciennes.length) return false;
  for (const a of anciennes) {
    try { await conn.query(`ALTER TABLE ${table} DROP CONSTRAINT \`${a.nom}\``); }
    catch { await conn.query(`ALTER TABLE ${table} MODIFY ${colonne} ${definition}`); }
  }
  await conn.query(`ALTER TABLE ${table} ADD CONSTRAINT ${nom} CHECK (${clause})`);
  return true;
}

// V3.3 — numérotation Jardins de Jerba et reprise du stock existant :
// numéros de lot jusqu'à 60 caractères, origine « REPRISE », mouvement « REPRISE »,
// style de numérotation « jardins_jerba », table des reprises.
async function miseAJourLots(conn, journal) {
  for (const table of ['lots', 'lots_presse', 'lots_filtration']) {
    const [c] = await conn.query(
      "SELECT CHARACTER_MAXIMUM_LENGTH AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'numero_lot'", [table]);
    if (c[0] && Number(c[0].n) < 60) {
      await conn.query(`ALTER TABLE ${table} MODIFY numero_lot VARCHAR(60) NOT NULL`);
      journal(`✓ Mise à jour : ${table}.numero_lot jusqu'à 60 caractères.`);
    }
  }
  const ORIGINES = "'ACHAT','RECEPTION_MP','PRESSE','FILTRATION','CONDITIONNEMENT','PRODUCTION_RECETTE','INVENTAIRE','AUTRE','REPRISE'";
  if (await remplacerCheck(conn, 'lots', 'origine', 'VARCHAR(20) NOT NULL', 'lots_origine_chk', `origine IN (${ORIGINES})`,
    (cl) => /RECEPTION_MP/.test(cl) && !/REPRISE/.test(cl))) journal('✓ Mise à jour : lots d\'origine « REPRISE » acceptés.');
  if (await remplacerCheck(conn, 'lot_type_champs', 'type_lot', 'VARCHAR(20) NOT NULL', 'lot_type_champs_type_chk', `type_lot IN (${ORIGINES})`,
    (cl) => /RECEPTION_MP/.test(cl) && !/REPRISE/.test(cl))) journal('✓ Mise à jour : champs personnalisés pour les lots repris.');
  if (await remplacerCheck(conn, 'stock_mouvements', 'type_mouvement', 'VARCHAR(20) NOT NULL', 'stock_mouvements_type_chk',
    "type_mouvement IN ('ACHAT','RECEPTION','VENTE','PRODUCTION','CONDITIONNEMENT','CONSOMMATION','TRANSFERT','AJUSTEMENT','INVENTAIRE','RETOUR_CLIENT','RETOUR_FOURNISSEUR','PERTE','CASSE','DESTRUCTION','AUTRE','REPRISE')",
    (cl) => /CONSOMMATION/.test(cl) && !/REPRISE/.test(cl))) journal('✓ Mise à jour : mouvement « REPRISE » (stock initial) accepté.');
  if (await remplacerCheck(conn, 'settings', 'lot_format_style', "VARCHAR(20) NOT NULL DEFAULT 'code_origine_seq'", 'settings_lot_format_chk',
    "lot_format_style IN ('code_origine_seq','origine_code_seq','jardins_jerba')",
    (cl) => /code_origine_seq/.test(cl) && !/jardins_jerba/.test(cl))) journal('✓ Mise à jour : numérotation « Jardins de Jerba » disponible.');
  const [rp] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'reprises'");
  if (!rp[0].n) {
    await conn.query(SQL_REPRISES);
    journal('✓ Mise à jour : table des reprises de stock créée.');
  }
  // V3.3 — yy des lots finis : un seul compteur qui continue d'une année à l'autre (lot_jj_fini).
  const [yy] = await conn.query("SELECT MAX(`last_value`) AS v, SUM(name = 'lot_jj_fini') AS deja FROM sequences WHERE name = 'lot_jj_fini' OR name LIKE 'lot_jj_fini\\_%'");
  if (yy[0].v != null && !Number(yy[0].deja)) {
    await conn.query("INSERT INTO sequences (name, `last_value`) VALUES ('lot_jj_fini', ?)", [yy[0].v]);
    journal(`✓ Mise à jour : compteur yy des lots finis continu (repart après ${yy[0].v}).`);
  }
  if (!(await colonneExiste(conn, 'lots', 'reprise_id'))) {
    await conn.query('ALTER TABLE lots ADD COLUMN reprise_id INT NULL, ADD INDEX idx_lots_reprise (reprise_id)');
    journal('✓ Mise à jour : lots.reprise_id ajoutée.');
  }
}

const SQL_REPRISES = `CREATE TABLE IF NOT EXISTS reprises (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  numero        VARCHAR(20) NOT NULL UNIQUE,
  date_reprise  DATE NOT NULL,
  fichier       VARCHAR(255) NULL,
  nb_lots       INT NOT NULL DEFAULT 0,
  employe_id    INT NULL,
  annulee_le    DATETIME NULL,
  annule_motif  VARCHAR(255) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

module.exports = { appliquerMisesAJour };
