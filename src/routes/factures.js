const { enTransaction } = require('../db/transaction');
const express = require('express');
const { computeFactureTotals, computeFactureTotalsDepuisLignes } = require('../services/pricing');
const { decrementerLot, LOT_DISPONIBLE } = require('../services/lotService');
const { StockInsuffisant } = require('../db/transaction');
const { positif, arrondi } = require('../services/regles');
const { requireRole } = require('../middleware/auth');
const { emettreFacture } = require('../services/ventes');

// Total des avoirs émis par facture (réduit ce que le client doit).
const AVOIRS_PAR_FACTURE = '(SELECT facture_id, SUM(total_ttc) AS total_avoirs FROM avoirs GROUP BY facture_id)';
const ar = (x) => Math.round(Number(x) * 1000) / 1000;

async function nextNumero(pool, seqName, prefix) {
  const upd = await pool.query(`UPDATE sequences SET \`last_value\` = \`last_value\` + 1 WHERE name = $1`, [seqName]);
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO sequences (name, \`last_value\`) VALUES ($1, 1)`, [seqName]);
  }
  const cur = await pool.query(`SELECT \`last_value\` FROM sequences WHERE name = $1`, [seqName]);
  return `${prefix}-${String(cur.rows[0].last_value).padStart(4, '0')}`;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT f.*, COALESCE(p.total_paye, 0) AS total_paye, COALESCE(a.total_avoirs, 0) AS total_avoirs,
        (f.total_ttc - COALESCE(p.total_paye, 0) - COALESCE(a.total_avoirs, 0)) AS solde
      FROM factures f
      LEFT JOIN ${AVOIRS_PAR_FACTURE} a ON a.facture_id = f.id
      LEFT JOIN (SELECT facture_id, SUM(montant) AS total_paye FROM paiements WHERE annule_le IS NULL GROUP BY facture_id) p
        ON p.facture_id = f.id
      ORDER BY f.date_emission DESC, f.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const facRes = await pool.query('SELECT * FROM factures WHERE id = $1', [req.params.id]);
    if (!facRes.rows[0]) return res.status(404).json({ error: 'Facture introuvable.' });
    const lignesRes = await pool.query('SELECT * FROM facture_lignes WHERE facture_id = $1', [req.params.id]);
    const paiementsRes = await pool.query('SELECT * FROM paiements WHERE facture_id = $1 ORDER BY date_paiement', [req.params.id]);
    // Les paiements annulés restent visibles (traçabilité) mais ne comptent plus.
    const totalPaye = paiementsRes.rows.filter(p => !p.annule_le).reduce((s, p) => s + Number(p.montant), 0);
    const avoirsRes = await pool.query('SELECT * FROM avoirs WHERE facture_id = $1 ORDER BY id', [req.params.id]);
    const totalAvoirs = avoirsRes.rows.reduce((s, a) => s + Number(a.total_ttc), 0);
    // Lignes de la commande avec ce qui a déjà été repris en avoir (pour le formulaire d'avoir).
    const avoirables = facRes.rows[0].commande_id ? (await pool.query(
      `SELECT cl.id AS commande_ligne_id, cl.produit_id, cl.lot_id, cl.qty, cl.unit_price, cl.free_units, p.nom AS produit_nom,
         COALESCE((SELECT SUM(al.qty) FROM avoir_lignes al JOIN avoirs a ON a.id = al.avoir_id
                   WHERE al.commande_ligne_id = cl.id AND a.facture_id = $2), 0) AS deja_avoir
       FROM commande_lignes cl LEFT JOIN produits p ON p.id = cl.produit_id WHERE cl.commande_id = $1 ORDER BY cl.id`,
      [facRes.rows[0].commande_id, req.params.id])).rows : [];
    res.json({
      ...facRes.rows[0], lignes: lignesRes.rows, paiements: paiementsRes.rows, avoirs: avoirsRes.rows, lignes_avoirables: avoirables,
      total_paye: totalPaye, total_avoirs: totalAvoirs, solde: ar(Number(facRes.rows[0].total_ttc) - totalPaye - totalAvoirs),
    });
  });

  // Émet une facture à partir d'une commande — recopie figée des lignes
  // (designation, prix, remise) au moment de la facturation, cohérent avec
  // le schéma qui dénormalise volontairement client_nom/commande_numero.
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { commande_id, tva_rate } = req.body;
      if (!commande_id) return res.status(400).json({ error: 'commande_id est requis.' });
      res.status(201).json(await emettreFacture(pool, { commande_id, tva_rate, employe_id: req.body.employe_id }));
    } catch (err) { next(err); }
  }));

  // Une facture émise ne s'annule pas (règle comptable) : on émet un avoir.
  // (Les factures annulées avant la V3.3 restent affichées comme telles.)
  router.post('/:id/annuler', (req, res) => {
    res.status(409).json({ error: "Une facture émise ne s'annule pas : émettez un avoir (menu ⋯ › Émettre un avoir)." });
  });

  router.post('/:id/paiements', enTransaction(pool, async (req, res, next, pool) => {
    const { date_paiement, montant, mode, reference, notes } = req.body;
    if (!date_paiement || !montant) return res.status(400).json({ error: 'date_paiement et montant sont requis.' });
    const qMontant = positif(montant, 'Le montant du paiement');
    // FOR UPDATE : deux paiements simultanés ne peuvent pas dépasser le total.
    const facRes = await pool.query('SELECT * FROM factures WHERE id = $1 FOR UPDATE', [req.params.id]);
    const facture = facRes.rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut === 'annulee') return res.status(409).json({ error: `La facture ${facture.numero} est annulée : aucun paiement possible.` });
    const deja = await pool.query('SELECT COALESCE(SUM(montant), 0) AS total FROM paiements WHERE facture_id = $1 AND annule_le IS NULL', [req.params.id]);
    const avs = await pool.query('SELECT COALESCE(SUM(total_ttc), 0) AS total FROM avoirs WHERE facture_id = $1', [req.params.id]);
    const reste = arrondi(Number(facture.total_ttc) - Number(deja.rows[0].total) - Number(avs.rows[0].total));
    if (reste <= 0) return res.status(409).json({ error: `La facture ${facture.numero} est déjà soldée (paiements et avoirs) : rien à encaisser.` });
    if (arrondi(qMontant) > reste) {
      return res.status(400).json({ error: `Le paiement (${arrondi(qMontant)}) dépasse le reste à payer de la facture ${facture.numero} (${reste}).` });
    }

    const insertRes = await pool.query(
      `INSERT INTO paiements (facture_id, date_paiement, montant, mode, reference, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, date_paiement, montant, mode || 'especes', reference || null, notes || null]
    );
    // Facture soldée → la commande passe d'elle-même à « payée ».
    if (facture.commande_id && arrondi(qMontant) >= reste) {
      await pool.query(`UPDATE commandes SET statut = 'payee' WHERE id = $1`, [facture.commande_id]);
    }
    const result = await pool.query('SELECT * FROM paiements WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  }));

  // Avoir sur une facture émise : total ou partiel (quantités par ligne).
  // Remet la marchandise en stock si elle revient (remise_en_stock), réduit ce
  // que le client doit. Un avoir total annule la vente (commande « annulée »).
  router.post('/:id/avoirs', requireRole('gerant'), enTransaction(pool, async (req, res, next, pool) => {
    const motif = String(req.body?.motif || '').trim();
    if (!motif) return res.status(400).json({ error: "Le motif de l'avoir est requis." });
    const remiseEnStock = req.body?.remise_en_stock !== false;
    const demandes = Array.isArray(req.body?.lignes) ? req.body.lignes : [];
    const facRes = await pool.query('SELECT * FROM factures WHERE id = $1 FOR UPDATE', [req.params.id]);
    const facture = facRes.rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut !== 'emise') return res.status(409).json({ error: `La facture ${facture.numero} n'est pas émise : pas d'avoir possible.` });

    const lignesCmd = (await pool.query(
      `SELECT cl.*, p.nom AS produit_nom,
         COALESCE((SELECT SUM(al.qty) FROM avoir_lignes al JOIN avoirs a ON a.id = al.avoir_id
                   WHERE al.commande_ligne_id = cl.id AND a.facture_id = $2), 0) AS deja_avoir
       FROM commande_lignes cl LEFT JOIN produits p ON p.id = cl.produit_id WHERE cl.commande_id = $1`,
      [facture.commande_id, facture.id])).rows;
    const choisies = [];
    for (const d of demandes) {
      const q = Number(d.qty);
      if (!q) continue;
      const l = lignesCmd.find(x => x.id === Number(d.commande_ligne_id));
      if (!l) return res.status(400).json({ error: 'Ligne de facture inconnue.' });
      positif(q, `La quantité reprise de « ${l.produit_nom} »`);
      const restant = ar(Number(l.qty) - Number(l.deja_avoir));
      if (q > restant + 0.0005) return res.status(400).json({ error: `« ${l.produit_nom} » : ${q} demandé, ${restant} encore facturé (le reste est déjà en avoir).` });
      choisies.push({ l, q });
    }
    if (!choisies.length) return res.status(400).json({ error: 'Indiquez au moins une quantité à reprendre.' });

    // Dernier avoir qui reprend tout ce qui restait : il prend exactement le
    // reliquat de la facture (timbre compris), pour solder la vente au millime.
    const toutRepris = lignesCmd.every(l => {
      const c = choisies.find(x => x.l.id === l.id);
      return ar(Number(l.deja_avoir) + (c ? c.q : 0)) >= ar(Number(l.qty));
    });
    let montants;
    if (toutRepris) {
      const prev = (await pool.query(
        `SELECT COALESCE(SUM(total_ht),0) AS ht, COALESCE(SUM(fodec_montant),0) AS fodec, COALESCE(SUM(montant_tva),0) AS tva,
                COALESCE(SUM(droit_timbre),0) AS timbre, COALESCE(SUM(total_ttc),0) AS ttc FROM avoirs WHERE facture_id = $1`, [facture.id])).rows[0];
      montants = { totalHT: Number(facture.total_ht) - Number(prev.ht), fodecMontant: Number(facture.fodec_montant) - Number(prev.fodec),
        montantTVA: Number(facture.montant_tva) - Number(prev.tva), droitTimbre: Number(facture.droit_timbre) - Number(prev.timbre),
        totalTTC: Number(facture.total_ttc) - Number(prev.ttc) };
    } else {
      const fodecRate = Number(facture.total_ht) > 0 ? Number(facture.fodec_montant) / Number(facture.total_ht) * 100 : 0;
      montants = computeFactureTotalsDepuisLignes(choisies.map(c => ({ unitPrice: c.l.unit_price, qty: c.q })), Number(facture.tva_rate), fodecRate, 0, Infinity);
    }
    // Jamais plus que ce que la facture vaut encore (après les avoirs déjà émis).
    const dejaAvoir = Number((await pool.query('SELECT COALESCE(SUM(total_ttc), 0) AS t FROM avoirs WHERE facture_id = $1', [facture.id])).rows[0].t);
    if (ar(montants.totalTTC) > ar(Number(facture.total_ttc) - dejaAvoir) + 0.0005) {
      return res.status(400).json({ error: `L'avoir (${ar(montants.totalTTC)} DT) dépasse ce qui reste facturé (${ar(Number(facture.total_ttc) - dejaAvoir)} DT).` });
    }

    const numero = await nextNumero(pool, 'avoir_seq', 'AV');
    const ins = await pool.query(
      `INSERT INTO avoirs (numero, facture_id, client_id, client_nom, motif, remise_en_stock, total_ht, fodec_montant, montant_tva, droit_timbre, total_ttc, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [numero, facture.id, facture.client_id, facture.client_nom, motif.slice(0, 255), remiseEnStock ? 1 : 0,
        ar(montants.totalHT), ar(montants.fodecMontant), ar(montants.montantTVA), ar(montants.droitTimbre), ar(montants.totalTTC), req.user?.id || null]
    );
    const avoirId = ins.insertId;
    for (const { l, q } of choisies) {
      await pool.query(
        `INSERT INTO avoir_lignes (avoir_id, commande_ligne_id, produit_id, lot_id, designation, qty, unit_price, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [avoirId, l.id, l.produit_id, l.lot_id, l.produit_nom || 'Produit', q, l.unit_price, ar(q * Number(l.unit_price))]
      );
      if (!remiseEnStock || !l.lot_id) continue;
      // Ligne reprise en entier : les unités offertes reviennent aussi.
      const qteStock = ar(Number(l.deja_avoir) + q) >= ar(Number(l.qty)) ? q + Number(l.free_units || 0) : q;
      await pool.query('UPDATE lots SET quantite_actuelle = quantite_actuelle + $1 WHERE id = $2', [qteStock, l.lot_id]);
      await pool.query(`UPDATE lots SET statut = 'LIBERE' WHERE id = $1 AND statut = 'EPUISE'`, [l.lot_id]);
      await pool.query(
        `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note)
         VALUES ($1,'RETOUR_CLIENT','ENTREE',$2,$3,$4,'avoir',$5,$6)`,
        [await nextNumero(pool, 'mouvement_seq', 'MVT'), l.produit_id, l.lot_id, qteStock, avoirId, `Avoir ${numero} : ${motif}`.slice(0, 255)]
      );
    }
    // Vente entièrement reprise → commande annulée ; sinon, facture soldée → payée.
    const resteDu = ar(Number(facture.total_ttc) - dejaAvoir - montants.totalTTC
      - Number((await pool.query('SELECT COALESCE(SUM(montant), 0) AS t FROM paiements WHERE facture_id = $1 AND annule_le IS NULL', [facture.id])).rows[0].t));
    if (facture.commande_id && toutRepris) {
      await pool.query(`UPDATE commandes SET statut = 'annulee', notes = CONCAT(COALESCE(notes, ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE '\n' END, $1) WHERE id = $2`,
        [`Vente reprise par l'avoir ${numero} : ${motif}`, facture.commande_id]);
    } else if (facture.commande_id && resteDu <= 0) {
      await pool.query(`UPDATE commandes SET statut = 'payee' WHERE id = $1 AND statut IN ('confirmee','livree')`, [facture.commande_id]);
    }
    const result = await pool.query('SELECT * FROM avoirs WHERE id = $1', [avoirId]);
    res.status(201).json({ ...result.rows[0], reste_du: resteDu });
  }));

  // Annule un paiement (erreur de saisie, remboursement). Le paiement reste
  // visible avec son motif ; il ne compte plus dans le total payé.
  router.post('/:id/paiements/:paiementId/annuler', requireRole('gerant'), enTransaction(pool, async (req, res, next, pool) => {
    const motif = String(req.body?.motif || '').trim();
    if (!motif) return res.status(400).json({ error: "Le motif de l'annulation est requis." });
    const facRes = await pool.query('SELECT * FROM factures WHERE id = $1 FOR UPDATE', [req.params.id]);
    const facture = facRes.rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    const maj = await pool.query(
      'UPDATE paiements SET annule_le = NOW(), annule_motif = $1, annule_par = $2 WHERE id = $3 AND facture_id = $4 AND annule_le IS NULL',
      [motif.slice(0, 255), req.user?.id || null, req.params.paiementId, req.params.id]
    );
    if (!maj.affectedRows) return res.status(409).json({ error: 'Paiement introuvable ou déjà annulé.' });
    if (facture.commande_id) {
      await pool.query(`UPDATE commandes SET statut = 'livree' WHERE id = $1 AND statut = 'payee'`, [facture.commande_id]);
    }
    const result = await pool.query('SELECT * FROM paiements WHERE id = $1', [req.params.paiementId]);
    res.json(result.rows[0]);
  }));

  return router;
};
