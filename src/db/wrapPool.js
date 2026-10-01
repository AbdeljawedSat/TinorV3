// Enveloppe un pool mysql2 pour exposer une interface façon "pg" (Pool.query
// retourne {rows}, Pool.connect() retourne un client avec .query()/.release()),
// avec traduction automatique des placeholders $1,$2... vers ? positionnels.
// Partagé entre src/db/pool.js (production) et test/setup.js (tests contre une
// vraie base MariaDB), pour garantir que la même logique de traduction est
// exercée dans les deux cas.

// Convertit $1,$2... (et les répétitions, ex: $4 utilisé deux fois) en ? positionnels
// pour mysql2, en reconstruisant le tableau de paramètres dans le bon ordre —
// nécessaire car certaines requêtes (ex: création d'huile) réutilisent un même $N
// à plusieurs endroits, ce qu'un simple remplacement de texte ne gérerait pas.
function toMysql(sql, params) {
  const newParams = [];
  const mysqlSql = sql.replace(/\$(\d+)/g, (_, n) => {
    newParams.push(params[Number(n) - 1]);
    return '?';
  });
  return { mysqlSql, newParams };
}

function normalize(result) {
  if (Array.isArray(result)) return { rows: result };
  // Résultat d'un INSERT/UPDATE/DELETE (pas de lignes) : on expose insertId/affectedRows
  // en plus de rows=[] pour rester utilisable dans les deux cas.
  return { rows: [], insertId: result.insertId, affectedRows: result.affectedRows };
}

function wrapMysqlPool(rawPool) {
  return {
    async query(sql, params = []) {
      const { mysqlSql, newParams } = toMysql(sql, params);
      const [result] = await rawPool.query(mysqlSql, newParams);
      return normalize(result);
    },
    async connect() {
      const conn = await rawPool.getConnection();
      return {
        async query(sql, params = []) {
          const { mysqlSql, newParams } = toMysql(sql, params);
          const [result] = await conn.query(mysqlSql, newParams);
          return normalize(result);
        },
        release() { conn.release(); }
      };
    },
    async end() { await rawPool.end(); }
  };
}

module.exports = { wrapMysqlPool, toMysql, normalize };
