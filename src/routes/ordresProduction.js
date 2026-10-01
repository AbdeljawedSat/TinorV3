const express = require('express');
const { nextNumero, createLot, consumeLot, recordEntree } = require('../services/lotService');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT op.*, p.nom AS produit_nom, l.numero_lot, e.nom AS employe_nom
      FROM ordres_production op
      LEFT JOIN recettes r ON r.id = op.recette_id
      LEFT JOIN produits p ON p.id = r.produit_id
      LEFT JOIN lots l ON l.id = op.lot_id
      LEFT JOIN employes e ON e.id = op.employe_id
      ORDER BY op.date DESC, op.id DESC
    `);
    res.json(result.rows);
  });

  // Lance une production : pour chaque ingrédient de la recette, calcule le
  // besoin (quantite_par_unite × qty_produite), sélectionne un lot en FIFO
  // (pas de fractionnement multi-lots, même limite assumée que pour les
  // commandes), le consomme, puis crée le lot de produit fini.
  router.post('/', async (req, res, next) => {
    try {
      const { recette_id, date, qty_produite, notes, employe_id } = req.body;
      if (!recette_id || !date || !qty_produite) {
        return res.status(400).json({ error: 'recette_id, date et qty_produite sont requis.' });
      }
      const recRes = await pool.query('SELECT * FROM recettes WHERE id = $1', [recette_id]);
      const recette = recRes.rows[0];
      if (!recette) return res.status(400).json({ error: 'Recette introuvable.' });

      const ingRes = await pool.query('SELECT * FROM recette_ingredients WHERE recette_id = $1', [recette_id]);
      if (!ingRes.rows.length) return res.status(400).json({ error: 'Cette recette n\'a aucun ingrédient défini.' });

      // Vérification de disponibilité AVANT toute consommation (tout ou rien).
      const besoins = [];
      for (const ing of ingRes.rows) {
        const besoin = Number(ing.quantite_par_unite) * Number(qty_produite);
        const lotRes = await pool.query(
          `SELECT id, numero_lot, quantite_actuelle FROM lots
           WHERE produit_id = $1 AND statut = 'LIBERE' AND quantite_actuelle >= $2
           ORDER BY created_at ASC LIMIT 1`,
          [ing.ingredient_id, besoin]
        );
        const lot = lotRes.rows[0];
        if (!lot) {
          const prodRes = await pool.query('SELECT nom FROM produits WHERE id = $1', [ing.ingredient_id]);
          const stockRes = await pool.query(
            `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND statut = 'LIBERE'`,
            [ing.ingredient_id]
          );
          return res.status(409).json({
            error: `Stock insuffisant pour "${prodRes.rows[0]?.nom || ing.ingredient_id}" — besoin ${besoin}, disponible ${stockRes.rows[0].total}.`,
          });
        }
        besoins.push({ ingredient_id: ing.ingredient_id, lot_id: lot.id, quantite: besoin });
      }

      const { lotId, numeroLot } = await createLot(pool, {
        produit_id: recette.produit_id, origine: 'PRODUCTION_RECETTE', quantite: qty_produite,
        employe_id, motif: 'Création via ordre de production',
      });

      const ordreRes = await pool.query(
        `INSERT INTO ordres_production (recette_id, lot_id, date, qty_produite, notes, employe_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [recette_id, lotId, date, qty_produite, notes || null, employe_id || null]
      );
      const ordreId = ordreRes.insertId;

      const numMvt = await nextNumero(pool, 'mouvement_seq', 'MVT');
      const groupId = require('crypto').randomUUID();
      for (const b of besoins) {
        await consumeLot(pool, {
          lotSourceId: b.lot_id, lotFilsId: lotId, quantite: b.quantite,
          typeMouvement: 'CONSOMMATION', employeId: employe_id, numeroMouvement: `${numMvt}-OUT-${b.ingredient_id}`,
          groupId, sourceType: 'ordre_production', sourceId: ordreId,
        });
      }
      await recordEntree(pool, {
        produitId: recette.produit_id, lotId, quantite: qty_produite, typeMouvement: 'PRODUCTION',
        employeId: employe_id, numeroMouvement: `${numMvt}-IN`, groupId, sourceType: 'ordre_production', sourceId: ordreId,
      });

      const result = await pool.query('SELECT * FROM ordres_production WHERE id = $1', [ordreId]);
      res.status(201).json({ ...result.rows[0], numero_lot: numeroLot });
    } catch (err) { next(err); }
  });

  return router;
};
