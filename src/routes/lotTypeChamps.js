const express = require('express');

const TYPES_LOT = ['ACHAT', 'RECEPTION_MP', 'PRESSE', 'FILTRATION', 'CONDITIONNEMENT', 'PRODUCTION_RECETTE', 'INVENTAIRE', 'AUTRE'];
const CHAMPS_COMMUNS_VERROUILLES = [
  { nom: 'N° de lot', type_champ: 'texte', obligatoire: true, verrouille: true, ordre: 0 },
  { nom: 'Produit', type_champ: 'liste', obligatoire: true, verrouille: true, ordre: 1 },
  { nom: 'Date', type_champ: 'date', obligatoire: true, verrouille: true, ordre: 2 },
];

module.exports = function (pool) {
  const router = express.Router();

  router.get('/types', (req, res) => res.json(TYPES_LOT));

  router.get('/:type', async (req, res) => {
    if (!TYPES_LOT.includes(req.params.type)) {
      return res.status(400).json({ error: `type_lot invalide. Valeurs possibles : ${TYPES_LOT.join(', ')}` });
    }
    const result = await pool.query(
      `SELECT * FROM lot_type_champs WHERE type_lot = $1 ORDER BY ordre`,
      [req.params.type]
    );
    res.json(result.rows);
  });

  // Initialise un type de lot avec ses 3 champs communs verrouillés — à appeler
  // une fois par type avant toute personnalisation.
  router.post('/:type/init', async (req, res) => {
    if (!TYPES_LOT.includes(req.params.type)) {
      return res.status(400).json({ error: `type_lot invalide. Valeurs possibles : ${TYPES_LOT.join(', ')}` });
    }
    const existing = await pool.query('SELECT COUNT(*) AS n FROM lot_type_champs WHERE type_lot = $1', [req.params.type]);
    if (existing.rows[0].n > 0) {
      return res.status(409).json({ error: 'Ce type de lot a déjà une structure — utilisez POST /:type/champs pour ajouter des champs.' });
    }
    for (const champ of CHAMPS_COMMUNS_VERROUILLES) {
      await pool.query(
        `INSERT INTO lot_type_champs (type_lot, nom, type_champ, obligatoire, verrouille, ordre) VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.type, champ.nom, champ.type_champ, champ.obligatoire, champ.verrouille, champ.ordre]
      );
    }
    const result = await pool.query('SELECT * FROM lot_type_champs WHERE type_lot = $1 ORDER BY ordre', [req.params.type]);
    res.status(201).json(result.rows);
  });

  router.post('/:type/champs', async (req, res) => {
    const { nom, type_champ, obligatoire } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom est requis.' });
    const maxOrdre = await pool.query('SELECT COALESCE(MAX(ordre), -1) AS m FROM lot_type_champs WHERE type_lot = $1', [req.params.type]);
    const insertRes = await pool.query(
      `INSERT INTO lot_type_champs (type_lot, nom, type_champ, obligatoire, verrouille, ordre)
       VALUES ($1,$2,$3,$4,FALSE,$5)`,
      [req.params.type, nom, type_champ || 'texte', !!obligatoire, maxOrdre.rows[0].m + 1]
    );
    const result = await pool.query('SELECT * FROM lot_type_champs WHERE id = $1', [insertRes.insertId]);
    res.status(201).json(result.rows[0]);
  });

  router.put('/champs/:id', async (req, res) => {
    const { nom, type_champ, obligatoire } = req.body;
    const champRes = await pool.query('SELECT * FROM lot_type_champs WHERE id = $1', [req.params.id]);
    if (!champRes.rows[0]) return res.status(404).json({ error: 'Champ introuvable.' });
    if (champRes.rows[0].verrouille) {
      return res.status(403).json({ error: 'Ce champ est commun à tous les types de lot et ne peut pas être modifié.' });
    }
    await pool.query(
      `UPDATE lot_type_champs SET nom=$1, type_champ=$2, obligatoire=$3 WHERE id=$4`,
      [nom, type_champ, !!obligatoire, req.params.id]
    );
    const result = await pool.query('SELECT * FROM lot_type_champs WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  });

  router.delete('/champs/:id', async (req, res) => {
    const champRes = await pool.query('SELECT * FROM lot_type_champs WHERE id = $1', [req.params.id]);
    if (!champRes.rows[0]) return res.status(404).json({ error: 'Champ introuvable.' });
    if (champRes.rows[0].verrouille) {
      return res.status(403).json({ error: 'Ce champ est commun à tous les types de lot et ne peut pas être supprimé.' });
    }
    await pool.query('DELETE FROM lot_type_champs WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  return router;
};
