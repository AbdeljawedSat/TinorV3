# Versions et archives de TinOR

| Version | Où la trouver | Contenu |
|---|---|---|
| **Statut 1** — référence de secours 1 | dépôt `WiFi-Voice-Controlled-Robot`, dossier `reference-secours-1/` | Archive d'origine (console + API V3) avec les premiers correctifs de déploiement Railway |
| **Statut 2** — V3.2 (archive) | branche **`archive/statut-2`** (commit `4df5c34`) · APK : version GitHub `android-v5` | Péremption FEFO, inventaires, étiquettes QR, cohérence du stock, base MySQL 8, application Android, pressage multi-graines, contraintes de cohérence |
| **V4.0** — version actuelle | branche `main` · APK : prochaine version GitHub `android-vN` | Sécurité (droits par rôle, journal d'audit), fiabilité (restauration testée, tests automatiques), qualité des lots, rappel de lot, coûts et marges, paiements fournisseurs, e-mail des factures, numérotation configurable (voir ci-dessous) |
| **V3.3** | tag/commits avant la V4 | Refonte de l'interface (voir plus bas) |

Télécharger une archive : sur GitHub, choisir la branche `archive/statut-2` puis **Code → Download ZIP**,
ou `https://github.com/AbdeljawedSat/TinorV3/archive/refs/heads/archive/statut-2.zip` (connecté à GitHub si le dépôt est privé).
Copies zip prêtes à télécharger dans le dossier `archive/` : `tinor-v3.2-statut-2.zip` (Statut 2) et `tinor-v3.3.zip` (V3.3).

Une branche d'archive ne doit plus recevoir de modifications.

## V4.0 — sécurité, qualité, gestion

**Sécurité** — cinq rôles (gérant, vendeur, magasinier, production, comptable) appliqués **par le serveur** (pas seulement masqués à l'écran) ;
utilisateurs, paramètres (écriture), sauvegardes et journal réservés au gérant ; au moins un gérant actif toujours conservé ; mots de passe de
10 caractères minimum, refus des plus courants ; compte désactivé ou rôle changé : effet immédiat ; journal d'audit (qui a fait quoi, refus de droits,
connexions) ; CORS limité (console, application Android, réseau local, `CORS_ORIGINS`) ; en-têtes de protection ; HTTPS direct ou derrière un proxy ;
texte saisi échappé à l'affichage et balises HTML refusées à l'enregistrement.

**Fiabilité** — tests automatiques à chaque modification (`.github/workflows/tests.yml` : syntaxe, console à jour, suite complète sur MariaDB, restauration) ;
`npm run restaurer` et `npm run test:restauration` (sauvegarde → restauration dans une base temporaire → comparaison table par table) ; tests d'opérations simultanées.

**Qualité** — analyses de lots avec seuils (olive : UE 2022/2104 ; graines : Codex Stan 210, à confirmer avec le laboratoire), lot libéré ou bloqué automatiquement,
dérogation motivée du gérant, quarantaine à la création (au choix par étape), certificat d'analyse imprimable ; **rappel de lot** : tous les lots issus d'un lot
et les clients livrés (impression, CSV).

**Gestion** — coût réel par lot (achat → presse → filtration → mélange → flacons, pertes comprises, plus frais d'étape) ; marges par produit, client et mois ;
achats avec réceptions partielles et reliquat ; paiements fournisseurs (reste à payer, annulation tracée) ; envoi des factures par e-mail (pièce jointe Word) ;
contrôle des mentions obligatoires d'une facture ; numérotation configurable des 15 opérations.

**Développement** — la console est écrite en plusieurs fichiers (`admin/src/`) et assemblée en un seul (`npm run console`).

**Pas encore intégré** — facturation électronique El Fatoora (TTN) : obligatoire en Tunisie depuis 2026 pour les assujettis à la TVA ; elle demande le format TEIF,
la signature électronique TunTrust et un accès TTN, à traiter avec le comptable (voir AMELIORATIONS.md).

## V3.3 — refonte de l'interface

Les 12 propositions de la page « Refonte de l'interface TinOR », toutes livrées (détail dans `AMELIORATIONS.md`) :

1. **Téléphone et messages** : listes en cartes (1), onglets en bas et formulaires plein écran (2), messages et confirmations intégrés (10).
2. **Rapidité** : saisie de commande en une étape (3), une action par ligne + menu « ⋯ » (4), bouton Exporter et filtres de période (5), statuts par bouton (6).
3. **Repères et finitions** : menu par activité (7), recherche universelle Ctrl+K (8), connexion simplifiée (9), « À faire aujourd'hui » (11), finitions visuelles (12).

Style « Rivage » ensuite appliqué à toute la console : menu blanc en accordéon (une seule rubrique dépliée), bandeaux en dégradé avec vague, accueil mer et olivier, cartes flottantes.

Aucune modification de la base de données : les fichiers `base/*.sql` restent valables.
