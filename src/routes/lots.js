const { enTransaction } = require('../db/transaction');
const express = require('express');
const { positifOuZero, datesOrdonnees } = require('../services/regles');
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
  // sur tous les niveaux de la chaîne (graines → presse → filtration → conditionnement).
  router.get('/:numero/tracabilite', async (req, res) => {
    const lotRes = await pool.query(
      `SELECT l.*, p.nom AS produit_nom FROM lots l LEFT JOIN produits p ON p.id = l.produit_id
       WHERE l.numero_lot = $1`,
      [req.params.numero]
    );
    const lot = lotRes.rows[0];
    if (!lot) return res.status(404).json({ error: 'Lot introuvable.' });

    // Toute la chaîne, sur tous les niveaux : un lot filtré remonte à son lot de
    // presse, puis aux lots de graines (MP) pressés ; dans l'autre sens, jusqu'aux
    // produits conditionnés. Pour chaque lien : origine, date, quantité utilisée
    // dans CE lien (lot_origines), quantité produite au total (quantite_initiale),
    // niveau (1 = lien direct) et lot voisin dans la chaîne (« utilisé dans » /
    // « issu de »). Un lot atteint par plusieurs chemins (mélange) n'apparaît
    // qu'une fois, au niveau le plus proche.
    async function parcourir(sens) {
      const [cle, autre] = sens === 'amont' ? ['lo.lot_fils_id', 'lo.lot_source_id'] : ['lo.lot_source_id', 'lo.lot_fils_id'];
      const vus = new Set([lot.id]);
      const resultat = [];
      let front = [lot.id];
      for (let niveau = 1; front.length && niveau <= 20; niveau++) {
        const marques = front.map((_, i) => `$${i + 1}`).join(', ');
        const r = await pool.query(
          `SELECT l.id, l.numero_lot, p.nom AS produit, l.origine, l.origine AS type,
                  COALESCE(l.date_production, l.created_at) AS date,
                  lo.quantite_utilisee AS quantite, lo.quantite_utilisee AS qte_utilisee,
                  l.quantite_initiale AS qte_produite, voisin.numero_lot AS lot_voisin
           FROM lot_origines lo
           JOIN lots l ON l.id = ${autre}
           JOIN lots voisin ON voisin.id = ${cle}
           LEFT JOIN produits p ON p.id = l.produit_id
           WHERE ${cle} IN (${marques})
           ORDER BY l.id`,
          front
        );
        const suivant = [];
        for (const row of r.rows) {
          if (vus.has(row.id)) continue;
          vus.add(row.id);
          suivant.push(row.id);
          const { id, ...ligne } = row;
          resultat.push({ ...ligne, niveau });
        }
        front = suivant;
      }
      return resultat;
    }
    const ascendants = { rows: await parcourir('amont') };
    const descendants = { rows: await parcourir('aval') };
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

  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const {
        produit_id, origine, fournisseur_id, lot_fournisseur, certificat_bio_id, bio_status,
        local_id, zone_id, date_production, date_expiration,
        quantite_initiale, notes, employe_id, sources, // sources: [{lot_source_id, quantite_utilisee}]
      } = req.body;
      if (!produit_id || !origine) {
        return res.status(400).json({ error: 'produit_id et origine sont requis.' });
      }
      positifOuZero(quantite_initiale, 'La quantité initiale du lot');
      datesOrdonnees(date_production, date_expiration, `Date d'expiration (${date_expiration}) antérieure à la date de production (${date_production}).`);
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
  }));

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
