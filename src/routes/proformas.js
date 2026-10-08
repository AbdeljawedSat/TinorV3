const express = require('express');
const { enTransaction } = require('../db/transaction');
const { nextNumero } = require('../services/lotService');
const { totauxDepuisLignes, lignesCommande, emettreFacture, ar } = require('../services/ventes');

// Factures en attente (pro forma PRO-…) : préparées, modifiables, imprimables
// « sans valeur comptable ». La validation émet la vraie facture (numéro légal).
module.exports = function (pool) {
  const router = express.Router();

  const charger = async (pool, id) => {
    const p = (await pool.query(
      `SELECT pf.*, c.numero AS commande_numero, cl.nom AS client_nom, cl.ville AS client_ville, cl.tel AS client_tel, cl.matricule_fiscal AS client_mf,
         f.numero AS facture_numero
       FROM proformas pf JOIN commandes c ON c.id = pf.commande_id LEFT JOIN clients cl ON cl.id = pf.client_id
       LEFT JOIN factures f ON f.id = pf.facture_id WHERE pf.id = $1`, [id])).rows[0];
    if (!p) return null;
    p.lignes = (await pool.query('SELECT * FROM proforma_lignes WHERE proforma_id = $1 ORDER BY id', [id])).rows;
    return p;
  };
  const recalculer = async (pool, id) => {
    const lignes = (await pool.query('SELECT * FROM proforma_lignes WHERE proforma_id = $1', [id])).rows;
    const pf = (await pool.query('SELECT tva_rate FROM proformas WHERE id = $1', [id])).rows[0];
    const t = await totauxDepuisLignes(pool, lignes.map(l => ({ unitPrice: l.unit_price, qty: l.qty })), pf.tva_rate);
    await pool.query(
      `UPDATE proformas SET total_ht = $1, fodec_montant = $2, montant_tva = $3, droit_timbre = $4, total_ttc = $5 WHERE id = $6`,
      [ar(t.totalHT), ar(t.fodecMontant), ar(t.montantTVA), ar(t.droitTimbre), ar(t.totalTTC), id]);
  };

  router.get('/', async (req, res) => {
    const r = await pool.query(`
      SELECT pf.*, c.numero AS commande_numero, cl.nom AS client_nom, f.numero AS facture_numero,
        (SELECT COUNT(*) FROM proforma_lignes WHERE proforma_id = pf.id) AS nb_lignes
      FROM proformas pf JOIN commandes c ON c.id = pf.commande_id LEFT JOIN clients cl ON cl.id = pf.client_id
      LEFT JOIN factures f ON f.id = pf.facture_id
      ORDER BY pf.statut = 'en_attente' DESC, pf.date_proforma DESC, pf.id DESC`);
    res.json(r.rows);
  });

  router.get('/:id', async (req, res) => {
    const p = await charger(pool, req.params.id);
    if (!p) return res.status(404).json({ error: 'Facture en attente introuvable.' });
    res.json(p);
  });

  // { commande_id, notes? } — reprend les lignes et prix de la commande.
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { commande_id, notes, employe_id } = req.body || {};
      if (!commande_id) return res.status(400).json({ error: 'commande_id est requis.' });
      const c = (await pool.query('SELECT * FROM commandes WHERE id = $1 FOR UPDATE', [commande_id])).rows[0];
      if (!c) return res.status(404).json({ error: 'Commande introuvable.' });
      if (c.statut === 'annulee') return res.status(409).json({ error: `La commande ${c.numero} est annulée.` });
      const fac = (await pool.query(`SELECT numero FROM factures WHERE commande_id = $1 AND statut = 'emise'`, [commande_id])).rows[0];
      if (fac) return res.status(409).json({ error: `La commande ${c.numero} est déjà facturée (${fac.numero}).` });
      const deja = (await pool.query(`SELECT numero FROM proformas WHERE commande_id = $1 AND statut = 'en_attente'`, [commande_id])).rows[0];
      if (deja) return res.status(409).json({ error: `La commande ${c.numero} a déjà une facture en attente (${deja.numero}) : modifiez-la.` });
      const lignes = await lignesCommande(pool, commande_id);
      if (!lignes.length) return res.status(400).json({ error: 'Commande sans lignes.' });
      const tva = (await pool.query('SELECT tva FROM settings WHERE id = 1')).rows[0]?.tva ?? 19;
      const numero = await nextNumero(pool, 'proforma_seq', 'PRO');
      const ins = await pool.query(
        `INSERT INTO proformas (numero, commande_id, client_id, date_proforma, tva_rate, notes, employe_id) VALUES ($1,$2,$3,CURDATE(),$4,$5,$6)`,
        [numero, commande_id, c.client_id, tva, notes || null, employe_id || null]);
      for (const l of lignes) {
        const designation = `${l.produit_nom}${l.free_units ? ` (+${l.free_units} offert${l.free_units > 1 ? 's' : ''})` : ''}`;
        await pool.query(
          `INSERT INTO proforma_lignes (proforma_id, commande_ligne_id, produit_id, designation, qty, unit_price, total) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ins.insertId, l.id, l.produit_id, designation, l.qty, l.unit_price, ar(Number(l.qty) * Number(l.unit_price))]);
      }
      await recalculer(pool, ins.insertId);
      res.status(201).json(await (async () => { const p = (await pool.query('SELECT * FROM proformas WHERE id = $1', [ins.insertId])).rows[0]; return p; })());
    } catch (err) { next(err); }
  }));

  // Modification : notes et prix unitaires TTC { notes, lignes: [{ id, unit_price }] }.
  router.put('/:id', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const p = (await pool.query('SELECT * FROM proformas WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!p) return res.status(404).json({ error: 'Facture en attente introuvable.' });
      if (p.statut !== 'en_attente') return res.status(409).json({ error: `${p.numero} est ${p.statut === 'validee' ? 'déjà validée' : 'annulée'} : plus modifiable.` });
      const { notes, lignes } = req.body || {};
      if (notes !== undefined) await pool.query('UPDATE proformas SET notes = $1 WHERE id = $2', [notes || null, p.id]);
      for (const l of (Array.isArray(lignes) ? lignes : [])) {
        const prix = Number(l.unit_price);
        if (!Number.isFinite(prix) || prix < 0) return res.status(400).json({ error: 'Prix unitaire invalide.' });
        const upd = await pool.query('UPDATE proforma_lignes SET unit_price = $1, total = ROUND(qty * $1, 3) WHERE id = $2 AND proforma_id = $3', [prix, l.id, p.id]);
        if (!upd.affectedRows) return res.status(400).json({ error: `Ligne ${l.id} absente de ${p.numero}.` });
      }
      await recalculer(pool, p.id);
      res.json(await charger(pool, p.id));
    } catch (err) { next(err); }
  }));

  // Validation : les prix de la facture en attente s'appliquent à la commande, puis
  // la vraie facture est émise (bon de livraison automatique pour le reste).
  router.post('/:id/valider', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const p = (await pool.query('SELECT * FROM proformas WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!p) return res.status(404).json({ error: 'Facture en attente introuvable.' });
      if (p.statut !== 'en_attente') return res.status(409).json({ error: `${p.numero} est déjà ${p.statut === 'validee' ? 'validée' : 'annulée'}.` });
      for (const l of (await pool.query('SELECT * FROM proforma_lignes WHERE proforma_id = $1 AND commande_ligne_id IS NOT NULL', [p.id])).rows) {
        await pool.query('UPDATE commande_lignes SET unit_price = $1, total = ROUND(qty * $1, 3) WHERE id = $2', [l.unit_price, l.commande_ligne_id]);
      }
      await pool.query('UPDATE commandes SET total = (SELECT COALESCE(SUM(total), 0) FROM commande_lignes WHERE commande_id = $1) WHERE id = $1', [p.commande_id]);
      const facture = await emettreFacture(pool, { commande_id: p.commande_id, tva_rate: p.tva_rate, employe_id: req.body?.employe_id });
      await pool.query(`UPDATE proformas SET statut = 'validee', facture_id = $1 WHERE id = $2`, [facture.id, p.id]);
      res.status(201).json(facture);
    } catch (err) { next(err); }
  }));

  router.post('/:id/annuler', async (req, res) => {
    const p = (await pool.query('SELECT * FROM proformas WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Facture en attente introuvable.' });
    if (p.statut !== 'en_attente') return res.status(409).json({ error: `${p.numero} n'est plus en attente.` });
    await pool.query(`UPDATE proformas SET statut = 'annulee' WHERE id = $1`, [p.id]);
    res.json({ ok: true });
  });

  return router;
};
