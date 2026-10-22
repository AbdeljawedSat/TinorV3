const express = require('express');
const bcrypt = require('bcryptjs');
const { validerMotDePasse, validerIdentifiant, validerRole } = require('../services/comptes');
const { ROLES, ROLES_LIBELLES, oublier } = require('../services/droits');

// Gérants actifs sauf celui qu'on modifie : il doit toujours en rester au moins un.
async function autresGerants(pool, id) {
  return Number((await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'gerant' AND actif = TRUE AND id <> $1`, [id])).rows[0].n);
}
const erreur = (res, message, status = 400) => res.status(status).json({ error: message });

module.exports = function (pool) {
  const router = express.Router();

  router.get('/roles', (req, res) => res.json(ROLES.map(code => ({ code, libelle: ROLES_LIBELLES[code] }))));

  router.get('/', async (req, res) => {
    const result = await pool.query(`
      SELECT u.id, u.username, u.role, u.actif, u.created_at, u.employe_id,
        e.nom AS employe_nom, e.prenom AS employe_prenom
      FROM users u LEFT JOIN employes e ON e.id = u.employe_id
      ORDER BY u.username
    `);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { username, password, employe_id, role, actif } = req.body;
    if (!username || !password) return erreur(res, 'username et password sont requis.');
    const e = validerIdentifiant(username) || validerRole(role || 'vendeur') || validerMotDePasse(password, username);
    if (e) return erreur(res, e);
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length) return erreur(res, 'Ce nom d\'utilisateur existe déjà.', 409);
    const hash = await bcrypt.hash(password, 10);
    const insertRes = await pool.query(
      `INSERT INTO users (username, password_hash, employe_id, role, actif) VALUES ($1,$2,$3,$4,$5)`,
      [username, hash, employe_id || null, role || 'vendeur', actif !== false]
    );
    const result = await pool.query('SELECT id, username, role, actif, employe_id FROM users WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  // Mot de passe optionnel à la modification : ne le change que si fourni.
  router.put('/:id', async (req, res) => {
    const { username, password, employe_id, role, actif } = req.body;
    const cible = (await pool.query('SELECT id, role, actif FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (!cible) return erreur(res, 'Utilisateur introuvable.', 404);
    const e = validerIdentifiant(username) || validerRole(role) || (password ? validerMotDePasse(password, username) : null);
    if (e) return erreur(res, e);
    const doublon = await pool.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [username, req.params.id]);
    if (doublon.rows.length) return erreur(res, 'Ce nom d\'utilisateur existe déjà.', 409);
    const resteGerant = role === 'gerant' && actif !== false;
    if (cible.role === 'gerant' && cible.actif && !resteGerant && !(await autresGerants(pool, cible.id))) {
      return erreur(res, 'Il doit rester au moins un gérant actif : nommez d\'abord un autre gérant.', 409);
    }
    if (Number(req.params.id) === req.user.id && actif === false) return erreur(res, 'Vous ne pouvez pas désactiver votre propre compte.', 409);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET username=$1, password_hash=$2, employe_id=$3, role=$4, actif=$5 WHERE id=$6`,
        [username, hash, employe_id || null, role, actif !== false, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE users SET username=$1, employe_id=$2, role=$3, actif=$4 WHERE id=$5`,
        [username, employe_id || null, role, actif !== false, req.params.id]
      );
    }
    oublier(req.params.id);
    const result = await pool.query('SELECT id, username, role, actif, employe_id FROM users WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    const cible = (await pool.query('SELECT id, role, actif FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (!cible) return res.status(204).end();
    if (Number(req.params.id) === req.user.id) return erreur(res, 'Vous ne pouvez pas supprimer votre propre compte.', 409);
    if (cible.role === 'gerant' && cible.actif && !(await autresGerants(pool, cible.id))) {
      return erreur(res, 'Il doit rester au moins un gérant actif.', 409);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    oublier(req.params.id);
    res.status(204).end();
  });

  return router;
};
