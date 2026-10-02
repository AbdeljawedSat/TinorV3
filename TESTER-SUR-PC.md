# Tester TinOR sur un PC avec VS Code

Tout tourne sur votre PC : base de données, API et console. Rien n'est mis en ligne.

## 1. Installer les logiciels (une seule fois)

| Logiciel | Lien | Remarque |
|---|---|---|
| **VS Code** | https://code.visualstudio.com | |
| **Git** | https://git-scm.com | options par défaut |
| **Node.js 20 LTS** (ou plus récent) | https://nodejs.org | cocher « Add to PATH » |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | sert à lancer la base MariaDB ; le démarrer avant les étapes ci-dessous |

Pas de Docker ? Voir « Sans Docker » en bas de page.

## 2. Ouvrir le projet

1. VS Code → **Fichier › Nouvelle fenêtre**, puis **Cloner le dépôt Git…**
   (ou `Ctrl+Maj+P` → `Git: Clone`) → coller `https://github.com/AbdeljawedSat/TinorV3`
   → choisir un dossier → **Ouvrir**.
   *Ou* décompresser `tinorV3-corrige.zip` et faire **Fichier › Ouvrir le dossier…**
2. Accepter **« Faire confiance aux auteurs »**.
3. Accepter l'installation des **extensions recommandées** (REST Client, Docker, client de base de données).

## 3. Lancer (dans l'ordre, la première fois)

Menu **Terminal › Exécuter la tâche…** puis :

| Tâche | Ce qu'elle fait | Durée |
|---|---|---|
| **TinOR 1 · Démarrer la base MariaDB (Docker)** | télécharge et démarre MariaDB (base `tinor_v3`) | 1 à 3 min la 1re fois |
| **TinOR 2 · Installer et préparer la base** | `npm install`, crée `.env`, les tables et le compte admin | ~1 min |
| **TinOR 3 · Démarrer l'API (rechargement auto)** | API sur le port 3001 ; redémarre à chaque modification d'un fichier | laisser tourner |
| **TinOR 4 · Charger les données de test** *(facultatif)* | produits, lots, production, commandes, factures d'exemple | ~10 s |

Ensuite, ouvrir **http://localhost:3001/** dans le navigateur :
l'adresse de l'API est déjà remplie → identifiant **admin**, mot de passe **changeme**.

Les fois suivantes : tâche **1** (si Docker a été arrêté) puis tâche **3**.

## 4. Tester

- **La console** : http://localhost:3001/ (tableau de bord, inventaires, étiquettes QR, alertes…).
- **Les requêtes de l'API** : ouvrir `api.http` → cliquer **Send Request** sur « Connexion »,
  puis sur n'importe quelle autre requête.
- **Les tests automatiques du stock** : tâche **TinOR · Tests de stock** (API démarrée).
  ⚠ Ils ajoutent des produits et commandes de test dans la base.
- **Déboguer l'API** : arrêter la tâche 3, puis onglet **Exécuter et déboguer** (`Ctrl+Maj+D`)
  → **API TinOR (débogage)** → `F5`. Points d'arrêt possibles dans `src/`.
  **TinOR complet : API + console (Edge)** lance l'API et ouvre la console d'un coup.
- **Voir la base** : extension Database Client → nouvelle connexion MySQL,
  hôte `127.0.0.1`, port `3306`, utilisateur `tinor`, mot de passe `tinor`, base `tinor_v3`.

## 5. Tester l'application Android sur le PC (facultatif)

1. Installer **Android Studio** → **Device Manager** → créer et démarrer un téléphone virtuel.
2. Glisser-déposer `TinOR.apk` sur la fenêtre de l'émulateur : il s'installe.
3. Dans l'application, adresse de l'API : **`http://10.0.2.2:3001/api`**
   (`10.0.2.2` = le PC vu depuis l'émulateur).

Depuis un vrai téléphone sur le même Wi-Fi : `http://<adresse IP du PC>:3001/api`
(adresse IP : commande `ipconfig` sous Windows ; autoriser Node.js dans le pare-feu).

## Arrêter

Tâche **TinOR · Arrêter la base (Docker)**. Les données sont conservées pour la fois suivante.
Repartir de zéro : `docker compose down -v` dans le terminal (efface la base).

## Problèmes fréquents

| Message | Solution |
|---|---|
| `docker: command not found` / tâche 1 en erreur | Docker Desktop n'est pas démarré |
| `port is already allocated` (3306) | un autre MySQL/MariaDB tourne déjà (XAMPP, WAMP…) : l'arrêter, ou utiliser « Sans Docker » |
| `EADDRINUSE :3001` | l'API tourne déjà (tâche 3 lancée deux fois) : fermer l'ancien terminal |
| `npm` n'est pas reconnu | réinstaller Node.js en cochant « Add to PATH », puis redémarrer VS Code |
| `Access denied for user 'tinor'` | identifiants de `.env` ≠ ceux de la base |

## Sans Docker (XAMPP, WAMP ou MariaDB installé)

Dans le client SQL (phpMyAdmin, HeidiSQL…), en root :

```sql
CREATE DATABASE tinor_v3 CHARACTER SET utf8mb4;
CREATE USER 'tinor'@'localhost' IDENTIFIED BY 'tinor';
CREATE USER 'tinor'@'127.0.0.1' IDENTIFIED BY 'tinor';
GRANT ALL ON tinor_v3.* TO 'tinor'@'localhost';
GRANT ALL ON tinor_v3.* TO 'tinor'@'127.0.0.1';
```

Puis tâches **2** et **3** comme ci-dessus (la tâche 1 n'est pas nécessaire).
