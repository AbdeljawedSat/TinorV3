// Efface le contenu de toutes les tables et charge les données de démonstration
// (base/tinor_v3_reinitialiser_demo.sql). La structure n'est pas modifiée.
// Usage : npm run reset:demo -- --confirmer
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { appliquerMisesAJour } = require('./mises-a-jour');

async function main() {
  const cible = process.env.DATABASE_URL ? '(base configurée via DATABASE_URL)'
    : `${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'tinor_v3'}`;
  if (!process.argv.includes('--confirmer')) {
    console.log(`⚠ Cette commande EFFACE tout le contenu de la base ${cible}`);
    console.log('  (produits, lots, commandes, factures, utilisateurs…) puis charge les données de démonstration.');
    console.log('  Pour confirmer : npm run reset:demo -- --confirmer');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.join(__dirname, '..', 'base', 'tinor_v3_reinitialiser_demo.sql'), 'utf8');
  const conn = process.env.DATABASE_URL
    ? await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true })
    : await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'tinor',
        password: process.env.DB_PASSWORD || 'tinor',
        database: process.env.DB_NAME || 'tinor_v3',
        multipleStatements: true,
      });
  const [tables] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sequences'");
  if (!tables[0].n) throw new Error('Tables TinOR absentes : lancer d\'abord npm run setup (ou importer base/tinor_v3_demo.sql).');
  await appliquerMisesAJour(conn);
  console.log(`Remise à zéro de ${cible}…`);
  await conn.query(sql);
  const [[r]] = await conn.query(`SELECT (SELECT COUNT(*) FROM produits) AS produits, (SELECT COUNT(*) FROM lots) AS lots,
    (SELECT COUNT(*) FROM commandes) AS commandes, (SELECT COUNT(*) FROM factures) AS factures`);
  console.log(`✓ Données de démonstration chargées : ${r.produits} produits, ${r.lots} lots, ${r.commandes} commandes, ${r.factures} factures.`);
  console.log('  Connexion : admin / changeme');
  await conn.end();
}

main().catch((e) => { console.error('Échec :', e.message); process.exit(1); });
