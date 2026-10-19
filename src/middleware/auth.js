const jwt = require('jsonwebtoken');

const crypto = require('crypto');

// Clé de signature des connexions. Absente ou connue de tous (valeurs d'exemple) : une clé ALÉATOIRE est créée à chaque
// démarrage (personne ne peut forger de connexion ; chacun doit simplement se reconnecter après un redémarrage).
// Pour des connexions qui survivent aux redémarrages : JWT_SECRET dans .env (npm run setup en génère une).
const CLES_CONNUES = /^(dev-secret-change-me|change-moi-en-production|changeme|secret|jwt_secret)$/i;
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || CLES_CONNUES.test(JWT_SECRET) || JWT_SECRET.length < 16) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠ JWT_SECRET absent, trop court ou connu : clé aléatoire utilisée (connexions à refaire après chaque redémarrage). Définissez une longue chaîne aléatoire dans .env.');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Droits insuffisants pour cette action." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
