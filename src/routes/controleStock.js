const express = require('express');
const { enTransaction } = require('../db/transaction');
const { nextNumero } = require('../services/lotService');

// Contrôle de cohérence du stock : pour chaque lot, la quantité actuelle doit
// être égale à la somme de ses mouvements (entrées − sorties), et jamais négative.
// Un écart signale une opération enregistrée à moitié (cas corrigés depuis :
// commande avec un même produit sur deux lignes, refacturation après annulation,
// opérations simultanées, inventaire) ou une modification directe en base.
module.exports = function (pool) {
  const router = express.Router();

  const REQUETE_ECARTS = `
    SELECT l.id, l.numero_lot, l.statut, l.produit_id, p.nom AS produit_nom, u.symbole AS unite_symbole,
           l.quantite_actuelle,
           COALESCE(SUM(CASE WHEN m.sens = 'ENTREE' THEN m.quantite WHEN m.sens = 'SORTIE' THEN -m.quantite ELSE 0 END), 0) AS selon_mouvements
    FROM lots l
    LEFT JOIN stock_mouvements m ON m.lot_id = l.id
    LEFT JOIN produits p ON p.id = l.produit_id
    LEFT JOIN unites u ON u.id = p.unite_id
    GROUP BY l.id
    HAVING ROUND(l.quantite_actuelle - selon_mouvements, 3) <> 0 OR l.quantite_actuelle < 0
    ORDER BY l.id`;

  function formater(rows) {
    return rows.map(r => ({
      ...r,
      quantite_actuelle: Number(r.quantite_actuelle),
      selon_mouvements: Number(r.selon_mouvements),
      ecart: Math.round((Number(r.quantite_actuelle) - Number(r.selon_mouvements)) * 1000) / 1000,
      negatif: Number(r.quantite_actuelle) < 0,
    }));
  }

  router.get('/', async (req, res) => {
    const lots = formater((await pool.query(REQUETE_ECARTS)).rows);
    res.json({ ok: lots.length === 0, nb_lots_en_ecart: lots.length, lots });
  });

  // Régularisation : la quantité du lot est conservée (c'est elle que voient les
  // ventes et la production) et un mouvement AJUSTEMENT comble l'écart, pour que
  // l'historique explique la quantité. Un lot négatif est ramené à zéro.
  // La quantité physique réelle ne peut être confirmée que par un inventaire.
  router.post('/regulariser', enTransaction(pool, async (req, res, next, pool) => {
    const { employe_id } = req.body || {};
    const lots = formater((await pool.query(REQUETE_ECARTS)).rows);
    const regularises = [];
    for (const l of lots) {
      if (l.negatif) {
        await pool.query('UPDATE lots SET quantite_actuelle = 0 WHERE id = $1', [l.id]);
        l.quantite_actuelle = 0;
      }
      const ecart = Math.round((l.quantite_actuelle - l.selon_mouvements) * 1000) / 1000;
      if (ecart) {
        await pool.query(
          `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note, employe_id)
           VALUES ($1,'AJUSTEMENT',$2,$3,$4,$5,'controle_stock',NULL,$6,$7)`,
          [await nextNumero(pool, 'mouvement_seq', 'MVT'), ecart > 0 ? 'ENTREE' : 'SORTIE', l.produit_id, l.id, Math.abs(ecart),
           l.negatif ? 'Régularisation : stock négatif ramené à zéro' : 'Régularisation : mouvement manquant (contrôle de cohérence)',
           employe_id || null]
        );
      }
      regularises.push({ numero_lot: l.numero_lot, ecart: l.ecart, negatif: l.negatif });
    }
    res.json({ regularises: regularises.length, lots: regularises });
  }));

  return router;
};
