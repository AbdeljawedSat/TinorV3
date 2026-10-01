const express = require('express');
const { buildXlsxBuffer, buildDocxBuffer } = require('../services/exportService');

function envoyerFichier(res, buffer, filename, format) {
  const mime = format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${format}"`);
  res.send(buffer);
}

module.exports = function (pool) {
  const router = express.Router();

  // ---------- Export générique — pour exporter EXACTEMENT ce qui est affiché
  // à l'écran (ex: Stock filtré sur un seul onglet/catégorie), pas toute la
  // table. Le client envoie déjà les lignes préparées. ----------
  router.post('/generique', async (req, res) => {
    const { titre, sousTitre, headers, rows, format } = req.body;
    if (!titre || !Array.isArray(headers) || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'titre, headers et rows sont requis.' });
    }
    const fmt = format === 'docx' ? 'docx' : 'xlsx';
    const buffer = fmt === 'xlsx'
      ? await buildXlsxBuffer(titre, headers, rows)
      : await buildDocxBuffer(titre, sousTitre || '', headers, rows);
    const nomFichier = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'export';
    envoyerFichier(res, buffer, nomFichier, fmt);
  });

  // ---------- Stock (tous lots avec quantité > 0) ----------
  router.get('/stock', async (req, res) => {
    const format = req.query.format === 'docx' ? 'docx' : 'xlsx';
    const result = await pool.query(`
      SELECT l.numero_lot, p.code AS produit_code, p.nom AS produit_nom, l.origine,
        lo.nom AS local_nom, l.statut, l.quantite_actuelle, u.symbole AS unite
      FROM lots l
      LEFT JOIN produits p ON p.id = l.produit_id
      LEFT JOIN unites u ON u.id = p.unite_id
      LEFT JOIN locaux lo ON lo.id = l.local_id
      WHERE l.quantite_actuelle > 0
      ORDER BY p.nom, l.numero_lot
    `);
    const headers = [
      { key: 'numero_lot', label: 'N° Lot', width: 16 },
      { key: 'produit_code', label: 'Code', width: 10 },
      { key: 'produit_nom', label: 'Produit', width: 32 },
      { key: 'origine', label: 'Origine', width: 16 },
      { key: 'local_nom', label: 'Local', width: 18 },
      { key: 'statut', label: 'Statut', width: 14 },
      { key: 'quantite_actuelle', label: 'Quantité', width: 14 },
      { key: 'unite', label: 'Unité', width: 10 },
    ];
    const buffer = format === 'xlsx'
      ? await buildXlsxBuffer('Stock', headers, result.rows)
      : await buildDocxBuffer('Stock — État complet', `Répartition de tous les lots en stock (quantité > 0)`, headers, result.rows);
    envoyerFichier(res, buffer, 'stock', format);
  });

  // ---------- Commandes ----------
  router.get('/commandes', async (req, res) => {
    const format = req.query.format === 'docx' ? 'docx' : 'xlsx';
    const result = await pool.query(`
      SELECT c.numero, c.date_iso AS date_commande, cl.nom AS client_nom, c.statut, c.total
      FROM commandes c
      LEFT JOIN clients cl ON cl.id = c.client_id
      ORDER BY c.date_iso DESC, c.id DESC
    `);
    const headers = [
      { key: 'numero', label: 'N° Commande', width: 16 },
      { key: 'date_commande', label: 'Date', width: 14 },
      { key: 'client_nom', label: 'Client', width: 28 },
      { key: 'statut', label: 'Statut', width: 16 },
      { key: 'total', label: 'Total (DT)', width: 14 },
    ];
    const rows = result.rows.map(r => ({ ...r, date_commande: r.date_commande ? new Date(r.date_commande).toLocaleDateString('fr-TN') : '' }));
    const buffer = format === 'xlsx'
      ? await buildXlsxBuffer('Commandes', headers, rows)
      : await buildDocxBuffer('Liste des commandes', `Historique complet`, headers, rows);
    envoyerFichier(res, buffer, 'commandes', format);
  });

  // ---------- Registre des lots ----------
  router.get('/lots', async (req, res) => {
    const format = req.query.format === 'docx' ? 'docx' : 'xlsx';
    const result = await pool.query(`
      SELECT l.numero_lot, p.nom AS produit_nom, l.origine, l.statut,
        l.quantite_initiale, l.quantite_actuelle, l.created_at
      FROM lots l
      LEFT JOIN produits p ON p.id = l.produit_id
      ORDER BY l.created_at DESC
      LIMIT 2000
    `);
    const headers = [
      { key: 'numero_lot', label: 'N° Lot', width: 16 },
      { key: 'produit_nom', label: 'Produit', width: 30 },
      { key: 'origine', label: 'Origine', width: 16 },
      { key: 'statut', label: 'Statut', width: 14 },
      { key: 'quantite_initiale', label: 'Qté initiale', width: 14 },
      { key: 'quantite_actuelle', label: 'Qté restante', width: 14 },
      { key: 'created_at', label: 'Créé le', width: 16 },
    ];
    const rows = result.rows.map(r => ({ ...r, created_at: r.created_at ? new Date(r.created_at).toLocaleDateString('fr-TN') : '' }));
    const buffer = format === 'xlsx'
      ? await buildXlsxBuffer('Registre des lots', headers, rows)
      : await buildDocxBuffer('Registre des lots', `Traçabilité complète — 2000 lots les plus récents`, headers, rows);
    envoyerFichier(res, buffer, 'registre_lots', format);
  });

  return router;
};
