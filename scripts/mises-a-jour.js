// Mises à jour de structure pour les bases déjà installées (idempotentes :
// sans effet si la base est déjà à jour). Appelées par `npm run migrate` et
// `npm run reset:demo`. Compatibles MariaDB 10.4+ et MySQL 8.0.19+.

async function colonneExiste(conn, table, colonne) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, colonne]
  );
  return r[0].n > 0;
}

async function appliquerMisesAJour(conn, journal = console.log) {
  // V3.3 — une commande non facturée peut être annulée (statut « annulee »).
  const [checks] = await conn.query(`
    SELECT tc.CONSTRAINT_NAME AS nom, cc.CHECK_CLAUSE AS clause
    FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'commandes' AND tc.CONSTRAINT_TYPE = 'CHECK'`);
  const ancien = checks.find(c => /en_attente/.test(c.clause) && /livree/.test(c.clause) && !/annulee/.test(c.clause));
  if (ancien) {
    try {
      await conn.query(`ALTER TABLE commandes DROP CONSTRAINT \`${ancien.nom}\``); // MySQL 8
    } catch {
      // MariaDB : contrainte posée sur la colonne → on redéfinit la colonne sans elle.
      await conn.query(`ALTER TABLE commandes MODIFY statut VARCHAR(15) NOT NULL DEFAULT 'confirmee'`);
    }
    await conn.query(`ALTER TABLE commandes ADD CONSTRAINT commandes_statut_chk CHECK (statut IN ('en_attente','confirmee','livree','payee','annulee'))`);
    journal('✓ Mise à jour : les commandes acceptent le statut « annulée ».');
  }

  // V3.3 — un paiement annulé reste visible avec son motif.
  const colonnes = [
    ['annule_le', 'DATETIME NULL'], ['annule_motif', 'VARCHAR(255) NULL'], ['annule_par', 'INT NULL'],
  ];
  for (const [col, type] of colonnes) {
    if (!(await colonneExiste(conn, 'paiements', col))) {
      await conn.query(`ALTER TABLE paiements ADD COLUMN ${col} ${type}`);
      journal(`✓ Mise à jour : paiements.${col} ajoutée.`);
    }
  }
}

module.exports = { appliquerMisesAJour };
