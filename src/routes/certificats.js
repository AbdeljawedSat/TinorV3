const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT c.*,
        COALESCE(f.nb, 0) AS nb_fournisseurs,
        (c.date_expiration < CURDATE()) AS expire
      FROM certificats_bio c
      LEFT JOIN (SELECT certificat_id, COUNT(*) AS nb FROM fournisseurs GROUP BY certificat_id) f ON f.certificat_id = c.id
      ORDER BY c.date_expiration ASC
    `);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { numero, organisme, date_delivrance, date_expiration, portee, document_ref } = req.body;
    if (!numero || !organisme || !date_delivrance || !date_expiration) {
      return res.status(400).json({ error: 'numero, organisme, date_delivrance et date_expiration sont requis.' });
    }
    const insertRes = await pool.query(
      `INSERT INTO certificats_bio (numero, organisme, date_delivrance, date_expiration, portee, document_ref)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [numero, organisme, date_delivrance, date_expiration, portee || null, document_ref || null]
    );
    const result = await pool.query('SELECT * FROM certificats_bio WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const { numero, organisme, date_delivrance, date_expiration, portee, document_ref } = req.body;
    const updateRes = await pool.query(
      `UPDATE certificats_bio SET numero=$1, organisme=$2, date_delivrance=$3, date_expiration=$4, portee=$5, document_ref=$6 WHERE id=$7`,
      [numero, organisme, date_delivrance, date_expiration, portee || null, document_ref || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Certificat introuvable.' });
    const result = await pool.query('SELECT * FROM certificats_bio WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    const used = await pool.query('SELECT COUNT(*) AS n FROM fournisseurs WHERE certificat_id = $1', [req.params.id]);
    if (used.rows[0].n > 0) {
      return res.status(409).json({ error: 'Impossible de supprimer : ce certificat est rattaché à un ou plusieurs fournisseurs.' });
    }
    await pool.query('DELETE FROM certificats_bio WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
