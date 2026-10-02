// Lance les tests de stock les uns après les autres. Prérequis : API démarrée
// (npm start) sur une base de TEST initialisée (npm run migrate && npm run seed) —
// les tests créent des produits, lots, commandes et factures.
const { execFileSync } = require('child_process');
const path = require('path');
let echec = false;
for (const t of ['ecarts', 'peremption', 'inventaire']) {
  console.log(`\n=== ${t} ===`);
  try { execFileSync(process.execPath, [path.join(__dirname, `${t}.js`)], { stdio: 'inherit' }); }
  catch { echec = true; }
}
if (echec) { console.error('\n✗ Des tests ont échoué.'); process.exit(1); }
console.log('\n✓ Tous les tests de stock passent.');
