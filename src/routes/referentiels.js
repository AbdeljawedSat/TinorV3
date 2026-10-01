const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/categories', async (req, res) => {
    const result = await pool.query('SELECT * FROM categories ORDER BY nom');
    res.json(result.rows);
  });

  // Création rapide d'une catégorie — depuis le formulaire produit.
  router.post('/categories', async (req, res) => {
    const { code, nom, type_category } = req.body;
    if (!code || !nom || !type_category) {
      return res.status(400).json({ error: 'code, nom et type_category sont requis.' });
    }
    const existing = await pool.query('SELECT id FROM categories WHERE code = $1', [code]);
    if (existing.rows.length) return res.status(409).json({ error: 'Une catégorie avec ce code existe déjà.' });
    const insertRes = await pool.query(
      `INSERT INTO categories (code, nom, type_category) VALUES ($1,$2,$3)`,
      [code, nom, type_category]
    );
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.get('/unites', async (req, res) => {
    const result = await pool.query('SELECT * FROM unites ORDER BY nom');
    res.json(result.rows);
  });

  router.get('/formats', async (req, res) => {
    const result = await pool.query('SELECT * FROM formats ORDER BY nom');
    res.json(result.rows);
  });

  // Création rapide d'un format (volume OU poids) — depuis le formulaire
  // produit, pour ne plus dépendre de SQL direct pour ajouter "80g", "200ml"...
  router.post('/formats', async (req, res) => {
    const { code, nom, volume, poids, unite_id } = req.body;
    if (!code || !nom || (!volume && !poids)) {
      return res.status(400).json({ error: 'code, nom et (volume ou poids) sont requis.' });
    }
    const existing = await pool.query('SELECT id FROM formats WHERE code = $1', [code]);
    if (existing.rows.length) return res.status(409).json({ error: 'Un format avec ce code existe déjà.' });
    const insertRes = await pool.query(
      `INSERT INTO formats (code, nom, volume, poids, unite_id) VALUES ($1,$2,$3,$4,$5)`,
      [code, nom, volume || null, poids || null, unite_id || null]
    );
    const result = await pool.query('SELECT * FROM formats WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  return router;
};
