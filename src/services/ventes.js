// Chaîne de vente : bon de commande (la commande) → bon(s) de livraison →
// facture en attente (pro forma, facultative) → facture.
//
// Stock : la quantité commandée est retirée du disponible dès la commande
// (réservation : personne d'autre ne peut la vendre) ; le bon de livraison
// enregistre la sortie physique, éventuellement en plusieurs fois. Le reliquat
// non livré peut être « soldé » : il revient alors en stock.
const { nextNumero, decrementerLot, LOT_DISPONIBLE } = require('./lotService');
const { computeFactureTotalsDepuisLignes } = require('./pricing');
const { StockInsuffisant } = require('../db/transaction');

const ar = (x) => Math.round(Number(x) * 1000) / 1000;
const arQ = (x) => Math.round(Number(x) * 100) / 100; // quantités (DECIMAL 10,2)

class ErreurVente extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

// Totaux d'une facture (ou pro forma) à partir de lignes { unitPrice (TTC), qty }.
async function totauxDepuisLignes(pool, lignes, tvaRate) {
  const settings = (await pool.query('SELECT * FROM settings WHERE id = 1')).rows[0] || {};
  const rate = tvaRate ?? settings.tva ?? 19;
  const t = computeFactureTotalsDepuisLignes(lignes, rate, settings.fodec_rate ?? 1, Number(settings.droit_timbre ?? 1), Number(settings.timbre_seuil ?? 1000));
  return { rate, ...t };
}

// Lignes d'une commande avec ce qui reste à livrer.
async function lignesCommande(pool, commandeId) {
  return (await pool.query(
    `SELECT cl.*, p.nom AS produit_nom, l.numero_lot FROM commande_lignes cl
     LEFT JOIN produits p ON p.id = cl.produit_id LEFT JOIN lots l ON l.id = cl.lot_id
     WHERE cl.commande_id = $1 ORDER BY cl.id`, [commandeId])).rows
    .map(l => ({ ...l, reste: arQ(Number(l.qty) - Number(l.qty_livree || 0)) }));
}

// Crée un bon de livraison. lignes : [{ commande_ligne_id, qty }] ; absent = tout le reste.
// Renvoie le BL créé, ou null si `siRien` vaut 'ignorer' et qu'il n'y a rien à livrer.
async function creerLivraison(pool, { commande_id, lignes, date_livraison, notes, employe_id, siRien = 'erreur' }) {
  const commande = (await pool.query('SELECT * FROM commandes WHERE id = $1 FOR UPDATE', [commande_id])).rows[0];
  if (!commande) throw new ErreurVente('Commande introuvable.', 404);
  if (commande.statut === 'annulee') throw new ErreurVente(`La commande ${commande.numero} est annulée : rien à livrer.`);
  const lc = await lignesCommande(pool, commande_id);
  const demandes = new Map();
  if (Array.isArray(lignes)) {
    for (const d of lignes) {
      const q = Number(d.qty);
      if (!d.commande_ligne_id || !Number.isFinite(q) || q < 0) throw new ErreurVente('Chaque ligne livrée demande commande_ligne_id et une quantité positive.', 400);
      if (q > 0) demandes.set(Number(d.commande_ligne_id), arQ((demandes.get(Number(d.commande_ligne_id)) || 0) + q));
    }
  } else {
    lc.filter(l => l.reste > 0).forEach(l => demandes.set(l.id, l.reste));
  }
  const aLivrer = [];
  for (const [id, q] of demandes) {
    const l = lc.find(x => x.id === id);
    if (!l) throw new ErreurVente(`Ligne ${id} absente de la commande ${commande.numero}.`, 400);
    if (q > l.reste + 1e-9) throw new ErreurVente(`« ${l.produit_nom} » : ${q} demandés, il ne reste que ${l.reste} à livrer.`);
    if (!l.lot_id) throw new ErreurVente(`« ${l.produit_nom} » n'est pas encore disponible (en attente de conditionnement ou de production) : livraison impossible pour cette ligne.`);
    aLivrer.push({ l, q });
  }
  if (!aLivrer.length) {
    if (siRien === 'ignorer') return null;
    throw new ErreurVente(`Rien à livrer sur la commande ${commande.numero}.`);
  }
  const numero = await nextNumero(pool, 'bl_seq', 'BL');
  const ins = await pool.query(
    `INSERT INTO bons_livraison (numero, commande_id, client_id, date_livraison, notes, employe_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [numero, commande_id, commande.client_id, date_livraison || new Date().toISOString().slice(0, 10), notes || null, employe_id || null]);
  for (const { l, q } of aLivrer) {
    await pool.query(`INSERT INTO bl_lignes (bl_id, commande_ligne_id, produit_id, lot_id, qty) VALUES ($1,$2,$3,$4,$5)`,
      [ins.insertId, l.id, l.produit_id, l.lot_id, q]);
    await pool.query('UPDATE commande_lignes SET qty_livree = qty_livree + $1 WHERE id = $2', [q, l.id]);
  }
  await majStatutLivraison(pool, commande_id);
  return (await pool.query('SELECT * FROM bons_livraison WHERE id = $1', [ins.insertId])).rows[0];
}

// Tout livré → « livrée » ; sinon une commande « livrée » sans BL complet redevient « confirmée ».
async function majStatutLivraison(pool, commandeId) {
  const r = (await pool.query(
    `SELECT COUNT(*) AS n, SUM(qty_livree >= qty) AS complets FROM commande_lignes WHERE commande_id = $1`, [commandeId])).rows[0];
  const tout = Number(r.n) > 0 && Number(r.complets) === Number(r.n);
  if (tout) await pool.query(`UPDATE commandes SET statut = 'livree' WHERE id = $1 AND statut IN ('en_attente','confirmee')`, [commandeId]);
  else await pool.query(`UPDATE commandes SET statut = 'confirmee' WHERE id = $1 AND statut = 'livree'`, [commandeId]);
}

// Émet la facture (numéro légal FAC-…) d'une commande. Ce qui n'a pas encore été
// livré l'est par un bon de livraison automatique : facture = marchandise livrée.
async function emettreFacture(pool, { commande_id, tva_rate, employe_id }) {
  const commande = (await pool.query(
    `SELECT c.*, cl.nom AS client_nom FROM commandes c LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.id = $1 FOR UPDATE`, [commande_id])).rows[0];
  if (!commande) throw new ErreurVente('Commande introuvable.', 404);
  if (commande.statut === 'annulee') throw new ErreurVente(`La commande ${commande.numero} est annulée : rien à facturer.`);
  if ((await pool.query(`SELECT id FROM factures WHERE commande_id = $1 AND statut = 'emise'`, [commande_id])).rows.length) {
    throw new ErreurVente('Cette commande a déjà une facture émise.');
  }
  let lignes = await lignesCommande(pool, commande_id);
  if (!lignes.length) throw new ErreurVente('Commande sans lignes — rien à facturer.', 400);
  // Une ligne sans lot attend son conditionnement : la marchandise n'est pas
  // encore sortie du stock, on ne peut donc pas la facturer.
  const enAttente = lignes.filter(l => !l.lot_id);
  if (enAttente.length) {
    throw new ErreurVente(`Facturation impossible : ${enAttente.map(l => `« ${l.produit_nom} »`).join(', ')} attend${enAttente.length > 1 ? 'ent' : ''} encore un conditionnement. Conditionnez, puis validez la ligne depuis Notifications avant de facturer.`);
  }
  await creerLivraison(pool, { commande_id, notes: 'Bon de livraison établi à la facturation', employe_id, siRien: 'ignorer' });
  lignes = await lignesCommande(pool, commande_id);

  // Refacturation après annulation (factures d'avant la V3.3) : l'annulation a
  // réintégré le stock ; la nouvelle facture le ressort.
  const annulees = await pool.query(`SELECT COUNT(*) AS n FROM factures WHERE commande_id = $1 AND statut = 'annulee'`, [commande_id]);
  if (Number(annulees.rows[0].n) > 0) {
    for (const l of lignes) {
      const qte = Number(l.qty) + Number(l.free_units || 0);
      const dispo = await pool.query(`SELECT numero_lot FROM lots WHERE id = $1 AND ${LOT_DISPONIBLE}`, [l.lot_id]);
      if (!dispo.rows[0]) throw new StockInsuffisant(`Refacturation impossible : le lot de « ${l.produit_nom} » n'est plus disponible (périmé, bloqué ou épuisé). Créez une nouvelle commande.`);
      await decrementerLot(pool, l.lot_id, qte);
      await pool.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1 AND quantite_actuelle <= 0`, [l.lot_id]);
      await pool.query(
        `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note)
         VALUES ($1,'VENTE','SORTIE',$2,$3,$4,'commande',$5,'Refacturation après annulation')`,
        [await nextNumero(pool, 'mouvement_seq', 'MVT'), l.produit_id, l.lot_id, qte, commande_id]);
    }
  }

  const t = await totauxDepuisLignes(pool, lignes.map(l => ({ unitPrice: l.unit_price, qty: l.qty })), tva_rate);
  const numero = await nextNumero(pool, 'facture_seq', 'FAC');
  const fac = await pool.query(
    `INSERT INTO factures (numero, commande_id, commande_numero, client_id, client_nom, tva_rate, fodec_montant, droit_timbre, total_ht, montant_tva, total_ttc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [numero, commande_id, commande.numero, commande.client_id, commande.client_nom, t.rate, t.fodecMontant, t.droitTimbre, t.totalHT, t.montantTVA, t.totalTTC]);
  for (const l of lignes) {
    const designation = `${l.produit_nom}${l.free_units ? ` (+${l.free_units} offert${l.free_units > 1 ? 's' : ''})` : ''}`;
    await pool.query(
      `INSERT INTO facture_lignes (facture_id, designation, prix_detail, unit_price, qty, total, remise_nom, remise_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [fac.insertId, designation, l.prix_detail, l.unit_price, l.qty, l.total, l.remise_nom, l.remise_pct]);
  }
  await pool.query(`UPDATE commandes SET statut = 'livree' WHERE id = $1 AND statut IN ('en_attente','confirmee')`, [commande_id]);
  // Une facture en attente (pro forma) de cette commande devient sans objet.
  await pool.query(`UPDATE proformas SET statut = 'validee', facture_id = $1 WHERE commande_id = $2 AND statut = 'en_attente'`, [fac.insertId, commande_id]);
  return (await pool.query('SELECT * FROM factures WHERE id = $1', [fac.insertId])).rows[0];
}

module.exports = { ErreurVente, totauxDepuisLignes, lignesCommande, creerLivraison, majStatutLivraison, emettreFacture, ar, arQ };
