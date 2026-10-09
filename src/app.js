const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const { idempotence } = require('./middleware/idempotence');

function createApp(pool) {
  const app = express();
  // Chrome / WebView récents : une page https (application Android) qui appelle
  // une adresse du réseau local (192.168.x.x) doit y être autorisée explicitement.
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS' && req.get('Access-Control-Request-Private-Network')) res.set('Access-Control-Allow-Private-Network', 'true');
    next();
  });
  app.use(cors());
  app.use(express.json({ limit: '8mb' })); // logo de la société envoyé avec les exports (data URI)

  // Console d'administration servie par l'API : https://<domaine>/ ouvre la
  // console, déjà reliée à cette API, et installable comme application.
  app.use(express.static(require('path').join(__dirname, '..', 'admin'), { index: 'tinor_admin.html' }));

  // version : génération d'API (détection par la console) ; release : numéro de la version livrée.
  app.get('/api/health', (req, res) => res.json({ ok: true, version: 'v3', release: require('../package.json').version }));

  app.use('/api/auth', require('./routes/auth')(pool));
  // Opérations renvoyées par un téléphone (hors ligne) : jamais enregistrées deux fois.
  app.use('/api', idempotence(pool));
  app.use('/api/sync', requireAuth, require('./routes/sync')(pool));

  app.use('/api/produits', requireAuth, require('./routes/produits')(pool));
  app.use('/api', requireAuth, require('./routes/referentiels')(pool));
  app.use('/api/lots', requireAuth, require('./routes/lots')(pool));
  app.use('/api/lot-type-champs', requireAuth, require('./routes/lotTypeChamps')(pool));
  app.use('/api/fournisseurs', requireAuth, require('./routes/fournisseurs')(pool));
  app.use('/api/clients', requireAuth, require('./routes/clients')(pool));
  app.use('/api/locaux', requireAuth, require('./routes/locaux')(pool));
  app.use('/api/employes', requireAuth, require('./routes/employes')(pool));
  app.use('/api/users', requireAuth, require('./routes/users')(pool));
  app.use('/api/achats', requireAuth, require('./routes/achats')(pool));
  app.use('/api/receptions', requireAuth, require('./routes/receptions')(pool));
  app.use('/api/stock-mouvements', requireAuth, require('./routes/stockMouvements')(pool));
  app.use('/api/notifications', requireAuth, require('./routes/notifications')(pool));
  app.use('/api/remises', requireAuth, require('./routes/remises')(pool));
  app.use('/api/commandes', requireAuth, require('./routes/commandes')(pool));
  app.use('/api/factures', requireAuth, require('./routes/factures')(pool));
  app.use('/api/livraisons', requireAuth, require('./routes/livraisons')(pool));
  app.use('/api/proformas', requireAuth, require('./routes/proformas')(pool));
  app.use('/api/presse', requireAuth, require('./routes/presse')(pool));
  app.use('/api/filtration', requireAuth, require('./routes/filtration')(pool));
  app.use('/api/conditionnement', requireAuth, require('./routes/conditionnement')(pool));
  app.use('/api/recettes', requireAuth, require('./routes/recettes')(pool));
  app.use('/api/ordres-production', requireAuth, require('./routes/ordresProduction')(pool));
  app.use('/api/settings', requireAuth, require('./routes/settings')(pool));
  app.use('/api/certificats', requireAuth, require('./routes/certificats')(pool));
  app.use('/api/paiements', requireAuth, require('./routes/paiements')(pool));
  app.use('/api/avoirs', requireAuth, require('./routes/avoirs')(pool));
  app.use('/api/exports', requireAuth, require('./routes/exports')(pool));
  app.use('/api/backup', requireAuth, require('./routes/backup')());
  app.use('/api/stats', requireAuth, require('./routes/stats')(pool));
  app.use('/api/grille-huiles', requireAuth, require('./routes/grilleHuiles')(pool));
  app.use('/api/alertes', requireAuth, require('./routes/alertes')(pool));
  app.use('/api/inventaires', requireAuth, require('./routes/inventaires')(pool));
  app.use('/api/controle-stock', requireAuth, require('./routes/controleStock')(pool));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
  });

  return app;
}

module.exports = createApp;
