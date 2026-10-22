// Consultation du journal d'audit (gérant seulement : voir services/droits.js).
const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const { du, au, utilisateur, rubrique, q } = req.query;
    const limite = Math.min(1000, Math.max(1, Number(req.query.limite) || 200));
    const clauses = [], params = [];
    const ajoute = (sql, v) => { params.push(v); clauses.push(sql.replace('?', `$${params.length}`)); };
    if (du) ajoute('cree_le >= ?', `${du} 00:00:00`);
    if (au) ajoute('cree_le <= ?', `${au} 23:59:59`);
    if (utilisateur) ajoute('username = ?', utilisateur);
    if (rubrique) ajoute('rubrique = ?', rubrique);
    if (q) { params.push(`%${q}%`); clauses.push(`(chemin LIKE $${params.length} OR resume LIKE $${params.length})`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const lignes = await pool.query(`SELECT * FROM journal_audit ${where} ORDER BY id DESC LIMIT ${limite}`, params);
    const filtres = await pool.query('SELECT DISTINCT rubrique FROM journal_audit ORDER BY rubrique');
    const users = await pool.query('SELECT DISTINCT username FROM journal_audit WHERE username IS NOT NULL ORDER BY username');
    res.json({ lignes: lignes.rows, rubriques: filtres.rows.map(r => r.rubrique), utilisateurs: users.rows.map(r => r.username) });
  });

  return router;
};
