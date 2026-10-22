// Coût réel par lot et marges par produit / client / mois.
const express = require('express');
const { coutDuLot, nouveauContexte, lireFrais, ETAPE_FRAIS } = require('../services/couts');
const { requireRole } = require('../middleware/auth');

const arrondi = (x, n = 3) => (x === null || x === undefined ? null : Math.round(Number(x) * 10 ** n) / 10 ** n);

module.exports = function (pool) {
  const router = express.Router();

  router.get('/frais', async (req, res) => res.json(await lireFrais(pool)));
  router.put('/frais', requireRole('gerant'), async (req, res) => {
    const valeurs = {};
    for (const k of Object.values(ETAPE_FRAIS)) {
      const v = Number(req.body[k] ?? 0);
      if (Number.isNaN(v) || v < 0 || v > 100000) return res.status(400).json({ error: `Frais invalides (${k}).` });
      valeurs[k] = v;
    }
    await pool.query(`UPDATE settings SET ${Object.keys(valeurs).map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = 1`, Object.values(valeurs));
    res.json(await lireFrais(pool));
  });

  // Coût détaillé d'un lot.
  router.get('/lot/:numero', async (req, res) => {
    const lot = (await pool.query('SELECT l.id, l.numero_lot, l.cout_unitaire, p.nom AS produit_nom FROM lots l LEFT JOIN produits p ON p.id = l.produit_id WHERE l.numero_lot = $1', [req.params.numero])).rows[0];
    if (!lot) return res.status(404).json({ error: 'Lot introuvable.' });
    const c = await coutDuLot(pool, lot.id, await nouveauContexte(pool));
    res.json({ numero_lot: lot.numero_lot, produit_nom: lot.produit_nom, cout_saisi: lot.cout_unitaire === null ? null : Number(lot.cout_unitaire), ...c, cout: arrondi(c.cout, 4) });
  });
  // Coût saisi à la main (matière première sans achat, correction). null/vide : retour au calcul automatique.
  router.put('/lot/:id', async (req, res) => {
    const brut = req.body.cout_unitaire;
    const v = brut === null || brut === '' || brut === undefined ? null : Number(brut);
    if (v !== null && (Number.isNaN(v) || v < 0 || v > 1e6)) return res.status(400).json({ error: 'Coût unitaire invalide.' });
    const r = await pool.query('UPDATE lots SET cout_unitaire = $1 WHERE id = $2', [v, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Lot introuvable.' });
    res.json({ ok: true, cout_unitaire: v });
  });

  // Marges sur les marchandises livrées (bons de livraison émis + anciennes commandes livrées sans bon).
  // Chiffre d'affaires = prix de vente TTC converti en HT (FODEC et timbre sont des taxes collectées, pas du chiffre d'affaires).
  router.get('/marges', async (req, res) => {
    const { du, au } = req.query;
    const par = ['produit', 'client', 'mois'].includes(req.query.par) ? req.query.par : 'produit';
    const bornes = [], p = [];
    const borne = (col) => { if (du) { p.push(du); bornes.push(`${col} >= $${p.length}`); } if (au) { p.push(au); bornes.push(`${col} <= $${p.length}`); } };
    borne('bl.date_livraison');
    const sqlBl = `SELECT bll.lot_id, bll.qty AS quantite, bl.date_livraison AS date, cl.unit_price, c.client_id, cli.nom AS client_nom, pr.id AS produit_id, pr.nom AS produit_nom, COALESCE(pr.tva, 19) AS tva
       FROM bl_lignes bll JOIN bons_livraison bl ON bl.id = bll.bl_id AND bl.statut = 'emis' JOIN commande_lignes cl ON cl.id = bll.commande_ligne_id
       JOIN commandes c ON c.id = cl.commande_id JOIN clients cli ON cli.id = c.client_id LEFT JOIN produits pr ON pr.id = bll.produit_id
       ${bornes.length ? 'WHERE ' + bornes.join(' AND ') : ''}`;
    const p2 = []; const b2 = [];
    if (du) { p2.push(du); b2.push(`DATE(c.date_iso) >= $${p2.length}`); }
    if (au) { p2.push(au); b2.push(`DATE(c.date_iso) <= $${p2.length}`); }
    const sqlAnciennes = `SELECT cll.lot_id, cll.qty_livree AS quantite, DATE(c.date_iso) AS date, cll.unit_price, c.client_id, cli.nom AS client_nom, pr.id AS produit_id, pr.nom AS produit_nom, COALESCE(pr.tva, 19) AS tva
       FROM commande_lignes cll JOIN commandes c ON c.id = cll.commande_id AND c.statut <> 'annulee' JOIN clients cli ON cli.id = c.client_id LEFT JOIN produits pr ON pr.id = cll.produit_id
       WHERE cll.qty_livree > 0 AND NOT EXISTS (SELECT 1 FROM bl_lignes b WHERE b.commande_ligne_id = cll.id) ${b2.length ? 'AND ' + b2.join(' AND ') : ''}`;
    const lignes = [...(await pool.query(sqlBl, p)).rows, ...(await pool.query(sqlAnciennes, p2)).rows];
    const ctx = await nouveauContexte(pool);
    const groupes = new Map();
    const total = { ca_ht: 0, cout: 0, quantite: 0, quantite_sans_cout: 0, ca_sans_cout: 0 };
    for (const l of lignes) {
      const q = Number(l.quantite), ca = q * Number(l.unit_price) / (1 + Number(l.tva) / 100);
      const c = l.lot_id ? await coutDuLot(pool, l.lot_id, ctx) : { cout: null };
      const cle = par === 'client' ? `c${l.client_id}` : par === 'mois' ? String(l.date instanceof Date ? l.date.toISOString() : l.date).slice(0, 7) : `p${l.produit_id}`;
      const nom = par === 'client' ? l.client_nom : par === 'mois' ? cle : l.produit_nom;
      const g = groupes.get(cle) || { cle, nom, quantite: 0, ca_ht: 0, cout: 0, ca_sans_cout: 0, quantite_sans_cout: 0 };
      g.quantite += q; g.ca_ht += ca; total.quantite += q; total.ca_ht += ca;
      if (c.cout === null) { g.quantite_sans_cout += q; g.ca_sans_cout += ca; total.quantite_sans_cout += q; total.ca_sans_cout += ca; }
      else { g.cout += q * c.cout; total.cout += q * c.cout; }
      groupes.set(cle, g);
    }
    const sortie = [...groupes.values()].map(g => {
      const caConnu = g.ca_ht - g.ca_sans_cout;
      return { ...g, ca_ht: arrondi(g.ca_ht), cout: arrondi(g.cout), marge: arrondi(caConnu - g.cout),
        marge_pct: caConnu > 0 ? arrondi((caConnu - g.cout) / caConnu * 100, 1) : null, ca_sans_cout: arrondi(g.ca_sans_cout), quantite: arrondi(g.quantite, 2), quantite_sans_cout: arrondi(g.quantite_sans_cout, 2) };
    }).sort((a, b) => par === 'mois' ? a.cle.localeCompare(b.cle) : b.ca_ht - a.ca_ht);
    const caConnu = total.ca_ht - total.ca_sans_cout;
    // Avoirs émis sur la période : à déduire du chiffre d'affaires.
    const pa = [], ba = [];
    if (du) { pa.push(du); ba.push(`DATE(a.date_emission) >= $${pa.length}`); }
    if (au) { pa.push(au); ba.push(`DATE(a.date_emission) <= $${pa.length}`); }
    const avoirs = (await pool.query(`SELECT COALESCE(SUM(a.total_ht), 0) AS t FROM avoirs a ${ba.length ? 'WHERE ' + ba.join(' AND ') : ''}`, pa)).rows[0];
    res.json({
      par, du: du || null, au: au || null, groupes: sortie,
      total: { ca_ht: arrondi(total.ca_ht), cout: arrondi(total.cout), marge: arrondi(caConnu - total.cout), marge_pct: caConnu > 0 ? arrondi((caConnu - total.cout) / caConnu * 100, 1) : null,
        quantite: arrondi(total.quantite, 2), ca_sans_cout: arrondi(total.ca_sans_cout), quantite_sans_cout: arrondi(total.quantite_sans_cout, 2), avoirs_ht: arrondi(avoirs.t) },
      note: 'Marge calculée sur les lignes dont le coût est connu ; les autres sont signalées « sans coût ».',
    });
  });

  return router;
};
