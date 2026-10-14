# TinOR V3 — Mémoire du projet (lue au début de chaque session)

## Projet
Gestion commerciale + production par lots pour une petite structure de transformation
(huiles, savons, cosmétiques) — Les Jardins de Djerba, Tunisie. Langue de travail : **français**.

## Stack
- API : Node.js 18+ / Express 5 / MariaDB-MySQL (`src/`, wrapper mysql2 façon `pg`, auth JWT)
- Console : `admin/tinor_admin.html` (HTML autonome, servi aussi par l'API sur `/`)
- Android : `android/` (APK compilé par GitHub Actions)
- Base : `base/*.sql` (vierge, démo, réel), `scripts/*.sql` (migrations), `tinor_erp_v3_schema.sql`
- Déploiement : Railway (`DEPLOIEMENT.md`), test PC (`TESTER-SUR-PC.md`)

## Commandes
`npm install` · `npm run dev` · `npm run migrate` · `npm run seed` · `npm run demo` · `npm run test:stock` · `npm run backup`

## Versions
Version actuelle : V3.3 (branche `main`). Les branches `archive/*` ne reçoivent plus de modifications.
Détails : `VERSIONS.md`, pistes d'amélioration : `AMELIORATIONS.md`.

## Particularités métier
Fiscalité tunisienne (FODEC, timbre, matricule fiscal), traçabilité des lots, FIFO/FEFO,
certificats bio, grille de prix huiles.

## Mémoire entre sessions (IMPORTANT)
- Le conteneur est éphémère : **tout fichier uploadé doit être commité** dans `docs/references/`
  (ou `base/source/` pour les données), puis listé ci-dessous.
- Les décisions et l'avancement sont dans `docs/JOURNAL.md`. **Lire ce journal au début de chaque session**
  et le mettre à jour (puis commit/push) à la fin.

## Fichiers de référence
- `base/source/BD_tinorexel.xlsx` — source des données historiques (registres, ventes)
- `docs/references/` — fichiers uploadés en discussion (ajouter une ligne ici pour chacun)
