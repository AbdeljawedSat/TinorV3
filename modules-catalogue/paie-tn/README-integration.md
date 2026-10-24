# tinor-paie — module de paie tunisienne pour TinOR ERP

Module Node.js/Express/MariaDB à brancher dans **tinor-api-v3**, avec un écran vanilla JS à intégrer dans **tinor_admin.html**. Le moteur de calcul est un portage exact du moteur Java : mêmes paramètres, mêmes règles d'arrondi, résultats identiques au millime (vérifié sur 15 cas fixes et 3 000 cas aléatoires).

```
tinor-paie/
├── src/
│   ├── engine/        moteur de calcul (decimal.js, aucune autre dépendance)
│   ├── db.js          adaptateur pool mariadb / mysql2 + migrations
│   ├── service.js     workflow, droits, audit
│   ├── routes.js      routeur Express /api/paie
│   ├── bulletin-html.js  bulletin imprimable (FR ou FR/AR)
│   ├── exports.js     états CSV / Excel
│   └── index.js       installerPaie()
├── ui/tinor-paie-ui.js   écran à intégrer dans tinor_admin.html
├── shared/            paramètres, rubriques, SQL, cas de test (copie de ../../shared)
├── demo/              serveur de démonstration autonome
└── test/              moteur, équivalence Java, API sur MariaDB
```

## 1. Installation dans tinor-api-v3

Copier le dossier `tinor-paie/` dans le projet, puis :

```bash
npm install ./tinor-paie        # installe decimal.js (exceljs recommandé pour les exports Excel, déjà présent dans TinOR)
```

Dans le serveur Express, **après** le middleware d'authentification TinOR :

```js
const { installerPaie } = require('./tinor-paie');

app.use('/api/paie', await installerPaie({
  pool,                                   // le pool mariadb (ou mysql2/promise) existant de TinOR
  utilisateur: (req) => req.user && {     // adapter à la session TinOR
    login: req.user.login,
    role: req.user.paieRole || 'CONSULTATION',   // ADMIN | GESTIONNAIRE | VALIDEUR | CONSULTATION
  },
  controleDeuxNiveaux: true,              // le valideur doit être différent de la personne qui a calculé
}));
app.use('/paie', express.static(path.join(__dirname, 'tinor-paie/ui')));
```

Au démarrage, les tables `paie_*` sont créées dans la base existante (aucune table TinOR n'est modifiée). Le script SQL est aussi disponible seul : `shared/sql/V1__paie_init.sql`.

## 2. Écran dans tinor_admin.html

```html
<section id="ecran-paie"></section>
<script src="/paie/tinor-paie-ui.js"></script>
<script>
  // à l'ouverture de l'onglet Paie :
  TinorPaie.monter(document.getElementById('ecran-paie'), {
    api: '/api/paie',
    entetes: () => ({ Authorization: 'Bearer ' + tokenTinor })   // si TinOR utilise un jeton ; inutile avec des cookies de session
  });
</script>
```

Couleurs modifiables par variables CSS sur `.tp` : `--tp-accent` (or TinOR #C8963A par défaut), `--tp-fond`, `--tp-carte`, `--tp-texte`.

Onglets : Paie du mois · Salariés & contrats · Éléments variables (avec aperçu du calcul) · Paramètres réglementaires · Entreprise et Journal d'audit (ADMIN). L'écran s'adapte au mobile.

## 3. Rôles

| Rôle | Droits |
|---|---|
| ADMIN | tout, dont modification des taux et barèmes, clôture, réouverture, fiche entreprise, journal |
| GESTIONNAIRE | salariés, contrats, variables, simulation, exports |
| VALIDEUR | validation de la paie et des paramètres réglementaires, exports |
| CONSULTATION | lecture seule |

## 4. API

| Méthode | Route | Rôle minimal | Usage |
|---|---|---|---|
| GET | /meta | tous | version moteur, droits, rubriques |
| GET / PUT | /entreprise | tous / ADMIN | fiche entreprise, taux AT et TFP |
| GET / POST | /salaries | tous / GESTIONNAIRE | liste (`?q=`, `?inactifs=1`), création |
| PUT | /salaries/:id | GESTIONNAIRE | modification |
| GET / POST | /salaries/:id/contrats | tous / GESTIONNAIRE | contrats et avenants |
| GET / POST | /periodes | tous / GESTIONNAIRE | périodes `{annee, mois}` |
| GET / POST | /periodes/:id/variables | tous / GESTIONNAIRE | éléments variables (`?salarieId=`) |
| DELETE | /variables/:id | GESTIONNAIRE | suppression (période ouverte) |
| POST | /periodes/:id/apercu | tous | calcul d'un salarié sans enregistrement `{salarieId}` |
| POST | /periodes/:id/simuler | GESTIONNAIRE | nouvelle version de calcul pour chaque salarié |
| GET | /periodes/:id/calculs | tous | derniers calculs avec détail complet |
| GET | /periodes/:id/controle-validation | VALIDEUR | contrôles et avertissements avant validation |
| POST | /periodes/:id/valider · /cloturer · /rouvrir | VALIDEUR · ADMIN · ADMIN | workflow (`{motif}` pour rouvrir) |
| GET | /periodes/:id/comparer/:salarieId | tous | écarts entre les deux dernières versions |
| GET | /periodes/:id/bulletins | GESTIONNAIRE | bulletins HTML imprimables (`?salarieId=`, `?langue=fr-ar`, `?imprimer=1`) |
| GET | /periodes/:id/etats/{livre-paie, etat-cnss, etat-retenues, etat-paiement}.{csv, xlsx} | GESTIONNAIRE | états |
| POST | /calcul | tous | calcul sans état à partir d'une entrée JSON (voir docs/SPECIFICATION_CALCUL.md) |
| GET / POST / DELETE | /parametres, /parametres/validations | tous / VALIDEUR | paramètres datés et leur validation |
| POST / DELETE | /parametres/versions, /parametres/versions/:id | ADMIN | nouvelle version datée d'un taux `{code, debut, valeur, source}` ou d'un barème `{code:'BAREME:IRPP', debut, tranches:[{de,a,taux}], source}` ; suppression d'une version future |
| GET | /journal | ADMIN | 500 dernières entrées d'audit (`?q=`) |

Erreurs : `400 {erreur}` règle métier, `401` non identifié, `403` droit insuffisant, `500` erreur interne (détail dans les journaux serveur uniquement).

## 5. Tests et démo

```bash
npm test                                     # moteur + équivalence Java (+ API si base configurée)
PAIE_TEST_DB_USER=... PAIE_TEST_DB_PASSWORD=... npm test   # inclut le workflow complet sur MariaDB
node scripts/cas-aleatoires.js 3000 > cas.json   # puis CalculCas (Java) et scripts/comparer-resultats.js
DB_USER=... DB_PASSWORD=... DB_NAME=paie_demo npm run demo   # http://localhost:3088 — authentification SIMULÉE, usage local uniquement
```

Après toute mise à jour des paramètres dans `../../shared/` : `npm run sync-shared`.

## Bulletins PDF

Le bulletin est produit en HTML A4 et converti en PDF par le navigateur (*Imprimer > Enregistrer en PDF*), comme pour les autres documents arabes de TinOR : le rendu de l'arabe (mode FR/AR) est ainsi correct. Chaque génération est tracée (table `paie_documents`, empreinte SHA-256, journal).
