const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT cl.*, r.nom AS remise_nom,
        COALESCE(o.nb, 0) AS commandes_count, COALESCE(o.total, 0) AS total_achete
      FROM clients cl
      LEFT JOIN remises r ON r.id = cl.remise_id
      LEFT JOIN (
        SELECT client_id, COUNT(*) AS nb, SUM(total) AS total FROM commandes GROUP BY client_id
      ) o ON o.client_id = cl.id
      ORDER BY cl.nom
    `);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { nom, tel, ville, matricule_fiscal, type, remise_id, notes } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom est requis.' });
    const insertRes = await pool.query(
      `INSERT INTO clients (nom, tel, ville, matricule_fiscal, type, remise_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nom, tel || null, ville || null, matricule_fiscal || null, type || 'particulier', remise_id || null, notes || null]
    );
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const { nom, tel, ville, matricule_fiscal, type, remise_id, notes } = req.body;
    const updateRes = await pool.query(
      `UPDATE clients SET nom=$1, tel=$2, ville=$3, matricule_fiscal=$4, type=$5, remise_id=$6, notes=$7 WHERE id=$8`,
      [nom, tel || null, ville || null, matricule_fiscal || null, type || 'particulier', remise_id || null, notes || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Client introuvable.' });
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
