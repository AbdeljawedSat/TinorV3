# Sauvegarde automatique — guide de mise en place

## Ce qui est déjà fait

- **Bouton "💾 Sauvegarder maintenant"** dans Paramètres → génère une copie complète immédiatement, visible et téléchargeable dans la liste juste en dessous.
- **Rotation automatique** : les sauvegardes de plus de 30 jours sont supprimées automatiquement à chaque nouvelle sauvegarde (modifiable, voir plus bas).
- **Script `scripts/backup.js`**, testé et confirmé : sauvegarde réelle + restauration réelle vérifiées avec des données de test.

Ce qu'il reste à faire chez vous : **programmer l'exécution automatique quotidienne** (le bouton seul ne suffit pas si personne n'y pense tous les jours).

---

## Étape 1 — Vérifier que `mysqldump` est accessible

Ouvrez PowerShell et tapez :
```powershell
mysqldump --version
```

Si ça affiche une version : c'est bon, passez à l'étape 2.

Si vous avez une erreur "commande introuvable" : `mysqldump` est installé avec MySQL/MariaDB mais son dossier n'est pas dans le PATH système. Cherchez le fichier `mysqldump.exe` (généralement dans `C:\Program Files\MySQL\MySQL Server X.X\bin\` ou `C:\xampp\mysql\bin\`), puis ajoutez ce dossier aux variables d'environnement Windows (Panneau de configuration → Système → Variables d'environnement → Path → Nouveau).

## Étape 2 — Tester le script manuellement

```powershell
cd C:\tinor-api-v3
node scripts\backup.js
```

Vous devriez voir `✓ Sauvegarde créée : ...` et un nouveau fichier dans le dossier `backups\`.

## Étape 3 — Planifier l'exécution quotidienne (Planificateur de tâches Windows)

1. Ouvrez **Planificateur de tâches** (recherchez "Planificateur" dans le menu Démarrer)
2. **Créer une tâche de base...** → nommez-la "Sauvegarde TinOR"
3. **Déclencheur** : Quotidien, choisissez une heure creuse (ex: 2h du matin)
4. **Action** : Démarrer un programme
   - Programme/script : `C:\tinor-api-v3\scripts\backup.bat`
   - Démarrer dans : `C:\tinor-api-v3\scripts`
5. Terminez, puis clic droit sur la tâche créée → **Exécuter** pour tester immédiatement
6. Vérifiez qu'un nouveau fichier est apparu dans `backups\` et que `backups\journal_sauvegarde.log` ne contient pas d'erreur

## Étape 4 — Copier les sauvegardes HORS de ce serveur (important)

Une sauvegarde qui reste sur la même machine ne protège pas contre une panne de disque dur ou un vol de matériel. Faites l'un des deux :

- **Simple** : synchronisez le dossier `backups\` avec Google Drive, OneDrive, ou Dropbox (installez l'application, faites glisser le dossier dedans)
- **Plus robuste** : copiez périodiquement sur une clé USB ou un disque externe rangé ailleurs

---

## Réglages modifiables

Dans le fichier `.env` (à la racine de `tinor-api-v3`), vous pouvez ajouter :

```
BACKUP_DIR=C:\un\autre\dossier          # emplacement des sauvegardes (par défaut: backups\ dans le projet)
BACKUP_RETENTION_DAYS=60                 # nombre de jours à conserver (par défaut: 30)
```

## En cas de besoin de restauration

```powershell
mysql -u tinor -p tinor_v3 < backups\nom_du_fichier.sql
```

⚠️ Cette commande **remplace** les données existantes par celles de la sauvegarde — à utiliser uniquement en cas de problème réel, pas par curiosité.
