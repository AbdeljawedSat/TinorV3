// Modules : liste pour la console (tous les utilisateurs) et administration (gérant : /api/modules-admin).
const express = require('express');
const fs = require('fs');

function routeurListe(pool, modules) {
  const router = express.Router();
  // Modules actifs auxquels l'utilisateur a accès : la console en fait des entrées de menu.
  router.get('/', async (req, res) => {
    await modules.pret;
    const surcharges = new Map((await pool.query('SELECT module_id, role FROM modules_droits WHERE user_id = $1', [req.user.id])).rows.map(r => [r.module_id, r.role]));
    const sortie = [];
    for (const [id, m] of modules.actifs) {
      if (!m.manifeste.ecran) continue;
      const role = modules.roleDans(m.manifeste, { id: req.user.id, role: req.user.role }, new Map(surcharges.has(id) ? [[req.user.id, surcharges.get(id)]] : []));
      if (!role) continue;
      sortie.push({ id, nom: m.manifeste.nom, version: m.manifeste.version, titre: m.manifeste.ecran.titre, icone: m.manifeste.ecran.icone || 'parametre', ui: m.manifeste.ecran.ui, api: `/api/m/${id}`, role });
    }
    res.json(sortie);
  });
  return router;
}

function routeurAdmin(pool, modules) {
  const router = express.Router();
  const zip = express.raw({ type: () => true, limit: '31mb' });

  router.get('/', async (req, res) => res.json({ installes: await modules.installes(), catalogue: await modules.catalogue() }));

  router.post('/installer', zip, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Envoyez le fichier .zip du module.' });
    res.status(201).json(await modules.installerDepuisZip(req.body, { par: req.user.username, activer: req.query.activer !== '0' }));
  });
  router.post('/installer-catalogue', async (req, res) => {
    const buffer = fs.readFileSync(modules.cheminCatalogue(req.body.fichier));
    res.status(201).json(await modules.installerDepuisZip(buffer, { par: req.user.username, activer: req.body.activer !== false }));
  });
  router.post('/:id/activer', async (req, res) => res.json(await modules.activer(req.params.id)));
  router.post('/:id/desactiver', async (req, res) => { await modules.desactiver(req.params.id); res.json({ ok: true }); });
  router.delete('/:id', async (req, res) => { await modules.retirer(req.params.id); res.status(204).end(); });

  router.get('/:id/config', async (req, res) => {
    if (!(await modules.ligne(req.params.id))) return res.status(404).json({ error: 'Module non installé.' });
    res.json(await modules.config(req.params.id));
  });
  router.put('/:id/config', async (req, res) => {
    if (!(await modules.ligne(req.params.id))) return res.status(404).json({ error: 'Module non installé.' });
    await modules.enregistrerConfig(req.params.id, req.body || {});
    res.json(await modules.config(req.params.id));
  });

  // Rôle de chaque utilisateur TinOR dans le module : choix explicite ou rôle par défaut.
  router.get('/:id/droits', async (req, res) => {
    if (!(await modules.ligne(req.params.id))) return res.status(404).json({ error: 'Module non installé.' });
    const { lireManifeste } = require('../services/modules');
    const m = lireManifeste(modules.dossier(req.params.id));
    const sauvegardes = await modules.droitsSauves(req.params.id);
    const users = (await pool.query('SELECT id, username, role, actif FROM users ORDER BY username')).rows;
    res.json({ roles: m.roles || null, utilisateurs: users.map(u => ({ user_id: u.id, username: u.username, role_tinor: u.role, actif: !!u.actif,
      choisi: sauvegardes.get(u.id) || null, effectif: modules.roleDans(m, { id: u.id, role: u.role }, sauvegardes) })) });
  });
  router.put('/:id/droits', async (req, res) => {
    if (!(await modules.ligne(req.params.id))) return res.status(404).json({ error: 'Module non installé.' });
    await modules.enregistrerDroits(req.params.id, Array.isArray(req.body.droits) ? req.body.droits : []);
    res.json({ ok: true });
  });
  return router;
}

module.exports = { routeurListe, routeurAdmin };
