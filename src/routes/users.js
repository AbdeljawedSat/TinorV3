const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function (pool) {
  const router = express.Router();

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
    if (!username || !password) return res.status(400).json({ error: 'username et password sont requis.' });
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });
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
    const result = await pool.query('SELECT id, username, role, actif, employe_id FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json(result.rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
