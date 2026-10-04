const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT p.*, f.numero AS facture_numero, f.client_id, f.client_nom, f.total_ttc AS facture_total
      FROM paiements p
      LEFT JOIN factures f ON f.id = p.facture_id
      ORDER BY p.date_paiement DESC, p.id DESC
    `);
    res.json(result.rows);
  });

  return router;
};
