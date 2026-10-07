const express = require('express');

// Synchronisation des téléphones utilisés hors ligne.
module.exports = function (pool) {
  const router = express.Router();

  // Une opération faite hors ligne a été refusée au retour du réseau (stock
  // insuffisant, lot épuisé…) : on prévient aussi le bureau (écran Notifications).
  router.post('/conflits', async (req, res) => {
    const nettoyer = v => String(v ?? '').replace(/[<>]/g, ''); // texte affiché tel quel dans la console
    const libelle = nettoyer(req.body?.libelle), erreur = nettoyer(req.body?.erreur), numero_provisoire = nettoyer(req.body?.numero_provisoire);
    if (!libelle || !erreur) return res.status(400).json({ error: 'libelle et erreur sont requis.' });
    const qui = req.user && req.user.username ? ` (saisie par ${req.user.username})` : '';
    const ins = await pool.query(
      `INSERT INTO notifications (type, titre, message) VALUES ('SYNC_CONFLIT', $1, $2)`,
      [`Opération hors ligne à corriger — ${String(libelle).slice(0, 90)}`,
       `${numero_provisoire ? numero_provisoire + ' : ' : ''}${String(erreur).slice(0, 900)}${qui}. À corriger sur le téléphone (écran Synchronisation).`]);
    res.status(201).json({ id: ins.insertId });
  });

  // La correction a été faite (renvoyée ou abandonnée) : la notification est résolue.
  router.post('/conflits/resolus', async (req, res) => {
    const numero_provisoire = String(req.body?.numero_provisoire ?? '').replace(/[<>%_]/g, '');
    if (!numero_provisoire) return res.status(400).json({ error: 'numero_provisoire est requis.' });
    await pool.query(
      `UPDATE notifications SET statut = 'RESOLUE', resolved_at = NOW()
       WHERE type = 'SYNC_CONFLIT' AND statut = 'EN_ATTENTE' AND message LIKE $1`, [`${numero_provisoire} :%`]);
    res.json({ ok: true });
  });

  return router;
};
