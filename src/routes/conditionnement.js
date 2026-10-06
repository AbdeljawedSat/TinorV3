const { enTransaction } = require('../db/transaction');
const express = require('express');
const { positif, entierSiUnite, arrondi, facteurConversion } = require('../services/regles');
const { nextNumero, createLot, consumeLot, recordEntree, LOT_DISPONIBLE, ORDRE_FEFO } = require('../services/lotService');
const { cleHuile, estNomMelange } = require('../services/graines');

// Lot générique (table lots) d'une source de conditionnement, avec son produit.
async function lotDeSource(pool, s) {
  const lotId = s.lot_id || (s.lot_presse_id
    ? (await pool.query('SELECT lot_id FROM lots_presse WHERE id = $1', [s.lot_presse_id])).rows[0]?.lot_id
    : (await pool.query('SELECT lot_id FROM lots_filtration WHERE id = $1', [s.lot_filtration_id])).rows[0]?.lot_id);
  if (!lotId) return null;
  return (await pool.query(
    `SELECT l.id, l.numero_lot, l.produit_id, p.nom, p.produit_source_id, p.categorie_id, p.tva, p.bio_eligible
     FROM lots l JOIN produits p ON p.id = l.produit_id WHERE l.id = $1`, [lotId])).rows[0] || null;
}

// Code produit à 2 chiffres suivant (même séquence que la création de produit).
async function codeProduitSuivant(pool) {
  const seq = await pool.query("UPDATE sequences SET `last_value` = `last_value` + 1 WHERE name = 'produit_code_seq'");
  if (!seq.affectedRows) await pool.query("INSERT INTO sequences (name, `last_value`) VALUES ('produit_code_seq', 1)");
  for (;;) {
    const cur = (await pool.query("SELECT `last_value` AS v FROM sequences WHERE name = 'produit_code_seq'")).rows[0].v;
    const code = String(cur).padStart(2, '0');
    if (!(await pool.query('SELECT 1 FROM produits WHERE code = $1', [code])).rows.length) return code;
    await pool.query("UPDATE sequences SET `last_value` = `last_value` + 1 WHERE name = 'produit_code_seq'");
  }
}

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
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { date, format_id, qty, note, employe_id, sources, consommables, champs_perso, melange, nouveau_produit } = req.body;
      let { produit_id } = req.body;
      if (nouveau_produit && nouveau_produit.nom && !produit_id) produit_id = 'nouveau';
      if (!date || !produit_id || !qty) {
        return res.status(400).json({ error: 'date, produit_id et qty sont requis.' });
      }
      if (!Array.isArray(sources) || !sources.length) {
        return res.status(400).json({ error: 'Au moins une source (lot_presse_id, lot_filtration_id ou lot_id + quantite_utilisee) est requise.' });
      }
      // Nouveau produit fini créé ici (dans la même transaction : rien n'est créé si l'opération échoue).
      if (produit_id === 'nouveau') {
        const nom = String(nouveau_produit.nom).trim();
        if (!format_id) return res.status(400).json({ error: 'Choisissez le format du nouveau produit fini.' });
        if ((await pool.query('SELECT 1 FROM produits WHERE nom = $1', [nom])).rows.length) {
          return res.status(400).json({ error: `Le produit « ${nom} » existe déjà : choisissez-le dans la liste.` });
        }
        const src = await lotDeSource(pool, sources[0] || {});
        if (!src) return res.status(400).json({ error: 'Choisissez d\'abord la source (lot vrac ou filtré).' });
        if (melange && !estNomMelange(nom)) return res.status(400).json({ error: `Un produit de mélange se nomme « Huile Mélange … » : « ${nom} ».` });
        const unite = (await pool.query("SELECT id FROM unites WHERE code = 'unite'")).rows[0];
        const sourceId = src.produit_source_id || src.produit_id; // une huile filtrée renvoie vers son vrac
        const code = await codeProduitSuivant(pool);
        const ins = await pool.query(
          `INSERT INTO produits (code, nom, categorie_id, unite_id, format_id, type_article, produit_source_id, vendable, stockable, actif, bio_eligible, tva)
           VALUES ($1,$2,$3,$4,$5,'PRODUIT_FABRIQUE',$6,TRUE,TRUE,TRUE,$7,$8)`,
          [code, nom, src.categorie_id, unite ? unite.id : null, format_id, sourceId, !!src.bio_eligible, src.tva ?? 19]);
        produit_id = ins.insertId;
      }
      // Produit conditionné : unité, format et vrac d'origine attendus.
      const produitRes = await pool.query(
        `SELECT p.nom, p.format_id, p.produit_source_id, u.code AS unite, f.volume AS format_volume, uf.code AS format_unite, uf.symbole AS format_symbole,
                ps.nom AS vrac_nom, us.code AS vrac_unite, us.symbole AS vrac_symbole
         FROM produits p
         LEFT JOIN unites u ON u.id = p.unite_id
         LEFT JOIN formats f ON f.id = COALESCE($2, p.format_id)
         LEFT JOIN unites uf ON uf.id = f.unite_id
         LEFT JOIN produits ps ON ps.id = p.produit_source_id
         LEFT JOIN unites us ON us.id = ps.unite_id
         WHERE p.id = $1`, [produit_id, format_id || null]);
      const produit = produitRes.rows[0];
      if (!produit) return res.status(400).json({ error: 'Produit conditionné introuvable.' });
      if (melange && !estNomMelange(produit.nom)) {
        return res.status(400).json({ error: `Pour un mélange, le produit fini doit être une huile mélange (ex. « Huile Mélange Sésame-Nigelle — Flacon 30ml ») : « ${produit.nom} » ne l'est pas.` });
      }
      if (!produit.format_id && !format_id) {
        return res.status(400).json({ error: `Le conditionnement donne un produit en flacon (10 ml, 30 ml, 100 ml, 1 L…) : « ${produit.nom} » n'a pas de format.` });
      }
      const qty_ = positif(qty, 'La quantité conditionnée');
      entierSiUnite(qty_, produit.unite, 'La quantité conditionnée');

      let quantiteSourceTotale = 0;
      const clesSources = new Set();
      for (const s of sources) {
        const types = [s.lot_presse_id, s.lot_filtration_id, s.lot_id].filter(Boolean);
        if (types.length !== 1) {
          return res.status(400).json({ error: 'Chaque source doit avoir exactement un type (lot_presse_id, lot_filtration_id ou lot_id).' });
        }
        if (!s.quantite_utilisee) return res.status(400).json({ error: 'quantite_utilisee est requis pour chaque source.' });
        positif(s.quantite_utilisee, 'La quantité utilisée de chaque source');

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
        // La source doit être l'huile de CE produit, en vrac ou filtrée (pas de flacon de sésame
        // rempli de nigelle) ; en mélange, plusieurs huiles différentes sont attendues.
        const src = await lotDeSource(pool, s);
        if (!src) return res.status(400).json({ error: 'Lot source introuvable.' });
        clesSources.add(cleHuile(src.nom) || `#${src.produit_id}`);
        const memeHuile = src.produit_id === produit.produit_source_id || (produit.produit_source_id && src.produit_source_id === produit.produit_source_id)
          || (!!cleHuile(src.nom) && cleHuile(src.nom) === cleHuile(produit.nom));
        if (!melange && (produit.produit_source_id || cleHuile(produit.nom)) && !memeHuile) {
          return res.status(400).json({ error: `« ${produit.nom} » se conditionne à partir de « ${produit.vrac_nom || 'la même huile'} » (ou de sa version filtrée) : le lot ${src.numero_lot} est « ${src.nom} ».` });
        }
        if (Number(quantiteDisponible) < Number(s.quantite_utilisee)) {
          return res.status(409).json({ error: `Stock insuffisant sur cette source (disponible ${quantiteDisponible}, demandé ${s.quantite_utilisee}).` });
        }
        quantiteSourceTotale += Number(s.quantite_utilisee);
      }

      if (melange && clesSources.size < 2) {
        return res.status(400).json({ error: 'Un mélange demande au moins deux huiles différentes en source (ex. sésame et nigelle).' });
      }

      // Bilan : le contenu conditionné (nombre × format) ne peut pas dépasser le vrac utilisé.
      const facteur = facteurConversion(produit.format_unite, produit.vrac_unite);
      if (produit.format_volume && facteur) {
        const contenu = arrondi(qty_ * Number(produit.format_volume) * facteur);
        if (contenu > arrondi(quantiteSourceTotale)) {
          return res.status(400).json({ error: `Bilan impossible : ${qty_} × ${Number(produit.format_volume)} ${produit.format_symbole} = ${contenu} ${produit.vrac_symbole}, plus que le vrac utilisé (${arrondi(quantiteSourceTotale)} ${produit.vrac_symbole}).` });
        }
      }

      // Vérification tout-ou-rien des consommables AVANT toute écriture,
      // même principe que les ordres de production.
      const consommablesResolus = [];
      for (const c of (consommables || [])) {
        if (!c.produit_id || !c.quantite) continue;
        positif(c.quantite, 'La quantité de chaque consommable');
        const lotRes = await pool.query(
          `SELECT id, quantite_actuelle FROM lots
           WHERE produit_id = $1 AND ${LOT_DISPONIBLE} AND quantite_actuelle >= $2
           ORDER BY ${ORDRE_FEFO} LIMIT 1`,
          [c.produit_id, c.quantite]
        );
        const lot = lotRes.rows[0];
        if (!lot) {
          const prodRes = await pool.query('SELECT nom FROM produits WHERE id = $1', [c.produit_id]);
          const stockRes = await pool.query(
            `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND ${LOT_DISPONIBLE}`,
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
  }));

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
