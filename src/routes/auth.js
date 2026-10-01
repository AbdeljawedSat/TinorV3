const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

module.exports = function (pool) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username et password sont requis.' });
    }
    const result = await pool.query(
      `SELECT u.*, e.nom AS employe_nom, e.prenom AS employe_prenom
       FROM users u LEFT JOIN employes e ON e.id = u.employe_id
       WHERE u.username = $1 AND u.actif = TRUE`,
      [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides.' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, employe_id: user.employe_id },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      user: {
        id: user.id, username: user.username, role: user.role,
        employe_id: user.employe_id, employe_nom: user.employe_nom, employe_prenom: user.employe_prenom,
      },
    });
  });

  return router;
};
