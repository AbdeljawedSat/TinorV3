const { enTransaction } = require('../db/transaction');
const express = require('express');
const { nextNumero, createLot, consumeLot, recordEntree } = require('../services/lotService');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT lp.*, p.nom AS produit_nom, e.nom AS employe_nom,
        l.quantite_actuelle, l.statut AS lot_statut, l.champs_perso
      FROM lots_presse lp
      LEFT JOIN produits p ON p.id = lp.produit_id
      LEFT JOIN employes e ON e.id = lp.employe_id
      LEFT JOIN lots l ON l.id = lp.lot_id
      ORDER BY lp.date DESC, lp.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const result = await pool.query(
      `SELECT lp.*, p.nom AS produit_nom FROM lots_presse lp
       LEFT JOIN produits p ON p.id = lp.produit_id WHERE lp.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lot de presse introuvable.' });
    res.json(result.rows[0]);
  });

  // Presse un lot de matière première (huile vrac) en un nouveau lot d'huile
  // pressée — consomme lot_source_id (généralement un lot RECEPTION_MP), crée
  // le lot générique résultant, et trace le rendement réel.
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const {
        date, produit_id, reception_id, lot_source_id,
        quantite_matiere_utilisee, quantite_tourteau, quantite_produite,
        notes, employe_id, champs_perso,
      } = req.body;
      if (!date || !produit_id || !quantite_produite) {
        return res.status(400).json({ error: 'date, produit_id et quantite_produite sont requis.' });
      }
      if (lot_source_id && !quantite_matiere_utilisee) {
        return res.status(400).json({ error: 'quantite_matiere_utilisee est requis quand lot_source_id est fourni.' });
      }
      if (lot_source_id) {
        const srcRes = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [lot_source_id]);
        if (!srcRes.rows[0]) return res.status(400).json({ error: 'Lot source introuvable.' });
        if (Number(srcRes.rows[0].quantite_actuelle) < Number(quantite_matiere_utilisee)) {
          return res.status(409).json({ error: `Stock insuffisant sur le lot source (disponible ${srcRes.rows[0].quantite_actuelle}, demandé ${quantite_matiere_utilisee}).` });
        }
      }

      const { lotId, numeroLot } = await createLot(pool, {
        produit_id, origine: 'PRESSE', quantite: quantite_produite, employe_id, motif: 'Création via pressage',
        extra: { champs_perso },
      });

      const rendement = quantite_matiere_utilisee ? quantite_produite / quantite_matiere_utilisee : null;
      await pool.query(
        `INSERT INTO lots_presse
          (date, produit_id, reception_id, lot_id, quantite_matiere_utilisee, quantite_tourteau,
           quantite_produite, rendement_reel, numero_lot, notes, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [date, produit_id, reception_id || null, lotId, quantite_matiere_utilisee || null,
         quantite_tourteau || null, quantite_produite, rendement, numeroLot, notes || null, employe_id || null]
      );

      const numMvt = await nextNumero(pool, 'mouvement_seq', 'MVT');
      const groupId = require('crypto').randomUUID();
      if (lot_source_id) {
        await consumeLot(pool, {
          lotSourceId: lot_source_id, lotFilsId: lotId, quantite: quantite_matiere_utilisee,
          typeMouvement: 'CONSOMMATION', employeId: employe_id, numeroMouvement: `${numMvt}-OUT`,
          groupId, sourceType: 'lots_presse', sourceId: lotId,
        });
      }
      await recordEntree(pool, {
        produitId: produit_id, lotId, quantite: quantite_produite, typeMouvement: 'PRODUCTION',
        employeId: employe_id, numeroMouvement: `${numMvt}-IN`, groupId, sourceType: 'lots_presse', sourceId: lotId,
      });

      const result = await pool.query('SELECT * FROM lots_presse WHERE lot_id = $1', [lotId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }));

  // Modification limitée aux champs sans impact sur le stock déjà mouvementé
  // (date, notes, employé) — les quantités et le lot source restent figés une
  // fois la production enregistrée, pour éviter toute incohérence de stock.
  router.put('/:id', async (req, res) => {
    const { date, notes, employe_id } = req.body;
    const updateRes = await pool.query(
      `UPDATE lots_presse SET date = COALESCE($1, date), notes = $2, employe_id = $3 WHERE id = $4`,
      [date || null, notes || null, employe_id || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Lot de presse introuvable.' });
    const result = await pool.query('SELECT * FROM lots_presse WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  return router;
};
