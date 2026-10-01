const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(result.rows[0] || null);
  });

  router.put('/', async (req, res) => {
    const {
      salaire, matiere_pct, rend_pct, marge, tva, ref_source, cumuler_lot, offre_achete, offre_gratuit,
      entreprise_nom, entreprise_adresse, entreprise_telephone, entreprise_email, entreprise_matricule_fiscal,
      entreprise_logo, facture_couleur, fodec_rate, droit_timbre, timbre_seuil,
      lot_format_style, lot_seq_par_origine,
    } = req.body;
    await pool.query(
      `UPDATE settings SET
        salaire = COALESCE($1, salaire), matiere_pct = COALESCE($2, matiere_pct), rend_pct = COALESCE($3, rend_pct),
        marge = COALESCE($4, marge), tva = COALESCE($5, tva), ref_source = COALESCE($6, ref_source),
        cumuler_lot = COALESCE($7, cumuler_lot), offre_achete = COALESCE($8, offre_achete), offre_gratuit = COALESCE($9, offre_gratuit),
        entreprise_nom = COALESCE($10, entreprise_nom), entreprise_adresse = COALESCE($11, entreprise_adresse),
        entreprise_telephone = COALESCE($12, entreprise_telephone), entreprise_email = COALESCE($13, entreprise_email),
        entreprise_matricule_fiscal = COALESCE($14, entreprise_matricule_fiscal), entreprise_logo = COALESCE($15, entreprise_logo),
        facture_couleur = COALESCE($16, facture_couleur), fodec_rate = COALESCE($17, fodec_rate),
        droit_timbre = COALESCE($18, droit_timbre), timbre_seuil = COALESCE($19, timbre_seuil),
        lot_format_style = COALESCE($20, lot_format_style), lot_seq_par_origine = COALESCE($21, lot_seq_par_origine)
       WHERE id = 1`,
      [
        salaire, matiere_pct, rend_pct, marge, tva, ref_source, cumuler_lot, offre_achete, offre_gratuit,
        entreprise_nom || null, entreprise_adresse || null, entreprise_telephone || null, entreprise_email || null,
        entreprise_matricule_fiscal || null, entreprise_logo || null, facture_couleur, fodec_rate, droit_timbre, timbre_seuil,
        lot_format_style || null, lot_seq_par_origine,
      ]
    );
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(result.rows[0]);
  });

  return router;
};
