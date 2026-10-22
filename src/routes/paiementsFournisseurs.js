// Paiements des fournisseurs : ce qui reste à payer par achat, solde par fournisseur, annulation tracée.
const express = require('express');
const { enTransaction } = require('../db/transaction');
const { requireRole } = require('../middleware/auth');
const { Invalide } = require('../services/regles');

const MODES = ['especes', 'cheque', 'virement', 'traite', 'autre'];
const arrondi = (x) => Math.round(Number(x) * 1000) / 1000;

// Par achat non annulé : total TTC, payé (paiements non annulés), reste.
const SITUATION = `
  SELECT a.id AS achat_id, a.numero, a.date_achat, a.statut, a.fournisseur_id, f.nom AS fournisseur_nom, a.total_ttc,
         COALESCE(p.paye, 0) AS paye, a.total_ttc - COALESCE(p.paye, 0) AS reste
  FROM achats a JOIN fournisseurs f ON f.id = a.fournisseur_id
  LEFT JOIN (SELECT achat_id, SUM(montant) AS paye FROM paiements_fournisseurs WHERE annule_le IS NULL AND achat_id IS NOT NULL GROUP BY achat_id) p ON p.achat_id = a.id
  WHERE a.statut NOT IN ('brouillon', 'annule')`;

module.exports = function (pool) {
  const router = express.Router();

  router.get('/situation', async (req, res) => {
    const achats = (await pool.query(`${SITUATION} ${req.query.fournisseur_id ? 'AND a.fournisseur_id = $1' : ''} ORDER BY a.date_achat DESC, a.id DESC`,
      req.query.fournisseur_id ? [req.query.fournisseur_id] : [])).rows
      .map(a => ({ ...a, total_ttc: Number(a.total_ttc), paye: Number(a.paye), reste: arrondi(a.reste) }));
    const parFournisseur = new Map();
    for (const a of achats) {
      const f = parFournisseur.get(a.fournisseur_id) || { fournisseur_id: a.fournisseur_id, nom: a.fournisseur_nom, total_ttc: 0, paye: 0, reste: 0, achats_ouverts: 0 };
      f.total_ttc += a.total_ttc; f.paye += a.paye; f.reste += a.reste; if (a.reste > 0.0005) f.achats_ouverts++;
      parFournisseur.set(a.fournisseur_id, f);
    }
    res.json({ achats, fournisseurs: [...parFournisseur.values()].map(f => ({ ...f, total_ttc: arrondi(f.total_ttc), paye: arrondi(f.paye), reste: arrondi(f.reste) })).sort((x, y) => y.reste - x.reste),
      total_du: arrondi(achats.reduce((t, a) => t + Math.max(0, a.reste), 0)) });
  });

  router.get('/', async (req, res) => {
    const clauses = [], params = [];
    if (req.query.achat_id) { params.push(req.query.achat_id); clauses.push(`p.achat_id = $${params.length}`); }
    if (req.query.fournisseur_id) { params.push(req.query.fournisseur_id); clauses.push(`p.fournisseur_id = $${params.length}`); }
    const r = await pool.query(
      `SELECT p.*, f.nom AS fournisseur_nom, a.numero AS achat_numero FROM paiements_fournisseurs p JOIN fournisseurs f ON f.id = p.fournisseur_id
       LEFT JOIN achats a ON a.id = p.achat_id ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY p.date_paiement DESC, p.id DESC`, params);
    res.json(r.rows);
  });

  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    const { achat_id, date_paiement, montant, mode, reference, notes } = req.body;
    if (!achat_id) throw new Invalide('achat_id est requis.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date_paiement || ''))) throw new Invalide('date_paiement (AAAA-MM-JJ) requise.');
    const m = arrondi(montant);
    if (!(m > 0)) throw new Invalide('Le montant doit être supérieur à 0.');
    if (mode && !MODES.includes(mode)) throw new Invalide(`Mode de paiement inconnu : ${MODES.join(', ')}.`);
    // Verrou sur l'achat : deux paiements simultanés ne peuvent pas dépasser ce qui reste dû.
    const achat = (await pool.query('SELECT id, numero, fournisseur_id, statut, total_ttc FROM achats WHERE id = $1 FOR UPDATE', [achat_id])).rows[0];
    if (!achat) throw new Invalide('Achat introuvable.');
    if (['brouillon', 'annule'].includes(achat.statut)) throw new Invalide(`L'achat ${achat.numero} est ${achat.statut === 'annule' ? 'annulé' : 'encore en brouillon'} : rien à payer.`);
    const paye = Number((await pool.query('SELECT COALESCE(SUM(montant), 0) AS t FROM paiements_fournisseurs WHERE achat_id = $1 AND annule_le IS NULL', [achat.id])).rows[0].t);
    const reste = arrondi(Number(achat.total_ttc) - paye);
    if (m > reste + 0.0005) throw new Invalide(`Le paiement (${m} DT) dépasse le reste à payer de l'achat ${achat.numero} (${reste} DT).`);
    const ins = await pool.query(
      'INSERT INTO paiements_fournisseurs (fournisseur_id, achat_id, date_paiement, montant, mode, reference, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [achat.fournisseur_id, achat.id, date_paiement, m, mode || 'especes', reference || null, notes || null, req.user ? req.user.id : null]);
    res.status(201).json({ ...(await pool.query('SELECT * FROM paiements_fournisseurs WHERE id = $1', [ins.insertId])).rows[0], reste_apres: arrondi(reste - m) });
  }));

  router.post('/:id/annuler', requireRole('gerant'), async (req, res) => {
    const motif = String(req.body.motif || '').trim();
    if (!motif) return res.status(400).json({ error: 'Le motif d\'annulation est obligatoire.' });
    const r = await pool.query('UPDATE paiements_fournisseurs SET annule_le = NOW(), annule_motif = $1, annule_par = $2 WHERE id = $3 AND annule_le IS NULL', [motif.slice(0, 255), req.user ? req.user.id : null, req.params.id]);
    if (!r.affectedRows) return res.status(409).json({ error: 'Paiement introuvable ou déjà annulé.' });
    res.json((await pool.query('SELECT * FROM paiements_fournisseurs WHERE id = $1', [req.params.id])).rows[0]);
  });

  return router;
};
