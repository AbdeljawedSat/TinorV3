const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query('SELECT * FROM remises ORDER BY categorie, nom');
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { nom, type, pourcentage, achete, gratuit, protege, categorie } = req.body;
    if (!nom || !type) return res.status(400).json({ error: 'nom et type sont requis.' });
    const insertRes = await pool.query(
      `INSERT INTO remises (nom, type, pourcentage, achete, gratuit, protege, categorie)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nom, type, pourcentage || 0, achete || null, gratuit || null, !!protege, categorie || 'client']
    );
    const result = await pool.query('SELECT * FROM remises WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const remiseRes = await pool.query('SELECT protege FROM remises WHERE id = $1', [req.params.id]);
    if (!remiseRes.rows[0]) return res.status(404).json({ error: 'Remise introuvable.' });
    if (remiseRes.rows[0].protege) return res.status(403).json({ error: 'Cette remise est protégée et ne peut pas être modifiée.' });
    const { nom, type, pourcentage, achete, gratuit, categorie } = req.body;
    await pool.query(
      `UPDATE remises SET nom=$1, type=$2, pourcentage=$3, achete=$4, gratuit=$5, categorie=$6 WHERE id=$7`,
      [nom, type, pourcentage || 0, achete || null, gratuit || null, categorie || 'client', req.params.id]
    );
    const result = await pool.query('SELECT * FROM remises WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    const remiseRes = await pool.query('SELECT protege FROM remises WHERE id = $1', [req.params.id]);
    if (!remiseRes.rows[0]) return res.status(404).json({ error: 'Remise introuvable.' });
    if (remiseRes.rows[0].protege) return res.status(403).json({ error: 'Cette remise est protégée et ne peut pas être supprimée.' });
    await pool.query('DELETE FROM remises WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
