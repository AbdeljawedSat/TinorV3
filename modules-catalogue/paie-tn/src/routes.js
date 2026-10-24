'use strict';
/**
 * Routeur Express du module paie — à monter dans tinor-api-v3 : app.use('/api/paie', routeur).
 * Toutes les routes exigent un utilisateur identifié (fourni par l'authentification TinOR via options.utilisateur).
 */
const crypto = require('crypto');
const express = require('express');
const { RegleMetier, AccesRefuse, droits, exiger, libelle } = require('./service');
const { bulletinsHtml } = require('./bulletin-html');
const exportsEtats = require('./exports');
const { MOTEUR } = require('./engine/moteur');

const ROLES = ['ADMIN', 'GESTIONNAIRE', 'VALIDEUR', 'CONSULTATION'];

/** Lecture par défaut de l'utilisateur TinOR : req.user = { login|username|email|id, paieRole|role }. */
function utilisateurParDefaut(req) {
  const u = req.user;
  if (!u) return null;
  const login = u.login || u.username || u.email || (u.id != null ? String(u.id) : null);
  let role = u.paieRole || (u.role && String(u.role).toUpperCase());
  if (role === 'ADMINISTRATEUR') role = 'ADMIN';
  if (!ROLES.includes(role)) role = 'CONSULTATION';
  return login ? { login, role } : null;
}

function creerRouteur(service, options = {}) {
  const lireUtilisateur = options.utilisateur || utilisateurParDefaut;
  const r = express.Router();
  r.use(express.json({ limit: '1mb' }));

  // identification obligatoire
  r.use((req, res, next) => {
    const u = lireUtilisateur(req);
    if (!u || !u.login || !ROLES.includes(u.role)) return res.status(401).json({ erreur: 'Authentification requise' });
    req.paieUser = u;
    next();
  });

  const h = (fn) => async (req, res) => {
    try {
      const out = await fn(req, res, req.paieUser);
      if (!res.headersSent) res.json(out === undefined ? { ok: true } : out);
    } catch (e) {
      if (e instanceof RegleMetier || e instanceof AccesRefuse || e.status === 501) return res.status(e.status).json({ erreur: e.message });
      console.error('[tinor-paie]', e);
      res.status(500).json({ erreur: 'Erreur interne du module paie. Consulter les journaux du serveur.' });
    }
  };
  const id = (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new RegleMetier('Identifiant invalide');
    return n;
  };

  r.get('/meta', h(async (req, res, u) => ({
    moteur: MOTEUR, paramsVersion: service.ref.version, controleDeuxNiveaux: service.controleDeuxNiveaux,
    utilisateur: u, droits: droits(u),
    rubriques: [...service.ref.rubriques.values()].map(({ code, libelle: lib, type, mode, cnss, irpp }) => ({ code, libelle: lib, type, mode, cnss, irpp })),
  })));

  // Entreprise
  r.get('/entreprise', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.entreprise(); }));
  r.put('/entreprise', h(async (req, res, u) => service.enregistrerEntreprise(u, req.body || {})));

  // Salariés & contrats
  r.get('/salaries', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.salaries({ q: req.query.q, inactifs: req.query.inactifs === '1' }); }));
  r.post('/salaries', h(async (req, res, u) => { res.status(201); return service.enregistrerSalarie(u, req.body || {}); }));
  r.put('/salaries/:id', h(async (req, res, u) => service.enregistrerSalarie(u, req.body || {}, id(req.params.id))));
  r.get('/salaries/:id/contrats', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.contrats(id(req.params.id)); }));
  r.post('/salaries/:id/contrats', h(async (req, res, u) => { res.status(201); return service.ajouterContrat(u, id(req.params.id), req.body || {}); }));

  // Périodes & workflow
  r.get('/periodes', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.periodes(); }));
  r.post('/periodes', h(async (req, res, u) => { res.status(201); return service.creerPeriode(u, req.body?.annee, req.body?.mois); }));
  r.get('/periodes/:id/variables', h(async (req, res, u) => {
    exiger(u, 'CONSULTER');
    return service.variables(id(req.params.id), req.query.salarieId ? id(req.query.salarieId) : null);
  }));
  r.post('/periodes/:id/variables', h(async (req, res, u) => { res.status(201); return service.ajouterVariable(u, id(req.params.id), req.body || {}); }));
  r.delete('/variables/:id', h(async (req, res, u) => service.supprimerVariable(u, id(req.params.id))));
  r.post('/periodes/:id/apercu', h(async (req, res, u) => service.apercu(u, id(req.params.id), id(req.body?.salarieId))));
  r.post('/periodes/:id/simuler', h(async (req, res, u) => service.simuler(u, id(req.params.id))));
  r.get('/periodes/:id/calculs', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.calculs(id(req.params.id)); }));
  r.get('/periodes/:id/controle-validation', h(async (req, res, u) => ({ avertissements: await service.controlerAvantValidation(u, id(req.params.id)) })));
  r.post('/periodes/:id/valider', h(async (req, res, u) => service.valider(u, id(req.params.id))));
  r.post('/periodes/:id/cloturer', h(async (req, res, u) => service.cloturer(u, id(req.params.id))));
  r.post('/periodes/:id/rouvrir', h(async (req, res, u) => service.rouvrir(u, id(req.params.id), req.body?.motif)));
  r.get('/periodes/:id/comparer/:salarieId', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.comparer(id(req.params.id), id(req.params.salarieId)); }));

  // Calcul sans état (simulateur)
  r.post('/calcul', h(async (req, res, u) => service.calculer(u, req.body || {})));

  // Bulletins HTML imprimables : ?salarieId=… (sinon tous), ?langue=fr-ar, ?imprimer=1
  r.get('/periodes/:id/bulletins', h(async (req, res, u) => {
    exiger(u, 'EXPORTER');
    const p = await service.periode(id(req.params.id));
    let calculs = await service.calculs(p.id);
    if (req.query.salarieId) calculs = calculs.filter((k) => k.salarieId === id(req.query.salarieId));
    if (!calculs.length) throw new RegleMetier('Aucun bulletin pour cette sélection : lancer la simulation');
    const ent = await service.entreprise();
    const html = bulletinsHtml(calculs.map((k) => ({ entreprise: ent, salarie: k.salarie, periode: p, calcul: k, resultat: k.resultat })),
      { bilingue: req.query.langue === 'fr-ar', impressionAuto: req.query.imprimer === '1' });
    const sha = crypto.createHash('sha256').update(html).digest('hex');
    for (const k of calculs) await service.tracerExport(u, p.id, k.salarieId, 'BULLETIN', k.id, `bulletin ${libelle(p)} ${k.salarie.matricule} v${k.version}`, sha);
    res.type('html').set('Cache-Control', 'no-store').send(html);
  }));

  // États : /periodes/:id/etats/livre-paie.csv | .xlsx
  r.get('/periodes/:id/etats/:fichier', h(async (req, res, u) => {
    exiger(u, 'EXPORTER');
    const m = /^([a-z-]+)\.(csv|xlsx)$/.exec(req.params.fichier);
    if (!m || !exportsEtats.TYPES[m[1]]) throw new RegleMetier('État inconnu');
    const p = await service.periode(id(req.params.id));
    const calculs = await service.calculs(p.id);
    if (!calculs.length) throw new RegleMetier('Aucun calcul pour cette période');
    const nom = `${m[1]}_${libelle(p)}.${m[2]}`;
    const corps = m[2] === 'csv' ? Buffer.from(exportsEtats.csv(m[1], libelle(p), calculs), 'utf8') : await exportsEtats.xlsx(m[1], libelle(p), calculs);
    await service.tracerExport(u, p.id, null, m[1].toUpperCase().replace(/-/g, '_'), null, nom, crypto.createHash('sha256').update(corps).digest('hex'));
    res.set('Content-Disposition', `attachment; filename="${nom}"`).set('Cache-Control', 'no-store')
      .type(m[2] === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(corps);
  }));

  // Paramètres réglementaires
  r.get('/parametres', h(async (req, res, u) => { exiger(u, 'CONSULTER'); return service.elementsReglementaires(); }));
  r.post('/parametres/versions', h(async (req, res, u) => { res.status(201); return service.ajouterVersion(u, req.body || {}); }));
  r.delete('/parametres/versions/:id', h(async (req, res, u) => service.supprimerVersion(u, id(req.params.id))));
  r.post('/parametres/validations', h(async (req, res, u) => service.validerParametre(u, req.body || {})));
  r.delete('/parametres/validations', h(async (req, res, u) => service.retirerValidation(u, String(req.query.code || ''), String(req.query.debut || ''))));

  // Journal
  r.get('/journal', h(async (req, res, u) => service.journal(u, req.query.q)));

  return r;
}

module.exports = { creerRouteur, utilisateurParDefaut, ROLES };
