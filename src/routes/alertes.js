const express = require('express');

// Alertes de péremption des lots. Un lot périmé n'est déjà plus proposé aux
// sorties de stock (voir LOT_DISPONIBLE dans lotService) ; ces routes servent à
// le signaler et à régulariser son statut (LIBERE → EXPIRE) avec historique.
module.exports = function (pool) {
  const router = express.Router();

  const SELECT_LOTS = `
    SELECT l.id, l.numero_lot, l.statut, l.date_expiration, l.quantite_actuelle,
           DATEDIFF(l.date_expiration, CURDATE()) AS jours_restants,
           p.nom AS produit_nom, u.symbole AS unite_symbole
    FROM lots l
    LEFT JOIN produits p ON p.id = l.produit_id
    LEFT JOIN unites u ON u.id = p.unite_id`;

  router.get('/peremption', async (req, res) => {
    const jours = Math.max(1, Math.min(365, Number(req.query.jours) || 30));
    const perimes = await pool.query(
      `${SELECT_LOTS}
       WHERE l.statut IN ('LIBERE','QUARANTAINE') AND l.quantite_actuelle > 0
         AND l.date_expiration < CURDATE()
       ORDER BY l.date_expiration ASC`
    );
    const bientot = await pool.query(
      `${SELECT_LOTS}
       WHERE l.statut IN ('LIBERE','QUARANTAINE') AND l.quantite_actuelle > 0
         AND l.date_expiration >= CURDATE()
         AND l.date_expiration <= DATE_ADD(CURDATE(), INTERVAL $1 DAY)
       ORDER BY l.date_expiration ASC`,
      [jours]
    );
    res.json({ jours, perimes: perimes.rows, bientot: bientot.rows });
  });

  // Passe au statut EXPIRE tous les lots encore actifs dont la date est dépassée.
  router.post('/peremption/expirer', async (req, res) => {
    const { employe_id } = req.body || {};
    const lots = await pool.query(
      `SELECT id, numero_lot FROM lots
       WHERE statut IN ('LIBERE','QUARANTAINE') AND quantite_actuelle > 0
         AND date_expiration < CURDATE()`
    );
    for (const lot of lots.rows) {
      await pool.query(`UPDATE lots SET statut = 'EXPIRE' WHERE id = $1`, [lot.id]);
      await pool.query(
        `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'EXPIRE',$2,$3)`,
        [lot.id, "Date d'expiration dépassée", employe_id || null]
      );
    }
    res.json({ expires: lots.rows.length, lots: lots.rows.map(l => l.numero_lot) });
  });

  return router;
};
