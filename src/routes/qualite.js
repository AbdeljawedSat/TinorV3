// Contrôle qualité des lots (analyses avec seuils → libération ou blocage du lot) et rappel de lot (quels clients ont reçu quoi).
const express = require('express');
const { enTransaction } = require('../db/transaction');
const { requireRole } = require('../middleware/auth');
const { Invalide } = require('../services/regles');

const PROFILS = [
  { code: 'OLIVE', nom: "Huile d'olive vierge extra", source: 'Règlement délégué (UE) 2022/2104' },
  { code: 'GRAINES', nom: 'Huiles de graines vierges (sésame, nigelle…)', source: 'Codex Stan 210 — à confirmer avec votre laboratoire' },
];
const FINIS = ['EPUISE', 'EXPIRE', 'CLOTURE']; // un lot sorti du circuit garde son statut ; l'analyse reste consignée

const conforme = (v, min, max) => (min == null || v >= Number(min)) && (max == null || v <= Number(max));
const arrondi4 = (x) => Math.round(Number(x) * 10000) / 10000;

module.exports = function (pool) {
  const router = express.Router();

  router.get('/profils', (req, res) => res.json(PROFILS));

  // ---- Paramètres et seuils
  router.get('/parametres', async (req, res) => {
    const r = await pool.query('SELECT * FROM qualite_parametres WHERE ($1 IS NULL OR profil = $1) ORDER BY profil, ordre, id', [req.query.profil || null]);
    res.json(r.rows);
  });
  router.post('/parametres', requireRole('gerant'), async (req, res) => {
    const { profil, code, nom, unite, min_valeur, max_valeur } = req.body;
    if (!PROFILS.some(p => p.code === profil)) return res.status(400).json({ error: 'Profil inconnu.' });
    if (!/^[A-Z0-9_]{2,30}$/.test(String(code || ''))) return res.status(400).json({ error: 'Code : 2 à 30 majuscules, chiffres ou _.' });
    if (!nom) return res.status(400).json({ error: 'nom requis.' });
    if (min_valeur != null && max_valeur != null && Number(min_valeur) > Number(max_valeur)) return res.status(400).json({ error: 'Le minimum dépasse le maximum.' });
    try {
      const ins = await pool.query('INSERT INTO qualite_parametres (profil, code, nom, unite, min_valeur, max_valeur, ordre) VALUES ($1,$2,$3,$4,$5,$6,99)',
        [profil, code, nom, unite || '', min_valeur ?? null, max_valeur ?? null]);
      res.status(201).json((await pool.query('SELECT * FROM qualite_parametres WHERE id = $1', [ins.insertId])).rows[0]);
    } catch (e) { if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce paramètre existe déjà pour ce profil.' }); throw e; }
  });
  router.put('/parametres/:id', requireRole('gerant'), async (req, res) => {
    const { nom, unite, min_valeur, max_valeur, actif } = req.body;
    const p = (await pool.query('SELECT * FROM qualite_parametres WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Paramètre introuvable.' });
    const min = min_valeur === undefined ? p.min_valeur : (min_valeur === '' || min_valeur === null ? null : Number(min_valeur));
    const max = max_valeur === undefined ? p.max_valeur : (max_valeur === '' || max_valeur === null ? null : Number(max_valeur));
    if ((min != null && Number.isNaN(min)) || (max != null && Number.isNaN(max))) return res.status(400).json({ error: 'Seuil invalide.' });
    if (min != null && max != null && Number(min) > Number(max)) return res.status(400).json({ error: 'Le minimum dépasse le maximum.' });
    await pool.query('UPDATE qualite_parametres SET nom = $1, unite = $2, min_valeur = $3, max_valeur = $4, actif = $5 WHERE id = $6',
      [nom || p.nom, unite ?? p.unite, min, max, actif === undefined ? p.actif : (actif ? 1 : 0), p.id]);
    res.json((await pool.query('SELECT * FROM qualite_parametres WHERE id = $1', [p.id])).rows[0]);
  });
  // Lots d'une étape mis en quarantaine à leur création, jusqu'à une analyse conforme (ex. FILTRATION,MELANGE).
  router.put('/quarantaine', requireRole('gerant'), async (req, res) => {
    const etapes = (Array.isArray(req.body.etapes) ? req.body.etapes : []).filter(e => ['RECEPTION_MP', 'PRESSE', 'FILTRATION', 'MELANGE', 'CONDITIONNEMENT'].includes(e));
    await pool.query('UPDATE settings SET qualite_quarantaine_etapes = $1 WHERE id = 1', [etapes.join(',')]);
    res.json({ etapes });
  });
  router.get('/quarantaine', async (req, res) => {
    const r = (await pool.query('SELECT qualite_quarantaine_etapes AS e FROM settings WHERE id = 1')).rows[0];
    res.json({ etapes: r && r.e ? r.e.split(',') : [] });
  });

  // ---- Analyses
  async function chargerControles(where, params, db = pool) {
    const rows = (await db.query(
      `SELECT c.*, l.numero_lot, p.nom AS produit_nom FROM controles_qualite c
       JOIN lots l ON l.id = c.lot_id LEFT JOIN produits p ON p.id = l.produit_id
       ${where} ORDER BY c.date_controle DESC, c.id DESC`, params)).rows;
    for (const c of rows) c.resultats = (await db.query('SELECT * FROM controle_resultats WHERE controle_id = $1 ORDER BY id', [c.id])).rows;
    return rows;
  }
  router.get('/controles', async (req, res) => {
    if (req.query.lot) return res.json(await chargerControles('WHERE l.numero_lot = $1', [req.query.lot]));
    if (req.query.lot_id) return res.json(await chargerControles('WHERE c.lot_id = $1', [req.query.lot_id]));
    res.json(await chargerControles('WHERE c.date_controle >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)', []));
  });
  router.get('/controles/:id', async (req, res) => {
    const c = (await chargerControles('WHERE c.id = $1', [req.params.id]))[0];
    if (!c) return res.status(404).json({ error: 'Analyse introuvable.' });
    res.json(c);
  });

  // Lots en quarantaine qui attendent une analyse.
  router.get('/en-attente', async (req, res) => {
    const r = await pool.query(
      `SELECT l.id, l.numero_lot, p.nom AS produit_nom, l.origine, l.quantite_actuelle, l.created_at
       FROM lots l LEFT JOIN produits p ON p.id = l.produit_id
       WHERE l.statut = 'QUARANTAINE' ORDER BY l.created_at`);
    res.json(r.rows);
  });

  router.post('/controles', enTransaction(pool, async (req, res, next, pool) => {
    const { lot_id, date_controle, profil, laboratoire, reference_rapport, resultats, notes, decision, derogation_motif } = req.body;
    if (!PROFILS.some(p => p.code === profil)) throw new Invalide('Choisissez le profil d\'analyse (olive ou graines).');
    const lot = (await pool.query('SELECT id, numero_lot, statut FROM lots WHERE id = $1 FOR UPDATE', [lot_id])).rows[0];
    if (!lot) throw new Invalide('Lot introuvable.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date_controle || ''))) throw new Invalide('date_controle (AAAA-MM-JJ) requise.');
    if (!Array.isArray(resultats) || !resultats.length) throw new Invalide('Saisissez au moins une valeur mesurée.');
    const params = (await pool.query('SELECT * FROM qualite_parametres WHERE profil = $1 AND actif = 1', [profil])).rows;
    const lignes = [];
    for (const r of resultats) {
      const p = params.find(x => x.code === r.code);
      if (!p) throw new Invalide(`Paramètre inconnu pour ce profil : ${r.code}.`);
      const v = Number(r.valeur);
      if (r.valeur === '' || r.valeur === null || Number.isNaN(v) || v < 0) throw new Invalide(`${p.nom} : valeur invalide.`);
      lignes.push({ p, v: arrondi4(v), ok: conforme(v, p.min_valeur, p.max_valeur) });
    }
    const toutOk = lignes.every(l => l.ok);
    let decisionFinale = decision || (toutOk ? 'LIBERE' : 'BLOQUE');
    if (!['LIBERE', 'BLOQUE', 'REJETE'].includes(decisionFinale)) throw new Invalide('Décision inconnue (LIBERE, BLOQUE ou REJETE).');
    if (!toutOk && decisionFinale === 'LIBERE') {
      if (!req.user || req.user.role !== 'gerant') throw Object.assign(new Invalide('Un lot hors seuils ne peut être libéré que par le gérant, avec un motif de dérogation.'), { status: 403 });
      if (!String(derogation_motif || '').trim()) throw new Invalide('Dérogation : le motif est obligatoire pour libérer un lot hors seuils.');
    }
    if (toutOk && decisionFinale !== 'LIBERE') decisionFinale = decision; // conforme mais bloqué/rejeté volontairement (ex. défaut d'aspect)
    const ins = await pool.query(
      `INSERT INTO controles_qualite (lot_id, date_controle, type_controle, resultat, decision, notes, laboratoire, reference_rapport, profil, conforme, derogation_motif, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [lot.id, date_controle, `Analyse ${profil}`, toutOk ? 'CONFORME' : 'NON_CONFORME', decisionFinale, notes || null, laboratoire || null,
        reference_rapport || null, profil, toutOk ? 1 : 0, (!toutOk && decisionFinale === 'LIBERE') ? String(derogation_motif).trim().slice(0, 255) : null, req.user ? req.user.id : null]);
    for (const l of lignes) {
      await pool.query('INSERT INTO controle_resultats (controle_id, code, nom, unite, valeur, min_valeur, max_valeur, conforme) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [ins.insertId, l.p.code, l.p.nom, l.p.unite, l.v, l.p.min_valeur, l.p.max_valeur, l.ok ? 1 : 0]);
    }
    // Effet sur le lot (sauf lot déjà sorti du circuit : l'analyse est seulement consignée).
    let nouveauStatut = lot.statut;
    if (!FINIS.includes(lot.statut) && lot.statut !== decisionFinale) {
      nouveauStatut = decisionFinale;
      const hors = lignes.filter(l => !l.ok).map(l => `${l.p.nom} ${l.v}${l.p.max_valeur != null && l.v > Number(l.p.max_valeur) ? ` > ${Number(l.p.max_valeur)}` : l.p.min_valeur != null ? ` < ${Number(l.p.min_valeur)}` : ''}`);
      const motif = `Analyse n°${ins.insertId} (${toutOk ? 'conforme' : 'hors seuils : ' + hors.join(', ')})${reference_rapport ? ` — rapport ${reference_rapport}` : ''}${!toutOk && decisionFinale === 'LIBERE' ? ` — dérogation : ${String(derogation_motif).trim()}` : ''}`.slice(0, 250);
      await pool.query('UPDATE lots SET statut = $1 WHERE id = $2', [nouveauStatut, lot.id]);
      await pool.query('INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,$2,$3,$4)', [lot.id, nouveauStatut, motif, req.user && req.user.employe_id || null]);
    }
    const c = (await chargerControles('WHERE c.id = $1', [ins.insertId], pool))[0];
    res.status(201).json({ ...c, statut_lot: nouveauStatut });
  }));

  // ---- Rappel de lot : le lot, tout ce qui en est issu, et les clients livrés.
  router.get('/rappel/:numero', async (req, res) => {
    const lot = (await pool.query(
      `SELECT l.id, l.numero_lot, l.statut, l.origine, l.quantite_initiale, l.quantite_actuelle, l.date_expiration, p.nom AS produit_nom
       FROM lots l LEFT JOIN produits p ON p.id = l.produit_id WHERE l.numero_lot = $1`, [req.params.numero])).rows[0];
    if (!lot) return res.status(404).json({ error: 'Lot introuvable.' });
    // Le lot lui-même et tous ses descendants (huile pressée → filtrée → fini → flacons).
    const vus = new Map([[lot.id, { ...lot, niveau: 0 }]]);
    let front = [lot.id];
    for (let niveau = 1; front.length && niveau <= 20; niveau++) {
      const r = await pool.query(
        `SELECT l.id, l.numero_lot, l.statut, l.origine, l.quantite_initiale, l.quantite_actuelle, l.date_expiration, p.nom AS produit_nom
         FROM lot_origines lo JOIN lots l ON l.id = lo.lot_fils_id LEFT JOIN produits p ON p.id = l.produit_id
         WHERE lo.lot_source_id IN (${front.map((_, i) => `$${i + 1}`).join(',')})`, front);
      front = [];
      for (const x of r.rows) if (!vus.has(x.id)) { vus.set(x.id, { ...x, niveau }); front.push(x.id); }
    }
    const ids = [...vus.keys()];
    const marques = ids.map((_, i) => `$${i + 1}`).join(',');
    // Livraisons (bons de livraison émis) + anciennes commandes livrées sans bon.
    const livraisons = (await pool.query(
      `SELECT bl.numero AS bl_numero, bl.date_livraison AS date, c.numero AS commande_numero, cl.id AS client_id, cl.nom AS client_nom, cl.tel AS client_tel,
              cl.ville AS client_ville, cl.type AS client_type, l.numero_lot, pr.nom AS produit_nom, bll.qty AS quantite,
              (SELECT f.numero FROM factures f WHERE f.commande_id = c.id AND f.statut = 'emise' ORDER BY f.id LIMIT 1) AS facture_numero
       FROM bl_lignes bll JOIN bons_livraison bl ON bl.id = bll.bl_id AND bl.statut = 'emis'
       JOIN commandes c ON c.id = bl.commande_id JOIN clients cl ON cl.id = bl.client_id
       JOIN lots l ON l.id = bll.lot_id LEFT JOIN produits pr ON pr.id = bll.produit_id
       WHERE bll.lot_id IN (${marques}) ORDER BY bl.date_livraison, bl.id`, ids)).rows;
    const anciennes = (await pool.query(
      `SELECT NULL AS bl_numero, c.date_iso AS date, c.numero AS commande_numero, cl.id AS client_id, cl.nom AS client_nom, cl.tel AS client_tel,
              cl.ville AS client_ville, cl.type AS client_type, l.numero_lot, pr.nom AS produit_nom, cll.qty_livree AS quantite,
              (SELECT f.numero FROM factures f WHERE f.commande_id = c.id AND f.statut = 'emise' ORDER BY f.id LIMIT 1) AS facture_numero
       FROM commande_lignes cll JOIN commandes c ON c.id = cll.commande_id AND c.statut <> 'annulee' JOIN clients cl ON cl.id = c.client_id
       JOIN lots l ON l.id = cll.lot_id LEFT JOIN produits pr ON pr.id = cll.produit_id
       WHERE cll.lot_id IN (${marques}) AND cll.qty_livree > 0
         AND NOT EXISTS (SELECT 1 FROM bl_lignes b WHERE b.commande_ligne_id = cll.id)
       ORDER BY c.date_iso`, ids)).rows;
    const toutes = [...livraisons, ...anciennes];
    const clients = new Map();
    for (const x of toutes) {
      const c = clients.get(x.client_id) || { client_id: x.client_id, nom: x.client_nom, tel: x.client_tel, ville: x.client_ville, type: x.client_type, quantite: 0, livraisons: 0 };
      c.quantite += Number(x.quantite); c.livraisons += 1;
      clients.set(x.client_id, c);
    }
    const sorties = (await pool.query(
      `SELECT type_mouvement, COALESCE(SUM(quantite),0) AS q FROM stock_mouvements WHERE lot_id IN (${marques}) AND sens = 'SORTIE' GROUP BY type_mouvement`, ids)).rows;
    res.json({
      lot, lots_concernes: [...vus.values()], livraisons: toutes, clients: [...clients.values()].sort((a, b) => b.quantite - a.quantite),
      en_stock: [...vus.values()].filter(l => Number(l.quantite_actuelle) > 0 && !['EPUISE', 'CLOTURE'].includes(l.statut)).map(l => ({ numero_lot: l.numero_lot, produit_nom: l.produit_nom, quantite_actuelle: Number(l.quantite_actuelle), statut: l.statut })),
      sorties_par_type: sorties.map(s => ({ type: s.type_mouvement, quantite: Number(s.q) })),
      total_livre: toutes.reduce((t, x) => t + Number(x.quantite), 0),
    });
  });

  return router;
};
