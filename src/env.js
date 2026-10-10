// Choix de l'environnement : RÉEL (.env) ou TEST (.env.test).
// TEST : option --test sur la ligne de commande (npm run start:test, migrate:test…)
// ou variable TINOR_ENV=test. Les deux versions partagent le même code ; seules
// la base, le port et le bandeau « MODE TEST » changent.
const fs = require('fs');
const path = require('path');

const test = process.argv.includes('--test') || /^test$/i.test(process.env.TINOR_ENV || '');
const fichier = path.join(__dirname, '..', test ? '.env.test' : '.env');
if (test && !fs.existsSync(fichier)) {
  console.error('Version TEST absente (.env.test) : lancez d\'abord « npm run creer:reel », qui prépare les deux versions.');
  process.exit(1);
}
require('dotenv').config({ path: fichier, quiet: true });
if (test) process.env.TINOR_ENVIRONNEMENT = 'TEST';

module.exports = { test, fichier, environnement: () => (process.env.TINOR_ENVIRONNEMENT || '').toUpperCase() || null };
