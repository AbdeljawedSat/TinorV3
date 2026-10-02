const { enTransaction } = require('../db/transaction');
const express = require('express');
const { nextNumero, createLot, consumeLot, recordEntree } = require('../services/lotService');
const { cleGraine, cleHuileVrac, estGraine, estHuileVrac } = require('../services/graines');

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
      // Bilan matière : la matière utilisée ne peut jamais être inférieure à
      // huile + tourteau (ni donc à l'un des deux) — le reste correspond aux pertes.
      const qMatiere = quantite_matiere_utilisee == null || quantite_matiere_utilisee === '' ? null : Number(quantite_matiere_utilisee);
      const qHuile = Number(quantite_produite);
      const qTourteau = quantite_tourteau == null || quantite_tourteau === '' ? 0 : Number(quantite_tourteau);
      if (!Number.isFinite(qHuile) || qHuile <= 0) return res.status(400).json({ error: "La quantité d'huile obtenue doit être supérieure à 0." });
      if (!Number.isFinite(qTourteau) || qTourteau < 0) return res.status(400).json({ error: 'La quantité de tourteau ne peut pas être négative.' });
      if (qMatiere != null) {
        if (!Number.isFinite(qMatiere) || qMatiere <= 0) return res.status(400).json({ error: 'La quantité de matière utilisée doit être supérieure à 0.' });
        const somme = Math.round((qHuile + qTourteau) * 1000) / 1000;
        if (somme > Math.round(qMatiere * 1000) / 1000) {
          return res.status(400).json({ error: `Bilan impossible : huile (${qHuile}) + tourteau (${qTourteau}) = ${somme}, supérieur à la matière utilisée (${qMatiere}). La matière utilisée doit être au moins égale à la somme.` });
        }
      }
      // Règle du pressage : graines consommées → huile en vrac de la même graine.
      const produitObtenu = (await pool.query('SELECT nom, type_article, format_id FROM produits WHERE id = $1', [produit_id])).rows[0];
      if (!produitObtenu) return res.status(400).json({ error: 'Produit obtenu introuvable.' });
      if (!estHuileVrac(produitObtenu)) {
        return res.status(400).json({ error: `Le produit obtenu d'un pressage doit être une huile en vrac (ex. « Huile de Sésame — Vrac ») : « ${produitObtenu.nom} » ne l'est pas.` });
      }
      if (lot_source_id) {
        const srcRes = await pool.query(
          `SELECT l.quantite_actuelle, l.numero_lot, p.nom, p.type_article, p.format_id
           FROM lots l JOIN produits p ON p.id = l.produit_id WHERE l.id = $1`, [lot_source_id]);
        if (!srcRes.rows[0]) return res.status(400).json({ error: 'Lot source introuvable.' });
        const source = srcRes.rows[0];
        if (!estGraine(source)) {
          return res.status(400).json({ error: `La matière consommée d'un pressage doit être un lot de graines (ex. « Graines de Sésame ») : le lot ${source.numero_lot} est « ${source.nom} ».` });
        }
        if (cleGraine(source.nom) !== cleHuileVrac(produitObtenu.nom)) {
          return res.status(400).json({ error: `« ${produitObtenu.nom} » ne correspond pas aux graines du lot ${source.numero_lot} (« ${source.nom} ») : choisissez l'huile en vrac de la même graine.` });
        }
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
