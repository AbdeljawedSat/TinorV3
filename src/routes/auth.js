const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

// Anti-devinette du mot de passe : 5 échecs par (adresse, identifiant) en 15 minutes → blocage jusqu'à ce que le plus
// ancien échec ait 15 minutes. Un succès remet à zéro. En mémoire : un redémarrage du serveur lève les blocages.
const ESSAIS_MAX = 5, FENETRE_MS = 15 * 60 * 1000;
const echecs = new Map();
function attente(cle) {
  const maintenant = Date.now();
  const liste = (echecs.get(cle) || []).filter(t => maintenant - t < FENETRE_MS);
  if (liste.length) echecs.set(cle, liste); else echecs.delete(cle);
  return liste.length >= ESSAIS_MAX ? Math.ceil((liste[0] + FENETRE_MS - maintenant) / 1000) : 0;
}
const noterEchec = (cle) => echecs.set(cle, [...(echecs.get(cle) || []), Date.now()]);
const trop = (res, s) => res.status(429).json({ error: `Trop d'échecs de connexion : réessayez dans ${Math.ceil(s / 60)} minute(s).`, retry_apres: s });

module.exports = function (pool) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username et password sont requis.' });
    }
    const cle = `${req.ip}|${String(username).toLowerCase()}`;
    const bloque = attente(cle);
    if (bloque) return trop(res, bloque);
    const result = await pool.query(
      `SELECT u.*, e.nom AS employe_nom, e.prenom AS employe_prenom
       FROM users u LEFT JOIN employes e ON e.id = u.employe_id
       WHERE u.username = $1 AND u.actif = TRUE`,
      [username]
    );
    const user = result.rows[0];
    if (!user) { noterEchec(cle); return res.status(401).json({ error: 'Identifiants invalides.' }); }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) { noterEchec(cle); return res.status(401).json({ error: 'Identifiants invalides.' }); }
    echecs.delete(cle);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, employe_id: user.employe_id },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      mot_de_passe_par_defaut: password === 'changeme', // mot de passe livré avec TinOR : la console demande de le changer
      user: {
        id: user.id, username: user.username, role: user.role,
        employe_id: user.employe_id, employe_nom: user.employe_nom, employe_prenom: user.employe_prenom,
      },
    });
  });

  // Changement de SON mot de passe (ancien mot de passe exigé). Le mot de passe livré « changeme » est refusé.
  router.post('/mot-de-passe', requireAuth, async (req, res) => {
    const { ancien, nouveau } = req.body || {};
    if (!ancien || !nouveau) return res.status(400).json({ error: 'ancien et nouveau mot de passe sont requis.' });
    const cle = `mdp|${req.user.id}`;
    const bloque = attente(cle);
    if (bloque) return trop(res, bloque);
    const user = (await pool.query('SELECT id, password_hash FROM users WHERE id = $1 AND actif = TRUE', [req.user.id])).rows[0];
    if (!user || !(await bcrypt.compare(String(ancien), user.password_hash))) { noterEchec(cle); return res.status(401).json({ error: 'Ancien mot de passe incorrect.' }); }
    echecs.delete(cle);
    const n = String(nouveau);
    if (n.length < 8) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
    if (n === 'changeme') return res.status(400).json({ error: 'Choisissez un mot de passe différent de celui livré avec TinOR.' });
    if (n === String(ancien)) return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l\'ancien.' });
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(n, 10), user.id]);
    res.json({ ok: true });
  });

  return router;
};
