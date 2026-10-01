const express = require('express');
const { faireSauvegarde, nettoyerAnciennesSauvegardes, BACKUP_DIR } = require('../../scripts/backup');
const fs = require('fs');
const path = require('path');

module.exports = function () {
  const router = express.Router();

  // Sauvegarde immédiate, déclenchée depuis l'interface.
  router.post('/now', async (req, res) => {
    try {
      const resultat = await faireSauvegarde();
      nettoyerAnciennesSauvegardes();
      res.json({ ok: true, fichier: resultat.fichier, taille: resultat.taille, date: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Liste des sauvegardes existantes (les plus récentes en premier).
  router.get('/', (req, res) => {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const fichiers = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('tinor_') && f.endsWith('.sql'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { fichier: f, taille: stat.size, date: stat.mtime };
      })
      .sort((a, b) => b.date - a.date);
    res.json(fichiers);
  });

  // Téléchargement d'une sauvegarde spécifique.
  router.get('/:fichier', (req, res) => {
    const nom = path.basename(req.params.fichier); // empêche toute tentative de sortir du dossier
    const chemin = path.join(BACKUP_DIR, nom);
    if (!fs.existsSync(chemin)) return res.status(404).json({ error: 'Fichier introuvable.' });
    res.download(chemin);
  });

  return router;
};
