# Démarrer TinOR avec les données réelles

TinOR fonctionne en **deux versions** sur le même PC, avec le même programme :

| | **RÉEL** (vos vraies données) | **TEST** (essais, formation) |
|---|---|---|
| Base | `tinor_reel` (vide au départ) | la base actuelle (démonstration) |
| Adresse | `http://IP-du-PC:3001` | `http://IP-du-PC:3002` |
| Démarrage | double-clic sur **TinOR.bat** | double-clic sur **TinOR Test.bat** |
| Repère | badge vert « VERSION RÉELLE » à la connexion | bandeau orange « MODE TEST » permanent |
| Remise à zéro | **impossible** (protégée) | `npm run reset:test` |

## 1. Créer la version RÉEL (une seule fois)

```powershell
cd C:\TinorV3
git pull
npm.cmd install
npm.cmd run creer:reel
```

La commande demande le nom de la base (Entrée = `tinor_reel`) et le **mot de passe du compte
admin** de la version RÉEL. Elle crée une base vide (tables, unités, formats, locaux, compte
admin), active la **numérotation Jardins de Jerba** et reprend les coordonnées de la société.

Si elle répond que l'utilisateur MariaDB ne peut pas créer de base, exécutez dans MariaDB en
administrateur (`mysql -u root -p`) les 3 lignes qu'elle affiche, puis relancez-la.

Pare-feu Windows (PowerShell administrateur, une fois) pour le téléphone :
```powershell
New-NetFirewallRule -DisplayName "TinOR 3001-3002" -Direction Inbound -Protocol TCP -LocalPort 3001,3002 -Action Allow
```

## 2. Remplir la version RÉEL (dans l'ordre)

1. **Paramètres** : société, logo, MF, TVA, FODEC, timbre ; « Format des numéros de lot » =
   *Jardins de Jerba* (déjà choisi).
2. **Produits** de la gamme, par exemple :
   - `Pépins de figue de barbarie` (matière première, kg)
   - `Huile de pépins de figue de barbarie — Vrac` (L)
   - `Huile de pépins de figue de barbarie — Filtrée` (L)
   - `Huile de pépins de figue de barbarie — Flacon 30ml` (format 30 ml, unité)
3. **Fournisseurs, clients**, employés, utilisateurs.
4. **Stock › Reprise du stock** : téléchargez le modèle Excel, remplissez une ligne par lot
   (le n° de lot est gardé tel quel), déposez le fichier, vérifiez l'aperçu, importez.
5. Faites un **inventaire** de contrôle, puis travaillez dans la version RÉEL.

## 3. Numérotation Jardins de Jerba

| Étape | Règle | Exemple |
|---|---|---|
| Pépins (matière première) | n° de lot du fournisseur, saisi à la réception | `GJ01/2023`, `212` |
| Presse | `XX-lotMP-AAAAMMJJH` (XX = n° de pressage, ne repart jamais à zéro) | `02-GJ01/2023-20230225H` |
| Filtration | même XX et lot MP, date de filtration, sans « H » | `02-GJ01/2023-20241230` |
| Flacons | `yy` + `x1x1` + `x2x2` (yy repart à 01 chaque année ; x2x2 = x1x1 sans mélange) | `090123`, `100101` |

Pressage de plusieurs lots de pépins : le lot principal (le plus utilisé) figure dans le
numéro, les autres dans la traçabilité. Numéro déjà pris : suffixe `-2`. Après une reprise du
stock, les compteurs repartent après les plus grands numéros repris.

## 4. Au quotidien

- Sauvegarde : `scripts\backup.bat` (version RÉEL) dans le Planificateur de tâches (voir
  `scripts/README_SAUVEGARDE.md`) ; `npm run backup:test` pour la version TEST.
- Mise à jour du logiciel : `git pull`, `npm.cmd install`, puis relancer les deux raccourcis
  (ils appliquent eux-mêmes les mises à jour de la base).
- Téléphone : changer d'adresse (…:3001 / …:3002) pour changer de version ; TinOR refuse de
  changer tant que des opérations faites hors ligne n'ont pas été envoyées à l'autre serveur.
