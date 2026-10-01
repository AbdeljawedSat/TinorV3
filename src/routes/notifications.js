const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const { statut } = req.query;
    const clauses = [];
    const params = [];
    if (statut) { params.push(statut); clauses.push(`n.statut = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT n.*, c.numero AS commande_numero, p.nom AS produit_nom
       FROM notifications n
       LEFT JOIN commandes c ON c.id = n.commande_id
       LEFT JOIN produits p ON p.id = n.produit_id
       ${where}
       ORDER BY n.statut = 'EN_ATTENTE' DESC, n.created_at DESC`,
      params
    );
    res.json(result.rows);
  });

  // Retente le prélèvement FIFO pour la ligne de commande restée en attente
  // (lot_id IS NULL) liée à cette notification — à appeler une fois le
  // conditionnement fait pour ce format.
  router.post('/:id/resoudre', async (req, res, next) => {
    try {
      const notifRes = await pool.query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
      const notif = notifRes.rows[0];
      if (!notif) return res.status(404).json({ error: 'Notification introuvable.' });
      if (notif.statut === 'RESOLUE') return res.status(409).json({ error: 'Cette notification est déjà résolue.' });
      if (!notif.commande_id || !notif.produit_id) {
        return res.status(400).json({ error: 'Notification sans commande/produit associé — rien à résoudre automatiquement.' });
      }

      const ligneRes = await pool.query(
        `SELECT * FROM commande_lignes WHERE commande_id = $1 AND produit_id = $2 AND lot_id IS NULL LIMIT 1`,
        [notif.commande_id, notif.produit_id]
      );
      const ligne = ligneRes.rows[0];
      if (!ligne) {
        // Déjà résolue autrement (ex: commande annulée) — on referme proprement.
        await pool.query(`UPDATE notifications SET statut = 'RESOLUE', resolved_at = NOW() WHERE id = $1`, [req.params.id]);
        return res.json({ resolue: true, note: 'Aucune ligne en attente trouvée — notification refermée.' });
      }

      const qtePrelevee = Number(ligne.qty) + Number(ligne.free_units || 0);
      const lotRes = await pool.query(
        `SELECT id, numero_lot, quantite_actuelle FROM lots
         WHERE produit_id = $1 AND statut = 'LIBERE' AND quantite_actuelle >= $2
         ORDER BY created_at ASC LIMIT 1`,
        [notif.produit_id, qtePrelevee]
      );
      const lot = lotRes.rows[0];
      if (!lot) {
        return res.status(409).json({ error: `Toujours indisponible — besoin ${qtePrelevee}, aucun lot ne couvre encore cette quantité pour ce format.` });
      }

      await pool.query('UPDATE commande_lignes SET lot_id = $1 WHERE id = $2', [lot.id, ligne.id]);
      await pool.query('UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2', [qtePrelevee, lot.id]);
      const lotApres = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [lot.id]);
      if (Number(lotApres.rows[0].quantite_actuelle) <= 0) {
        await pool.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1`, [lot.id]);
        await pool.query(
          `INSERT INTO lot_statuts_historique (lot_id, statut, motif) VALUES ($1,'EPUISE','Stock épuisé après résolution de notification')`,
          [lot.id]
        );
      }
      await pool.query(
        `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id)
         VALUES ($1,'VENTE','SORTIE',$2,$3,$4,'notification',$5)`,
        [`MVT-RESOLU-${req.params.id}`, notif.produit_id, lot.id, qtePrelevee, req.params.id]
      );

      // Si plus aucune ligne en attente sur cette commande, elle sort du statut "en_attente".
      const resteEnAttente = await pool.query(
        `SELECT COUNT(*) AS n FROM commande_lignes WHERE commande_id = $1 AND lot_id IS NULL`,
        [notif.commande_id]
      );
      if (Number(resteEnAttente.rows[0].n) === 0) {
        await pool.query(`UPDATE commandes SET statut = 'confirmee' WHERE id = $1 AND statut = 'en_attente'`, [notif.commande_id]);
      }

      await pool.query(`UPDATE notifications SET statut = 'RESOLUE', resolved_at = NOW() WHERE id = $1`, [req.params.id]);
      const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
      res.json({ ...result.rows[0], lot_assigne: lot.numero_lot, commande_toujours_en_attente: Number(resteEnAttente.rows[0].n) > 1 });
    } catch (err) { next(err); }
  });

  return router;
};
