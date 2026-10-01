const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  // Meilleures ventes par produit — agrégé côté serveur (évite de charger
  // toutes les lignes de toutes les commandes côté client pour un simple classement).
  router.get('/top-produits', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const jours = req.query.jours ? Number(req.query.jours) : null;
    const filtreDate = jours ? `AND c.date_iso >= DATE_SUB(NOW(), INTERVAL ${jours} DAY)` : '';
    const result = await pool.query(`
      SELECT p.id AS produit_id, p.nom AS produit_nom, p.code AS produit_code,
        SUM(cl.qty) AS quantite_totale, COUNT(DISTINCT cl.commande_id) AS nb_commandes,
        SUM(cl.qty * cl.unit_price) AS ca_total
      FROM commande_lignes cl
      JOIN commandes c ON c.id = cl.commande_id
      JOIN produits p ON p.id = cl.produit_id
      WHERE c.statut != 'annulee' ${filtreDate}
      GROUP BY p.id, p.nom, p.code
      ORDER BY quantite_totale DESC
      LIMIT ${limit}
    `);
    res.json(result.rows);
  });

  // Meilleurs clients — même logique, agrégée côté serveur.
  router.get('/top-clients', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await pool.query(`
      SELECT cl.id AS client_id, cl.nom AS client_nom,
        COUNT(c.id) AS nb_commandes, SUM(c.total) AS total
      FROM commandes c
      JOIN clients cl ON cl.id = c.client_id
      WHERE c.statut != 'annulee'
      GROUP BY cl.id, cl.nom
      ORDER BY total DESC
      LIMIT ${limit}
    `);
    res.json(result.rows);
  });

  // Alerte marge faible — produits dont le prix de vente est trop proche
  // (ou inférieur) au coût standard connu.
  router.get('/marge-faible', async (req, res) => {
    const seuilPct = req.query.seuil ? Number(req.query.seuil) : 15; // marge minimale acceptable, en %
    const result = await pool.query(`
      SELECT id, nom, code, prix_vente, cout_standard,
        ROUND((prix_vente - cout_standard) / prix_vente * 100, 1) AS marge_pct
      FROM produits
      WHERE vendable = TRUE AND prix_vente IS NOT NULL AND cout_standard IS NOT NULL
        AND prix_vente > 0
        AND (prix_vente - cout_standard) / prix_vente * 100 < ${seuilPct}
      ORDER BY marge_pct ASC
    `);
    res.json(result.rows);
  });

  // Chiffre d'affaires filtrable — par période, client et/ou produit,
  // combinables. Basé sur les lignes de commande (unit_price déjà remisé).
  router.get('/chiffre-affaires', async (req, res) => {
    const { date_debut, date_fin, client_id, produit_id } = req.query;
    const conditions = [`c.statut != 'annulee'`];
    const params = [];
    let i = 1;
    if (date_debut) { conditions.push(`c.date_iso >= $${i++}`); params.push(date_debut); }
    if (date_fin) { conditions.push(`c.date_iso <= $${i++}`); params.push(`${date_fin} 23:59:59`); }
    if (client_id) { conditions.push(`c.client_id = $${i++}`); params.push(Number(client_id)); }
    if (produit_id) { conditions.push(`cl.produit_id = $${i++}`); params.push(Number(produit_id)); }

    const result = await pool.query(`
      SELECT COALESCE(SUM(cl.qty * cl.unit_price), 0) AS chiffre_affaires,
        COUNT(DISTINCT cl.commande_id) AS nb_commandes,
        COALESCE(SUM(cl.qty), 0) AS quantite_totale
      FROM commande_lignes cl
      JOIN commandes c ON c.id = cl.commande_id
      WHERE ${conditions.join(' AND ')}
    `, params);
    res.json(result.rows[0]);
  });


  // Détail des ventes correspondant aux mêmes filtres que /chiffre-affaires —
  // une ligne par commande, avec la facture liée si elle existe (raccourci
  // direct possible côté frontend).
  router.get('/chiffre-affaires-detail', async (req, res) => {
    const { date_debut, date_fin, client_id, produit_id } = req.query;
    const conditions = [`c.statut != 'annulee'`];
    const params = [];
    let i = 1;
    if (date_debut) { conditions.push(`c.date_iso >= $${i++}`); params.push(date_debut); }
    if (date_fin) { conditions.push(`c.date_iso <= $${i++}`); params.push(`${date_fin} 23:59:59`); }
    if (client_id) { conditions.push(`c.client_id = $${i++}`); params.push(Number(client_id)); }
    if (produit_id) { conditions.push(`cl.produit_id = $${i++}`); params.push(Number(produit_id)); }

    const result = await pool.query(`
      SELECT c.id AS commande_id, c.numero AS commande_numero, c.date_iso,
        cli.nom AS client_nom, SUM(cl.qty * cl.unit_price) AS montant,
        f.id AS facture_id, f.numero AS facture_numero, f.statut AS facture_statut
      FROM commande_lignes cl
      JOIN commandes c ON c.id = cl.commande_id
      JOIN clients cli ON cli.id = c.client_id
      LEFT JOIN factures f ON f.commande_id = c.id AND f.statut != 'annulee'
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, c.numero, c.date_iso, cli.nom, f.id, f.numero, f.statut
      ORDER BY c.date_iso DESC
      LIMIT 200
    `, params);
    res.json(result.rows);
  });

  return router;
};
