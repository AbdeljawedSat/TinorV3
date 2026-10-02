const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  // Liste, avec stock calculé depuis les lots (vw_stock_actuel) et infos de base.
  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT p.*, c.nom AS categorie_nom, u.symbole AS unite_symbole, f.nom AS format_nom,
        COALESCE(s.stock, 0) AS stock_actuel
      FROM produits p
      LEFT JOIN categories c ON c.id = p.categorie_id
      LEFT JOIN unites u ON u.id = p.unite_id
      LEFT JOIN formats f ON f.id = p.format_id
      LEFT JOIN (
        SELECT produit_id, SUM(quantite_actuelle) AS stock
        FROM lots WHERE quantite_actuelle > 0 GROUP BY produit_id
      ) s ON s.produit_id = p.id
      ORDER BY p.code
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const result = await pool.query('SELECT * FROM produits WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Produit introuvable.' });
    res.json(result.rows[0]);
  });

  // Génère le prochain code produit à 2 chiffres (protocole TT conservé de la V2).
  async function nextProductCode(pool) {
    const seq = await pool.query(
      `UPDATE sequences SET \`last_value\` = \`last_value\` + 1 WHERE name = 'produit_code_seq'`
    );
    if (!seq.affectedRows) {
      await pool.query(`INSERT INTO sequences (name, \`last_value\`) VALUES ('produit_code_seq', 1)`);
    }
    const cur = await pool.query(`SELECT \`last_value\` FROM sequences WHERE name = 'produit_code_seq'`);
    return String(cur.rows[0].last_value).padStart(2, '0');
  }

  router.post('/', async (req, res) => {
    const {
      nom, description, barcode, categorie_id, unite_id, format_id, type_article,
      produit_source_id, vendable, achetable, fabriquable, stockable, actif,
      bio_eligible, prix_vente, cout_standard, stock_min, tva, notes,
    } = req.body;
    if (!nom || !categorie_id || !unite_id || !type_article) {
      return res.status(400).json({ error: 'nom, categorie_id, unite_id et type_article sont requis.' });
    }
    const code = await nextProductCode(pool);
    const insertRes = await pool.query(
      `INSERT INTO produits
        (code, nom, description, barcode, categorie_id, unite_id, format_id, type_article, produit_source_id,
         vendable, achetable, fabriquable, stockable, actif, bio_eligible, prix_vente, cout_standard, stock_min, tva, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        code, nom, description || null, barcode || null, categorie_id, unite_id, format_id || null, type_article,
        produit_source_id || null, !!vendable, !!achetable, !!fabriquable, stockable !== false, actif !== false,
        !!bio_eligible, prix_vente ?? null, cout_standard ?? null, stock_min ?? null, tva ?? 19, notes || null,
      ]
    );
    // Un produit fabriqué/vendu a besoin d'une séquence de lot dédiée (protocole TT-SSS).
    await pool.query(
      `INSERT INTO lot_sequences (produit_id, last_seq) VALUES ($1, 0)`,
      [insertRes.insertId]
    );
    const result = await pool.query('SELECT * FROM produits WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const {
      nom, description, barcode, categorie_id, unite_id, format_id, type_article,
      produit_source_id, vendable, achetable, fabriquable, stockable, actif,
      bio_eligible, prix_vente, cout_standard, stock_min, tva, notes,
    } = req.body;
    const updateRes = await pool.query(
      `UPDATE produits SET
        nom=$1, description=$2, barcode=$3, categorie_id=$4, unite_id=$5, format_id=$6, type_article=$7,
        produit_source_id=$8, vendable=$9, achetable=$10, fabriquable=$11, stockable=$12, actif=$13,
        bio_eligible=$14, prix_vente=$15, cout_standard=$16, stock_min=$17, tva=$18, notes=$19
       WHERE id=$20`,
      [
        nom, description || null, barcode || null, categorie_id, unite_id, format_id || null, type_article,
        produit_source_id || null, !!vendable, !!achetable, !!fabriquable, stockable !== false, actif !== false,
        !!bio_eligible, prix_vente ?? null, cout_standard ?? null, stock_min ?? null, tva ?? 19, notes || null, req.params.id,
      ]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Produit introuvable.' });
    const result = await pool.query('SELECT * FROM produits WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    const lotsRes = await pool.query('SELECT COUNT(*) AS n FROM lots WHERE produit_id = $1', [req.params.id]);
    if (lotsRes.rows[0].n > 0) {
      return res.status(409).json({ error: 'Impossible de supprimer un produit ayant des lots enregistrés — désactivez-le plutôt (actif=false).' });
    }
    await pool.query('DELETE FROM produits WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
