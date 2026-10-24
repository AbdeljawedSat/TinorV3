'use strict';
/**
 * tinor-paie — point d'entrée.
 *
 *   const { installerPaie } = require('./tinor-paie');
 *   app.use('/api/paie', await installerPaie({ pool, utilisateur: (req) => ({ login: req.user.login, role: 'GESTIONNAIRE' }) }));
 *
 * Le moteur seul (sans base) : const { MoteurPaie, Referentiel } = require('./tinor-paie');
 */
const { creerDb, migrer } = require('./db');
const { Referentiel } = require('./engine/referentiel');
const { MoteurPaie, MOTEUR, VERSION } = require('./engine/moteur');
const { PaieService, RegleMetier, AccesRefuse, DROITS } = require('./service');
const { creerRouteur, utilisateurParDefaut, ROLES } = require('./routes');
const { bulletinsHtml } = require('./bulletin-html');

/**
 * Crée le service et le routeur Express, après application des migrations SQL (tables paie_*).
 * @param {object} o
 * @param {object} o.pool              pool mariadb ou mysql2/promise de TinOR
 * @param {function} [o.utilisateur]   (req) => { login, role } ; role ∈ ADMIN | GESTIONNAIRE | VALIDEUR | CONSULTATION
 * @param {boolean} [o.controleDeuxNiveaux=true]
 * @param {string} [o.parametres] [o.rubriques]  fichiers JSON externes (sinon shared/ du module)
 * @param {boolean} [o.migrer=true]
 */
async function installerPaie(o) {
  const db = creerDb(o.pool);
  if (o.migrer !== false) {
    const faites = await migrer(db);
    if (faites.length) console.log('[tinor-paie] migrations appliquées :', faites.join(', '));
  }
  const ref = Referentiel.charger(o.parametres, o.rubriques);
  const service = new PaieService(db, ref, { controleDeuxNiveaux: o.controleDeuxNiveaux });
  await service.rechargerReferentiel(); // fichier + versions de paramètres saisies dans l'application
  const routeur = creerRouteur(service, { utilisateur: o.utilisateur });
  routeur.service = service;
  return routeur;
}

module.exports = {
  installerPaie, creerDb, migrer, Referentiel, MoteurPaie, MOTEUR, VERSION, PaieService, RegleMetier, AccesRefuse, DROITS,
  creerRouteur, utilisateurParDefaut, ROLES, bulletinsHtml,
};
