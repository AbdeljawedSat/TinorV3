// Vérifie la syntaxe de tout le JavaScript du dépôt (src, scripts, test) et des scripts de la console.
// Usage : node scripts/verifier-syntaxe.js   (utilisé par la CI : .github/workflows/tests.yml)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const racine = path.join(__dirname, '..');
let erreurs = 0, n = 0;
function verifier(fichier, source) {
  try { execFileSync(process.execPath, ['--check', fichier], { stdio: 'pipe' }); n++; }
  catch (e) { erreurs++; console.error(`✗ ${path.relative(racine, source || fichier)}\n${String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')}`); }
}
function parcourir(dossier) {
  for (const f of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, f.name);
    if (f.isDirectory()) { if (!['node_modules', '.git', 'android', 'archive'].includes(f.name)) parcourir(chemin); }
    else if (f.name.endsWith('.js')) verifier(chemin);
  }
}
for (const d of ['src', 'scripts', 'test']) parcourir(path.join(racine, d));

// Console : chaque bloc <script> de admin/tinor_admin.html est vérifié à part.
const html = fs.readFileSync(path.join(racine, 'admin', 'tinor_admin.html'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tinor-console-'));
[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  if (!m[1].trim()) return;
  const f = path.join(tmp, `console-${i}.js`);
  fs.writeFileSync(f, m[1].replace(/<\\\/script>/g, ''));
  verifier(f, path.join(racine, 'admin', 'tinor_admin.html'));
});
console.log(erreurs ? `✗ ${erreurs} fichier(s) avec une erreur de syntaxe.` : `✓ Syntaxe correcte (${n} fichiers et blocs de la console).`);
process.exit(erreurs ? 1 : 0);
