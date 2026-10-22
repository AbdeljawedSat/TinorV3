const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const { appliquerDroits } = require('./services/droits');
const { idempotence } = require('./middleware/idempotence');

// Console (admin/tinor_admin.html) : relue quand le fichier change (mise à jour par git pull).
// version = 10 premiers caractères du SHA-1 du fichier, calculée de la même façon au build Android.
const CONSOLE_FICHIER = require('path').join(__dirname, '..', 'admin', 'tinor_admin.html');
let consoleEnCache = { mtime: 0 };
function consoleActuelle() {
  const fs = require('fs');
  const mtime = fs.statSync(CONSOLE_FICHIER).mtimeMs;
  if (mtime !== consoleEnCache.mtime) {
    const brut = fs.readFileSync(CONSOLE_FICHIER);
    const version = require('crypto').createHash('sha1').update(brut).digest('hex').slice(0, 10);
    consoleEnCache = { mtime, version, html: brut.toString('utf8').replace("'__TINOR_CONSOLE__'", `'${version}'`) };
  }
  return consoleEnCache;
}

// Version installée (dernier commit git) : affichée sur l'écran de connexion pour vérifier
// qu'une mise à jour est bien arrivée. null si git n'est pas disponible.
let versionInstallee;
function miseAJourInstallee() {
  if (versionInstallee === undefined) {
    try {
      const [hash, date] = require('child_process').execFileSync('git', ['log', '-1', '--format=%h|%cI'],
        { cwd: require('path').join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim().split('|');
      versionInstallee = hash ? { commit: hash, date } : null;
    } catch { versionInstallee = null; }
  }
  return versionInstallee;
}

const ORIGINES_AUTORISEES = () => String(process.env.CORS_ORIGINS || '').split(',').map(x => x.trim().replace(/\/$/, '')).filter(Boolean);
function origineAutorisee(origine) {
  if (!origine) return true; // pas d'en-tête Origin : outil local, même site, application native
  if (origine === 'https://appassets.androidplatform.net') return true; // application Android
  if (ORIGINES_AUTORISEES().includes(origine)) return true;
  let h;
  try { h = new URL(origine).hostname; } catch { return false; }
  return h === 'localhost' || h === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith('.local');
}

function createApp(pool) {
  const app = express();
  // Chrome / WebView récents : une page https (application Android) qui appelle
  // une adresse du réseau local (192.168.x.x) doit y être autorisée explicitement.
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS' && req.get('Access-Control-Request-Private-Network')) res.set('Access-Control-Allow-Private-Network', 'true');
    next();
  });
  // Derrière un hébergeur (Railway, Render…), l'adresse réelle du client est dans X-Forwarded-For : TRUST_PROXY=1 l'active.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.disable('x-powered-by');
  // En-têtes de protection (équivalent minimal de helmet) ; HSTS seulement si la requête est arrivée en HTTPS.
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000');
    next();
  });
  // CORS : la console servie par l'API (même adresse), l'application Android, localhost et le réseau local sont acceptés ;
  // tout autre site doit être listé dans CORS_ORIGINS (adresses séparées par des virgules).
  app.use(cors({ origin: (origine, rappel) => rappel(null, origineAutorisee(origine)) }));
  app.use(express.json({ limit: '8mb' })); // logo de la société envoyé avec les exports (data URI)

  // Console d'administration servie par l'API : https://<domaine>/ ouvre la
  // console, déjà reliée à cette API, et installable comme application.
  // La page est servie avec sa version (empreinte du fichier) : la console compare avec
  // /api/health → « console » et signale une fenêtre pas à jour (cache du navigateur,
  // application Android plus ancienne que le serveur). Jamais gardée en cache sans vérification.
  app.get(['/', '/tinor_admin.html'], (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(consoleActuelle().html);
  });
  app.use(express.static(require('path').join(__dirname, '..', 'admin'), {
    index: 'tinor_admin.html',
    setHeaders: (res, fichier) => { if (/\.(html|js|json)$/.test(fichier)) res.set('Cache-Control', 'no-cache'); },
  }));

  // version : génération d'API (détection par la console) ; release : numéro de la version livrée.
  app.get('/api/health', (req, res) => res.json({ ok: true, version: 'v3', release: require('../package.json').version,
    environnement: require('./env').environnement(), // « TEST » → bandeau orange dans la console
    console: (() => { try { return consoleActuelle().version; } catch { return null; } })(), mise_a_jour: miseAJourInstallee() }));

  const acces = [requireAuth, appliquerDroits(pool)]; // connecté + droits du rôle (voir services/droits.js)
  app.use('/api', require('./middleware/saisie').refuserBalises);
  app.use('/api', require('./middleware/audit').audit(pool));
  app.use('/api/auth', require('./routes/auth')(pool));
  // Opérations renvoyées par un téléphone (hors ligne) : jamais enregistrées deux fois.
  app.use('/api', idempotence(pool));
  app.use('/api/sync', acces, require('./routes/sync')(pool));

  app.use('/api/produits', acces, require('./routes/produits')(pool));
  app.use('/api', acces, require('./routes/referentiels')(pool));
  app.use('/api/lots', acces, require('./routes/lots')(pool));
  app.use('/api/lot-type-champs', acces, require('./routes/lotTypeChamps')(pool));
  app.use('/api/fournisseurs', acces, require('./routes/fournisseurs')(pool));
  app.use('/api/clients', acces, require('./routes/clients')(pool));
  app.use('/api/locaux', acces, require('./routes/locaux')(pool));
  app.use('/api/employes', acces, require('./routes/employes')(pool));
  app.use('/api/users', acces, require('./routes/users')(pool));
  app.use('/api/achats', acces, require('./routes/achats')(pool));
  app.use('/api/receptions', acces, require('./routes/receptions')(pool));
  app.use('/api/stock-mouvements', acces, require('./routes/stockMouvements')(pool));
  app.use('/api/notifications', acces, require('./routes/notifications')(pool));
  app.use('/api/remises', acces, require('./routes/remises')(pool));
  app.use('/api/commandes', acces, require('./routes/commandes')(pool));
  app.use('/api/factures', acces, require('./routes/factures')(pool));
  app.use('/api/livraisons', acces, require('./routes/livraisons')(pool));
  app.use('/api/proformas', acces, require('./routes/proformas')(pool));
  app.use('/api/presse', acces, require('./routes/presse')(pool));
  app.use('/api/filtration', acces, require('./routes/filtration')(pool));
  app.use('/api/melanges', acces, require('./routes/melanges')(pool));
  app.use('/api/conditionnement', acces, require('./routes/conditionnement')(pool));
  app.use('/api/recettes', acces, require('./routes/recettes')(pool));
  app.use('/api/ordres-production', acces, require('./routes/ordresProduction')(pool));
  app.use('/api/settings', acces, require('./routes/settings')(pool));
  app.use('/api/audit', acces, require('./routes/audit')(pool));
  app.use('/api/numerotation', acces, require('./routes/numerotation')(pool));
  app.use('/api/certificats', acces, require('./routes/certificats')(pool));
  app.use('/api/paiements', acces, require('./routes/paiements')(pool));
  app.use('/api/avoirs', acces, require('./routes/avoirs')(pool));
  app.use('/api/exports', acces, require('./routes/exports')(pool));
  app.use('/api/backup', acces, require('./routes/backup')());
  app.use('/api/stats', acces, require('./routes/stats')(pool));
  app.use('/api/grille-huiles', acces, require('./routes/grilleHuiles')(pool));
  app.use('/api/alertes', acces, require('./routes/alertes')(pool));
  app.use('/api/inventaires', acces, require('./routes/inventaires')(pool));
  app.use('/api/reprises', acces, require('./routes/reprises')(pool)); // reprise du stock existant (n° de lot gardés)
  app.use('/api/controle-stock', acces, require('./routes/controleStock')(pool));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
  });

  return app;
}

module.exports = createApp;
module.exports.origineAutorisee = origineAutorisee;
