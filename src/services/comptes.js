// Règles des comptes utilisateurs : mot de passe (longueur et liste de mots de passe trop courants, sans règle de
// composition — recommandation NIST SP 800-63B), identifiant, rôle.
const { ROLES } = require('./droits');

const COURANTS = new Set(['changeme', 'password', 'motdepasse', 'azerty', 'azertyuiop', 'qwerty', 'qwertyuiop', 'tinor', 'tinor123', 'tinorv3',
  'admin', 'administrateur', 'admin123', '123456', '12345678', '123456789', '1234567890', '0123456789', '11111111', '00000000', 'jardinsdejerba', 'letmein', 'welcome']);
const MIN_MDP = 10;

function validerMotDePasse(mdp, username = '') {
  const m = String(mdp ?? '');
  if (m.length < MIN_MDP) return `Le mot de passe doit faire au moins ${MIN_MDP} caractères (une phrase facile à retenir convient).`;
  if (m.length > 128) return 'Mot de passe trop long (128 caractères maximum).';
  const compact = m.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COURANTS.has(m.toLowerCase()) || COURANTS.has(compact) || /^(.)\1+$/.test(m)) return 'Ce mot de passe est trop courant : choisissez-en un autre.';
  if (username && compact.includes(String(username).toLowerCase().replace(/[^a-z0-9]/g, '')) && String(username).length >= 3) return 'Le mot de passe ne doit pas contenir l\'identifiant.';
  return null;
}
function validerIdentifiant(u) {
  return /^[A-Za-z0-9._@-]{3,40}$/.test(String(u ?? '')) ? null : 'Identifiant : 3 à 40 caractères (lettres, chiffres, . _ - @), sans espace.';
}
const validerRole = (r) => (ROLES.includes(r) ? null : `Rôle inconnu : choisir parmi ${ROLES.join(', ')}.`);

module.exports = { validerMotDePasse, validerIdentifiant, validerRole, MIN_MDP };
