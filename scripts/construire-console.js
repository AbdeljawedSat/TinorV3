// Assemble la console : admin/src/*  →  admin/tinor_admin.html (un seul fichier, comme avant : c'est lui que sert l'API
// et qu'embarque l'application Android). Les morceaux sont lus dans l'ordre de leur nom (NNN-titre.ext) et collés tels quels.
//   npm run console              assemble admin/tinor_admin.html
//   npm run console -- --verifier  échoue si tinor_admin.html n'est pas à jour avec admin/src (utilisé par la CI)
// On modifie les fichiers de admin/src, puis on relance cette commande et on enregistre les deux.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'admin', 'src');
const SORTIE = path.join(__dirname, '..', 'admin', 'tinor_admin.html');

const morceaux = fs.readdirSync(SRC).filter(f => /^\d{3}[a-z]?-.+\.(html|css|js)$/.test(f)).sort();
if (!morceaux.length) { console.error('✗ admin/src est vide.'); process.exit(1); }
const html = morceaux.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');

if (process.argv.includes('--verifier')) {
  const actuel = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : '';
  if (actuel !== html) {
    console.error('✗ admin/tinor_admin.html n\'est pas à jour avec admin/src : lancez « npm run console » et enregistrez le résultat.');
    process.exit(1);
  }
  console.log(`✓ La console est à jour (${morceaux.length} fichiers dans admin/src).`);
} else {
  fs.writeFileSync(SORTIE, html);
  console.log(`✓ admin/tinor_admin.html assemblé à partir de ${morceaux.length} fichiers (${(html.length / 1024).toFixed(0)} Ko).`);
}
