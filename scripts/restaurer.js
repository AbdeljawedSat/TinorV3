// ============================================================================
// Restauration d'une sauvegarde TinOR (fichier .sql produit par scripts/backup.js).
//
//   node scripts/restaurer.js backups/tinor_xxx.sql --vers tinor_verification
//       → restaure dans une AUTRE base (créée si besoin) : pour vérifier une sauvegarde sans rien risquer.
//   node scripts/restaurer.js backups/tinor_xxx.sql --ecraser --confirmer
//       → remplace le contenu de la base configurée (.env) : reprise après incident. Une sauvegarde de sécurité
//         de l'état actuel est faite d'abord.
// Les droits de création de base (--vers) peuvent demander DB_ADMIN_USER / DB_ADMIN_PASSWORD (compte root).
// ============================================================================
require('../src/env');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');

const HOTE = process.env.DB_HOST || '127.0.0.1', PORT = process.env.DB_PORT || 3306;
const UTILISATEUR = process.env.DB_USER || 'tinor', MOT_DE_PASSE = process.env.DB_PASSWORD || 'tinor';
const BASE = process.env.DB_NAME || 'tinor_v3';
const ADMIN = process.env.DB_ADMIN_USER || UTILISATEUR, ADMIN_MDP = process.env.DB_ADMIN_PASSWORD || MOT_DE_PASSE;

const NOM_BASE_OK = /^[A-Za-z0-9_]{1,64}$/;

// Envoie le fichier .sql au client mysql (flux : pas de limite de taille en mémoire).
function injecter(fichier, base, utilisateur, mdp) {
  return new Promise((resolve, reject) => {
    const proc = spawn('mysql', [`--host=${HOTE}`, `--port=${PORT}`, `--user=${utilisateur}`, '--default-character-set=utf8mb4', base],
      { env: { ...process.env, MYSQL_PWD: mdp }, stdio: ['pipe', 'ignore', 'pipe'] });
    let erreur = '';
    proc.stderr.on('data', d => { erreur += d.toString(); });
    proc.on('error', e => reject(new Error(`Client « mysql » introuvable (${e.message}). Installez-le ou ajoutez son dossier au PATH.`)));
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(erreur.trim() || `mysql a échoué (code ${code}).`))));
    fs.createReadStream(fichier).on('error', reject).pipe(proc.stdin);
  });
}

async function connexionAdmin() {
  return mysql.createConnection({ host: HOTE, port: PORT, user: ADMIN, password: ADMIN_MDP });
}

// Restaure `fichier` dans `base` (vidée avant). Renvoie le nombre de tables restaurées.
async function restaurerVers(fichier, base, { creer = true } = {}) {
  if (!NOM_BASE_OK.test(base)) throw new Error('Nom de base invalide (lettres, chiffres et _ seulement).');
  if (!fs.existsSync(fichier)) throw new Error(`Fichier introuvable : ${fichier}`);
  const admin = await connexionAdmin();
  try {
    if (creer) {
      await admin.query(`DROP DATABASE IF EXISTS \`${base}\``);
      await admin.query(`CREATE DATABASE \`${base}\` CHARACTER SET utf8mb4`);
    }
    await injecter(fichier, base, ADMIN, ADMIN_MDP);
    const [[r]] = await admin.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [base]);
    return r.n;
  } finally { await admin.end(); }
}

async function main() {
  const args = process.argv.slice(2);
  const fichier = args.find(a => !a.startsWith('--'));
  const vers = args.includes('--vers') ? args[args.indexOf('--vers') + 1] : null;
  if (!fichier || (!vers && !args.includes('--ecraser'))) {
    console.log('Usage :\n  node scripts/restaurer.js <sauvegarde.sql> --vers <autre_base>        (vérification, sans risque)\n  node scripts/restaurer.js <sauvegarde.sql> --ecraser --confirmer        (remplace la base ' + BASE + ')');
    process.exit(1);
  }
  const chemin = path.resolve(fichier);
  if (vers) {
    if (vers === BASE) { console.error(`✗ « ${vers} » est la base en service : utilisez --ecraser --confirmer.`); process.exit(1); }
    const n = await restaurerVers(chemin, vers);
    console.log(`✓ Sauvegarde restaurée dans la base « ${vers} » (${n} tables). La base en service n'a pas été touchée.`);
    return;
  }
  if (!args.includes('--confirmer')) {
    console.log(`⚠ Cette commande REMPLACE tout le contenu de la base « ${BASE} » par la sauvegarde ${path.basename(chemin)}.`);
    console.log('  Pour confirmer : ajoutez --confirmer');
    process.exit(1);
  }
  console.log('Sauvegarde de sécurité de l\'état actuel…');
  const { faireSauvegarde } = require('./backup');
  const secu = await faireSauvegarde('tinor_avant-restauration');
  console.log(`✓ État actuel gardé dans ${secu.fichier}`);
  const n = await restaurerVers(chemin, BASE, { creer: true });
  console.log(`✓ Base « ${BASE} » restaurée depuis ${path.basename(chemin)} (${n} tables). Relancez TinOR.`);
}

if (require.main === module) main().catch(e => { console.error('✗ Échec :', e.message); process.exit(1); });
module.exports = { restaurerVers, ADMIN, ADMIN_MDP };
