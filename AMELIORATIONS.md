# TinOR V3 — Comparaison avec des applications semblables et pistes d'amélioration

Applications de référence retenues (gestion commerciale + production par lots, adaptées à une
petite structure de transformation : huiles, savons, cosmétiques) :

- **Odoo** (modules Ventes, Inventaire, Fabrication, Qualité) — ERP modulaire, très utilisé en Tunisie.
- **Dolibarr** — ERP/CRM open source francophone, simple, orienté PME.
- **ERPNext** — ERP open source, très fort sur la traçabilité par lots et la qualité.
- **Katana MRP** — logiciel de production pour petits fabricants (recettes, lots, stock).

## 1. Ce que TinOR fait déjà bien

| Domaine | TinOR V3 | Remarque |
|---|---|---|
| Traçabilité des lots | Ascendants / descendants, historique des statuts | Au niveau d'ERPNext ; meilleur que Dolibarr |
| Chaîne huile (réception → presse → filtration → conditionnement) | Spécifique, avec rendements | Aucun des 4 ne l'a nativement : c'est l'atout principal |
| Certificats bio, statut bio par lot | Oui | Rare, même dans Odoo (module tiers) |
| Fiscalité tunisienne (FODEC, timbre, matricule fiscal) | Oui | Odoo/Dolibarr nécessitent une localisation |
| Grille de prix huiles, remises, marge faible | Oui | Bon niveau |
| FIFO à la sortie de stock, notifications de stock manquant | Oui | |
| Exports, sauvegarde depuis la console | Oui | |

## 2. Écarts constatés (ce que les autres ont et pas TinOR)

Vérifié dans le code d'origine : les tables `inventaires`, `inventaire_lignes` et `controles_qualite`
existaient dans le schéma sans route API ni écran. La colonne « TinOR » indique l'état actuel
(✅ = ajouté lors de la priorité 1).

| # | Fonction | Odoo | Dolibarr | ERPNext | Katana | TinOR |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 1 | Alertes péremption des lots (date d'expiration proche / dépassée) | ✓ | ✓ | ✓ | ✓ | ✅ alertes + lot périmé exclu des ventes |
| 2 | Alertes stock minimum (réapprovisionnement) | ✓ | ✓ | ✓ | ✓ | ✓ (existait déjà : rupture et sous-seuil au tableau de bord) |
| 3 | Inventaire physique (comptage, écarts, ajustement) | ✓ | ✓ | ✓ | ✓ | ✅ |
| 4 | Contrôle qualité des lots (analyses, acidité, conformité) | ✓ | – | ✓ | – | ✗ (table vide) |
| 5 | Devis → commande | ✓ | ✓ | ✓ | ✓ | ✗ |
| 6 | Bon de livraison | ✓ | ✓ | ✓ | ✓ | ✗ |
| 7 | Avoir (note de crédit) au lieu d'annuler la facture | ✓ | ✓ | ✓ | – | ✗ (annulation seulement) |
| 8 | Étiquettes lot avec QR code / code-barres | ✓ | ✓ | ✓ | ✓ | ✅ |
| 9 | Facture PDF + envoi par e-mail | ✓ | ✓ | ✓ | ✓ | partiel (impression navigateur, exports Excel/Word ; pas d'e-mail) |
| 10 | Journal d'audit (qui a modifié quoi) | ✓ | ✓ | ✓ | ✓ | ✗ (choix assumé dans le schéma) |
| 11 | Rôles plus fins que gérant / vendeur | ✓ | ✓ | ✓ | ✓ | 2 rôles |
| 12 | Facturation électronique tunisienne (El Fatoora / TTN) | module | module | – | – | ✗ |
| 13 | Coût de revient par lot (matière + emballage + main-d'œuvre) | ✓ | partiel | ✓ | ✓ | partiel (grille de coûts) |
| 14 | Achats : demande de prix, réception partielle, reliquats | ✓ | ✓ | ✓ | ✓ | partiel |

## 3. Feuille de route proposée

### Priorité 1 — gains rapides ✅ réalisée
1. ✅ **Péremption** : les ventes, le conditionnement et les ordres de production n'utilisent
   plus de lot périmé et suivent l'ordre **FEFO** (premier expiré, premier sorti) — avant,
   un lot périmé pouvait être vendu. Alertes au tableau de bord (périmés / sous 30 jours),
   passage au statut `EXPIRE` en un clic (historisé), date d'expiration colorée dans le registre.
   API : `GET /api/alertes/peremption?jours=30`, `POST /api/alertes/peremption/expirer`.
2. ✅ **Inventaire physique** : écran Catalogue & Stock › Inventaires. Ouverture par local,
   comptage avec écarts en direct, clôture qui ajuste les lots par des mouvements `INVENTAIRE`
   (transaction). API : `/api/inventaires`.
3. ✅ **Étiquettes de lot 70 × 40 mm avec QR code** (bouton « Étiquette » du registre des lots).
   Le QR contient le n° de lot : scanné (douchette USB) dans la recherche + Entrée, il ouvre
   la traçabilité. Fonctionne hors ligne (bibliothèque intégrée au fichier).
4. ✅ En plus : compteurs du menu reliés aux vraies données (valeurs fixes de maquette avant).

### Priorité 2 — cycle de vente complet
4. **Devis** convertible en commande.
5. **Bon de livraison** généré depuis la commande.
6. **Avoir** sur facture (remboursement partiel ou total, réintégration de stock).
7. **Facture PDF + envoi par e-mail**.

### Priorité 3 — qualité et contrôle
8. **Contrôle qualité des lots** (acidité, peroxydes, résultat conforme / non conforme
   qui fait passer le lot de `QUARANTAINE` à `LIBERE` ou `REJETE`).
9. **Journal d'audit** des opérations sensibles (factures, stock, prix).
10. **Coût de revient réel par lot** sur toute la chaîne de production.

### Priorité 4 — selon besoin
11. Rôles supplémentaires (production, magasinier, comptable).
12. Facturation électronique El Fatoora (si l'entreprise y est soumise).
