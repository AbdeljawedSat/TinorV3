// Droits d'accès par rôle, appliqués côté serveur à toutes les routes (l'interface masque des boutons, mais seul le serveur fait foi).
//  - gerant      : tout.
//  - vendeur     : tout sauf l'administration (utilisateurs, paramètres, sauvegardes, journal d'audit).
//  - magasinier  : écritures sur le stock (lots, réceptions, inventaires, mouvements, locaux), achats et fournisseurs.
//  - production  : écritures sur la production (presse, filtration, mélange, conditionnement, recettes, ordres) et la qualité.
//  - comptable   : écritures sur factures, paiements, avoirs, achats, fournisseurs, clients.
// Tous les rôles peuvent LIRE (GET), sauf les rubriques d'administration. Un rôle limité ne peut écrire que dans ses rubriques.
const ROLES = ['gerant', 'vendeur', 'magasinier', 'production', 'comptable'];
const ROLES_LIBELLES = { gerant: 'Gérant', vendeur: 'Vendeur', magasinier: 'Magasinier', production: 'Production', comptable: 'Comptable' };
const ROLES_COMPLETS = ['gerant', 'vendeur']; // rôles historiques : tout sauf l'administration

const ADMIN = new Set(['users', 'backup', 'audit', 'modules-admin']); // lecture ET écriture réservées au gérant
const ADMIN_ECRITURE = new Set(['settings']);         // lecture ouverte (nom de l'entreprise…), écriture réservée au gérant

const ECRITURE = {
  magasinier: new Set(['lots', 'receptions', 'inventaires', 'reprises', 'controle-stock', 'stock-mouvements', 'locaux', 'notifications', 'alertes', 'achats', 'fournisseurs', 'certificats', 'qualite', 'auth']),
  production: new Set(['presse', 'filtration', 'melanges', 'conditionnement', 'recettes', 'ordres-production', 'lots', 'qualite', 'notifications', 'auth']),
  comptable: new Set(['factures', 'paiements', 'avoirs', 'achats', 'fournisseurs', 'clients', 'remises', 'exports', 'paiements-fournisseurs', 'couts', 'auth']),
};

// Renvoie null si l'accès est permis, sinon le message de refus.
function refus(role, methode, chemin) {
  const rubrique = String(chemin || '').replace(/^\/api\//, '').split(/[/?]/)[0];
  if (!ROLES.includes(role)) return 'Rôle inconnu.';
  if (role === 'gerant') return null;
  if (rubrique === 'm') return null; // modules : chaque module contrôle lui-même les rôles qu'il définit (voir Réglages › Modules)
  if (ADMIN.has(rubrique)) return 'Réservé au gérant.';
  const lecture = methode === 'GET' || methode === 'HEAD' || methode === 'OPTIONS';
  if (lecture) return null;
  if (ADMIN_ECRITURE.has(rubrique)) return 'Réservé au gérant.';
  if (rubrique === 'numerotation') return 'Réservé au gérant.';
  if (ROLES_COMPLETS.includes(role)) return null;
  if (!(ECRITURE[role] && ECRITURE[role].has(rubrique))) return `Votre rôle (${ROLES_LIBELLES[role]}) ne permet pas cette opération.`;
  return null;
}

// Middleware : relit l'utilisateur en base (compte désactivé ou rôle changé pris en compte sans attendre la fin du jeton),
// puis applique la matrice ci-dessus. Mis en cache 15 s.
const cache = new Map();
const oublier = (id) => cache.delete(Number(id)); // appelé quand un compte change (désactivation, rôle) : effet immédiat
function appliquerDroits(pool) {
  return async (req, res, next) => {
    if (!req.user) return next();
    let u = cache.get(req.user.id);
    if (!u || Date.now() - u.t > 15000) {
      const r = await pool.query('SELECT id, username, role, actif FROM users WHERE id = $1', [req.user.id]);
      u = { t: Date.now(), ligne: r.rows[0] || null };
      cache.set(req.user.id, u);
    }
    if (!u.ligne || !u.ligne.actif) return res.status(401).json({ error: 'Compte désactivé ou supprimé.' });
    req.user.role = u.ligne.role;
    const message = refus(req.user.role, req.method, req.originalUrl);
    if (message) return res.status(403).json({ error: message });
    next();
  };
}

module.exports = { oublier, ROLES, ROLES_LIBELLES, refus, appliquerDroits };
