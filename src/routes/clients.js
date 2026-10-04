const express = require('express');

// Par client : total des factures émises (hors annulées) et des paiements actifs.
const SOLDES_FACTURES = `
  SELECT f.client_id, SUM(f.total_ttc) - SUM(COALESCE(a.avoirs, 0)) AS facture, SUM(COALESCE(p.paye, 0)) AS paye
  FROM factures f
  LEFT JOIN (SELECT facture_id, SUM(montant) AS paye FROM paiements WHERE annule_le IS NULL GROUP BY facture_id) p ON p.facture_id = f.id
  LEFT JOIN (SELECT facture_id, SUM(total_ttc) AS avoirs FROM avoirs GROUP BY facture_id) a ON a.facture_id = f.id
  WHERE f.statut = 'emise'
  GROUP BY f.client_id`;

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT cl.*, r.nom AS remise_nom,
        COALESCE(o.nb, 0) AS commandes_count, COALESCE(o.total, 0) AS total_achete,
        COALESCE(f.facture, 0) AS total_facture, COALESCE(f.paye, 0) AS total_paye,
        COALESCE(f.facture, 0) - COALESCE(f.paye, 0) AS solde
      FROM clients cl
      LEFT JOIN remises r ON r.id = cl.remise_id
      LEFT JOIN (
        SELECT client_id, COUNT(*) AS nb, SUM(total) AS total FROM commandes WHERE statut <> 'annulee' GROUP BY client_id
      ) o ON o.client_id = cl.id
      LEFT JOIN (${SOLDES_FACTURES}) f ON f.client_id = cl.id
      ORDER BY cl.nom
    `);
    res.json(result.rows);
  });

  // Relevé de compte : factures émises (hors annulées) et paiements, avec le
  // solde après chaque opération.
  router.get('/:id/releve', async (req, res) => {
    const cl = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!cl.rows[0]) return res.status(404).json({ error: 'Client introuvable.' });
    const factures = await pool.query(
      `SELECT id, numero, date_emission AS date, total_ttc FROM factures WHERE client_id = $1 AND statut = 'emise'`, [req.params.id]);
    const paiements = await pool.query(
      `SELECT p.id, p.date_paiement AS date, p.montant, p.mode, p.reference, f.numero AS facture_numero
       FROM paiements p JOIN factures f ON f.id = p.facture_id
       WHERE f.client_id = $1 AND f.statut = 'emise' AND p.annule_le IS NULL`, [req.params.id]);
    const avoirs = await pool.query(
      `SELECT a.numero, a.date_emission AS date, a.total_ttc, f.numero AS facture_numero
       FROM avoirs a JOIN factures f ON f.id = a.facture_id WHERE f.client_id = $1 AND f.statut = 'emise'`, [req.params.id]);
    const iso = (d) => (d instanceof Date ? d.toISOString() : String(d || ''));
    const ops = [
      ...factures.rows.map(f => ({ date: iso(f.date), type: 'facture', libelle: `Facture ${f.numero}`, debit: Number(f.total_ttc), credit: 0 })),
      ...avoirs.rows.map(a => ({ date: iso(a.date), type: 'avoir', libelle: `Avoir ${a.numero} (sur ${a.facture_numero})`, debit: 0, credit: Number(a.total_ttc) })),
      ...paiements.rows.map(p => ({ date: iso(p.date), type: 'paiement', libelle: `Paiement ${p.facture_numero} (${p.mode}${p.reference ? ' ' + p.reference : ''})`, debit: 0, credit: Number(p.montant) })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'facture' ? -1 : 1));
    let solde = 0;
    for (const o of ops) { solde = Math.round((solde + o.debit - o.credit) * 1000) / 1000; o.solde = solde; }
    const totalFacture = ops.reduce((s, o) => s + o.debit, 0), totalPaye = ops.reduce((s, o) => s + o.credit, 0);
    res.json({ client: cl.rows[0], operations: ops, total_facture: totalFacture, total_paye: totalPaye, solde });
  });

  router.post('/', async (req, res) => {
    const { nom, tel, ville, matricule_fiscal, type, remise_id, notes } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom est requis.' });
    const insertRes = await pool.query(
      `INSERT INTO clients (nom, tel, ville, matricule_fiscal, type, remise_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nom, tel || null, ville || null, matricule_fiscal || null, type || 'particulier', remise_id || null, notes || null]
    );
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const { nom, tel, ville, matricule_fiscal, type, remise_id, notes } = req.body;
    const updateRes = await pool.query(
      `UPDATE clients SET nom=$1, tel=$2, ville=$3, matricule_fiscal=$4, type=$5, remise_id=$6, notes=$7 WHERE id=$8`,
      [nom, tel || null, ville || null, matricule_fiscal || null, type || 'particulier', remise_id || null, notes || null, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Client introuvable.' });
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
