const express = require('express');
const { nextNumero, createLot, consumeLot, recordEntree } = require('../services/lotService');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT c.*, p.nom AS produit_nom, COALESCE(c.format_id, p.format_id) AS format_id, p.categorie_id, p.code AS produit_code,
        u.symbole AS unite_symbole, e.nom AS employe_nom, l.numero_lot, l.quantite_actuelle, l.statut AS lot_statut,
        l.champs_perso, src.sources_restantes
      FROM conditionnements c
      LEFT JOIN produits p ON p.id = c.produit_id
      LEFT JOIN unites u ON u.id = p.unite_id
      LEFT JOIN employes e ON e.id = c.employe_id
      LEFT JOIN lots l ON l.id = c.lot_id
      LEFT JOIN (
        SELECT cs.conditionnement_id,
          GROUP_CONCAT(
            CONCAT(COALESCE(lpl.numero_lot, lfl.numero_lot, ld.numero_lot), ':', COALESCE(lpl.quantite_actuelle, lfl.quantite_actuelle, ld.quantite_actuelle), ':', COALESCE(lpl.produit_id, lfl.produit_id, ld.produit_id))
            SEPARATOR '||'
          ) AS sources_restantes
        FROM conditionnement_sources cs
        LEFT JOIN lots_presse lp ON lp.id = cs.lot_presse_id
        LEFT JOIN lots lpl ON lpl.id = lp.lot_id
        LEFT JOIN lots_filtration lf ON lf.id = cs.lot_filtration_id
        LEFT JOIN lots lfl ON lfl.id = lf.lot_id
        LEFT JOIN lots ld ON ld.id = cs.lot_id
        GROUP BY cs.conditionnement_id
      ) src ON src.conditionnement_id = c.id
      ORDER BY c.date DESC, c.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const condRes = await pool.query('SELECT * FROM conditionnements WHERE id = $1', [req.params.id]);
    if (!condRes.rows[0]) return res.status(404).json({ error: 'Conditionnement introuvable.' });
    const sourcesRes = await pool.query(
      `SELECT cs.*, lp.numero_lot AS lot_presse_numero, lf.numero_lot AS lot_filtration_numero
       FROM conditionnement_sources cs
       LEFT JOIN lots_presse lp ON lp.id = cs.lot_presse_id
       LEFT JOIN lots_filtration lf ON lf.id = cs.lot_filtration_id
       WHERE cs.conditionnement_id = $1`,
      [req.params.id]
    );
    res.json({ ...condRes.rows[0], sources: sourcesRes.rows });
  });

  // Conditionne du vrac (presse ou filtration) en produit fini formaté
  // (ex: "Sésame 30ml"). sources : [{ lot_presse_id XOR lot_filtration_id, quantite_utilisee }]
  // consommables (optionnel) : [{ produit_id, quantite }] — flacons, bouchons,
  // étiquettes... sélection FIFO d'un lot par consommable, même logique de
  // traçabilité que le vrac (lot_origines + stock_mouvements).
  router.post('/', async (req, res, next) => {
    try {
      const { date, produit_id, format_id, qty, note, employe_id, sources, consommables, champs_perso } = req.body;
      if (!date || !produit_id || !qty) {
        return res.status(400).json({ error: 'date, produit_id et qty sont requis.' });
      }
      if (!Array.isArray(sources) || !sources.length) {
        return res.status(400).json({ error: 'Au moins une source (lot_presse_id, lot_filtration_id ou lot_id + quantite_utilisee) est requise.' });
      }
      let quantiteSourceTotale = 0;
      for (const s of sources) {
        const types = [s.lot_presse_id, s.lot_filtration_id, s.lot_id].filter(Boolean);
        if (types.length !== 1) {
          return res.status(400).json({ error: 'Chaque source doit avoir exactement un type (lot_presse_id, lot_filtration_id ou lot_id).' });
        }
        if (!s.quantite_utilisee) return res.status(400).json({ error: 'quantite_utilisee est requis pour chaque source.' });

        let quantiteDisponible;
        if (s.lot_presse_id) {
          const srcRes = await pool.query('SELECT lot_id FROM lots_presse WHERE id = $1', [s.lot_presse_id]);
          if (!srcRes.rows[0]) return res.status(400).json({ error: `lots_presse ${s.lot_presse_id} introuvable.` });
          const lotRes = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [srcRes.rows[0].lot_id]);
          quantiteDisponible = lotRes.rows[0].quantite_actuelle;
        } else if (s.lot_filtration_id) {
          const srcRes = await pool.query('SELECT lot_id FROM lots_filtration WHERE id = $1', [s.lot_filtration_id]);
          if (!srcRes.rows[0]) return res.status(400).json({ error: `lots_filtration ${s.lot_filtration_id} introuvable.` });
          const lotRes = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [srcRes.rows[0].lot_id]);
          quantiteDisponible = lotRes.rows[0].quantite_actuelle;
        } else {
          // Vrac reçu directement (achat/réception), sans passage par presse/filtration.
          const lotRes = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [s.lot_id]);
          if (!lotRes.rows[0]) return res.status(400).json({ error: `Lot ${s.lot_id} introuvable.` });
          quantiteDisponible = lotRes.rows[0].quantite_actuelle;
        }
        if (Number(quantiteDisponible) < Number(s.quantite_utilisee)) {
          return res.status(409).json({ error: `Stock insuffisant sur cette source (disponible ${quantiteDisponible}, demandé ${s.quantite_utilisee}).` });
        }
        quantiteSourceTotale += Number(s.quantite_utilisee);
      }

      // Vérification tout-ou-rien des consommables AVANT toute écriture,
      // même principe que les ordres de production.
      const consommablesResolus = [];
      for (const c of (consommables || [])) {
        if (!c.produit_id || !c.quantite) continue;
        const lotRes = await pool.query(
          `SELECT id, quantite_actuelle FROM lots
           WHERE produit_id = $1 AND statut = 'LIBERE' AND quantite_actuelle >= $2
           ORDER BY created_at ASC LIMIT 1`,
          [c.produit_id, c.quantite]
        );
        const lot = lotRes.rows[0];
        if (!lot) {
          const prodRes = await pool.query('SELECT nom FROM produits WHERE id = $1', [c.produit_id]);
          const stockRes = await pool.query(
            `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND statut = 'LIBERE'`,
            [c.produit_id]
          );
          return res.status(409).json({
            error: `Stock insuffisant pour le consommable "${prodRes.rows[0]?.nom || c.produit_id}" — demandé ${c.quantite}, disponible ${stockRes.rows[0].total}.`,
          });
        }
        consommablesResolus.push({ produit_id: c.produit_id, lot_id: lot.id, quantite: c.quantite });
      }

      const { lotId, numeroLot } = await createLot(pool, {
        produit_id, origine: 'CONDITIONNEMENT', quantite: qty, employe_id, motif: 'Création via conditionnement',
        extra: { champs_perso },
      });

      // Le format est figé ici, au moment précis de l'opération — si aucun
      // n'est fourni explicitement, on prend celui du produit À CET INSTANT
      // (mais on l'enregistre en dur : un changement futur du format du
      // produit ne réécrira jamais cette ligne d'historique).
      let formatFige = format_id || null;
      if (!formatFige) {
        const produitRes = await pool.query('SELECT format_id FROM produits WHERE id = $1', [produit_id]);
        formatFige = produitRes.rows[0]?.format_id || null;
      }

      const condRes = await pool.query(
        `INSERT INTO conditionnements (date, produit_id, format_id, lot_id, qty, quantite_source_utilisee, note, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [date, produit_id, formatFige, lotId, qty, quantiteSourceTotale, note || null, employe_id || null]
      );
      const conditionnementId = condRes.insertId;

      const numMvt = await nextNumero(pool, 'mouvement_seq', 'MVT');
      const groupId = require('crypto').randomUUID();

      for (const s of sources) {
        let lotSourceGeneriqueId;
        if (s.lot_presse_id) {
          const srcRes = await pool.query('SELECT lot_id FROM lots_presse WHERE id = $1', [s.lot_presse_id]);
          lotSourceGeneriqueId = srcRes.rows[0].lot_id;
        } else if (s.lot_filtration_id) {
          const srcRes = await pool.query('SELECT lot_id FROM lots_filtration WHERE id = $1', [s.lot_filtration_id]);
          lotSourceGeneriqueId = srcRes.rows[0].lot_id;
        } else {
          lotSourceGeneriqueId = s.lot_id;
        }

        await pool.query(
          `INSERT INTO conditionnement_sources (conditionnement_id, lot_presse_id, lot_filtration_id, lot_id, quantite_utilisee)
           VALUES ($1,$2,$3,$4,$5)`,
          [conditionnementId, s.lot_presse_id || null, s.lot_filtration_id || null, s.lot_id || null, s.quantite_utilisee]
        );
        const refLabel = s.lot_presse_id ? `presse-${s.lot_presse_id}` : s.lot_filtration_id ? `filtration-${s.lot_filtration_id}` : `direct-${s.lot_id}`;
        await consumeLot(pool, {
          lotSourceId: lotSourceGeneriqueId, lotFilsId: lotId, quantite: s.quantite_utilisee,
          typeMouvement: 'CONSOMMATION', employeId: employe_id, numeroMouvement: `${numMvt}-OUT-${refLabel}`,
          groupId, sourceType: 'conditionnement', sourceId: conditionnementId,
        });
      }

      for (const c of consommablesResolus) {
        await consumeLot(pool, {
          lotSourceId: c.lot_id, lotFilsId: lotId, quantite: c.quantite,
          typeMouvement: 'CONSOMMATION', employeId: employe_id, numeroMouvement: `${numMvt}-OUT-CONS-${c.produit_id}`,
          groupId, sourceType: 'conditionnement', sourceId: conditionnementId,
        });
      }

      await recordEntree(pool, {
        produitId: produit_id, lotId, quantite: qty, typeMouvement: 'CONDITIONNEMENT',
        employeId: employe_id, numeroMouvement: `${numMvt}-IN`, groupId, sourceType: 'conditionnement', sourceId: conditionnementId,
      });

      const result = await pool.query('SELECT * FROM conditionnements WHERE id = $1', [conditionnementId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res) => {
    const { date, note, employe_id } = req.body;
    const updateRes = await pool.query(
      `UPDATE conditionnements SET date = COALESCE($1, date), note = $2, employe_id = $3 WHERE id = $4`,
      [date || null, note || null, employe_id || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Conditionnement introuvable.' });
    const result = await pool.query('SELECT * FROM conditionnements WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  return router;
};
