// Numérotation des opérations : choix du format par opération (actuel / proposé / personnalisé).
const express = require('express');
const { requireRole } = require('../middleware/auth');
const numerotation = require('../services/numerotation');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    res.json(await numerotation.lister(pool));
  });

  // Aperçu en direct d'un format (n'avance aucun compteur).
  router.post('/apercu', async (req, res) => {
    const { cle, zones, n, ...ctx } = req.body;
    if (!numerotation.PAR_CLE[cle]) return res.status(404).json({ error: 'Opération inconnue.' });
    res.json(await numerotation.apercu(pool, cle, zones, ctx, Math.min(10, Number(n) || 3)));
  });

  router.put('/:cle', requireRole('gerant'), async (req, res) => {
    if (!numerotation.PAR_CLE[req.params.cle]) return res.status(404).json({ error: 'Opération inconnue.' });
    await numerotation.enregistrer(pool, req.params.cle, req.body, req.user && req.user.id);
    res.json((await numerotation.lister(pool)).find(o => o.cle === req.params.cle));
  });

  return router;
};
