const express = require('express');
const { nextLotNumber, nextNumero, recordEntree } = require('../services/lotService');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const { produit_id, origine, statut } = req.query;
    const clauses = [];
    const params = [];
    if (produit_id) { params.push(produit_id); clauses.push(`l.produit_id = $${params.length}`); }
    if (origine) { params.push(origine); clauses.push(`l.origine = $${params.length}`); }
    if (statut) { params.push(statut); clauses.push(`l.statut = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT l.*, p.nom AS produit_nom, p.code AS produit_code, u.symbole AS unite_symbole,
          f.nom AS fournisseur_nom, e.nom AS employe_nom, e.prenom AS employe_prenom
       FROM lots l
       LEFT JOIN produits p ON p.id = l.produit_id
       LEFT JOIN unites u ON u.id = p.unite_id
       LEFT JOIN fournisseurs f ON f.id = l.fournisseur_id
       LEFT JOIN employes e ON e.id = l.employe_id
       ${where}
       ORDER BY l.created_at DESC`,
      params
    );
    res.json(result.rows);
  });

  router.get('/:numero', async (req, res) => {
    const result = await pool.query(
      `SELECT l.*, p.nom AS produit_nom, p.code AS produit_code
       FROM lots l LEFT JOIN produits p ON p.id = l.produit_id
       WHERE l.numero_lot = $1`,
      [req.params.numero]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lot introuvable.' });
    res.json(result.rows[0]);
  });

  // Traçabilité : ascendants (d'où vient ce lot) et descendants (où il a été utilisé),
  // sur un seul niveau — même logique que l'écran Traçabilité de l'interface.
  router.get('/:numero/tracabilite', async (req, res) => {
    const lotRes = await pool.query(
      `SELECT l.*, p.nom AS produit_nom FROM lots l LEFT JOIN produits p ON p.id = l.produit_id
       WHERE l.numero_lot = $1`,
      [req.params.numero]
    );
    const lot = lotRes.rows[0];
    if (!lot) return res.status(404).json({ error: 'Lot introuvable.' });

    // Pour chaque lot de la chaîne : origine (= opération d'où il vient),
    // date, quantité utilisée dans CE lien précis (lot_origines), et quantité
    // produite au total par ce lot (quantite_initiale, indépendant du lien).
    const ascendants = await pool.query(
      `SELECT ls.numero_lot, ps.nom AS produit, ls.origine, ls.origine AS type,
              COALESCE(ls.date_production, ls.created_at) AS date,
              lo.quantite_utilisee AS quantite, lo.quantite_utilisee AS qte_utilisee,
              ls.quantite_initiale AS qte_produite
       FROM lot_origines lo
       JOIN lots ls ON ls.id = lo.lot_source_id
       LEFT JOIN produits ps ON ps.id = ls.produit_id
       WHERE lo.lot_fils_id = $1`,
      [lot.id]
    );
    const descendants = await pool.query(
      `SELECT lf.numero_lot, pf.nom AS produit, lf.origine, lf.origine AS type,
              COALESCE(lf.date_production, lf.created_at) AS date,
              lo.quantite_utilisee AS quantite, lo.quantite_utilisee AS qte_utilisee,
              lf.quantite_initiale AS qte_produite
       FROM lot_origines lo
       JOIN lots lf ON lf.id = lo.lot_fils_id
       LEFT JOIN produits pf ON pf.id = lf.produit_id
       WHERE lo.lot_source_id = $1`,
      [lot.id]
    );
    res.json({ lot, ascendants: ascendants.rows, descendants: descendants.rows });
  });

  // Répartition : tous les mouvements de stock de ce lot précis — d'où il
  // vient (entrées) et où il est parti (sorties : vente, consommation en
  // production, perte...). Vue complémentaire à la traçabilité amont/aval.
  router.get('/:numero/mouvements', async (req, res) => {
    const lotRes = await pool.query('SELECT id FROM lots WHERE numero_lot = $1', [req.params.numero]);
    if (!lotRes.rows[0]) return res.status(404).json({ error: 'Lot introuvable.' });
    const result = await pool.query(
      `SELECT m.*, e.nom AS employe_nom, e.prenom AS employe_prenom
       FROM stock_mouvements m LEFT JOIN employes e ON e.id = m.employe_id
       WHERE m.lot_id = $1 ORDER BY m.date_mouvement`,
      [lotRes.rows[0].id]
    );
    res.json(result.rows);
  });

  router.get('/:numero/historique-statuts', async (req, res) => {
    const lotRes = await pool.query('SELECT id FROM lots WHERE numero_lot = $1', [req.params.numero]);
    if (!lotRes.rows[0]) return res.status(404).json({ error: 'Lot introuvable.' });
    const result = await pool.query(
      `SELECT h.*, e.nom AS employe_nom, e.prenom AS employe_prenom
       FROM lot_statuts_historique h LEFT JOIN employes e ON e.id = h.employe_id
       WHERE h.lot_id = $1 ORDER BY h.date_debut`,
      [lotRes.rows[0].id]
    );
    res.json(result.rows);
  });

  router.post('/', async (req, res, next) => {
    try {
      const {
        produit_id, origine, fournisseur_id, lot_fournisseur, certificat_bio_id, bio_status,
        local_id, zone_id, date_production, date_expiration,
        quantite_initiale, notes, employe_id, sources, // sources: [{lot_source_id, quantite_utilisee}]
      } = req.body;
      if (!produit_id || !origine) {
        return res.status(400).json({ error: 'produit_id et origine sont requis.' });
      }
      const numeroLot = await nextLotNumber(pool, produit_id, origine);
      const insertRes = await pool.query(
        `INSERT INTO lots
          (produit_id, numero_lot, origine, fournisseur_id, lot_fournisseur, certificat_bio_id, bio_status,
           local_id, zone_id, date_production, date_expiration, quantite_initiale, quantite_actuelle,
           notes, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14)`,
        [
          produit_id, numeroLot, origine, fournisseur_id || null, lot_fournisseur || null,
          certificat_bio_id || null, bio_status || 'A_VERIFIER', local_id || null, zone_id || null,
          date_production || null, date_expiration || null, quantite_initiale || 0, notes || null,
          employe_id || null,
        ]
      );
      const newLotId = insertRes.insertId;

      // Traçabilité ascendante : sources déclarées à la création (ex: lot de presse
      // consommant un lot de réception matière première).
      if (Array.isArray(sources)) {
        for (const s of sources) {
          if (!s.lot_source_id) continue;
          await pool.query(
            `INSERT INTO lot_origines (lot_fils_id, lot_source_id, quantite_utilisee) VALUES ($1,$2,$3)`,
            [newLotId, s.lot_source_id, s.quantite_utilisee || null]
          );
        }
      }
      // Premier enregistrement dans l'historique des statuts.
      await pool.query(
        `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'LIBERE','Création du lot',$2)`,
        [newLotId, employe_id || null]
      );
      // Mouvement de stock correspondant — sans ça, un lot créé ici manquerait
      // à l'appel dans l'écran Mouvements, contrairement à tous les autres
      // flux (réception, presse, filtration, conditionnement).
      if (Number(quantite_initiale) > 0) {
        const numeroMouvement = await nextNumero(pool, 'mouvement_seq', 'MVT');
        await recordEntree(pool, {
          produitId: produit_id, lotId: newLotId, quantite: quantite_initiale,
          typeMouvement: origine === 'INVENTAIRE' ? 'INVENTAIRE' : 'AJUSTEMENT',
          employeId: employe_id, numeroMouvement, groupId: null, sourceType: 'lot_manuel', sourceId: newLotId,
        });
      }

      const result = await pool.query('SELECT * FROM lots WHERE id = $1', [newLotId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // Changement de statut — trace obligatoirement le motif dans l'historique
  // (voir BD Gestion Commerciale V3 : lots.statut = valeur courante seule,
  // lot_statuts_historique = source de vérité du pourquoi/quand/qui).
  router.post('/:id/statut', async (req, res) => {
    const { statut, motif, employe_id } = req.body;
    if (!statut) return res.status(400).json({ error: 'statut est requis.' });
    const lotRes = await pool.query('SELECT id FROM lots WHERE id = $1', [req.params.id]);
    if (!lotRes.rows[0]) return res.status(404).json({ error: 'Lot introuvable.' });

    await pool.query('UPDATE lots SET statut = $1 WHERE id = $2', [statut, req.params.id]);
    await pool.query(
      `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,$2,$3,$4)`,
      [req.params.id, statut, motif || null, employe_id || null]
    );
    const result = await pool.query('SELECT * FROM lots WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  return router;
};
