const express = require('express');

async function nextNumero(pool, seqName, prefix) {
  const upd = await pool.query(`UPDATE sequences SET last_value = last_value + 1 WHERE name = $1`, [seqName]);
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO sequences (name, last_value) VALUES ($1, 1)`, [seqName]);
  }
  const cur = await pool.query(`SELECT last_value FROM sequences WHERE name = $1`, [seqName]);
  return `${prefix}-${String(cur.rows[0].last_value).padStart(4, '0')}`;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT a.*, f.nom AS fournisseur_nom, e.nom AS employe_nom,
        COALESCE(l.nb, 0) AS nb_lignes
      FROM achats a
      LEFT JOIN fournisseurs f ON f.id = a.fournisseur_id
      LEFT JOIN employes e ON e.id = a.employe_id
      LEFT JOIN (SELECT achat_id, COUNT(*) AS nb FROM achat_lignes GROUP BY achat_id) l ON l.achat_id = a.id
      ORDER BY a.date_achat DESC, a.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const achatRes = await pool.query(
      `SELECT a.*, f.nom AS fournisseur_nom FROM achats a
       LEFT JOIN fournisseurs f ON f.id = a.fournisseur_id WHERE a.id = $1`,
      [req.params.id]
    );
    if (!achatRes.rows[0]) return res.status(404).json({ error: 'Achat introuvable.' });
    const lignesRes = await pool.query(
      `SELECT al.*, p.nom AS produit_nom, p.code AS produit_code
       FROM achat_lignes al LEFT JOIN produits p ON p.id = al.produit_id
       WHERE al.achat_id = $1`,
      [req.params.id]
    );
    res.json({ ...achatRes.rows[0], lignes: lignesRes.rows });
  });

  // Crée un achat avec ses lignes en une fois. total_ht/tva/total_ttc recalculés
  // côté serveur à partir des lignes plutôt que de faire confiance au client.
  router.post('/', async (req, res, next) => {
    try {
      const { fournisseur_id, date_achat, statut, notes, employe_id, lignes, tva_rate } = req.body;
      if (!fournisseur_id || !date_achat) {
        return res.status(400).json({ error: 'fournisseur_id et date_achat sont requis.' });
      }
      if (!Array.isArray(lignes) || !lignes.length) {
        return res.status(400).json({ error: 'Au moins une ligne est requise.' });
      }
      const numero = await nextNumero(pool, 'achat_seq', 'ACH');
      let totalHt = 0;
      for (const l of lignes) {
        if (!l.produit_id || !l.quantite) {
          return res.status(400).json({ error: 'Chaque ligne nécessite produit_id et quantite.' });
        }
        totalHt += Number(l.quantite) * Number(l.prix_unitaire || 0);
      }
      const rate = tva_rate ?? 19;
      const tvaAmount = totalHt * (rate / 100);
      const totalTtc = totalHt + tvaAmount;

      const achatRes = await pool.query(
        `INSERT INTO achats (numero, fournisseur_id, date_achat, statut, total_ht, tva, total_ttc, notes, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [numero, fournisseur_id, date_achat, statut || 'brouillon', totalHt, tvaAmount, totalTtc, notes || null, employe_id || null]
      );
      const achatId = achatRes.insertId;

      for (const l of lignes) {
        const ligneTotal = Number(l.quantite) * Number(l.prix_unitaire || 0);
        await pool.query(
          `INSERT INTO achat_lignes (achat_id, produit_id, quantite, prix_unitaire, total_ht, lot_fournisseur, date_expiration)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [achatId, l.produit_id, l.quantite, l.prix_unitaire || 0, ligneTotal, l.lot_fournisseur || null, l.date_expiration || null]
        );
      }
      const result = await pool.query('SELECT * FROM achats WHERE id = $1', [achatId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res) => {
    const { statut, notes } = req.body;
    const updateRes = await pool.query(
      `UPDATE achats SET statut = COALESCE($1, statut), notes = COALESCE($2, notes) WHERE id = $3`,
      [statut || null, notes ?? null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Achat introuvable.' });
    const result = await pool.query('SELECT * FROM achats WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    const achatRes = await pool.query('SELECT statut FROM achats WHERE id = $1', [req.params.id]);
    if (!achatRes.rows[0]) return res.status(404).json({ error: 'Achat introuvable.' });
    if (achatRes.rows[0].statut !== 'brouillon') {
      return res.status(409).json({ error: 'Seul un achat en brouillon peut être supprimé — annulez-le sinon.' });
    }
    await pool.query('DELETE FROM achats WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};

module.exports.nextNumero = nextNumero;
