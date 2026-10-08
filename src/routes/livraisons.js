const express = require('express');
const { enTransaction } = require('../db/transaction');
const { requireRole } = require('../middleware/auth');
const { creerLivraison, majStatutLivraison } = require('../services/ventes');

// Bons de livraison (BL-…) : sortie physique de la marchandise commandée, en une
// ou plusieurs fois. Document de transport, sans prix, avec les lots livrés.
module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const r = await pool.query(`
      SELECT b.*, c.numero AS commande_numero, cl.nom AS client_nom, e.nom AS employe_nom,
        (SELECT COUNT(*) FROM bl_lignes WHERE bl_id = b.id) AS nb_lignes,
        (SELECT SUM(qty) FROM bl_lignes WHERE bl_id = b.id) AS qte,
        (SELECT f.numero FROM factures f WHERE f.commande_id = b.commande_id AND f.statut = 'emise' LIMIT 1) AS facture_numero
      FROM bons_livraison b
      JOIN commandes c ON c.id = b.commande_id
      LEFT JOIN clients cl ON cl.id = b.client_id
      LEFT JOIN employes e ON e.id = b.employe_id
      ORDER BY b.date_livraison DESC, b.id DESC`);
    res.json(r.rows);
  });

  router.get('/:id', async (req, res) => {
    const b = (await pool.query(
      `SELECT b.*, c.numero AS commande_numero, c.date_iso AS commande_date, cl.nom AS client_nom, cl.ville AS client_ville, cl.tel AS client_tel, cl.matricule_fiscal AS client_mf
       FROM bons_livraison b JOIN commandes c ON c.id = b.commande_id LEFT JOIN clients cl ON cl.id = b.client_id WHERE b.id = $1`, [req.params.id])).rows[0];
    if (!b) return res.status(404).json({ error: 'Bon de livraison introuvable.' });
    const lignes = (await pool.query(
      `SELECT bl.*, p.nom AS produit_nom, u.symbole AS unite, l.numero_lot, cl.qty AS qty_commandee, cl.qty_livree, cl.free_units
       FROM bl_lignes bl JOIN commande_lignes cl ON cl.id = bl.commande_ligne_id
       LEFT JOIN produits p ON p.id = bl.produit_id LEFT JOIN unites u ON u.id = p.unite_id LEFT JOIN lots l ON l.id = bl.lot_id
       WHERE bl.bl_id = $1 ORDER BY bl.id`, [req.params.id])).rows;
    res.json({ ...b, lignes });
  });

  // { commande_id, date_livraison?, notes?, lignes?: [{ commande_ligne_id, qty }] } — sans lignes : tout le reste.
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { commande_id, date_livraison, notes, lignes, employe_id } = req.body || {};
      if (!commande_id) return res.status(400).json({ error: 'commande_id est requis.' });
      if ((await pool.query(`SELECT id FROM factures WHERE commande_id = $1 AND statut = 'emise'`, [commande_id])).rows.length) {
        return res.status(409).json({ error: 'Cette commande est déjà facturée : elle est entièrement livrée.' });
      }
      res.status(201).json(await creerLivraison(pool, { commande_id, date_livraison, notes, lignes, employe_id }));
    } catch (err) { next(err); }
  }));

  // Annulation (erreur de saisie, livraison refusée) : les quantités redeviennent « à livrer ».
  router.post('/:id/annuler', requireRole('gerant'), enTransaction(pool, async (req, res, next, pool) => {
    try {
      const motif = String(req.body?.motif || '').trim();
      if (!motif) return res.status(400).json({ error: 'Le motif est requis.' });
      const b = (await pool.query('SELECT * FROM bons_livraison WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!b) return res.status(404).json({ error: 'Bon de livraison introuvable.' });
      if (b.statut === 'annule') return res.status(409).json({ error: `${b.numero} est déjà annulé.` });
      const fac = (await pool.query(`SELECT numero FROM factures WHERE commande_id = $1 AND statut = 'emise'`, [b.commande_id])).rows[0];
      if (fac) return res.status(409).json({ error: `La commande est facturée (${fac.numero}) : le bon de livraison ne s'annule plus (un retour se fait par avoir).` });
      for (const l of (await pool.query('SELECT * FROM bl_lignes WHERE bl_id = $1', [b.id])).rows) {
        await pool.query('UPDATE commande_lignes SET qty_livree = GREATEST(qty_livree - $1, 0) WHERE id = $2', [l.qty, l.commande_ligne_id]);
      }
      await pool.query(`UPDATE bons_livraison SET statut = 'annule', annule_motif = $1 WHERE id = $2`, [motif.slice(0, 255), b.id]);
      await majStatutLivraison(pool, b.commande_id);
      res.json((await pool.query('SELECT * FROM bons_livraison WHERE id = $1', [b.id])).rows[0]);
    } catch (err) { next(err); }
  }));

  return router;
};
