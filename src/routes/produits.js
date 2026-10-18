const express = require('express');
const { positifOuZero, entreBornes, Invalide } = require('../services/regles');
const { enTransaction } = require('../db/transaction');
const { normaliser, cleGraine } = require('../services/graines');
const { codeProduitSuivant } = require('../services/produitCode');

// Prix, coût et seuil de stock ne peuvent pas être négatifs ; TVA entre 0 et 100 %.
function verifierProduit({ prix_vente, cout_standard, stock_min, tva }) {
  positifOuZero(prix_vente, 'Le prix de vente');
  positifOuZero(cout_standard, 'Le coût standard');
  positifOuZero(stock_min, 'Le stock minimum');
  entreBornes(tva, 0, 100, 'La TVA');
}

// « Graines de Sésame » → « Huile de Sésame » ; « Graine d'Amande » → « Huile d'Amande » ;
// « Pépins de figue de barbarie » → « Huile de pépins de figue de barbarie ». null si le nom n'est pas celui d'une graine.
function nomHuileDeGraine(nomGraine) {
  const m = String(nomGraine || '').trim().match(/^(graines?|p[ée]pins?)\s+(de\s+|d['’])(.+)$/i);
  if (!m || !cleGraine(nomGraine)) return null;
  const reste = m[3].trim();
  const particule = /^d['’]/i.test(m[2]) ? "d'" : 'de ';
  return /^p/i.test(m[1]) ? `Huile de pépins ${particule}${reste}` : `Huile ${particule}${reste}`;
}

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

  // Prochain code produit à 2 chiffres (protocole TT conservé de la V2). Les codes déjà pris sont sautés :
  // un compteur en retard (produits créés par un import ou reprise) ne provoque plus « Duplicate entry ».
  const nextProductCode = (pool) => codeProduitSuivant(pool);

  // Insère un produit (+ sa séquence de lot) et renvoie sa ligne. Utilisé par la création simple et par les dérivés.
  async function insererProduit(pool, p) {
    const code = await nextProductCode(pool);
    const insertRes = await pool.query(
      `INSERT INTO produits
        (code, nom, description, barcode, categorie_id, unite_id, format_id, type_article, produit_source_id,
         vendable, achetable, fabriquable, stockable, actif, bio_eligible, prix_vente, cout_standard, stock_min, tva, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        code, p.nom, p.description || null, p.barcode || null, p.categorie_id, p.unite_id, p.format_id || null, p.type_article,
        p.produit_source_id || null, !!p.vendable, !!p.achetable, !!p.fabriquable, p.stockable !== false, p.actif !== false,
        !!p.bio_eligible, p.prix_vente ?? null, p.cout_standard ?? null, p.stock_min ?? null, p.tva ?? 19, p.notes || null,
      ]
    );
    // Un produit fabriqué/vendu a besoin d'une séquence de lot dédiée (protocole TT-SSS).
    await pool.query(`INSERT INTO lot_sequences (produit_id, last_seq) VALUES ($1, 0)`, [insertRes.insertId]);
    return (await pool.query('SELECT * FROM produits WHERE id = $1', [insertRes.insertId])).rows[0];
  }

  router.post('/', async (req, res) => {
    const { nom, categorie_id, unite_id, type_article } = req.body;
    if (!nom || !categorie_id || !unite_id || !type_article) {
      return res.status(400).json({ error: 'nom, categorie_id, unite_id et type_article sont requis.' });
    }
    verifierProduit(req.body);
    res.status(201).json(await insererProduit(pool, req.body));
  });

  // Dérivés d'une graine : huile vrac, huile filtrée, flacons (un par format coché). Un dérivé qui existe
  // déjà (même nom) est ignoré. derives : { vrac: bool, filtree: bool, formats: [{ format_id, prix_vente }] }.
  async function creerDerives(pool, graine, derives) {
    const nomHuile = nomHuileDeGraine(graine.nom);
    if (graine.type_article !== 'MATIERE_PREMIERE' || !nomHuile) {
      throw new Invalide('Les dérivés se créent pour une matière première nommée « Graines de … » ou « Pépins de … » : sans ce nom, Presse et Filtration ne peuvent pas relier la graine à son huile.');
    }
    const d = derives || {};
    const formats = Array.isArray(d.formats) ? d.formats : [];
    const unites = Object.fromEntries((await pool.query('SELECT id, code FROM unites')).rows.map(u => [u.code, u.id]));
    const cat = (await pool.query("SELECT id FROM categories WHERE code = 'HUILE' ORDER BY id LIMIT 1")).rows[0];
    const categorieId = cat ? cat.id : graine.categorie_id;
    const existants = new Map((await pool.query('SELECT id, nom FROM produits')).rows.map(p => [normaliser(p.nom), p]));
    const crees = [], ignores = [];
    const commun = { categorie_id: categorieId, tva: graine.tva, bio_eligible: !!graine.bio_eligible, type_article: 'PRODUIT_FABRIQUE', fabriquable: true };
    const creer = async (champs) => {
      const deja = existants.get(normaliser(champs.nom));
      if (deja) { ignores.push(champs.nom); return deja; }
      verifierProduit(champs);
      const p = await insererProduit(pool, { ...commun, ...champs });
      existants.set(normaliser(p.nom), p); crees.push(p); return p;
    };
    const vracNom = `${nomHuile} — Vrac`;
    let vrac = existants.get(normaliser(vracNom)) || null;
    if (d.vrac) vrac = await creer({ nom: vracNom, unite_id: unites.litre });
    if (d.filtree) await creer({ nom: `${nomHuile} — Filtrée`, unite_id: unites.litre, produit_source_id: vrac ? vrac.id : null });
    for (const f of formats) {
      const fmt = (await pool.query('SELECT * FROM formats WHERE id = $1', [f.format_id])).rows[0];
      if (!fmt) throw new Invalide(`Format ${f.format_id} introuvable.`);
      if (!fmt.volume) throw new Invalide(`Le format « ${fmt.nom} » n'a pas de volume : seuls les volumes donnent des flacons d'huile.`);
      await creer({ nom: `${nomHuile} — Flacon ${fmt.code}`, unite_id: unites.unite, format_id: fmt.id, produit_source_id: vrac ? vrac.id : null,
        vendable: true, prix_vente: f.prix_vente === '' || f.prix_vente == null ? null : Number(f.prix_vente) });
    }
    return { crees, ignores };
  }

  // Nouvelle graine + dérivés cochés, en une seule opération : si un produit échoue, rien n'est créé.
  router.post('/avec-derives', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const body = req.body.graine || {};
      const graine = { ...body, type_article: 'MATIERE_PREMIERE' };
      if (!graine.nom || !graine.categorie_id || !graine.unite_id) return res.status(400).json({ error: 'nom, categorie_id et unite_id sont requis.' });
      if (!nomHuileDeGraine(graine.nom)) {
        return res.status(400).json({ error: 'Le nom doit commencer par « Graines de … » ou « Pépins de … » pour créer les dérivés.' });
      }
      verifierProduit(graine);
      const produit = await insererProduit(pool, graine);
      const { crees, ignores } = await creerDerives(pool, produit, req.body.derives);
      res.status(201).json({ graine: produit, crees: [produit, ...crees], ignores });
    } catch (err) { next(err); }
  }));

  // Dérivés à ajouter à une graine existante (ex. un volume de plus).
  router.post('/:id/derives', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const graine = (await pool.query('SELECT * FROM produits WHERE id = $1', [req.params.id])).rows[0];
      if (!graine) return res.status(404).json({ error: 'Produit introuvable.' });
      const { crees, ignores } = await creerDerives(pool, graine, req.body.derives);
      res.status(201).json({ graine, crees, ignores });
    } catch (err) { next(err); }
  }));

  router.put('/:id', async (req, res) => {
    const {
      nom, description, barcode, categorie_id, unite_id, format_id, type_article,
      produit_source_id, vendable, achetable, fabriquable, stockable, actif,
      bio_eligible, prix_vente, cout_standard, stock_min, tva, notes,
    } = req.body;
    verifierProduit(req.body);
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
