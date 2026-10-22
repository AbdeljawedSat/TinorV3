# Mise en ligne de TinOR (Railway)

L'API (la racine du dépôt) est hébergée sur Railway avec une base MySQL Railway.
La console (`admin/tinor_admin.html`) peut rester un simple fichier : l'écran de
connexion contient un champ **« Adresse de l'API »** où l'on colle l'URL en ligne.

## 1. Créer le projet

1. Se connecter sur https://railway.com avec son compte GitHub.
2. **New Project → Deploy from GitHub repo** → choisir `tinorV3`
   (autoriser l'accès au dépôt si Railway le demande).
3. Le premier déploiement échouera tant que la base (étape 3) n'est pas ajoutée : c'est normal.

## 2. Réglages du service

Aucun réglage de dossier ni de branche n'est nécessaire : l'API est à la racine, branche `main`.

La commande de démarrage est lue dans `railway.json` :
`npm run migrate && npm run seed && npm start`
→ crée les tables et le compte admin au premier démarrage, ne fait rien ensuite.

## 3. Ajouter la base de données

1. Dans le projet : **+ Create → Database → MySQL**.
2. Dans le service API → **Variables**, ajouter :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` |
| `JWT_SECRET` | une longue chaîne aléatoire (ex. résultat de `openssl rand -hex 32`) |
| `TRUST_PROXY` | `1` derrière un hébergeur : le blocage après 5 échecs de connexion compte l'adresse réelle du client |
| `NODE_ENV` | `production` |

`PORT` est fourni automatiquement par Railway.

La base MySQL de Railway est compatible (testé sur MySQL 8.4). Pour partir avec les données
d'exemple, importer `base/tinor_v3_demo.sql` dans la base Railway **avant** le premier démarrage.

## 4. Obtenir l'adresse publique

Service API → **Settings → Networking → Generate Domain**.
Vérifier dans le navigateur : `https://<votre-domaine>.up.railway.app/api/health`
doit afficher `{"ok":true,"version":"v3"}`.

## 5. Se connecter

1. Ouvrir `admin/tinor_admin.html` dans le navigateur (double-clic sur le fichier).
2. **Adresse de l'API** : `https://<votre-domaine>.up.railway.app/api`
3. Identifiant `admin`, mot de passe `changeme`.
4. **Changer immédiatement le mot de passe admin** : l'API est publique.

## Optionnel : données de test

Depuis un PC avec Node.js, dans la racine du dépôt :

```
API_URL=https://<votre-domaine>.up.railway.app/api node scripts/seed_test_complet.js
```

À faire **avant** de changer le mot de passe admin (le script se connecte avec `admin` / `changeme`),
et uniquement sur une base vide.


## HTTPS, e-mail et sécurité (V4)

**HTTPS** — deux possibilités :
1. *Derrière un proxy* (hébergeur type Railway/Render, ou Caddy / nginx) : le proxy fournit le certificat, TinOR reste en HTTP sur son port. Définir `TRUST_PROXY=1`
   pour que l'adresse réelle des clients soit connue (limite des essais de connexion, journal d'audit). Exemple Caddy (`Caddyfile`) :
   ```
   tinor.exemple.tn {
       reverse_proxy 127.0.0.1:3001
   }
   ```
2. *Direct* : `TLS_CERT=/chemin/fullchain.pem` et `TLS_KEY=/chemin/privkey.pem` dans `.env` ; TinOR écoute alors en HTTPS.

Avec HTTPS, l'en-tête `Strict-Transport-Security` est envoyé automatiquement.

**CORS** — la console servie par l'API, l'application Android et le réseau local fonctionnent sans réglage. Une autre adresse (site, domaine différent) se déclare dans
`CORS_ORIGINS=https://autre.exemple.tn` (plusieurs : séparées par des virgules).

**E-mail des factures** — dans `.env` : `SMTP_HOST`, `SMTP_PORT` (587 ou 465), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Sans `SMTP_HOST`, le menu « ✉ Envoyer par e-mail » répond
« non configuré ». Renseigner l'e-mail du client sur sa fiche l'enregistre comme adresse par défaut.

**Mot de passe et clé** — changer le mot de passe de `admin` (À propos › Changer mon mot de passe, 10 caractères minimum) et définir une longue `JWT_SECRET` aléatoire dans `.env`
(`openssl rand -hex 32`), faute de quoi les connexions sont à refaire à chaque redémarrage.

**Sauvegarde et restauration** — voir `scripts/README_SAUVEGARDE.md`. Vérifier régulièrement qu'une sauvegarde se restaure : `npm run test:restauration`.
