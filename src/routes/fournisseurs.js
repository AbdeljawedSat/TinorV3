const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT f.*, c.numero AS certificat_numero, c.date_expiration AS certificat_expiration
      FROM fournisseurs f LEFT JOIN certificats_bio c ON c.id = f.certificat_id
      ORDER BY f.nom
    `);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { nom, type, matricule_fiscal, localisation, statut_bio, certificat_id, telephone, email, notes } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom est requis.' });
    const insertRes = await pool.query(
      `INSERT INTO fournisseurs (nom, type, matricule_fiscal, localisation, statut_bio, certificat_id, telephone, email, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [nom, type || 'fournisseur_externe', matricule_fiscal || null, localisation || null, statut_bio || 'conversion',
       certificat_id || null, telephone || null, email || null, notes || null]
    );
    const result = await pool.query('SELECT * FROM fournisseurs WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const { nom, type, matricule_fiscal, localisation, statut_bio, certificat_id, telephone, email, notes } = req.body;
    const updateRes = await pool.query(
      `UPDATE fournisseurs SET nom=$1, type=$2, matricule_fiscal=$3, localisation=$4, statut_bio=$5, certificat_id=$6,
        telephone=$7, email=$8, notes=$9 WHERE id=$10`,
      [nom, type, matricule_fiscal || null, localisation || null, statut_bio, certificat_id || null, telephone || null,
       email || null, notes || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Fournisseur introuvable.' });
    const result = await pool.query('SELECT * FROM fournisseurs WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM fournisseurs WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
