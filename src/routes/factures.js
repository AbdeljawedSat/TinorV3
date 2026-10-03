const { enTransaction } = require('../db/transaction');
const express = require('express');
const { computeFactureTotals, computeFactureTotalsDepuisLignes } = require('../services/pricing');
const { decrementerLot, LOT_DISPONIBLE } = require('../services/lotService');
const { StockInsuffisant } = require('../db/transaction');
const { positif, arrondi } = require('../services/regles');

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
      SELECT f.*, COALESCE(p.total_paye, 0) AS total_paye,
        (f.total_ttc - COALESCE(p.total_paye, 0)) AS solde
      FROM factures f
      LEFT JOIN (SELECT facture_id, SUM(montant) AS total_paye FROM paiements GROUP BY facture_id) p
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
    const totalPaye = paiementsRes.rows.reduce((s, p) => s + Number(p.montant), 0);
    res.json({
      ...facRes.rows[0], lignes: lignesRes.rows, paiements: paiementsRes.rows,
      total_paye: totalPaye, solde: Number(facRes.rows[0].total_ttc) - totalPaye,
    });
  });

  // Émet une facture à partir d'une commande — recopie figée des lignes
  // (designation, prix, remise) au moment de la facturation, cohérent avec
  // le schéma qui dénormalise volontairement client_nom/commande_numero.
  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { commande_id, tva_rate } = req.body;
      if (!commande_id) return res.status(400).json({ error: 'commande_id est requis.' });

      const cmdRes = await pool.query(
        `SELECT c.*, cl.nom AS client_nom FROM commandes c
         LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.id = $1 FOR UPDATE`,
        [commande_id]
      );
      const commande = cmdRes.rows[0];
      if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });

      const dejaFacturee = await pool.query(
        `SELECT id FROM factures WHERE commande_id = $1 AND statut = 'emise'`,
        [commande_id]
      );
      if (dejaFacturee.rows.length) {
        return res.status(409).json({ error: 'Cette commande a déjà une facture émise.' });
      }

      const lignesRes = await pool.query(
        `SELECT cl.*, p.nom AS produit_nom FROM commande_lignes cl
         LEFT JOIN produits p ON p.id = cl.produit_id WHERE cl.commande_id = $1`,
        [commande_id]
      );
      if (!lignesRes.rows.length) return res.status(400).json({ error: 'Commande sans lignes — rien à facturer.' });

      const settingsRes = await pool.query('SELECT * FROM settings WHERE id = 1');
      const settings = settingsRes.rows[0] || {};
      const rate = tva_rate ?? settings.tva ?? 19;
      const fodecRate = settings.fodec_rate ?? 1;
      const timbreSeuil = Number(settings.timbre_seuil ?? 1000);
      const droitTimbreConfigure = Number(settings.droit_timbre ?? 1);
      // Méthode conforme au modèle Excel de référence : HT extrait ligne par
      // ligne, FODEC/TVA/Timbre ajoutés une seule fois sur le total résultant.
      const { totalHT, fodecMontant, montantTVA, droitTimbre, totalTTC: totalTtc } = computeFactureTotalsDepuisLignes(
        lignesRes.rows.map(l => ({ unitPrice: l.unit_price, qty: l.qty })),
        rate, fodecRate, droitTimbreConfigure, timbreSeuil
      );

      // Refacturation après annulation : l'annulation a réintégré le stock des
      // lots vendus ; la nouvelle facture le ressort (sinon les marchandises
      // livrées restaient comptées en stock — écart constaté).
      const annulees = await pool.query(
        `SELECT COUNT(*) AS n FROM factures WHERE commande_id = $1 AND statut = 'annulee'`, [commande_id]
      );
      if (Number(annulees.rows[0].n) > 0) {
        for (const l of lignesRes.rows) {
          if (!l.lot_id) continue;
          const qte = Number(l.qty) + Number(l.free_units || 0);
          const dispo = await pool.query(`SELECT numero_lot FROM lots WHERE id = $1 AND ${LOT_DISPONIBLE}`, [l.lot_id]);
          if (!dispo.rows[0]) {
            throw new StockInsuffisant(`Refacturation impossible : le lot de « ${l.produit_nom} » n'est plus disponible (périmé, bloqué ou épuisé). Créez une nouvelle commande.`);
          }
          await decrementerLot(pool, l.lot_id, qte);
          await pool.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1 AND quantite_actuelle <= 0`, [l.lot_id]);
          await pool.query(
            `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note)
             VALUES ($1,'VENTE','SORTIE',$2,$3,$4,'commande',$5,'Refacturation après annulation')`,
            [await nextNumero(pool, 'mouvement_seq', 'MVT'), l.produit_id, l.lot_id, qte, commande_id]
          );
        }
      }

      const numero = await nextNumero(pool, 'facture_seq', 'FAC');
      const facRes = await pool.query(
        `INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [numero, commande_id, commande.numero, commande.client_id, commande.client_nom, rate, fodecMontant, droitTimbre, totalHT, montantTVA, totalTtc]
      );
      const factureId = facRes.insertId;

      for (const l of lignesRes.rows) {
        const designation = `${l.produit_nom}${l.free_units ? ` (+${l.free_units} offert${l.free_units > 1 ? 's' : ''})` : ''}`;
        await pool.query(
          `INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [factureId, designation, l.prix_detail, l.unit_price, l.qty, l.total, l.remise_nom, l.remise_pct]
        );
      }
      await pool.query(`UPDATE commandes SET statut = 'livree' WHERE id = $1`, [commande_id]);

      const result = await pool.query('SELECT * FROM factures WHERE id = $1', [factureId]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }));

  // Annule une facture et réintègre le stock des lots vendus via la commande liée.
  router.post('/:id/annuler', enTransaction(pool, async (req, res, next, pool) => {
    const facRes = await pool.query('SELECT * FROM factures WHERE id = $1', [req.params.id]);
    const facture = facRes.rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut === 'annulee') return res.status(409).json({ error: 'Cette facture est déjà annulée.' });

    // Condition sur le statut : si deux demandes d'annulation arrivent en même
    // temps (double clic), une seule passe — le stock n'est réintégré qu'une fois.
    const annul = await pool.query(`UPDATE factures SET statut = 'annulee' WHERE id = $1 AND statut <> 'annulee'`, [req.params.id]);
    if (!annul.affectedRows) return res.status(409).json({ error: 'Cette facture est déjà annulée.' });

    if (facture.commande_id) {
      const lignesRes = await pool.query(
        'SELECT * FROM commande_lignes WHERE commande_id = $1', [facture.commande_id]
      );
      for (const l of lignesRes.rows) {
        if (!l.lot_id) continue;
        const qteRestituee = Number(l.qty) + Number(l.free_units || 0);
        await pool.query('UPDATE lots SET quantite_actuelle = quantite_actuelle + $1 WHERE id = $2', [qteRestituee, l.lot_id]);
        await pool.query(`UPDATE lots SET statut = 'LIBERE' WHERE id = $1 AND statut = 'EPUISE'`, [l.lot_id]);
        await pool.query(
          `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note)
           VALUES ($1,'RETOUR_CLIENT','ENTREE',$2,$3,$4,'facture',$5,'Annulation facture')`,
          [await nextNumero(pool, 'mouvement_seq', 'MVT'), l.produit_id, l.lot_id, qteRestituee, req.params.id]
        );
      }
      await pool.query(`UPDATE commandes SET statut = 'confirmee' WHERE id = $1`, [facture.commande_id]);
    }
    const result = await pool.query('SELECT * FROM factures WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  }));

  router.post('/:id/paiements', enTransaction(pool, async (req, res, next, pool) => {
    const { date_paiement, montant, mode, reference, notes } = req.body;
    if (!date_paiement || !montant) return res.status(400).json({ error: 'date_paiement et montant sont requis.' });
    const qMontant = positif(montant, 'Le montant du paiement');
    // FOR UPDATE : deux paiements simultanés ne peuvent pas dépasser le total.
    const facRes = await pool.query('SELECT * FROM factures WHERE id = $1 FOR UPDATE', [req.params.id]);
    const facture = facRes.rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut === 'annulee') return res.status(409).json({ error: `La facture ${facture.numero} est annulée : aucun paiement possible.` });
    const deja = await pool.query('SELECT COALESCE(SUM(montant), 0) AS total FROM paiements WHERE facture_id = $1', [req.params.id]);
    const reste = arrondi(Number(facture.total_ttc) - Number(deja.rows[0].total));
    if (arrondi(qMontant) > reste) {
      return res.status(400).json({ error: `Le paiement (${arrondi(qMontant)}) dépasse le reste à payer de la facture ${facture.numero} (${reste}).` });
    }

    const insertRes = await pool.query(
      `INSERT INTO paiements (facture_id, date_paiement, montant, mode, reference, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, date_paiement, montant, mode || 'especes', reference || null, notes || null]
    );
    const result = await pool.query('SELECT * FROM paiements WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  }));

  return router;
};
