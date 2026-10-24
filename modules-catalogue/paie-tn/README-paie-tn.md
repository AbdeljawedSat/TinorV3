# Module de paie tunisienne — Java & JavaScript

Réalisé d'après le *Cahier des charges — Module de gestion de la paie et des déclarations sociales et fiscales — Tunisie* (v1.0, 23/10/2026).

```
paie-tn/
├── shared/                   SOURCE UNIQUE commune aux deux solutions
│   ├── parametres-tn.json    paramètres réglementaires datés + barèmes IRPP (source, statut, dates d'effet)
│   ├── rubriques-tn.json     catalogue des rubriques (assujettissement CNSS / IRPP, mode de calcul)
│   ├── sql/                  schéma MariaDB/MySQL (V1 tables paie_*, V2 versions de paramètres)
│   └── tests/                cas d'équivalence + résultats du moteur Java
├── java/                     1) Solution NetBeans / Java : moteur + application de test Swing
├── js/tinor-paie/            2) Solution JavaScript à intégrer dans TinOR ERP (Express + MariaDB + écran vanilla JS)
├── dist/paie-app-1.0.0-autonome.jar   application Java prête à lancer (java -jar)
└── docs/
    ├── SPECIFICATION_CALCUL.md     étapes et règles d'arrondi communes aux deux moteurs
    ├── PARAMETRES_A_CONFIRMER.md   valeurs, sources et points réglementaires à faire valider
    └── exemples/                   bulletins PDF et captures d'écran (données fictives)
```

Les deux solutions peuvent partager **la même base** : même schéma, même workflow, et chaque moteur sait contrôler un calcul produit par l'autre.

## Ce qui est livré

| Exigence du cahier des charges | Java | TinOR JS |
|---|---|---|
| Moteur unique, déterministe, montants en décimal exact | ✔ BigDecimal | ✔ decimal.js — résultats identiques au millime |
| Paramètres datés, source, historique, reproduction d'un bulletin ancien | ✔ | ✔ (même fichier) |
| Taux et barèmes **modifiables dans l'écran** (versions datées, historique conservé) | ✔ éditeur Swing | ✔ éditeur TinOR |
| Aucun calcul présenté comme conforme sans validation des paramètres | ✔ mention NON CERTIFIÉ | ✔ |
| Salariés, contrats/avenants, éléments variables | ✔ | ✔ |
| Simulation, détail transparent, comparaison avant/après | ✔ | ✔ |
| Validation (contrôle à deux niveaux), clôture, réouverture motivée | ✔ | ✔ |
| Détection de données modifiées après simulation | ✔ | ✔ |
| Rôles ADMIN / GESTIONNAIRE / VALIDEUR / CONSULTATION | ✔ (comptes propres, PBKDF2) | ✔ (session TinOR) |
| Journal d'audit, archivage des documents (SHA-256) | ✔ | ✔ |
| Bulletin PDF | ✔ PDFBox | ✔ HTML A4 → PDF navigateur, option bilingue FR/AR |
| Livre de paie, états CNSS, IRPP/CSS, paiement | ✔ CSV | ✔ CSV et Excel |
| Migrations SQL versionnées | ✔ | ✔ |

## Vérifications effectuées

| Test | Résultat |
|---|---|
| Moteur Java — tests unitaires JUnit (dont un bulletin recalculé à la main) | 26 / 26 |
| Application Java — workflow complet sur MariaDB 10.11 (`WorkflowIT`) | 9 / 9 |
| Moteur JS — tests unitaires | 10 / 10 |
| Équivalence Java ↔ JS — cas partagés | 15 / 15 identiques |
| Équivalence Java ↔ JS — tirage aléatoire (2024 → 2027, erreurs comprises) | 3 000 / 3 000 identiques |
| API TinOR — workflow complet sur MariaDB 10.11 | ✔ (mêmes montants que l'application Java) |
| Interfaces — rendu bureau et mobile, bulletins PDF | contrôlé visuellement |

Ces tests prouvent que les deux moteurs **calculent la même chose** et que le workflow est sûr. Ils ne prouvent pas la conformité réglementaire : aucun cas de référence n'a été validé par un spécialiste de la paie tunisienne (le cahier des charges interdit d'en inventer).

## Avant toute utilisation réelle

1. Faire vérifier chaque paramètre de `docs/PARAMETRES_A_CONFIRMER.md` sur les textes officiels — en priorité la contribution au **fonds de perte d'emploi** (sources contradictoires) et le mode de calcul de la **CSS**.
2. Faire valider des bulletins de référence par un expert-comptable, et les ajouter aux tests.
3. Valider les paramètres dans l'application : les bulletins deviennent alors « certifiables ».
4. Les fichiers déclaratifs officiels (CNSS, DGI) ne sont pas produits : leur format exact doit d'abord être fourni.

## Limites V1

Annualisation mensuelle sans régularisation annuelle de l'IRPP · pas de prorata automatique d'entrée/sortie · régime CNSS général non agricole uniquement (pas de CNRPS, régime agricole, SIVP/KARAMA exonérés) · pas de solde de tout compte ni de rappel sur période antérieure.
