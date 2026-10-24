'use strict';
// Point d'entrée du module pour TinOR : branche le moteur de paie (src/) sur la base et sur les droits de TinOR,
// et ajoute l'import des employés de TinOR (/tinor/employes, /tinor/importer) qui n'existe pas dans le moteur autonome.
// ctx : voir src/services/modules.js (pool brut dédié sans conversion des DECIMAL, utilisateur de la session, configuration).
const express = require('express');
const { installerPaie } = require('./src');
const { exiger, RegleMetier, AccesRefuse } = require('./src/service');

const DATE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = {
  async installer(ctx) {
    const config = ctx.config();
    const utilisateur = (req) => {
      const u = ctx.utilisateur(req);
      return u && u.role ? { login: u.login, role: u.role } : null; // rôle du module décidé par TinOR (Modules › Droits)
    };
    const routeur = await installerPaie({
      pool: await ctx.poolBrut(),                    // pool mysql2 dédié : les montants restent du texte exact (millimes)
      utilisateur,
      controleDeuxNiveaux: config.controleDeuxNiveaux !== false,
    });
    const service = routeur.service;

    const parent = express.Router();
    const h = (fn) => async (req, res) => {
      try { res.json(await fn(req, utilisateur(req))); }
      catch (e) {
        if (e instanceof RegleMetier || e instanceof AccesRefuse) return res.status(e.status).json({ erreur: e.message });
        console.error('[paie-tn]', e);
        res.status(500).json({ erreur: 'Erreur interne du module paie. Consulter les journaux du serveur.' });
      }
    };

    // Employés de TinOR (table employes) avec, pour chacun, le salarié de paie déjà créé à partir du même matricule.
    parent.get('/tinor/employes', h(async (req, u) => {
      exiger(u, 'GERER_SALARIES');
      const employes = (await ctx.pool.query('SELECT id, matricule, nom, prenom, fonction, date_entree, actif FROM employes ORDER BY nom, prenom')).rows;
      const existants = new Set((await service.salaries({ inactifs: true })).map(s => s.matricule));
      return employes.map(e => ({ id: e.id, matricule: e.matricule, nom: e.nom, prenom: e.prenom, fonction: e.fonction || '', actif: !!e.actif,
        dateEntree: e.date_entree ? new Date(e.date_entree).toISOString().slice(0, 10) : null, dejaImporte: existants.has(e.matricule) }));
    }));

    // Crée les salariés de paie sélectionnés : matricule, nom, prénom, fonction viennent de TinOR ; le reste (CNSS, famille, RIB,
    // contrat) se complète dans la fiche. Les employés déjà importés (même matricule) ne sont jamais écrasés.
    parent.post('/tinor/importer', h(async (req, u) => {
      exiger(u, 'GERER_SALARIES');
      const demandes = Array.isArray(req.body && req.body.employes) ? req.body.employes : [];
      if (!demandes.length) throw new RegleMetier('Cochez au moins un employé à importer');
      if (demandes.length > 500) throw new RegleMetier('500 employés au maximum par import');
      const importes = [], ignores = [];
      for (const d of demandes) {
        const e = (await ctx.pool.query('SELECT id, matricule, nom, prenom, fonction, date_entree, actif FROM employes WHERE id = $1', [Number(d.id)])).rows[0];
        if (!e) { ignores.push({ id: d.id, raison: 'employé introuvable dans TinOR' }); continue; }
        const dateEntree = d.dateEntree || (e.date_entree ? new Date(e.date_entree).toISOString().slice(0, 10) : '');
        if (!DATE.test(dateEntree)) { ignores.push({ matricule: e.matricule, raison: "date d'entrée manquante" }); continue; }
        try {
          const s = await service.enregistrerSalarie(u, { matricule: e.matricule, nom: e.nom, prenom: e.prenom, fonction: e.fonction, dateEntree, actif: !!e.actif });
          importes.push({ id: s.id, matricule: s.matricule });
        } catch (err) {
          if (err instanceof RegleMetier) ignores.push({ matricule: e.matricule, raison: /existe déjà/.test(err.message) ? 'déjà importé' : err.message });
          else throw err;
        }
      }
      if (importes.length) await service.audit(service.db, u, 'IMPORT', 'SALARIE', null, `${importes.length} salarié(s) importé(s) des employés de TinOR`);
      return { importes, ignores };
    }));

    parent.use(routeur);
    return parent;
  },
};
