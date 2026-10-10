// ============================================================================
// Prépare les deux versions de TinOR sur ce PC :
//   • TEST (essais, formation) : la base actuelle (données de démonstration),
//     fichier .env.test, port 3002, bandeau orange « MODE TEST ».
//   • RÉEL (vos vraies données) : une base NEUVE et vide (tinor_reel par défaut),
//     fichier .env, port 3001, numérotation des lots « Jardins de Jerba ».
// Usage : npm run creer:reel
//         (options : --base=tinor_reel --mot-de-passe=… pour le compte admin)
// Ne touche jamais une base réelle déjà créée ; .env n'est réécrit qu'à la fin,
// une fois la base réelle prête.
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const RACINE = path.join(__dirname, '..');
const ENV = path.join(RACINE, '.env'), ENV_TEST = path.join(RACINE, '.env.test');
const option = (nom) => (process.argv.find(a => a.startsWith(`--${nom}=`)) || '').split('=').slice(1).join('=') || null;
const lireEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
function ecrireVar(texte, cle, valeur) {
  const re = new RegExp(`^${cle}=.*$`, 'm');
  return re.test(texte) ? texte.replace(re, `${cle}=${valeur}`) : `${texte.replace(/\s*$/, '')}\n${cle}=${valeur}\n`;
}
function question(texte, cache = false) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (cache) rl._writeToOutput = (s) => { if (/\n|\r/.test(s) || s.startsWith(texte)) rl.output.write(s.startsWith(texte) ? texte : s); };
    rl.question(texte, (r) => { rl.close(); if (cache) process.stdout.write('\n'); ok(r.trim()); });
  });
}

async function main() {
  if (!fs.existsSync(ENV)) { console.error('✗ Fichier .env introuvable : installez d\'abord TinOR (npm run setup).'); process.exit(1); }
  const actuel = lireEnv(ENV);
  if ((actuel.TINOR_ENVIRONNEMENT || '').toUpperCase() === 'REEL') {
    console.log(`✓ La version RÉEL existe déjà (base ${actuel.DB_NAME}). Rien n'est modifié.`);
    console.log('  Démarrer : TinOR.bat (réel, port 3001) · TinOR Test.bat (test, port 3002)');
    return;
  }
  const base = option('base') || (await question('Nom de la base réelle [tinor_reel] : ')) || 'tinor_reel';
  if (!/^[A-Za-z0-9_]+$/.test(base)) { console.error('✗ Nom de base invalide (lettres, chiffres et _ seulement).'); process.exit(1); }
  if (base === actuel.DB_NAME) { console.error(`✗ « ${base} » est la base actuelle (qui devient la version TEST) : choisissez un autre nom.`); process.exit(1); }
  let motDePasse = option('mot-de-passe');
  while (!motDePasse || motDePasse.length < 6) {
    motDePasse = await question('Mot de passe du compte « admin » de la version RÉEL (6 caractères min.) : ', true);
    if (motDePasse.length < 6) console.log('  Trop court.');
  }

  // 1. Base réelle : création (ou base vide déjà créée par l'administrateur MariaDB).
  const acces = { host: actuel.DB_HOST || '127.0.0.1', port: Number(actuel.DB_PORT || 3306), user: actuel.DB_USER || 'tinor', password: actuel.DB_PASSWORD || '' };
  const conn = await mysql.createConnection(acces);
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (e) {
    console.error(`✗ L'utilisateur MariaDB « ${acces.user} » ne peut pas créer de base (${e.code}).`);
    console.error('  Ouvrez MariaDB en administrateur (mysql -u root -p) et exécutez :');
    console.error(`    CREATE DATABASE ${base} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.error(`    GRANT ALL PRIVILEGES ON ${base}.* TO '${acces.user}'@'localhost';`);
    console.error('    FLUSH PRIVILEGES;');
    console.error('  puis relancez : npm run creer:reel');
    process.exit(1);
  }
  const [[deja]] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'lots'", [base]);
  if (deja.n) {
    const [[n]] = await conn.query(`SELECT (SELECT COUNT(*) FROM \`${base}\`.lots) + (SELECT COUNT(*) FROM \`${base}\`.commandes) AS n`);
    if (n.n) { console.error(`✗ La base « ${base} » contient déjà des données : rien n'est modifié.`); process.exit(1); }
  }
  await conn.end();

  // 2. Tables + données de référence (unités, formats, locaux, compte admin) — aucune donnée de démonstration.
  const envBase = { ...process.env, DB_NAME: base, DB_HOST: acces.host, DB_PORT: String(acces.port), DB_USER: acces.user, DB_PASSWORD: acces.password, TINOR_ENV: '' };
  execFileSync(process.execPath, [path.join(__dirname, 'migrate.js')], { stdio: 'inherit', env: envBase });
  execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit', env: envBase });

  // 3. Réglages : mot de passe admin choisi, numérotation Jardins de Jerba, coordonnées
  //    de la société reprises de la base actuelle (si elles y sont).
  const reel = await mysql.createConnection({ ...acces, database: base });
  await reel.query("UPDATE users SET password_hash = ? WHERE username = 'admin'", [await bcrypt.hash(motDePasse, 10)]);
  console.log('✓ Compte « admin » de la version RÉEL : mot de passe = celui que vous venez de choisir (pas « changeme »).');
  await reel.query("UPDATE settings SET lot_format_style = 'jardins_jerba' WHERE id = 1");
  try {
    const [[s]] = await reel.query(`SELECT * FROM \`${actuel.DB_NAME}\`.settings WHERE id = 1`);
    const [cols] = await reel.query("SELECT COLUMN_NAME AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = 'settings'", [base]);
    const aCopier = cols.map(x => x.c).filter(c => /^entreprise_|^facture_couleur$|^fodec_rate$|^droit_timbre$|^timbre_seuil$|^tva/.test(c) && s && s[c] != null);
    for (const c of aCopier) await reel.query(`UPDATE settings SET \`${c}\` = ? WHERE id = 1`, [s[c]]);
    if (aCopier.length) console.log(`✓ Coordonnées de la société reprises de la base actuelle (${aCopier.length} réglages).`);
  } catch { /* base actuelle sans réglages : à saisir dans Paramètres */ }
  await reel.end();

  // 4. Fichiers d'environnement : la base actuelle devient TEST (port 3002), la nouvelle est RÉEL (port 3001).
  let texteActuel = fs.readFileSync(ENV, 'utf8');
  if (!fs.existsSync(ENV_TEST)) {
    let t = ecrireVar(texteActuel, 'PORT', '3002');
    t = ecrireVar(t, 'TINOR_ENVIRONNEMENT', 'TEST');
    fs.writeFileSync(ENV_TEST, t);
    console.log(`✓ Version TEST : base ${actuel.DB_NAME}, port 3002 (fichier .env.test).`);
  }
  texteActuel = ecrireVar(texteActuel, 'DB_NAME', base);
  texteActuel = ecrireVar(texteActuel, 'PORT', '3001');
  texteActuel = ecrireVar(texteActuel, 'TINOR_ENVIRONNEMENT', 'REEL');
  texteActuel = ecrireVar(texteActuel, 'JWT_SECRET', crypto.randomBytes(32).toString('hex'));
  texteActuel = ecrireVar(texteActuel, 'NODE_ENV', 'production');
  fs.writeFileSync(ENV, texteActuel);
  console.log(`✓ Version RÉEL : base ${base} (vide), port 3001 (fichier .env).`);
  console.log('');
  console.log('  Démarrer la version RÉEL : double-clic sur « TinOR.bat »       → http://IP-du-PC:3001');
  console.log('  Démarrer la version TEST : double-clic sur « TinOR Test.bat »  → http://IP-du-PC:3002');
  console.log('  Connexion RÉEL : admin + le mot de passe choisi.  Connexion TEST : comme avant.');
  console.log('  Ensuite, dans RÉEL : Paramètres → produits → clients/fournisseurs → Stock › Reprise du stock.');
}

main().catch((e) => { console.error('Échec :', e.message); process.exit(1); });
