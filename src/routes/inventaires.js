const express = require('express');
const { nextNumero } = require('../services/lotService');

// Inventaire physique : photo du stock théorique d'un local à l'ouverture,
// saisie des quantités comptées, puis clôture qui ajuste chaque lot en écart
// (mouvement de stock de type INVENTAIRE) — même principe qu'Odoo/Dolibarr.
module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(
      `SELECT i.*, lc.nom AS local_nom, e.nom AS employe_nom, e.prenom AS employe_prenom,
          (SELECT COUNT(*) FROM inventaire_lignes il WHERE il.inventaire_id = i.id) AS nb_lignes,
          (SELECT COUNT(*) FROM inventaire_lignes il WHERE il.inventaire_id = i.id AND il.ecart <> 0) AS nb_ecarts
       FROM inventaires i
       LEFT JOIN locaux lc ON lc.id = i.local_id
       LEFT JOIN employes e ON e.id = i.employe_id
       ORDER BY i.date DESC, i.id DESC`
    );
    res.json(result.rows);
  });

  async function chargerInventaire(id) {
    const inv = await pool.query(
      `SELECT i.*, lc.nom AS local_nom FROM inventaires i LEFT JOIN locaux lc ON lc.id = i.local_id WHERE i.id = $1`,
      [id]
    );
    if (!inv.rows[0]) return null;
    const lignes = await pool.query(
      `SELECT il.*, p.nom AS produit_nom, l.numero_lot, l.date_expiration, u.symbole AS unite_symbole
       FROM inventaire_lignes il
       LEFT JOIN produits p ON p.id = il.produit_id
       LEFT JOIN lots l ON l.id = il.lot_id
       LEFT JOIN unites u ON u.id = p.unite_id
       WHERE il.inventaire_id = $1
       ORDER BY p.nom, l.numero_lot`,
      [id]
    );
    return { ...inv.rows[0], lignes: lignes.rows };
  }

  router.get('/:id', async (req, res) => {
    const inv = await chargerInventaire(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable.' });
    res.json(inv);
  });

  // Ouverture : une ligne par lot en stock du local (quantité comptée pré-remplie
  // avec la quantité théorique, à corriger pendant le comptage).
  router.post('/', async (req, res) => {
    const { local_id, notes, employe_id, inclure_sans_local = true } = req.body;
    if (!local_id) return res.status(400).json({ error: 'local_id est requis.' });
    const enCours = await pool.query(
      `SELECT numero FROM inventaires WHERE local_id = $1 AND statut = 'en_cours'`, [local_id]
    );
    if (enCours.rows[0]) {
      return res.status(409).json({ error: `L'inventaire ${enCours.rows[0].numero} est déjà en cours pour ce local.` });
    }
    const lots = await pool.query(
      `SELECT id, produit_id, quantite_actuelle FROM lots
       WHERE quantite_actuelle > 0 AND statut NOT IN ('EPUISE','CLOTURE','REJETE')
         AND (local_id = $1 ${inclure_sans_local ? 'OR local_id IS NULL' : ''})`,
      [local_id]
    );
    if (!lots.rows.length) return res.status(400).json({ error: 'Aucun lot en stock à inventorier pour ce local.' });

    const numero = await nextNumero(pool, 'inventaire_seq', 'INV');
    const ins = await pool.query(
      `INSERT INTO inventaires (numero, date, local_id, statut, notes, employe_id) VALUES ($1, CURDATE(), $2, 'en_cours', $3, $4)`,
      [numero, local_id, notes || null, employe_id || null]
    );
    for (const l of lots.rows) {
      await pool.query(
        `INSERT INTO inventaire_lignes (inventaire_id, produit_id, lot_id, quantite_theorique, quantite_physique, ecart)
         VALUES ($1,$2,$3,$4,$4,0)`,
        [ins.insertId, l.produit_id, l.id, l.quantite_actuelle]
      );
    }
    res.status(201).json(await chargerInventaire(ins.insertId));
  });

  // Saisie du comptage : [{ id, quantite_physique }]
  router.put('/:id/lignes', async (req, res) => {
    const inv = await pool.query('SELECT statut FROM inventaires WHERE id = $1', [req.params.id]);
    if (!inv.rows[0]) return res.status(404).json({ error: 'Inventaire introuvable.' });
    if (inv.rows[0].statut !== 'en_cours') return res.status(409).json({ error: 'Inventaire déjà clôturé.' });
    const { lignes } = req.body;
    if (!Array.isArray(lignes)) return res.status(400).json({ error: 'lignes est requis.' });
    for (const l of lignes) {
      const q = Number(l.quantite_physique);
      if (!Number.isFinite(q) || q < 0) return res.status(400).json({ error: 'Quantité comptée invalide.' });
      await pool.query(
        `UPDATE inventaire_lignes SET quantite_physique = $1, ecart = $1 - quantite_theorique
         WHERE id = $2 AND inventaire_id = $3`,
        [q, l.id, req.params.id]
      );
    }
    res.json(await chargerInventaire(req.params.id));
  });

  // Clôture : chaque écart est appliqué au lot (quantité actuelle + écart, pour
  // ne pas écraser une vente faite pendant le comptage) et tracé par un mouvement
  // INVENTAIRE. Le tout dans une transaction.
  router.post('/:id/cloturer', async (req, res) => {
    const { employe_id } = req.body || {};
    const conn = await pool.connect();
    try {
      await conn.query('START TRANSACTION');
      const inv = await conn.query('SELECT * FROM inventaires WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!inv.rows[0]) { await conn.query('ROLLBACK'); return res.status(404).json({ error: 'Inventaire introuvable.' }); }
      if (inv.rows[0].statut !== 'en_cours') { await conn.query('ROLLBACK'); return res.status(409).json({ error: 'Inventaire déjà clôturé.' }); }

      const lignes = await conn.query(
        `SELECT il.*, l.quantite_actuelle, l.statut AS lot_statut FROM inventaire_lignes il
         JOIN lots l ON l.id = il.lot_id WHERE il.inventaire_id = $1 AND il.ecart <> 0`,
        [req.params.id]
      );
      for (const l of lignes.rows) {
        const avant = Number(l.quantite_actuelle);
        const nouvelle = Math.max(0, avant + Number(l.ecart));
        // Le mouvement enregistre la variation RÉELLEMENT appliquée au lot (et non
        // l'écart de comptage brut) : si le lot a bougé pendant le comptage et que
        // le résultat est ramené à zéro, les deux restent cohérents.
        const variation = Math.round((nouvelle - avant) * 1000) / 1000;
        if (!variation) continue;
        await conn.query('UPDATE lots SET quantite_actuelle = $1 WHERE id = $2', [nouvelle, l.lot_id]);
        const numeroMvt = await nextNumero(conn, 'mouvement_seq', 'MVT');
        const mvt = await conn.query(
          `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, local_id, quantite, source_type, source_id, note, employe_id)
           VALUES ($1,'INVENTAIRE',$2,$3,$4,$5,$6,'inventaire',$7,$8,$9)`,
          [numeroMvt, variation > 0 ? 'ENTREE' : 'SORTIE', l.produit_id, l.lot_id, inv.rows[0].local_id, Math.abs(variation),
           req.params.id, `Inventaire ${inv.rows[0].numero}`, employe_id || null]
        );
        await conn.query('UPDATE inventaire_lignes SET mouvement_ajustement_id = $1 WHERE id = $2', [mvt.insertId, l.id]);
        if (nouvelle === 0 && l.lot_statut !== 'EPUISE') {
          await conn.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1`, [l.lot_id]);
          await conn.query(
            `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'EPUISE',$2,$3)`,
            [l.lot_id, `Inventaire ${inv.rows[0].numero} : quantité comptée nulle`, employe_id || null]
          );
        }
      }
      await conn.query(`UPDATE inventaires SET statut = 'cloture' WHERE id = $1`, [req.params.id]);
      await conn.query('COMMIT');
    } catch (err) {
      await conn.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
    res.json(await chargerInventaire(req.params.id));
  });

  // Abandon d'un inventaire non clôturé (aucun stock n'a encore été modifié).
  router.delete('/:id', async (req, res) => {
    const inv = await pool.query('SELECT statut FROM inventaires WHERE id = $1', [req.params.id]);
    if (!inv.rows[0]) return res.status(404).json({ error: 'Inventaire introuvable.' });
    if (inv.rows[0].statut !== 'en_cours') return res.status(409).json({ error: 'Un inventaire clôturé ne peut pas être supprimé.' });
    await pool.query('DELETE FROM inventaires WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
