const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT r.*, p.nom AS produit_nom, p.code AS produit_code,
        COALESCE(i.nb, 0) AS nb_ingredients
      FROM recettes r
      LEFT JOIN produits p ON p.id = r.produit_id
      LEFT JOIN (SELECT recette_id, COUNT(*) AS nb FROM recette_ingredients GROUP BY recette_id) i ON i.recette_id = r.id
      ORDER BY p.nom
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const recRes = await pool.query(
      `SELECT r.*, p.nom AS produit_nom FROM recettes r LEFT JOIN produits p ON p.id = r.produit_id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!recRes.rows[0]) return res.status(404).json({ error: 'Recette introuvable.' });
    const ingRes = await pool.query(
      `SELECT ri.*, p.nom AS ingredient_nom, p.code AS ingredient_code, u.symbole AS unite_symbole
       FROM recette_ingredients ri
       LEFT JOIN produits p ON p.id = ri.ingredient_id
       LEFT JOIN unites u ON u.id = p.unite_id
       WHERE ri.recette_id = $1`,
      [req.params.id]
    );
    res.json({ ...recRes.rows[0], ingredients: ingRes.rows });
  });

  router.post('/', async (req, res, next) => {
    try {
      const { produit_id, notes, ingredients } = req.body;
      if (!produit_id) return res.status(400).json({ error: 'produit_id est requis.' });
      if (!Array.isArray(ingredients) || !ingredients.length) {
        return res.status(400).json({ error: 'Au moins un ingrédient est requis.' });
      }
      const existing = await pool.query('SELECT id FROM recettes WHERE produit_id = $1', [produit_id]);
      if (existing.rows.length) return res.status(409).json({ error: 'Ce produit a déjà une recette — modifiez-la plutôt.' });

      const recRes = await pool.query('INSERT INTO recettes (produit_id, notes) VALUES ($1,$2)', [produit_id, notes || null]);
      const recetteId = recRes.insertId;
      for (const ing of ingredients) {
        if (!ing.ingredient_id || !ing.quantite_par_unite) continue;
        await pool.query(
          `INSERT INTO recette_ingredients (recette_id, ingredient_id, quantite_par_unite) VALUES ($1,$2,$3)`,
          [recetteId, ing.ingredient_id, ing.quantite_par_unite]
        );
      }
      const result = await pool.query('SELECT * FROM recettes WHERE id = $1', [recetteId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // Remplace entièrement la liste d'ingrédients (pas d'impact stock — une
  // recette est une définition, seul un ordre de production consomme du stock).
  router.put('/:id', async (req, res, next) => {
    try {
      const { notes, ingredients } = req.body;
      const recRes = await pool.query('SELECT id FROM recettes WHERE id = $1', [req.params.id]);
      if (!recRes.rows[0]) return res.status(404).json({ error: 'Recette introuvable.' });

      await pool.query('UPDATE recettes SET notes = $1 WHERE id = $2', [notes || null, req.params.id]);
      if (Array.isArray(ingredients)) {
        await pool.query('DELETE FROM recette_ingredients WHERE recette_id = $1', [req.params.id]);
        for (const ing of ingredients) {
          if (!ing.ingredient_id || !ing.quantite_par_unite) continue;
          await pool.query(
            `INSERT INTO recette_ingredients (recette_id, ingredient_id, quantite_par_unite) VALUES ($1,$2,$3)`,
            [req.params.id, ing.ingredient_id, ing.quantite_par_unite]
          );
        }
      }
      const result = await pool.query('SELECT * FROM recettes WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res) => {
    const used = await pool.query('SELECT COUNT(*) AS n FROM ordres_production WHERE recette_id = $1', [req.params.id]);
    if (used.rows[0].n > 0) {
      return res.status(409).json({ error: 'Impossible de supprimer : des ordres de production utilisent cette recette.' });
    }
    await pool.query('DELETE FROM recettes WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
