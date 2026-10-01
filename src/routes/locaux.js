const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT l.*, COALESCE(z.nb, 0) AS nb_zones
      FROM locaux l
      LEFT JOIN (SELECT local_id, COUNT(*) AS nb FROM local_zones GROUP BY local_id) z ON z.local_id = l.id
      ORDER BY l.nom
    `);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { code, nom, type_local, adresse } = req.body;
    if (!code || !nom || !type_local) return res.status(400).json({ error: 'code, nom et type_local sont requis.' });
    const insertRes = await pool.query(
      `INSERT INTO locaux (code, nom, type_local, adresse) VALUES ($1,$2,$3,$4)`,
      [code, nom, type_local, adresse || null]
    );
    const result = await pool.query('SELECT * FROM locaux WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const { code, nom, type_local, adresse } = req.body;
    const updateRes = await pool.query(
      `UPDATE locaux SET code=$1, nom=$2, type_local=$3, adresse=$4 WHERE id=$5`,
      [code, nom, type_local, adresse || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Local introuvable.' });
    const result = await pool.query('SELECT * FROM locaux WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.get('/:id/zones', async (req, res) => {
    const result = await pool.query('SELECT * FROM local_zones WHERE local_id = $1 ORDER BY nom', [req.params.id]);
    res.json(result.rows);
  });

  router.post('/:id/zones', async (req, res) => {
    const { code, nom, description } = req.body;
    if (!code || !nom) return res.status(400).json({ error: 'code et nom sont requis.' });
    const insertRes = await pool.query(
      `INSERT INTO local_zones (local_id, code, nom, description) VALUES ($1,$2,$3,$4)`,
      [req.params.id, code, nom, description || null]
    );
    const result = await pool.query('SELECT * FROM local_zones WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  return router;
};
