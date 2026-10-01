const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  // Lecture seule : les mouvements sont générés automatiquement par les
  // autres modules (réceptions, presse, filtration, conditionnement,
  // commandes, production) — jamais saisis directement ici.
  router.get('/', async (req, res) => {
    const { produit_id, lot_id, type_mouvement, sens, date_debut, date_fin } = req.query;
    const clauses = [];
    const params = [];
    if (produit_id) { params.push(produit_id); clauses.push(`sm.produit_id = $${params.length}`); }
    if (lot_id) { params.push(lot_id); clauses.push(`sm.lot_id = $${params.length}`); }
    if (type_mouvement) { params.push(type_mouvement); clauses.push(`sm.type_mouvement = $${params.length}`); }
    if (sens) { params.push(sens); clauses.push(`sm.sens = $${params.length}`); }
    if (date_debut) { params.push(date_debut); clauses.push(`sm.date_mouvement >= $${params.length}`); }
    if (date_fin) { params.push(date_fin); clauses.push(`sm.date_mouvement <= $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT sm.*, p.nom AS produit_nom, l.numero_lot, lo.nom AS local_nom, e.nom AS employe_nom
       FROM stock_mouvements sm
       LEFT JOIN produits p ON p.id = sm.produit_id
       LEFT JOIN lots l ON l.id = sm.lot_id
       LEFT JOIN locaux lo ON lo.id = sm.local_id
       LEFT JOIN employes e ON e.id = sm.employe_id
       ${where}
       ORDER BY sm.date_mouvement DESC, sm.id DESC
       LIMIT 500`,
      params
    );
    res.json(result.rows);
  });

  // Résumé du stock actuel par produit et par local — calculé depuis les
  // lots réels, jamais depuis un compteur stocké à part.
  router.get('/resume', async (req, res) => {
    const result = await pool.query(`
      SELECT p.id AS produit_id, p.code AS produit_code, p.nom AS produit_nom, u.symbole AS unite_symbole,
        l.local_id, lo.nom AS local_nom, l.statut,
        SUM(l.quantite_actuelle) AS quantite
      FROM lots l
      JOIN produits p ON p.id = l.produit_id
      LEFT JOIN unites u ON u.id = p.unite_id
      LEFT JOIN locaux lo ON lo.id = l.local_id
      WHERE l.quantite_actuelle > 0
      GROUP BY p.id, p.code, p.nom, u.symbole, l.local_id, lo.nom, l.statut
      ORDER BY p.nom, lo.nom
    `);
    res.json(result.rows);
  });

  return router;
};
