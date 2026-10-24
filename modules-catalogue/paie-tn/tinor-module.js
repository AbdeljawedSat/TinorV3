'use strict';
// Point d'entrée du module pour TinOR : branche le moteur de paie (src/) sur la base et sur les droits de TinOR.
// ctx : voir src/services/modules.js (pool brut dédié sans conversion des DECIMAL, utilisateur de la session, configuration).
const { installerPaie } = require('./src');

module.exports = {
  async installer(ctx) {
    const config = ctx.config();
    const routeur = await installerPaie({
      pool: await ctx.poolBrut(),                    // pool mysql2 dédié : les montants restent du texte exact (millimes)
      utilisateur: (req) => {
        const u = ctx.utilisateur(req);
        return u && u.role ? { login: u.login, role: u.role } : null; // rôle du module décidé par TinOR (Modules › Droits)
      },
      controleDeuxNiveaux: config.controleDeuxNiveaux !== false,
    });
    return routeur;
  },
};
