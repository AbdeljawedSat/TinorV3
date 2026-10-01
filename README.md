# TinOR V3

| Dossier / fichier | Contenu |
|---|---|
| racine (`src/`, `scripts/`, `package.json`…) | API V3 (Node.js + Express + MariaDB/MySQL) |
| `admin/tinor_admin.html` | Console d'administration (fichier HTML autonome) |
| `archive/tinor-api-v3.zip` | Archive d'origine de l'API (référence de secours 1) |
| `DEPLOIEMENT.md` | Mise en ligne pas à pas sur Railway |

Connexion à la console : ouvrir `admin/tinor_admin.html`, renseigner l'**Adresse de l'API**
(`http://127.0.0.1:3001/api` en local, ou l'URL Railway), puis `admin` / `changeme`.

---

# TinOR API V3

Backend de la BD Gestion Commerciale V3 (Express + MariaDB), même architecture que tinor-api (V2) : wrapper mysql2 façon `pg` ($1,$2.../.rows), auth JWT.

## Installation locale (développement)

**Prérequis** : Node.js 18+, une base MariaDB/MySQL accessible (locale ou distante).

1. **Installer les dépendances**
   ```
   npm install
   ```

2. **Configurer la connexion à la base**
   ```
   cp .env.example .env
   ```
   Puis éditer `.env` : soit `DATABASE_URL` (une seule ligne, pratique avec un hébergeur), soit `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` séparément (pratique en local ou cPanel). Changer aussi `JWT_SECRET` (`openssl rand -hex 32`).

3. **Créer la base vide** (si elle n'existe pas déjà)
   ```
   mysql -u root -e "CREATE DATABASE tinor_v3 CHARACTER SET utf8mb4;"
   ```

4. **Appliquer le schéma**
   ```
   npm run migrate
   ```
   Exécute `tinor_erp_v3_schema.sql` — crée les ~41 tables de BD Gestion Commerciale V3.

5. **Insérer les données de référence**
   ```
   npm run seed
   ```
   Unités, catégories, formats, un local par défaut, la structure de lots de base (3 champs communs par type), et un compte `admin` / `changeme` — **à changer avant toute mise en production**.

6. **Démarrer le serveur**
   ```
   npm start
   ```
   Ou `npm run dev` pour un rechargement automatique à chaque modification.

7. **Vérifier**
   ```
   curl http://127.0.0.1:3001/api/health
   ```
   Doit répondre `{"ok":true,"version":"v3"}`.

## Déploiement (Railway / Render)

Mêmes fichiers de config que tinor-api (V2) : `Procfile`, `railway.json`, `render.yaml`.

- **Railway** : connecter le repo, définir `DATABASE_URL` et `JWT_SECRET` dans les variables d'environnement. Le déploiement lance `npm run migrate && npm start` automatiquement (voir `railway.json`).
- **Render** : importer `render.yaml` sur render.com/deploy. ⚠️ Render n'héberge pas MariaDB nativement — prévoir une base externe (PlanetScale, Aiven, ou votre hébergement cPanel existant) et renseigner `DATABASE_URL` manuellement après création du service.

Dans les deux cas, **exécuter `npm run seed` une seule fois manuellement** après le premier déploiement (via le shell du service, ou `railway run npm run seed`) — ce n'est pas fait automatiquement à chaque redémarrage.

## Endpoints implémentés

- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/produits`
- `GET/POST /api/lots`, `GET /api/lots/:numero/tracabilite`, `GET /api/lots/:numero/historique-statuts`, `POST /api/lots/:id/statut`
- `GET/POST/PUT/DELETE /api/fournisseurs`
- `GET/POST/PUT/DELETE /api/clients`
- `GET/POST /api/locaux`, `GET/POST /api/locaux/:id/zones`
- `GET/POST/PUT /api/employes`
- `GET/POST /api/lot-type-champs/:type`, `.../:type/champs`, `PUT/DELETE .../champs/:id`
- `GET/POST/PUT/DELETE /api/achats`
- `GET/POST /api/receptions` (crée automatiquement les lots correspondants)
- `GET/POST/PUT/DELETE /api/remises`
- `GET/POST /api/commandes`, `PUT /api/commandes/:id/statut` (remises, FIFO, sortie de stock tracée)
- `GET/POST /api/factures`, `POST /api/factures/:id/annuler`, `POST /api/factures/:id/paiements`
- `GET/POST /api/presse` (consomme un lot matière première, calcule le rendement réel)
- `GET/POST /api/filtration` (combine un ou plusieurs lots de presse)
- `GET/POST /api/conditionnement` (transforme du vrac presse/filtration en produit fini formaté)

## Reste à implémenter

recettes/ordres_production (production générale hors huile), grille_huiles (tarification dynamique), inventaires, stats.

Testé de bout en bout sur MariaDB réelle à chaque module (pas seulement relu) : login, produit avec code auto, lot avec numérotation TT-SSS auto, traçabilité ascendants/descendants via `lot_origines`, changement de statut avec historique complet, achat générique + réception avec création de lot automatique, commande avec remise "lot" et FIFO, facturation, paiement partiel, annulation avec réintégration de stock, chaîne complète réception→presse→filtration→conditionnement avec rendements calculés et stock vérifié cohérent à chaque étape.
