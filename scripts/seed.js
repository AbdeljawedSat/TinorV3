// Données de référence minimales pour démarrer — usage : npm run seed
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const CHAMPS_COMMUNS = [
  { nom: 'N° de lot', type_champ: 'texte', obligatoire: 1, verrouille: 1, ordre: 0 },
  { nom: 'Produit', type_champ: 'liste', obligatoire: 1, verrouille: 1, ordre: 1 },
  { nom: 'Date', type_champ: 'date', obligatoire: 1, verrouille: 1, ordre: 2 },
];
const TYPES_LOT = ['ACHAT', 'RECEPTION_MP', 'PRESSE', 'FILTRATION', 'CONDITIONNEMENT', 'PRODUCTION_RECETTE', 'INVENTAIRE', 'AUTRE'];

async function main() {
  const conn = process.env.DATABASE_URL
    ? await mysql.createConnection({ uri: process.env.DATABASE_URL })
    : await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'tinor',
        password: process.env.DB_PASSWORD || 'tinor',
        database: process.env.DB_NAME || 'tinor_v3',
      });

  await conn.query(`INSERT IGNORE INTO unites (code, nom, symbole) VALUES
    ('litre','Litre','L'), ('ml','Millilitre','ml'), ('kg','Kilogramme','kg'),
    ('g','Gramme','g'), ('unite','Unité','u')`);

  await conn.query(`INSERT IGNORE INTO categories (code, nom, type_category) VALUES
    ('HUILE','Huiles','PRODUIT'), ('CONS','Consommables','CONSOMMABLE'),
    ('EMBALLAGE','Emballages','EMBALLAGE'), ('SAVON','Savons','PRODUIT'),
    ('COMPOSE','Produits composés','PRODUIT')`);

  await conn.query(`INSERT IGNORE INTO formats (code, nom, volume, unite_id) VALUES
    ('10ml','10 ml', 10, (SELECT id FROM unites WHERE code='ml')),
    ('30ml','30 ml', 30, (SELECT id FROM unites WHERE code='ml')),
    ('100ml','100 ml', 100, (SELECT id FROM unites WHERE code='ml')),
    ('250ml','250 ml', 250, (SELECT id FROM unites WHERE code='ml')),
    ('1000ml','1000 ml', 1000, (SELECT id FROM unites WHERE code='ml'))`);

  await conn.query(`INSERT IGNORE INTO locaux (code, nom, type_local) VALUES
    ('ATELIER','Atelier Djerba','PRODUCTION'), ('STOCK1','Entrepôt Principal','STOCK')`);

  await conn.query(`INSERT INTO sequences (name, \`last_value\`) VALUES ('produit_code_seq', 0)
    ON DUPLICATE KEY UPDATE name = name`);

  // Structure de lots par défaut : les 3 champs communs verrouillés pour chaque type.
  for (const type of TYPES_LOT) {
    const [existing] = await conn.query('SELECT COUNT(*) AS n FROM lot_type_champs WHERE type_lot = ?', [type]);
    if (existing[0].n > 0) continue;
    for (const c of CHAMPS_COMMUNS) {
      await conn.query(
        `INSERT INTO lot_type_champs (type_lot, nom, type_champ, obligatoire, verrouille, ordre) VALUES (?,?,?,?,?,?)`,
        [type, c.nom, c.type_champ, c.obligatoire, c.verrouille, c.ordre]
      );
    }
  }

  // Employé + utilisateur admin par défaut (mot de passe à changer en production).
  const [emp] = await conn.query(
    `INSERT IGNORE INTO employes (matricule, nom, prenom, fonction) VALUES ('EMP-000','Admin','Compte','Gérant')`
  );
  const [empRow] = await conn.query(`SELECT id FROM employes WHERE matricule = 'EMP-000'`);
  const empId = empRow[0].id;

  const [existingUser] = await conn.query(`SELECT id FROM users WHERE username = 'admin'`);
  if (!existingUser.length) {
    const hash = await bcrypt.hash('changeme', 10);
    await conn.query(
      `INSERT INTO users (username, password_hash, employe_id, role) VALUES ('admin', ?, ?, 'gerant')`,
      [hash, empId]
    );
    console.log('✓ Utilisateur admin créé (username: admin / mot de passe: changeme — à changer).');
  }

  await conn.query(`INSERT IGNORE INTO settings (id) VALUES (1)`);

  console.log('✓ Données de référence insérées.');
  await conn.end();
}

main().catch((e) => { console.error('Échec du seed :', e.message); process.exit(1); });
