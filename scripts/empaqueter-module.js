// Fabrique le .zip installable d'un module (écran Réglages › Modules) à partir de son dossier source.
//   node scripts/empaqueter-module.js modules-catalogue/paie-tn            → modules-catalogue/paie-tn-1.0.0.zip
//   node scripts/empaqueter-module.js modules-catalogue/paie-tn --verifier → échoue si le .zip n'est pas à jour avec les sources
// Les dépendances déclarées dans module.json (« dependances ») sont embarquées depuis node_modules : le module est autonome.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { validerManifeste } = require('../src/services/modules');

const racine = path.join(__dirname, '..');
const dossier = path.resolve(process.argv[2] || '');
const verifier = process.argv.includes('--verifier');
if (!process.argv[2] || !fs.existsSync(path.join(dossier, 'module.json'))) { console.error('Usage : node scripts/empaqueter-module.js <dossier-du-module> [--verifier]'); process.exit(1); }

function lister(base, rel = '') {
  const sortie = [];
  for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) sortie.push(...lister(base, r)); else if (e.isFile()) sortie.push(r);
  }
  return sortie;
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const manifeste = validerManifeste(JSON.parse(fs.readFileSync(path.join(dossier, 'module.json'), 'utf8')), dossier);
const exclure = (manifeste.empaqueter && manifeste.empaqueter.exclure) || [];
const fichiers = new Map(); // chemin dans le zip → contenu
for (const f of lister(dossier)) {
  if (f.startsWith('node_modules/') || exclure.some(x => (x.endsWith('/') ? f.startsWith(x) : f === x))) continue;
  fichiers.set(f, fs.readFileSync(path.join(dossier, f)));
}
for (const dep of manifeste.dependances || []) {
  const d = path.join(racine, 'node_modules', dep);
  if (!fs.existsSync(d)) { console.error(`✗ Dépendance « ${dep} » absente de node_modules : npm install.`); process.exit(1); }
  for (const f of lister(d)) if (!f.startsWith('node_modules/')) fichiers.set(`node_modules/${dep}/${f}`, fs.readFileSync(path.join(d, f)));
}
const nom = `${manifeste.id}-${manifeste.version}.zip`;
const sortie = path.join(path.dirname(dossier), nom);

(async () => {
  if (verifier) {
    if (!fs.existsSync(sortie)) { console.error(`✗ ${path.relative(racine, sortie)} absent : lancez « node scripts/empaqueter-module.js ${path.relative(racine, dossier)} ».`); process.exit(1); }
    const zip = await JSZip.loadAsync(fs.readFileSync(sortie));
    const dans = new Map();
    for (const e of Object.values(zip.files)) if (!e.dir) dans.set(e.name, sha(await e.async('nodebuffer')));
    const ecarts = [];
    for (const [f, c] of fichiers) if (dans.get(f) !== sha(c)) ecarts.push(f);
    for (const f of dans.keys()) if (!fichiers.has(f)) ecarts.push(f + ' (en trop)');
    if (ecarts.length) { console.error(`✗ ${nom} n'est pas à jour (${ecarts.length} fichier(s) : ${ecarts.slice(0, 5).join(', ')}…) : relancez l'empaquetage.`); process.exit(1); }
    console.log(`✓ ${nom} est à jour (${fichiers.size} fichiers).`);
    return;
  }
  const zip = new JSZip();
  for (const f of [...fichiers.keys()].sort()) zip.file(f, fichiers.get(f), { date: new Date('2026-01-01T00:00:00Z') });
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  for (const autre of fs.readdirSync(path.dirname(dossier))) if (autre.startsWith(`${manifeste.id}-`) && autre.endsWith('.zip') && autre !== nom) fs.unlinkSync(path.join(path.dirname(dossier), autre));
  fs.writeFileSync(sortie, buffer);
  console.log(`✓ ${path.relative(racine, sortie)} : ${fichiers.size} fichiers, ${(buffer.length / 1024).toFixed(0)} Ko (sha256 ${sha(buffer).slice(0, 12)}…)`);
})();
