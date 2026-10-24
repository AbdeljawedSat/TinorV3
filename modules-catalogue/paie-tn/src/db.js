'use strict';
/**
 * Adaptateur base de données : accepte un pool `mariadb` (connecteur officiel) ou `mysql2/promise`.
 * Expose query(sql, params) et transaction(fn) avec des résultats normalisés :
 *  - SELECT -> tableau de lignes (BigInt convertis en Number, DECIMAL laissés en texte) ;
 *  - INSERT/UPDATE -> { insertId, affectedRows }.
 */
const fs = require('fs');
const path = require('path');

function normaliserLigne(row) {
  if (row === null || typeof row !== 'object') return row;
  const o = {};
  for (const [k, v] of Object.entries(row)) o[k] = typeof v === 'bigint' ? Number(v) : v;
  return o;
}

function normaliser(res) {
  // mysql2/promise renvoie [lignes, champs]
  if (Array.isArray(res) && res.length === 2 && (res[1] === undefined || Array.isArray(res[1]))
      && (Array.isArray(res[0]) || (res[0] && typeof res[0] === 'object' && 'affectedRows' in res[0]))) res = res[0];
  if (Array.isArray(res)) return res.map(normaliserLigne);
  if (res && typeof res === 'object' && 'affectedRows' in res)
    return { insertId: Number(res.insertId || 0), affectedRows: Number(res.affectedRows || 0) };
  return res;
}

function creerDb(pool) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.getConnection !== 'function')
    throw new Error('tinor-paie : un pool mariadb ou mysql2/promise est requis');
  const executer = async (cible, sql, params = []) => normaliser(await cible.query(sql, params));
  const db = {
    query: (sql, params) => executer(pool, sql, params),
    async transaction(fn) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const tx = { query: (sql, params) => executer(conn, sql, params) };
        const r = await fn(tx);
        await conn.commit();
        return r;
      } catch (e) {
        try { await conn.rollback(); } catch (_) { /* connexion perdue */ }
        throw e;
      } finally {
        conn.release();
      }
    },
  };
  return db;
}

/** Découpe le script SQL commun en ordres (même règle que Database.decouper côté Java). */
function decouper(sql) {
  const ordres = [];
  let cur = '';
  for (const ligne of sql.split(/\r?\n/)) {
    const t = ligne.trim();
    if (!t || t.startsWith('--')) continue;
    cur += ligne + '\n';
    if (t.endsWith(';')) { ordres.push(cur.trim().slice(0, -1)); cur = ''; }
  }
  if (cur.trim()) ordres.push(cur.trim());
  return ordres;
}

const MIGRATIONS = ['V1__paie_init.sql', 'V2__parametres_versions.sql'];

/** Applique les migrations non encore appliquées (tables paie_*). Renvoie la liste des fichiers appliqués. */
async function migrer(db) {
  let actuelle = 0;
  try {
    const r = await db.query('SELECT COALESCE(MAX(version),0) AS v FROM paie_schema_version');
    actuelle = Number(r[0].v);
  } catch (e) { actuelle = 0; }
  const appliquees = [];
  for (let i = actuelle; i < MIGRATIONS.length; i++) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'shared', 'sql', MIGRATIONS[i]), 'utf8');
    // DDL MariaDB : auto-commit implicite, les CREATE ... IF NOT EXISTS rendent la reprise sûre
    for (const o of decouper(sql)) await db.query(o);
    appliquees.push(MIGRATIONS[i]);
  }
  return appliquees;
}

module.exports = { creerDb, migrer, decouper };
