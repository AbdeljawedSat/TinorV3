const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query('SELECT * FROM employes ORDER BY nom, prenom');
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const { matricule, nom, prenom, fonction, telephone, email, actif } = req.body;
    if (!matricule || !nom || !prenom) {
      return res.status(400).json({ error: 'matricule, nom et prenom sont requis.' });
    }
    const insertRes = await pool.query(
      `INSERT INTO employes (matricule, nom, prenom, fonction, telephone, email, actif) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [matricule, nom, prenom, fonction || null, telephone || null, email || null, actif !== false]
    );
    const result = await pool.query('SELECT * FROM employes WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const { matricule, nom, prenom, fonction, telephone, email, actif } = req.body;
    const updateRes = await pool.query(
      `UPDATE employes SET matricule=$1, nom=$2, prenom=$3, fonction=$4, telephone=$5, email=$6, actif=$7 WHERE id=$8`,
      [matricule, nom, prenom, fonction || null, telephone || null, email || null, actif !== false, req.params.id]
    );
    if (!updateRes.affectedRows) return res.status(404).json({ error: 'Employé introuvable.' });
    const result = await pool.query('SELECT * FROM employes WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  return router;
};
