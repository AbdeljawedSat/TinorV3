const { enTransaction } = require('../db/transaction');
const express = require('express');
const { nextNumero, createLot, consumeLot, recordEntree } = require('../services/lotService');
const { cleGraine, cleHuileVrac, estGraine, estHuileVrac, estHuileMelangeVrac } = require('../services/graines');
const { positif, positifOuZero, arrondi } = require('../services/regles');
const { compositions } = require('../services/composition');
const vide = v => v === undefined || v === null || v === '';

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT lp.*, p.nom AS produit_nom, e.nom AS employe_nom,
        l.quantite_actuelle, l.statut AS lot_statut, l.champs_perso,
        (SELECT GROUP_CONCAT(CONCAT(ls.numero_lot, ' (', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM lo.quantite_utilisee)), ')') ORDER BY ls.numero_lot SEPARATOR ', ')
           FROM lot_origines lo JOIN lots ls ON ls.id = lo.lot_source_id WHERE lo.lot_fils_id = lp.lot_id) AS lots_graines
      FROM lots_presse lp
      LEFT JOIN produits p ON p.id = lp.produit_id
      LEFT JOIN employes e ON e.id = lp.employe_id
      LEFT JOIN lots l ON l.id = lp.lot_id
      ORDER BY lp.date DESC, lp.id DESC
    `);
    const compo = await compositions(pool, result.rows.map(r => r.lot_id));
    res.json(result.rows.map(r => ({ ...r, composition: compo.get(String(r.lot_id)) || [] })));
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

  // Pressage : une opération consomme un ou PLUSIEURS lots de graines et produit
  // une huile en vrac PAR GRAINE (ex. 2 lots de sésame + 1 lot de nigelle →
  // huile de sésame + huile de nigelle). Chaque huile obtenue devient un lot
  // (une ligne lots_presse) relié à ses lots de graines (lot_origines).
  //
  // Corps : { date, sources: [{ lot_id, quantite }],
  //           sorties: [{ produit_id, quantite_produite, quantite_tourteau }], notes, employe_id }
  // Ancien format accepté : { produit_id, lot_source_id, quantite_matiere_utilisee,
  //                           quantite_tourteau, quantite_produite } (un lot → une huile).
  //
  // Bilan, par graine et donc au total : graines utilisées ≥ huile + tourteau.
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { date, reception_id, notes, employe_id, champs_perso, melange } = req.body;
      let { sources, sorties } = req.body;
      let matiereSansSource = null; // ancien format sans lot : bilan sur la quantité déclarée
      if (!Array.isArray(sorties)) {
        const { produit_id, lot_source_id, quantite_matiere_utilisee, quantite_tourteau, quantite_produite } = req.body;
        if (lot_source_id && !quantite_matiere_utilisee) {
          return res.status(400).json({ error: 'quantite_matiere_utilisee est requis quand lot_source_id est fourni.' });
        }
        sorties = [{ produit_id, quantite_produite, quantite_tourteau }];
        sources = lot_source_id ? [{ lot_id: lot_source_id, quantite: quantite_matiere_utilisee }] : [];
        if (!lot_source_id && !vide(quantite_matiere_utilisee)) matiereSansSource = positif(quantite_matiere_utilisee, 'La quantité de matière utilisée');
      }
      sources = Array.isArray(sources) ? sources.filter(s => s && s.lot_id) : [];
      if (!date) return res.status(400).json({ error: 'La date est requise.' });
      if (!sorties.length) return res.status(400).json({ error: 'Au moins une huile obtenue est requise.' });
      if (!sources.length && sorties.length > 1) {
        return res.status(400).json({ error: 'Un pressage sans lot de graines ne peut produire qu\'une seule huile.' });
      }

      // ---- Sources : des lots de graines, chacun une seule fois, quantité > 0 et disponible
      const graines = new Map(); // clé de graine → { total, lots: [...] }
      const vus = new Set();
      for (const s of sources) {
        if (vus.has(Number(s.lot_id))) return res.status(400).json({ error: 'Un même lot de graines est saisi deux fois : regroupez les quantités sur une seule ligne.' });
        vus.add(Number(s.lot_id));
        const q = positif(s.quantite, 'La quantité de graines utilisée');
        const lot = (await pool.query(
          `SELECT l.id, l.quantite_actuelle, l.numero_lot, l.statut, p.nom, p.type_article, p.format_id
           FROM lots l JOIN produits p ON p.id = l.produit_id WHERE l.id = $1`, [s.lot_id])).rows[0];
        if (!lot) return res.status(400).json({ error: `Lot de graines ${s.lot_id} introuvable.` });
        if (!estGraine(lot)) {
          return res.status(400).json({ error: `La matière consommée d'un pressage doit être un lot de graines (ex. « Graines de Sésame ») : le lot ${lot.numero_lot} est « ${lot.nom} ».` });
        }
        if (Number(lot.quantite_actuelle) < q) {
          return res.status(409).json({ error: `Stock insuffisant sur le lot ${lot.numero_lot} (disponible ${Number(lot.quantite_actuelle)}, demandé ${q}).` });
        }
        const cle = cleGraine(lot.nom);
        if (!graines.has(cle)) graines.set(cle, { nom: lot.nom, total: 0, lots: [] });
        const g = graines.get(cle);
        g.total = arrondi(g.total + q);
        g.lots.push({ id: lot.id, numero_lot: lot.numero_lot, quantite: q });
      }

      // ---- Sorties : une huile en vrac par graine, quantités valides
      const huiles = [];
      for (const so of sorties) {
        const produit = (await pool.query('SELECT id, nom, type_article, format_id FROM produits WHERE id = $1', [so.produit_id])).rows[0];
        if (!produit) return res.status(400).json({ error: 'Produit obtenu introuvable.' });
        if (melange && !estHuileMelangeVrac(produit)) {
          return res.status(400).json({ error: `Pour un mélange de graines, le produit obtenu doit être une huile mélange en vrac (ex. « Huile Mélange Sésame-Nigelle — Vrac ») : « ${produit.nom} » ne l'est pas.` });
        }
        if (!melange && !estHuileVrac(produit)) {
          return res.status(400).json({ error: `Le produit obtenu d'un pressage doit être une huile en vrac (ex. « Huile de Sésame — Vrac ») : « ${produit.nom} » ne l'est pas.` });
        }
        const cle = melange ? '__melange' : cleHuileVrac(produit.nom);
        if (huiles.some(h => h.cle === cle)) return res.status(400).json({ error: `Une seule huile obtenue par graine : « ${produit.nom} » est en double.` });
        huiles.push({
          cle, produit,
          huile: positif(so.quantite_produite, `La quantité de « ${produit.nom} » obtenue`),
          tourteau: positifOuZero(so.quantite_tourteau, 'La quantité de tourteau'),
        });
      }

      // ---- Mélange : toutes les graines (au moins deux sortes) donnent UNE huile mélange.
      if (melange) {
        if (graines.size < 2) return res.status(400).json({ error: 'Un mélange de graines demande au moins deux graines différentes (ex. sésame et nigelle).' });
        if (huiles.length !== 1) return res.status(400).json({ error: 'Un mélange de graines donne une seule huile mélange.' });
        const tout = { nom: 'mélange', total: 0, lots: [] };
        for (const g of graines.values()) { tout.total = arrondi(tout.total + g.total); tout.lots.push(...g.lots); }
        graines.clear(); graines.set('__melange', tout);
      }

      // ---- Correspondance graines ↔ huiles et bilan matière
      if (sources.length && !melange) {
        for (const h of huiles) {
          if (!graines.has(h.cle)) {
            return res.status(400).json({ error: `« ${h.produit.nom} » ne correspond à aucun des lots de graines saisis : choisissez l'huile en vrac de la même graine.` });
          }
        }
        for (const [cle, g] of graines) {
          if (!huiles.some(h => h.cle === cle)) {
            return res.status(400).json({ error: `Les graines « ${g.nom} » sont consommées sans huile obtenue : ajoutez l'huile en vrac correspondante.` });
          }
        }
      }
      let totalGraines = 0, totalSorties = 0;
      for (const h of huiles) {
        const matiere = sources.length ? graines.get(h.cle).total : matiereSansSource;
        h.matiere = matiere;
        if (matiere == null) continue;
        const sortie = arrondi(h.huile + h.tourteau);
        if (sortie > arrondi(matiere)) {
          return res.status(400).json({ error: `Bilan impossible pour « ${h.produit.nom} » : huile (${h.huile}) + tourteau (${h.tourteau}) = ${sortie}, supérieur aux graines utilisées (${arrondi(matiere)}). Les graines doivent être au moins égales à la somme.` });
        }
        totalGraines += matiere; totalSorties += sortie;
      }

      // ---- Écritures (transaction : tout ou rien)
      const groupId = require('crypto').randomUUID();
      const crees = [];
      for (const h of huiles) {
        const { lotId, numeroLot } = await createLot(pool, {
          produit_id: h.produit.id, origine: 'PRESSE', quantite: h.huile, employe_id, motif: 'Création via pressage',
          extra: { champs_perso },
        });
        await pool.query(
          `INSERT INTO lots_presse
            (date, produit_id, reception_id, lot_id, quantite_matiere_utilisee, quantite_tourteau,
             quantite_produite, rendement_reel, numero_lot, notes, employe_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [date, h.produit.id, reception_id || null, lotId, h.matiere, h.tourteau || null,
           h.huile, h.matiere ? h.huile / h.matiere : null, numeroLot, notes || null, employe_id || null]
        );
        for (const l of (sources.length ? graines.get(h.cle).lots : [])) {
          await consumeLot(pool, {
            lotSourceId: l.id, lotFilsId: lotId, quantite: l.quantite,
            typeMouvement: 'CONSOMMATION', employeId: employe_id, numeroMouvement: await nextNumero(pool, 'mouvement_seq', 'MVT'),
            groupId, sourceType: 'lots_presse', sourceId: lotId,
          });
        }
        await recordEntree(pool, {
          produitId: h.produit.id, lotId, quantite: h.huile, typeMouvement: 'PRODUCTION',
          employeId: employe_id, numeroMouvement: await nextNumero(pool, 'mouvement_seq', 'MVT'),
          groupId, sourceType: 'lots_presse', sourceId: lotId,
        });
        crees.push((await pool.query('SELECT * FROM lots_presse WHERE lot_id = $1', [lotId])).rows[0]);
      }

      // Compatibilité : la réponse reste la ligne lots_presse (1re huile), avec la liste complète.
      res.status(201).json({
        ...crees[0], lots_presse: crees,
        bilan: { graines: arrondi(totalGraines), huiles_et_tourteau: arrondi(totalSorties), pertes: arrondi(totalGraines - totalSorties) },
      });
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
