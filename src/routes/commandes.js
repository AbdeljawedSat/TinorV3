const express = require('express');

async function nextNumero(pool, seqName, prefix) {
  const upd = await pool.query(`UPDATE sequences SET last_value = last_value + 1 WHERE name = $1`, [seqName]);
  if (!upd.affectedRows) {
    await pool.query(`INSERT INTO sequences (name, last_value) VALUES ($1, 1)`, [seqName]);
  }
  const cur = await pool.query(`SELECT last_value FROM sequences WHERE name = $1`, [seqName]);
  return `${prefix}-${String(cur.rows[0].last_value).padStart(4, '0')}`;
}

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

  router.post('/', async (req, res, next) => {
    try {
      const { client_id, statut, notes, employe_id, lignes } = req.body;
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
        const prodRes = await pool.query('SELECT * FROM produits WHERE id = $1', [l.produit_id]);
        const produit = prodRes.rows[0];
        if (!produit) return res.status(400).json({ error: `Produit ${l.produit_id} introuvable.` });
        const prixDetail = l.prix_detail ?? produit.prix_vente ?? 0;

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
           WHERE produit_id = $1 AND statut = 'LIBERE' AND quantite_actuelle >= $2
           ORDER BY created_at ASC LIMIT 1`,
          [l.produit_id, qtePrelevee]
        );
        const lot = lotRes.rows[0];

        if (!lot) {
          let vracTotal = 0;
          if (produit.produit_source_id) {
            const vracRes = await pool.query(
              `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND statut = 'LIBERE'`,
              [produit.produit_source_id]
            );
            vracTotal = Number(vracRes.rows[0].total);
          }
          if (vracTotal > 0) {
            // Vrac disponible : la ligne reste en attente de conditionnement,
            // la commande n'est PAS refusée.
            commandeEnAttente = true;
            lignesAConstruire.push({
              produit_id: l.produit_id, lot_id: null, numero_lot: null,
              qty: l.qty, prixDetail, unitPrice, ligneTotal, remise, freeUnits, qtePrelevee, enAttente: true,
            });
            notificationsAPreparer.push({
              produit_id: l.produit_id, produit_nom: produit.nom, demande: qtePrelevee, vracDisponible: vracTotal,
            });
            continue;
          }
          const stockRes = await pool.query(
            `SELECT COALESCE(SUM(quantite_actuelle),0) AS total FROM lots WHERE produit_id = $1 AND statut = 'LIBERE'`,
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

        await pool.query(
          `UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2`,
          [l.qtePrelevee, l.lot_id]
        );
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
          [`MVT-${numero}-${l.produit_id}`, l.produit_id, l.lot_id, l.qtePrelevee, commandeId, groupId, employe_id || null]
        );
      }

      for (const n of notificationsAPreparer) {
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
  });

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
    const updateRes = await pool.query('UPDATE commandes SET statut = $1 WHERE id = $2', [statut, req.params.id]);
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Commande introuvable.' });
    const result = await pool.query('SELECT * FROM commandes WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  return router;
};
