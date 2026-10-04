const express = require('express');

// Avoirs émis (lecture). La création se fait depuis la facture :
// POST /api/factures/:id/avoirs.
module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT a.*, f.numero AS facture_numero, f.commande_id
      FROM avoirs a JOIN factures f ON f.id = a.facture_id
      ORDER BY a.date_emission DESC, a.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const a = await pool.query(
      `SELECT a.*, f.numero AS facture_numero, f.date_emission AS facture_date, f.tva_rate
       FROM avoirs a JOIN factures f ON f.id = a.facture_id WHERE a.id = $1`, [req.params.id]);
    if (!a.rows[0]) return res.status(404).json({ error: 'Avoir introuvable.' });
    const lignes = await pool.query('SELECT * FROM avoir_lignes WHERE avoir_id = $1 ORDER BY id', [req.params.id]);
    res.json({ ...a.rows[0], lignes: lignes.rows });
  });

  return router;
};
