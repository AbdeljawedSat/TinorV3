// Mélange = lot fini en vrac, avant la mise en flacons (registres Jardins de Jerba).
// Une ou deux huiles (lots filtrés ou vrac) → un lot « yy x1x1 x2x2 » (yy continue
// d'une année à l'autre ; x1x1 / x2x2 = XX des deux huiles ; x1x1 répété s'il n'y en a
// qu'une). Les flacons conditionnés depuis ce lot gardent son n° + le format
// (« 110409-10ML », « 110409-30ML ») — voir routes/conditionnement.js.
// Le lot est enregistré en origine AUTRE avec champs_perso.etape = 'MELANGE'.
const express = require('express');
const { enTransaction } = require('../db/transaction');
const { createLot, consumeLot, recordEntree, nextNumero, nextLotNumber, LOT_DISPONIBLE } = require('../services/lotService');
const { estHuileVrac, estHuileFiltree, estHuileMelangeFiltree, cleHuile } = require('../services/graines');

const ETAPE = "JSON_VALUE(l.champs_perso, '$.etape') = 'MELANGE'";
const arrondi = (n) => Math.round(Number(n) * 1000) / 1000;

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const lots = (await pool.query(
      `SELECT l.id, l.numero_lot, l.produit_id, p.nom AS produit_nom, u.symbole AS unite_symbole, l.date_production AS date,
              l.quantite_initiale, l.quantite_actuelle, l.statut, l.date_expiration, l.notes, l.created_at
       FROM lots l JOIN produits p ON p.id = l.produit_id LEFT JOIN unites u ON u.id = p.unite_id
       WHERE ${ETAPE} ORDER BY COALESCE(l.date_production, l.created_at) DESC, l.id DESC`)).rows;
    for (const l of lots) {
      l.huiles = (await pool.query(
        `SELECT s.numero_lot, o.quantite_utilisee FROM lot_origines o JOIN lots s ON s.id = o.lot_source_id WHERE o.lot_fils_id = $1 ORDER BY o.id`, [l.id])).rows;
      l.flacons = (await pool.query(
        `SELECT f.numero_lot, p.nom AS produit_nom, f.quantite_initiale, f.quantite_actuelle
         FROM lot_origines o JOIN lots f ON f.id = o.lot_fils_id JOIN produits p ON p.id = f.produit_id
         WHERE o.lot_source_id = $1 GROUP BY f.id ORDER BY f.numero_lot`, [l.id])).rows;
    }
    res.json(lots);
  });

  // yy du prochain lot fini (aperçu du n° dans le formulaire).
  router.get('/prochain', async (req, res) => {
    const r = (await pool.query("SELECT `last_value` AS v FROM sequences WHERE name = 'lot_jj_fini'")).rows[0];
    const s = (await pool.query('SELECT lot_format_style FROM settings WHERE id = 1')).rows[0] || {};
    res.json({ yy: Number(r?.v || 0) + 1, numerotation: s.lot_format_style || 'code_origine_seq' });
  });

  // body : { date, sources: [{ lot_id, quantite }] (1 ou 2, dans l'unité de l'huile, ex. L),
  //          produit_id? (obligatoire si deux huiles différentes : « Huile Mélange … — Filtrée »), note, employe_id }
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { date, sources, note, employe_id, champs_perso } = req.body;
      let { produit_id } = req.body;
      if (!date) return res.status(400).json({ error: 'La date du mélange est requise.' });
      if (!Array.isArray(sources) || !sources.length || sources.length > 2) return res.status(400).json({ error: 'Choisissez une ou deux huiles (lots filtrés).' });
      const lots = [];
      for (const s of sources) {
        const q = Number(s.quantite);
        if (!s.lot_id || !(q > 0)) return res.status(400).json({ error: 'Chaque huile demande son lot et une quantité supérieure à 0.' });
        const l = (await pool.query(
          `SELECT l.id, l.numero_lot, l.produit_id, l.quantite_actuelle, l.date_expiration, p.nom, p.format_id, p.type_article, u.symbole
           FROM lots l JOIN produits p ON p.id = l.produit_id LEFT JOIN unites u ON u.id = p.unite_id
           WHERE l.id = $1 AND ${LOT_DISPONIBLE.replace(/statut|date_expiration/g, m => `l.${m}`)}`, [s.lot_id])).rows[0];
        if (!l) return res.status(400).json({ error: 'Lot d\'huile introuvable, bloqué ou périmé.' });
        if (!(estHuileFiltree(l) || estHuileVrac(l) || estHuileMelangeFiltree(l))) return res.status(400).json({ error: `Le lot ${l.numero_lot} (« ${l.nom} ») n'est pas une huile en vrac ou filtrée.` });
        if (lots.some(x => x.id === l.id)) return res.status(400).json({ error: `Le lot ${l.numero_lot} est choisi deux fois.` });
        if (Number(l.quantite_actuelle) < q) return res.status(409).json({ error: `Stock insuffisant sur le lot ${l.numero_lot} : disponible ${Number(l.quantite_actuelle)} ${l.symbole || ''}, demandé ${q}.` });
        lots.push({ ...l, quantite: q });
      }
      if (!produit_id) {
        const memes = new Set(lots.map(l => cleHuile(l.nom)));
        if (memes.size > 1) return res.status(400).json({ error: 'Deux huiles différentes : choisissez le produit du mélange (« Huile Mélange … — Filtrée »).' });
        // Même huile : le lot fini est l'huile filtrée de cette huile (sinon celle du 1er lot).
        const filtree = lots.find(l => estHuileFiltree(l)) || lots[0];
        produit_id = filtree.produit_id;
      }
      const total = arrondi(lots.reduce((t, l) => t + l.quantite, 0));
      const numero = await nextLotNumber(pool, produit_id, 'MELANGE', { date, sources: lots.map(l => ({ lot_id: l.id, quantite: l.quantite })) });
      const expirations = lots.map(l => l.date_expiration).filter(Boolean).map(d => new Date(d).toISOString().slice(0, 10)).sort();
      const { lotId, numeroLot } = await createLot(pool, {
        produit_id, origine: 'AUTRE', quantite: total, employe_id, motif: 'Création via mélange', numero,
        extra: { date_expiration: expirations[0] || null, champs_perso: { ...(champs_perso || {}), etape: 'MELANGE', huiles: lots.map(l => `${l.numero_lot} (${l.quantite})`) } },
      });
      await pool.query('UPDATE lots SET date_production = $1, notes = $2 WHERE id = $3', [date, note || null, lotId]);
      const groupId = require('crypto').randomUUID();
      for (const l of lots) {
        await consumeLot(pool, {
          lotSourceId: l.id, lotFilsId: lotId, quantite: l.quantite, typeMouvement: 'CONSOMMATION', employeId: employe_id,
          numeroMouvement: await nextNumero(pool, 'mouvement_seq', 'MVT'), groupId, sourceType: 'melange', sourceId: lotId,
        });
      }
      await recordEntree(pool, {
        produitId: produit_id, lotId, quantite: total, typeMouvement: 'PRODUCTION', employeId: employe_id,
        numeroMouvement: await nextNumero(pool, 'mouvement_seq', 'MVT'), groupId, sourceType: 'melange', sourceId: lotId,
      });
      res.status(201).json({ id: lotId, lot_id: lotId, numero_lot: numeroLot, quantite: total, produit_id });
    } catch (err) { next(err); }
  }));

  return router;
};
