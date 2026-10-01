const express = require('express');
const { computeCoutRevient, getDetailPrice, FORMATS } = require('../services/pricing');

module.exports = function (pool) {
  const router = express.Router();

  async function getSettings(pool) {
    const r = await pool.query('SELECT * FROM settings WHERE id = 1');
    return r.rows[0];
  }

  // Calcule les prix courants (tous formats) pour une grille donnée, à une
  // date de référence — respecte les overrides s'ils existent, sinon calcule
  // selon la formule V2 à partir de la dernière entrée d'historique valide.
  async function computeCurrentPrices(pool, grille, dateRef) {
    const settings = await getSettings(pool);
    const histRes = await pool.query(
      `SELECT * FROM grille_historique WHERE grille_id = $1 AND date_effet <= $2 ORDER BY date_effet DESC, id DESC LIMIT 1`,
      [grille.id, dateRef]
    );
    const costEntry = histRes.rows[0] || { cout_matiere: grille.matiere, rendement_jour: grille.prod };

    const coutOverrideRes = await pool.query('SELECT valeur FROM grille_cout_overrides WHERE grille_id = $1', [grille.id]);
    const coutRevient = coutOverrideRes.rows.length
      ? Number(coutOverrideRes.rows[0].valeur)
      : computeCoutRevient(grille, costEntry, settings);

    const formats = {};
    for (const formatKey of Object.keys(FORMATS)) {
      const detailOverrideRes = await pool.query(
        'SELECT valeur FROM grille_detail_overrides WHERE grille_id = $1 AND format_key = $2',
        [grille.id, formatKey]
      );
      const f = FORMATS[formatKey];
      const baseHT = coutRevient * f.frac + f.emb;
      const prixDetail = detailOverrideRes.rows.length
        ? Number(detailOverrideRes.rows[0].valeur)
        : getDetailPrice(grille, formatKey, coutRevient, settings);
      formats[formatKey] = {
        baseHT,
        prixDetail,
        override: detailOverrideRes.rows.length > 0,
      };
    }
    return { coutRevient, coutOverride: coutOverrideRes.rows.length > 0, costEntry, formats };
  }

  // Recalcule les prix stockés (detail30_marche/tableau, t100/t250/t1000) à
  // partir de la dernière entrée de coût connue + réglages actuels, et les
  // persiste. Nécessaire car getDetailPrice() lit ces colonnes STOCKÉES pour
  // le 30ml (toujours) et pour 100/250/1000ml (quand ref_source='tableau',
  // le réglage par défaut) — sans ce recalcul, un changement de coût matière,
  // d'amortissement ou d'électricité ne se répercutait jamais sur les prix
  // réellement utilisés, seulement sur le "coût de revient" affiché.
  async function recomputeStoredPrices(pool, grilleId) {
    const gRes = await pool.query('SELECT * FROM grille_huiles WHERE id = $1', [grilleId]);
    const grille = gRes.rows[0];
    if (!grille) return;
    const settings = await getSettings(pool);
    const histRes = await pool.query(
      `SELECT * FROM grille_historique WHERE grille_id = $1 AND date_effet <= CURRENT_DATE ORDER BY date_effet DESC, id DESC LIMIT 1`,
      [grilleId]
    );
    const costEntry = histRes.rows[0] || { cout_matiere: grille.matiere, rendement_jour: grille.prod };
    const coutRevient = computeCoutRevient(grille, costEntry, settings);
    const margeF = 1 + Number(settings.marge) / 100;
    const tvaF = 1 + Number(settings.tva) / 100;
    const price = (formatKey) => {
      const f = FORMATS[formatKey];
      return Math.round((coutRevient * f.frac + f.emb) * margeF * tvaF * 1000) / 1000;
    };
    await pool.query(
      `UPDATE grille_huiles SET detail30_marche=$1, detail30_tableau=$1, t100=$2, t250=$3, t1000=$4 WHERE id=$5`,
      [price('30ml'), price('100ml'), price('250ml'), price('1000ml'), grilleId]
    );
  }

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT g.*, p.nom AS produit_nom, p.code AS produit_code
      FROM grille_huiles g LEFT JOIN produits p ON p.id = g.produit_id
      ORDER BY p.nom
    `);
    const dateRef = req.query.date || new Date().toISOString().slice(0, 10);
    const withPrices = [];
    for (const g of result.rows) {
      const prices = await computeCurrentPrices(pool, g, dateRef);
      withPrices.push({ ...g, ...prices });
    }
    res.json(withPrices);
  });

  router.get('/:id', async (req, res) => {
    const gRes = await pool.query(
      `SELECT g.*, p.nom AS produit_nom FROM grille_huiles g LEFT JOIN produits p ON p.id = g.produit_id WHERE g.id = $1`,
      [req.params.id]
    );
    if (!gRes.rows[0]) return res.status(404).json({ error: 'Grille introuvable.' });
    const dateRef = req.query.date || new Date().toISOString().slice(0, 10);
    const prices = await computeCurrentPrices(pool, gRes.rows[0], dateRef);
    res.json({ ...gRes.rows[0], ...prices });
  });

  // Crée la grille de prix d'une huile — calcule les prix de départ selon la
  // formule V2 (identique à l'ancien POST /oils), et pose la première entrée
  // d'historique de coût.
  router.post('/', async (req, res, next) => {
    try {
      const { produit_id, matiere, prod, amortissement, electricite_par_litre } = req.body;
      if (!produit_id || matiere == null || prod == null || prod <= 0) {
        return res.status(400).json({ error: 'produit_id, matiere et prod (> 0) sont requis.' });
      }
      const existing = await pool.query('SELECT id FROM grille_huiles WHERE produit_id = $1', [produit_id]);
      if (existing.rows.length) return res.status(409).json({ error: 'Ce produit a déjà une grille de prix — modifiez-la plutôt.' });

      const settings = await getSettings(pool);
      const costEntry = { cout_matiere: matiere, rendement_jour: prod };
      const oilConfig = { amortissement: amortissement ?? 5, electricite_par_litre: electricite_par_litre ?? 0 };
      const coutRevient = computeCoutRevient(oilConfig, costEntry, settings);
      const margeF = 1 + Number(settings.marge) / 100;
      const tvaF = 1 + Number(settings.tva) / 100;
      const price = (formatKey) => {
        const f = FORMATS[formatKey];
        return Math.round((coutRevient * f.frac + f.emb) * margeF * tvaF * 1000) / 1000;
      };

      const insertRes = await pool.query(
        `INSERT INTO grille_huiles (produit_id, matiere, prod, amortissement, electricite_par_litre, detail30_marche, detail30_tableau, t100, t250, t1000, is_custom)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,TRUE)`,
        [produit_id, matiere, prod, oilConfig.amortissement, oilConfig.electricite_par_litre, price('30ml'), price('100ml'), price('250ml'), price('1000ml')]
      );
      const grilleId = insertRes.insertId;
      await pool.query(
        `INSERT INTO grille_historique (grille_id, date_effet, cout_matiere, rendement_jour, note)
         VALUES ($1, CURRENT_DATE, $2, $3, 'Création de la grille')`,
        [grilleId, matiere, prod]
      );
      const result = await pool.query('SELECT * FROM grille_huiles WHERE id = $1', [grilleId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // Modifie l'amortissement et/ou l'électricité/L — recalcule automatiquement
  // les prix par format qui ne sont pas déjà forcés manuellement (override).
  router.put('/:id', async (req, res, next) => {
    try {
      const { amortissement, electricite_par_litre } = req.body;
      const gRes = await pool.query('SELECT * FROM grille_huiles WHERE id = $1', [req.params.id]);
      if (!gRes.rows[0]) return res.status(404).json({ error: 'Grille introuvable.' });

      await pool.query(
        `UPDATE grille_huiles SET amortissement = COALESCE($1, amortissement), electricite_par_litre = COALESCE($2, electricite_par_litre) WHERE id = $3`,
        [amortissement ?? null, electricite_par_litre ?? null, req.params.id]
      );
      await recomputeStoredPrices(pool, req.params.id);
      const result = await pool.query('SELECT * FROM grille_huiles WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // Historique de coût — AMÉLIORATION vs V2, qui ne permettait pas d'ajouter
  // de nouvelles entrées via l'API (seulement à la création).
  router.get('/:id/historique', async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM grille_historique WHERE grille_id = $1 ORDER BY date_effet DESC',
      [req.params.id]
    );
    res.json(result.rows);
  });

  router.post('/:id/historique', async (req, res) => {
    const { date_effet, cout_matiere, rendement_jour, note } = req.body;
    if (!date_effet || cout_matiere == null || rendement_jour == null) {
      return res.status(400).json({ error: 'date_effet, cout_matiere et rendement_jour sont requis.' });
    }
    const gRes = await pool.query('SELECT id FROM grille_huiles WHERE id = $1', [req.params.id]);
    if (!gRes.rows[0]) return res.status(404).json({ error: 'Grille introuvable.' });
    await pool.query(
      `INSERT INTO grille_historique (grille_id, date_effet, cout_matiere, rendement_jour, note) VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, date_effet, cout_matiere, rendement_jour, note || null]
    );
    await recomputeStoredPrices(pool, req.params.id);
    const result = await pool.query('SELECT * FROM grille_historique WHERE grille_id = $1 ORDER BY date_effet DESC', [req.params.id]);
    res.status(201).json(result.rows);
  });

  // Recalcul manuel — utile après un changement des réglages globaux
  // (salaire, marge, TVA...) qui affecte toutes les grilles à la fois.
  router.post('/:id/recalculer', async (req, res) => {
    const gRes = await pool.query('SELECT id FROM grille_huiles WHERE id = $1', [req.params.id]);
    if (!gRes.rows[0]) return res.status(404).json({ error: 'Grille introuvable.' });
    await recomputeStoredPrices(pool, req.params.id);
    const result = await pool.query('SELECT * FROM grille_huiles WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  // Overrides — AMÉLIORATION vs V2 (tables existaient mais aucune route pour
  // les gérer ; il fallait passer par du SQL direct).
  router.post('/:id/cout-override', async (req, res) => {
    const { valeur } = req.body;
    if (valeur == null) return res.status(400).json({ error: 'valeur est requise.' });
    await pool.query(
      `INSERT INTO grille_cout_overrides (grille_id, valeur) VALUES ($1,$2) ON DUPLICATE KEY UPDATE valeur = $2`,
      [req.params.id, valeur]
    );
    res.json({ grille_id: Number(req.params.id), valeur });
  });
  router.delete('/:id/cout-override', async (req, res) => {
    await pool.query('DELETE FROM grille_cout_overrides WHERE grille_id = $1', [req.params.id]);
    res.status(204).end();
  });

  router.post('/:id/detail-override', async (req, res) => {
    const { format_key, valeur } = req.body;
    if (!format_key || valeur == null) return res.status(400).json({ error: 'format_key et valeur sont requis.' });
    if (!FORMATS[format_key]) return res.status(400).json({ error: `format_key invalide. Valeurs possibles : ${Object.keys(FORMATS).join(', ')}` });
    await pool.query(
      `INSERT INTO grille_detail_overrides (grille_id, format_key, valeur) VALUES ($1,$2,$3)
       ON DUPLICATE KEY UPDATE valeur = $3`,
      [req.params.id, format_key, valeur]
    );
    res.json({ grille_id: Number(req.params.id), format_key, valeur });
  });
  router.delete('/:id/detail-override/:format_key', async (req, res) => {
    await pool.query(
      'DELETE FROM grille_detail_overrides WHERE grille_id = $1 AND format_key = $2',
      [req.params.id, req.params.format_key]
    );
    res.status(204).end();
  });

  return router;
};
