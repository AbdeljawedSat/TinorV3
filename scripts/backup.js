// ============================================================================
// Sauvegarde automatique de la base TinOR — exporte via mysqldump, garde les
// 30 dernières sauvegardes (rotation), supprime les plus anciennes.
//
// Usage manuel :
//   node scripts/backup.js
//
// Usage planifié (Windows) : voir backup.bat + instructions dans
// scripts/README_SAUVEGARDE.md
// ============================================================================

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'tinor';
const DB_PASSWORD = process.env.DB_PASSWORD || 'tinor';
const DB_NAME = process.env.DB_NAME || 'tinor_v3';

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const JOURS_A_GARDER = Number(process.env.BACKUP_RETENTION_DAYS || 30);

function horodatage() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

function faireSauvegarde() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const nomFichier = `tinor_${DB_NAME}_${horodatage()}.sql`;
    const cheminComplet = path.join(BACKUP_DIR, nomFichier);

    // Le mot de passe est passé via une variable d'environnement plutôt que
    // dans la commande elle-même (évite qu'il apparaisse dans les journaux
    // système / la liste des processus en cours).
    const env = { ...process.env, MYSQL_PWD: DB_PASSWORD };
    const commande = `mysqldump --host=${DB_HOST} --port=${DB_PORT} --user=${DB_USER} --single-transaction --routines --triggers ${DB_NAME}`;

    const out = fs.createWriteStream(cheminComplet);
    const proc = exec(commande, { env, maxBuffer: 1024 * 1024 * 50 });
    proc.stdout.pipe(out);
    let erreur = '';
    proc.stderr.on('data', d => { erreur += d.toString(); });

    proc.on('close', code => {
      out.close();
      if (code !== 0) {
        fs.unlink(cheminComplet, () => {});
        return reject(new Error(erreur || `mysqldump a échoué (code ${code}). Vérifiez qu'il est installé et dans le PATH.`));
      }
      const taille = fs.statSync(cheminComplet).size;
      if (taille < 100) {
        fs.unlink(cheminComplet, () => {});
        return reject(new Error('Fichier de sauvegarde anormalement petit — probable échec silencieux.'));
      }
      resolve({ fichier: nomFichier, chemin: cheminComplet, taille });
    });
  });
}

function nettoyerAnciennesSauvegardes() {
  if (!fs.existsSync(BACKUP_DIR)) return { supprimes: [] };
  const limite = Date.now() - JOURS_A_GARDER * 24 * 60 * 60 * 1000;
  const supprimes = [];
  for (const nom of fs.readdirSync(BACKUP_DIR)) {
    if (!nom.startsWith('tinor_') || !nom.endsWith('.sql')) continue;
    const chemin = path.join(BACKUP_DIR, nom);
    const stat = fs.statSync(chemin);
    if (stat.mtimeMs < limite) {
      fs.unlinkSync(chemin);
      supprimes.push(nom);
    }
  }
  return { supprimes };
}

async function main() {
  console.log(`[${new Date().toISOString()}] Démarrage de la sauvegarde...`);
  try {
    const res = await faireSauvegarde();
    console.log(`✓ Sauvegarde créée : ${res.fichier} (${(res.taille / 1024).toFixed(0)} Ko)`);
    const { supprimes } = nettoyerAnciennesSauvegardes();
    if (supprimes.length) console.log(`✓ ${supprimes.length} ancienne(s) sauvegarde(s) supprimée(s) (> ${JOURS_A_GARDER} jours).`);
    console.log('Terminé avec succès.');
  } catch (err) {
    console.error('❌ ÉCHEC DE LA SAUVEGARDE :', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { faireSauvegarde, nettoyerAnciennesSauvegardes, BACKUP_DIR };
