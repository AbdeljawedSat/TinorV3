# Versions et archives de TinOR

| Version | Où la trouver | Contenu |
|---|---|---|
| **Statut 1** — référence de secours 1 | dépôt `WiFi-Voice-Controlled-Robot`, dossier `reference-secours-1/` | Archive d'origine (console + API V3) avec les premiers correctifs de déploiement Railway |
| **Statut 2** — V3.2 (archive) | branche **`archive/statut-2`** (commit `4df5c34`) · APK : version GitHub `android-v5` | Péremption FEFO, inventaires, étiquettes QR, cohérence du stock, base MySQL 8, application Android, pressage multi-graines, contraintes de cohérence |
| **V3.3** — version actuelle | branche `main` · APK : prochaine version GitHub `android-vN` | Refonte de l'interface (voir ci-dessous) |

Télécharger une archive : sur GitHub, choisir la branche `archive/statut-2` puis **Code → Download ZIP**,
ou `https://github.com/AbdeljawedSat/TinorV3/archive/refs/heads/archive/statut-2.zip` (connecté à GitHub si le dépôt est privé).
Copies zip prêtes à télécharger dans le dossier `archive/` : `tinor-v3.2-statut-2.zip` (Statut 2) et `tinor-v3.3.zip` (V3.3).

Une branche d'archive ne doit plus recevoir de modifications.

## V3.3 — refonte de l'interface

Les 12 propositions de la page « Refonte de l'interface TinOR », toutes livrées (détail dans `AMELIORATIONS.md`) :

1. **Téléphone et messages** : listes en cartes (1), onglets en bas et formulaires plein écran (2), messages et confirmations intégrés (10).
2. **Rapidité** : saisie de commande en une étape (3), une action par ligne + menu « ⋯ » (4), bouton Exporter et filtres de période (5), statuts par bouton (6).
3. **Repères et finitions** : menu par activité (7), recherche universelle Ctrl+K (8), connexion simplifiée (9), « À faire aujourd'hui » (11), finitions visuelles (12).

Style « Rivage » ensuite appliqué à toute la console : menu blanc en accordéon (une seule rubrique dépliée), bandeaux en dégradé avec vague, accueil mer et olivier, cartes flottantes.

Aucune modification de la base de données : les fichiers `base/*.sql` restent valables.
