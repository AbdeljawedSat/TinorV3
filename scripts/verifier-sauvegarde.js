// Vérifie qu'une sauvegarde est RESTAURABLE : sauvegarde la base courante, la restaure dans une base temporaire,
// compare le nombre de lignes de chaque table (et une empreinte de leur contenu), puis supprime la base temporaire.
// Usage : npm run test:restauration      (utilisé aussi par la CI)
require('../src/env');
const mysql = require('mysql2/promise');
const { faireSauvegarde } = require('./backup');
const { restaurerVers, ADMIN, ADMIN_MDP } = require('./restaurer');
const fs = require('fs');

const BASE = process.env.DB_NAME || 'tinor_v3';
const TEMP = `${BASE}_restauration_test`.slice(0, 64);

async function empreintes(conn, base) {
  const [tables] = await conn.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY 1", [base]);
  const r = {};
  for (const { t } of tables) {
    const [[n]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${base}\`.\`${t}\``);
    let somme = null;
    try { const [[c]] = await conn.query(`CHECKSUM TABLE \`${base}\`.\`${t}\``); somme = String(c.Checksum); } catch { /* vue ou moteur sans checksum */ }
    r[t] = { lignes: Number(n.n), somme };
  }
  return r;
}

(async () => {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: process.env.DB_PORT || 3306, user: ADMIN, password: ADMIN_MDP });
  let ok = true;
  try {
    // Les écritures de l'API sont terminées au moment de la sauvegarde (single-transaction) : l'état comparé est le même.
    const sauvegarde = await faireSauvegarde();
    console.log(`✓ Sauvegarde faite : ${sauvegarde.fichier} (${(sauvegarde.taille / 1024).toFixed(0)} Ko)`);
    const nTables = await restaurerVers(sauvegarde.chemin, TEMP);
    console.log(`✓ Restaurée dans « ${TEMP} » : ${nTables} tables`);
    const [a, b] = [await empreintes(conn, BASE), await empreintes(conn, TEMP)];
    let lignes = 0;
    for (const t of Object.keys(a)) {
      if (!b[t]) { ok = false; console.error(`✗ Table absente après restauration : ${t}`); continue; }
      lignes += a[t].lignes;
      if (a[t].lignes !== b[t].lignes) { ok = false; console.error(`✗ ${t} : ${a[t].lignes} lignes à l'origine, ${b[t].lignes} après restauration`); }
      else if (a[t].somme && b[t].somme && a[t].somme !== b[t].somme) { ok = false; console.error(`✗ ${t} : contenu différent après restauration`); }
    }
    const [[cles]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.table_constraints WHERE constraint_type = \'FOREIGN KEY\' AND table_schema = ?', [BASE]);
    const [[cles2]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.table_constraints WHERE constraint_type = \'FOREIGN KEY\' AND table_schema = ?', [TEMP]);
    if (cles.n !== cles2.n) { ok = false; console.error(`✗ Clés étrangères : ${cles.n} à l'origine, ${cles2.n} après restauration`); }
    console.log(ok ? `✓ Restauration conforme : ${Object.keys(a).length} tables, ${lignes} lignes, ${cles.n} clés étrangères identiques.` : '✗ Restauration NON conforme.');
    fs.unlinkSync(sauvegarde.chemin); // sauvegarde de test : inutile de la garder
  } catch (e) { ok = false; console.error('✗ Échec :', e.message); }
  finally { await conn.query(`DROP DATABASE IF EXISTS \`${TEMP}\``).catch(() => {}); await conn.end(); }
  process.exit(ok ? 0 : 1);
})();
