const { enTransaction } = require('../db/transaction');
const express = require('express');
const { LOT_DISPONIBLE, ORDRE_FEFO, decrementerLot } = require('../services/lotService');
const { positif, positifOuZero, entierSiUnite } = require('../services/regles');

async function nextNumero(pool, seqName, prefix) {
  const upd = await pool.query(`UPDATE sequences SET \`last_value\` = \`last_value\` + 1 WHERE name = $1`, [seqName]);
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO sequences (name, \`last_value\`) VALUES ($1, 1)`, [seqName]);
  }
  const cur = await pool.query(`SELECT \`last_value\` FROM sequences WHERE name = $1`, [seqName]);
  return `${prefix}-${String(cur.rows[0].last_value).padStart(4, '0')}`;
}

const STATUTS_COMMANDE = ['en_attente', 'confirmee', 'livree', 'payee'];
const { requireRole } = require('../middleware/auth');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT c.*, cl.nom AS client_nom, e.nom AS employe_nom,
        COALESCE(l.nb, 0) AS nb_lignes
      FROM commandes c
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN employes e ON e.id = c.employe_id
      LEFT JOIN (SELECT commande_id, COUNT(*) AS nb FROM commande_lignes GROUP BY commande_id) l ON l.commande_id = c.id
      ORDER BY c.date_iso DESC, c.id DESC
    `);
    res.json(result.rows);
  });

  router.get('/:id', async (req, res) => {
    const cmdRes = await pool.query(
      `SELECT c.*, cl.nom AS client_nom FROM commandes c
       LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!cmdRes.rows[0]) return res.status(404).json({ error: 'Commande introuvable.' });
    const lignesRes = await pool.query(
      `SELECT cl.*, p.nom AS produit_nom, l.numero_lot
       FROM commande_lignes cl
       LEFT JOIN produits p ON p.id = cl.produit_id
       LEFT JOIN lots l ON l.id = cl.lot_id
       WHERE cl.commande_id = $1`,
      [req.params.id]
    );
    res.json({ ...cmdRes.rows[0], lignes: lignesRes.rows });
  });

  // Applique une remise à une ligne. Hypothèse retenue pour le type 'lot'
  // (ex: "9 achetés = 1 offert") : le prix unitaire ne change pas, mais des
  // unités gratuites s'ajoutent à la quantité prélevée en stock sans être
  // facturées — à ajuster si votre pratique commerciale diffère.
  function applyRemise(remise, qty, prixDetail) {
    if (!remise) return { unitPrice: prixDetail, freeUnits: 0 };
    if (remise.type === 'pourcentage') {
      return { unitPrice: prixDetail * (1 - remise.pourcentage / 100), freeUnits: 0 };
    }
    if (remise.type === 'lot' && remise.achete) {
      const freeUnits = Math.floor(qty / remise.achete) * (remise.gratuit || 0);
      return { unitPrice: prixDetail, freeUnits };
    }
    return { unitPrice: prixDetail, freeUnits: 0 };
  }

  router.post('/', enTransaction(pool, async (req, res, next, pool) => {
    try {
      const { client_id, statut, notes, employe_id, lignes, accepter_attente } = req.body;
      if (!client_id) return res.status(400).json({ error: 'client_id est requis.' });
      if (!Array.isArray(lignes) || !lignes.length) {
        return res.status(400).json({ error: 'Au moins une ligne est requise.' });
      }

      const numero = await nextNumero(pool, 'commande_seq', 'CMD');
      const groupId = require('crypto').randomUUID();
      const lignesAConstruire = [];
      const notificationsAPreparer = [];
      let total = 0;
      let commandeEnAttente = false;

      for (const l of lignes) {
        if (!l.produit_id || !l.qty) {
          return res.status(400).json({ error: 'Chaque ligne nécessite produit_id et qty.' });
        }
        const prodRes = await pool.query(
          'SELECT p.*, u.code AS unite_code FROM produits p LEFT JOIN unites u ON u.id = p.unite_id WHERE p.id = $1', [l.produit_id]);
        const produit = prodRes.rows[0];
        if (!produit) return res.status(400).json({ error: `Produit ${l.produit_id} introuvable.` });
        positif(l.qty, `La quantité de « ${produit.nom} »`);
        entierSiUnite(l.qty, produit.unite_code, `La quantité de « ${produit.nom} »`);
        const prixDetail = positifOuZero(l.prix_detail ?? produit.prix_vente, `Le prix de « ${produit.nom} »`);

        let remise = null;
        if (l.remise_id) {
          const remiseRes = await pool.query('SELECT * FROM remises WHERE id = $1', [l.remise_id]);
          remise = remiseRes.rows[0] || null;
        }
        const { unitPrice, freeUnits } = applyRemise(remise, l.qty, prixDetail);
        const qtePrelevee = Number(l.qty) + freeUnits;
        const ligneTotal = Number(l.qty) * unitPrice;
        total += ligneTotal;

        // Sélection FIFO d'un lot disponible — pas de fractionnement multi-lots
        // dans cette première version : si aucun lot seul ne couvre la quantité,
        // on regarde s'il existe du vrac (produits.produit_source_id) pour ce
        // format — si oui, la ligne passe "en attente" (pas d'échec de la
        // commande entière, une notification est créée) ; sinon, refus classique.
        const lotRes = await pool.query(
          `SELECT id, numero_lot, quantite_actuelle FROM lots
           WHERE produit_id = $1 AND ${LOT_DISPONIBLE} AND quantite_actuelle >= $2
           ORDER BY ${ORDRE_FEFO} LIMIT 1`,
          [l.produit_id, qtePrelevee]
        );
        const lot = lotRes.rows[0];

        if (!lot) {
          let vracTotal = 0;
          if (produit.produit_source_id) {
            const vracRes = await pool.query(
              `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND ${LOT_DISPONIBLE}`,
              [produit.produit_source_id]
            );
            vracTotal = Number(vracRes.rows[0].total);
          }
          // Rupture acceptée (commande saisie hors ligne puis corrigée) : la ligne
          // attend une production, la commande n'est pas refusée.
          const ruptureAcceptee = vracTotal <= 0 && (accepter_attente || l.accepter_attente);
          if (vracTotal > 0 || ruptureAcceptee) {
            // Vrac disponible : la ligne reste en attente de conditionnement,
            // la commande n'est PAS refusée.
            commandeEnAttente = true;
            lignesAConstruire.push({
              produit_id: l.produit_id, lot_id: null, numero_lot: null,
              qty: l.qty, prixDetail, unitPrice, ligneTotal, remise, freeUnits, qtePrelevee, enAttente: true,
            });
            notificationsAPreparer.push({
              produit_id: l.produit_id, produit_nom: produit.nom, demande: qtePrelevee, vracDisponible: vracTotal, rupture: ruptureAcceptee,
            });
            continue;
          }
          const stockRes = await pool.query(
            `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND ${LOT_DISPONIBLE}`,
            [l.produit_id]
          );
          return res.status(409).json({
            error: `Stock insuffisant pour "${produit.nom}" — demandé ${qtePrelevee}, disponible (tous lots confondus) ${stockRes.rows[0].total}. Aucun lot seul ne couvre la quantité, et aucun vrac correspondant n'est disponible.`,
          });
        }

        lignesAConstruire.push({
          produit_id: l.produit_id, lot_id: lot.id, numero_lot: lot.numero_lot,
          qty: l.qty, prixDetail, unitPrice, ligneTotal, remise, freeUnits, qtePrelevee, enAttente: false,
        });
      }

      const statutFinal = commandeEnAttente ? 'en_attente' : (statut || 'confirmee');
      const cmdRes = await pool.query(
        `INSERT INTO commandes (numero, client_id, statut, notes, total, employe_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [numero, client_id, statutFinal, notes || null, total, employe_id || null]
      );
      const commandeId = cmdRes.insertId;

      for (const l of lignesAConstruire) {
        await pool.query(
          `INSERT INTO commande_lignes
            (commande_id, produit_id, lot_id, qty, prix_detail, unit_price, total, remise_id, remise_nom, remise_pct, remise_type, free_units)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            commandeId, l.produit_id, l.lot_id, l.qty, l.prixDetail, l.unitPrice, l.ligneTotal,
            l.remise ? l.remise.id : null, l.remise ? l.remise.nom : null,
            l.remise ? l.remise.pourcentage : null, l.remise ? l.remise.type : null, l.freeUnits,
          ]
        );

        if (l.enAttente) continue; // rien à décrémenter, en attente de conditionnement

        await decrementerLot(pool, l.lot_id, l.qtePrelevee);
        const lotApres = await pool.query('SELECT quantite_actuelle FROM lots WHERE id = $1', [l.lot_id]);
        if (Number(lotApres.rows[0].quantite_actuelle) <= 0) {
          await pool.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1`, [l.lot_id]);
          await pool.query(
            `INSERT INTO lot_statuts_historique (lot_id, statut, motif, employe_id) VALUES ($1,'EPUISE','Stock épuisé après vente',$2)`,
            [l.lot_id, employe_id || null]
          );
        }

        await pool.query(
          `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, group_id, employe_id)
           VALUES ($1,'VENTE','SORTIE',$2,$3,$4,'commande',$5,$6,$7)`,
          // N° issu de la séquence : l'ancien `MVT-<commande>-<produit>` entrait en
          // collision quand un même produit figurait sur deux lignes.
          [await nextNumero(pool, 'mouvement_seq', 'MVT'), l.produit_id, l.lot_id, l.qtePrelevee, commandeId, groupId, employe_id || null]
        );
      }

      for (const n of notificationsAPreparer) {
        if (n.rupture) {
          await pool.query(
            `INSERT INTO notifications (type, titre, message, commande_id, produit_id) VALUES ('RUPTURE', $1, $2, $3, $4)`,
            [`Rupture — ${n.produit_nom}`,
             `La commande ${numero} attend ${n.demande} × "${n.produit_nom}" : plus de stock ni de vrac. Une production est nécessaire pour la livrer.`,
             commandeId, n.produit_id]);
          continue;
        }
        await pool.query(
          `INSERT INTO notifications (type, titre, message, commande_id, produit_id)
           VALUES ('STOCK_FORMAT_MANQUANT', $1, $2, $3, $4)`,
          [
            `Format manquant — ${n.produit_nom}`,
            `La commande ${numero} demande ${n.demande} × "${n.produit_nom}", indisponible dans ce format. Du vrac est disponible (${n.vracDisponible}) — un conditionnement est nécessaire pour débloquer cette ligne.`,
            commandeId, n.produit_id,
          ]
        );
      }

      const result = await pool.query('SELECT * FROM commandes WHERE id = $1', [commandeId]);
      res.status(201).json({ ...result.rows[0], lignes: lignesAConstruire, notifications_creees: notificationsAPreparer.length });
    } catch (err) { next(err); }
  }));

  // Modification limitée aux notes — les lignes ont déjà décrémenté du stock
  // réel (FIFO) ; les rééditer nécessiterait la même logique de réversion que
  // l'annulation de facture, pas encore étendue à ce niveau.
  router.put('/:id', async (req, res) => {
    const { notes } = req.body;
    const updateRes = await pool.query('UPDATE commandes SET notes = $1 WHERE id = $2', [notes || null, req.params.id]);
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Commande introuvable.' });
    const result = await pool.query('SELECT * FROM commandes WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.put('/:id/statut', async (req, res) => {
    const { statut } = req.body;
    if (!statut) return res.status(400).json({ error: 'statut est requis.' });
    if (!STATUTS_COMMANDE.includes(statut)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs possibles : ${STATUTS_COMMANDE.join(', ')}. Pour annuler une vente, annulez sa facture (le stock est alors réintégré).` });
    }
    const cmdRes = await pool.query('SELECT * FROM commandes WHERE id = $1', [req.params.id]);
    const commande = cmdRes.rows[0];
    if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });
    if (commande.statut === 'annulee') return res.status(409).json({ error: `La commande ${commande.numero} est annulée : son statut ne change plus.` });
    // « Payée » suit l'argent réellement reçu : seulement si la facture est soldée.
    if (statut === 'payee') {
      const fac = await pool.query(
        `SELECT f.numero, f.total_ttc - COALESCE((SELECT SUM(montant) FROM paiements p WHERE p.facture_id = f.id AND p.annule_le IS NULL), 0)
                - COALESCE((SELECT SUM(total_ttc) FROM avoirs a WHERE a.facture_id = f.id), 0) AS solde
         FROM factures f WHERE f.commande_id = $1 AND f.statut = 'emise'`, [req.params.id]);
      if (!fac.rows[0]) return res.status(409).json({ error: `La commande ${commande.numero} n'est pas facturée : elle ne peut pas être « payée ». Émettez la facture puis encaissez-la.` });
      if (Number(fac.rows[0].solde) > 0.0005) return res.status(409).json({ error: `La facture ${fac.rows[0].numero} n'est pas soldée (reste ${Number(fac.rows[0].solde).toFixed(3)} DT) : encaissez-la, la commande passera « payée » d'elle-même.` });
    }
    await pool.query('UPDATE commandes SET statut = $1 WHERE id = $2', [statut, req.params.id]);
    const result = await pool.query('SELECT * FROM commandes WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  // Annule une commande non facturée (le client renonce) : le stock sorti à la
  // commande est réintégré. Une commande facturée s'annule par sa facture.
  router.post('/:id/annuler', requireRole('gerant'), enTransaction(pool, async (req, res, next, pool) => {
    const motif = String(req.body?.motif || '').trim();
    if (!motif) return res.status(400).json({ error: "Le motif de l'annulation est requis." });
    const cmdRes = await pool.query('SELECT * FROM commandes WHERE id = $1 FOR UPDATE', [req.params.id]);
    const commande = cmdRes.rows[0];
    if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });
    if (commande.statut === 'annulee') return res.status(409).json({ error: `La commande ${commande.numero} est déjà annulée.` });
    const facs = await pool.query(`SELECT numero, statut FROM factures WHERE commande_id = $1`, [req.params.id]);
    const emise = facs.rows.find(f => f.statut === 'emise');
    if (emise) return res.status(409).json({ error: `La commande ${commande.numero} est facturée (${emise.numero}) : émettez un avoir sur la facture.` });

    // Sans aucune facture, le stock est encore sorti : on le réintègre. Après
    // une facture annulée, il l'a déjà été — ne pas le rendre deux fois.
    if (!facs.rows.length) {
      const lignes = await pool.query('SELECT * FROM commande_lignes WHERE commande_id = $1 AND lot_id IS NOT NULL', [req.params.id]);
      for (const l of lignes.rows) {
        const qte = Number(l.qty) + Number(l.free_units || 0);
        await pool.query('UPDATE lots SET quantite_actuelle = quantite_actuelle + $1 WHERE id = $2', [qte, l.lot_id]);
        await pool.query(`UPDATE lots SET statut = 'LIBERE' WHERE id = $1 AND statut = 'EPUISE'`, [l.lot_id]);
        await pool.query(
          `INSERT INTO stock_mouvements (numero, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note)
           VALUES ($1,'RETOUR_CLIENT','ENTREE',$2,$3,$4,'commande',$5,$6)`,
          [await nextNumero(pool, 'mouvement_seq', 'MVT'), l.produit_id, l.lot_id, qte, req.params.id, `Annulation commande : ${motif}`.slice(0, 255)]
        );
      }
    }
    await pool.query(`UPDATE notifications SET statut = 'RESOLUE' WHERE commande_id = $1 AND statut = 'EN_ATTENTE'`, [req.params.id]);
    await pool.query(
      `UPDATE commandes SET statut = 'annulee', notes = CONCAT(COALESCE(notes, ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE '\n' END, $1) WHERE id = $2`,
      [`Annulée : ${motif}`, req.params.id]
    );
    const result = await pool.query('SELECT * FROM commandes WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  }));

  return router;
};
