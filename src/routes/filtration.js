const { enTransaction } = require('../db/transaction');
const express = require('express');
const { positif, positifOuZero, arrondi } = require('../services/regles');
const { estHuileFiltree, estHuileMelangeFiltree, cleHuileVrac } = require('../services/graines');
const { nextNumero, createLot, consumeLot, recordEntree } = require('../services/lotService');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT lf.*, p.nom AS produit_nom, e.nom AS employe_nom,
        l.quantite_actuelle, l.statut AS lot_statut, l.champs_perso
      FROM lots_filtration lf
      LEFT JOIN produits p ON p.id = lf.produit_id
      LEFT JOIN employes e ON e.id = lf.employe_id
      LEFT JOIN lots l ON l.id = lf.lot_id
      ORDER BY lf.date DESC, lf.id DESC
    `);
    // Composition (huile par huile) d'après les lots de presse utilisés : utile surtout pour un mélange.
    const compo = await pool.query(`
      SELECT lfs.lot_filtration_id, p.nom, SUM(lfs.quantite_utilisee) AS quantite
      FROM lots_filtration_sources lfs
      JOIN lots_presse lp ON lp.id = lfs.lot_presse_id
      JOIN produits p ON p.id = lp.produit_id
      GROUP BY lfs.lot_filtration_id, p.nom`);
    const parFiltration = new Map();
    for (const c of compo.rows) {
      if (!parFiltration.has(c.lot_filtration_id)) parFiltration.set(c.lot_filtration_id, []);
      parFiltration.get(c.lot_filtration_id).push({ huile: c.nom, quantite: Number(c.quantite) });
    }
    res.json(result.rows.map(f => {
      const composition = parFiltration.get(f.id) || [];
      const total = composition.reduce((t, c) => t + c.quantite, 0);
      composition.forEach(c => { c.pourcentage = total ? Math.round((c.quantite / total) * 1000) / 10 : null; });
      return { ...f, composition };
    }));
  });

  router.get('/:id', async (req, res) => {
    const filtRes = await pool.query('SELECT * FROM lots_filtration WHERE id = $1', [req.params.id]);
    if (!filtRes.rows[0]) return res.status(404).json({ error: 'Lot de filtration introuvable.' });
    const sourcesRes = await pool.query(
      `SELECT lfs.*, lp.numero_lot AS lot_presse_numero
       FROM lots_filtration_sources lfs LEFT JOIN lots_presse lp ON lp.id = lfs.lot_presse_id
       WHERE lfs.lot_filtration_id = $1`,
      [req.params.id]
    );
    res.json({ ...filtRes.rows[0], sources: sourcesRes.rows });
  });

  // Filtre un ou plusieurs lots de presse en un nouveau lot d'huile filtrée.
  // sources : [{ lot_presse_id, quantite_utilisee }] — peut combiner plusieurs
  // pressages (ex: fusion de deux petits lots avant filtration).
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { date, produit_id, filtre_utilise, quantite_dechet, quantite_produite, notes, employe_id, sources, champs_perso, melange } = req.body;
      if (!date || !produit_id || !quantite_produite) {
        return res.status(400).json({ error: 'date, produit_id et quantite_produite sont requis.' });
      }
      if (!Array.isArray(sources) || !sources.length) {
        return res.status(400).json({ error: 'Au moins une source (lot_presse_id + quantite_utilisee) est requise.' });
      }
      const qFiltre = positif(quantite_produite, "La quantité d'huile filtrée");
      const qDechet = positifOuZero(quantite_dechet, 'La quantité de déchet');
      const produitObtenu = (await pool.query('SELECT nom, type_article, format_id FROM produits WHERE id = $1', [produit_id])).rows[0];
      if (!produitObtenu) return res.status(400).json({ error: 'Produit obtenu introuvable.' });
      if (melange && !estHuileMelangeFiltree(produitObtenu)) {
        return res.status(400).json({ error: `Pour un mélange, le produit obtenu doit être une huile mélange filtrée (ex. « Huile Mélange Sésame-Nigelle — Filtrée ») : « ${produitObtenu.nom} » ne l'est pas.` });
      }
      if (!melange && !estHuileFiltree(produitObtenu)) {
        return res.status(400).json({ error: `Le produit obtenu d'une filtration doit être une huile filtrée (ex. « Huile de Sésame — Filtrée ») : « ${produitObtenu.nom} » ne l'est pas.` });
      }
      const huilesSources = new Set();
      let totalUtilise = 0;
      for (const s of sources) {
        if (!s.lot_presse_id || !s.quantite_utilisee) {
          return res.status(400).json({ error: 'Chaque source nécessite lot_presse_id et quantite_utilisee.' });
        }
        positif(s.quantite_utilisee, 'La quantité utilisée de chaque lot de presse');
        const presseRes = await pool.query(
          'SELECT lp.lot_id, lp.numero_lot, p.nom FROM lots_presse lp LEFT JOIN produits p ON p.id = lp.produit_id WHERE lp.id = $1', [s.lot_presse_id]);
        if (!presseRes.rows[0]) return res.status(400).json({ error: `Lot de presse ${s.lot_presse_id} introuvable.` });
        // Huile de sésame filtrée = huile de sésame pressée (sauf mélange coché).
        if (!melange && cleHuileVrac(presseRes.rows[0].nom) !== cleHuileVrac(produitObtenu.nom)) {
          return res.status(400).json({ error: `« ${produitObtenu.nom} » se filtre à partir de la même huile : le lot ${presseRes.rows[0].numero_lot} est « ${presseRes.rows[0].nom} ».` });
        }
        huilesSources.add(cleHuileVrac(presseRes.rows[0].nom) || presseRes.rows[0].nom);
        const lotRes = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [presseRes.rows[0].lot_id]);
        if (Number(lotRes.rows[0].quantite_actuelle) < Number(s.quantite_utilisee)) {
          return res.status(409).json({ error: `Stock insuffisant sur le lot de presse ${s.lot_presse_id} (disponible ${lotRes.rows[0].quantite_actuelle}, demandé ${s.quantite_utilisee}).` });
        }
        totalUtilise += Number(s.quantite_utilisee);
      }

      if (melange && huilesSources.size < 2) {
        return res.status(400).json({ error: 'Un mélange demande au moins deux huiles différentes (ex. un lot de sésame et un lot de nigelle).' });
      }

      // Bilan : l'huile filtrée et le déchet viennent de l'huile pressée utilisée.
      if (arrondi(qFiltre + qDechet) > arrondi(totalUtilise)) {
        return res.status(400).json({ error: `Bilan impossible : huile filtrée (${qFiltre}) + déchet (${qDechet}) = ${arrondi(qFiltre + qDechet)}, supérieur à l'huile pressée utilisée (${arrondi(totalUtilise)}).` });
      }

      const { lotId, numeroLot } = await createLot(pool, {
        produit_id, origine: 'FILTRATION', quantite: quantite_produite, employe_id, motif: 'Création via filtration',
        extra: { champs_perso },
      });

      const rendement = totalUtilise ? quantite_produite / totalUtilise : null;
      await pool.query(
        `INSERT INTO lots_filtration
          (date, produit_id, lot_id, filtre_utilise, quantite_dechet, quantite_produite, rendement_reel, numero_lot, notes, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [date, produit_id, lotId, filtre_utilise || null, quantite_dechet || null, quantite_produite, rendement, numeroLot, notes || null, employe_id || null]
      );
      const filtrationRes = await pool.query('SELECT id FROM lots_filtration WHERE lot_id = $1', [lotId]);
      const filtrationId = filtrationRes.rows[0].id;

      const numMvt = await nextNumero(pool, 'mouvement_seq', 'MVT');
      const groupId = require('crypto').randomUUID();

      for (const s of sources) {
        const presseRes = await pool.query('SELECT lot_id FROM lots_presse WHERE id = $1', [s.lot_presse_id]);
        const lotPresseGeneriqueId = presseRes.rows[0].lot_id;

        await pool.query(
          `INSERT INTO lots_filtration_sources (lot_filtration_id, lot_presse_id, quantite_utilisee) VALUES ($1,$2,$3)`,
          [filtrationId, s.lot_presse_id, s.quantite_utilisee]
        );
        await consumeLot(pool, {
          lotSourceId: lotPresseGeneriqueId, lotFilsId: lotId, quantite: s.quantite_utilisee,
          typeMouvement: 'CONSOMMATION', employeId: employe_id, numeroMouvement: `${numMvt}-OUT-${s.lot_presse_id}`,
          groupId, sourceType: 'lots_filtration', sourceId: filtrationId,
        });
      }
      await recordEntree(pool, {
        produitId: produit_id, lotId, quantite: quantite_produite, typeMouvement: 'PRODUCTION',
        employeId: employe_id, numeroMouvement: `${numMvt}-IN`, groupId, sourceType: 'lots_filtration', sourceId: filtrationId,
      });

      const result = await pool.query('SELECT * FROM lots_filtration WHERE id = $1', [filtrationId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }));

  router.put('/:id', async (req, res) => {
    const { date, filtre_utilise, notes, employe_id } = req.body;
    const updateRes = await pool.query(
      `UPDATE lots_filtration SET date = COALESCE($1, date), filtre_utilise = $2, notes = $3, employe_id = $4 WHERE id = $5`,
      [date || null, filtre_utilise || null, notes || null, employe_id || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Lot de filtration introuvable.' });
    const result = await pool.query('SELECT * FROM lots_filtration WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  return router;
};
