const { enTransaction } = require('../db/transaction');
const express = require('express');
const { nextNumero, recordEntree, nextLotNumber } = require('../services/lotService');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT r.*, f.nom AS fournisseur_nom, lo.nom AS local_nom, e.nom AS employe_nom,
        COALESCE(rl.nb, 0) AS nb_lignes
      FROM receptions r
      LEFT JOIN fournisseurs f ON f.id = r.fournisseur_id
      LEFT JOIN locaux lo ON lo.id = r.local_id
      LEFT JOIN employes e ON e.id = r.employe_id
      LEFT JOIN (SELECT reception_id, COUNT(*) AS nb FROM reception_lignes GROUP BY reception_id) rl ON rl.reception_id = r.id
      ORDER BY r.date_reception DESC, r.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const recRes = await pool.query(
      `SELECT r.*, f.nom AS fournisseur_nom, lo.nom AS local_nom FROM receptions r
       LEFT JOIN fournisseurs f ON f.id = r.fournisseur_id
       LEFT JOIN locaux lo ON lo.id = r.local_id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!recRes.rows[0]) return res.status(404).json({ error: 'Réception introuvable.' });
    const lignesRes = await pool.query(
      `SELECT rl.*, p.nom AS produit_nom, l.numero_lot
       FROM reception_lignes rl
       LEFT JOIN produits p ON p.id = rl.produit_id
       LEFT JOIN lots l ON l.id = rl.lot_id
       WHERE rl.reception_id = $1`,
      [req.params.id]
    );
    res.json({ ...recRes.rows[0], lignes: lignesRes.rows });
  });

  // Crée la réception ET, pour chaque ligne, le lot correspondant automatiquement —
  // c'est le point d'entrée réel de la matière dans le système de traçabilité.
  // Origine calculée PAR LIGNE (pas globalement) : 'ACHAT' si rattaché à un bon
  // d'achat OU si le produit n'est pas une matière première (un emballage/
  // consommable reçu directement reste un achat, même sans bon formel) ;
  // 'RECEPTION_MP' seulement pour une vraie matière première sans bon d'achat
  // (cueillette/apport direct d'une parcelle).
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { fournisseur_id, achat_id, date_reception, local_id, statut, notes, employe_id, lignes } = req.body;
      if (!fournisseur_id || !date_reception || !local_id) {
        return res.status(400).json({ error: 'fournisseur_id, date_reception et local_id sont requis.' });
      }
      if (!Array.isArray(lignes) || !lignes.length) {
        return res.status(400).json({ error: 'Au moins une ligne est requise.' });
      }
      const numero = await nextNumero(pool, 'reception_seq', 'REC');

      const recRes = await pool.query(
        `INSERT INTO receptions (numero, fournisseur_id, achat_id, date_reception, local_id, statut, notes, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [numero, fournisseur_id, achat_id || null, date_reception, local_id, statut || 'receptionnee', notes || null, employe_id || null]
      );
      const receptionId = recRes.insertId;

      const lignesCreees = [];
      for (const l of lignes) {
        if (!l.produit_id || !l.quantite) {
          return res.status(400).json({ error: 'Chaque ligne nécessite produit_id et quantite.' });
        }
        const produitRes = await pool.query('SELECT type_article FROM produits WHERE id = $1', [l.produit_id]);
        if (!produitRes.rows[0]) {
          return res.status(400).json({ error: `Produit ${l.produit_id} introuvable.` });
        }
        const origineLigne = (achat_id || produitRes.rows[0].type_article !== 'MATIERE_PREMIERE') ? 'ACHAT' : 'RECEPTION_MP';
        const numeroLot = await nextLotNumber(pool, l.produit_id, origineLigne);
        const lotRes = await pool.query(
          `INSERT INTO lots
            (produit_id, numero_lot, origine, fournisseur_id, lot_fournisseur, certificat_bio_id, bio_status,
             local_id, zone_id, date_expiration, quantite_initiale, quantite_actuelle, employe_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12)`,
          [
            l.produit_id, numeroLot, origineLigne, fournisseur_id, l.lot_fournisseur || null,
            l.certificat_bio_id || null, l.certificat_bio_id ? 'BIO' : 'A_VERIFIER',
            local_id, l.zone_id || null, l.date_expiration || null, l.quantite, employe_id || null,
          ]
        );
        const lotId = lotRes.insertId;
        await pool.query(
          `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'LIBERE','Création via réception',$2)`,
          [lotId, employe_id || null]
        );
        await pool.query(
          `INSERT INTO reception_lignes (reception_id, produit_id, lot_id, quantite, lot_fournisseur, date_expiration, certificat_bio_id, zone_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [receptionId, l.produit_id, lotId, l.quantite, l.lot_fournisseur || null, l.date_expiration || null, l.certificat_bio_id || null, l.zone_id || null]
        );
        // Si la réception est rattachée à un achat, on relie aussi la ligne d'achat au lot créé.
        if (achat_id) {
          await pool.query(
            `UPDATE achat_lignes SET lot_id = $1 WHERE achat_id = $2 AND produit_id = $3 AND lot_id IS NULL LIMIT 1`,
            [lotId, achat_id, l.produit_id]
          );
        }
        const numMvt = await nextNumero(pool, 'mouvement_seq', 'MVT');
        await recordEntree(pool, {
          produitId: l.produit_id, lotId, quantite: l.quantite,
          typeMouvement: achat_id ? 'ACHAT' : 'RECEPTION',
          employeId: employe_id, numeroMouvement: numMvt, groupId: null,
          sourceType: 'reception', sourceId: receptionId,
        });
        lignesCreees.push({ produit_id: l.produit_id, numero_lot: numeroLot, lot_id: lotId, quantite: l.quantite });
      }

      if (achat_id) {
        await pool.query(`UPDATE achats SET statut = 'receptionne' WHERE id = $1`, [achat_id]);
      }

      const result = await pool.query('SELECT * FROM receptions WHERE id = $1', [receptionId]);
      res.status(201).json({ ...result.rows[0], lignes: lignesCreees });
    } catch (err) { next(err); }
  }));

  return router;
};
