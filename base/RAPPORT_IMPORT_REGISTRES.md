# Remplissage de `tinor_reel` depuis les registres Excel — évaluation

Source : `base/source/BD_tinorexel.xlsx` (5 feuilles : presse, filtration, mélange, mouvement/ventes, stock produit fini).
Résultat : **`base/tinor_reel_donnees.sql`** (à exécuter une fois, après `tinor_reel_creation.sql`).
Générateur reproductible : `node scripts/importer-registres.js` (sur une base neuve).

## Ce qui est importé

| Étape | Lignes | Détail |
|---|---|---|
| Produits | 5 | Pépins de figue de barbarie · Huile … Vrac · Filtrée · Flacon 10 ml · Flacon 30 ml (+ catégorie « Matières premières ») |
| Lots de pépins | 4 | `2312`, `2313`, `2314`, `GJ01/2023` (n° fournisseur gardé tel quel) |
| Pressages | 30 | n° de lot des registres gardés, kg de pépins, litres d'huile, n° d'outil en remarque |
| Filtrations | 23 | filtre utilisé, déchet, rendement, lien vers le lot de presse |
| Lots finis (mélanges) | 10 | deux huiles filtrées par lot, au prorata exact des ml du registre |
| Lots de flacons | 15 | 19 opérations de flaconnage ; un lot par format (2ᵉ format = suffixe `-2`, règle de l'application) |
| Sorties | 22 | mouvements de stock « VENTE » (client, paiement, destination en note) |
| Clients | 15 | pris des noms du registre des ventes |
| Mouvements de stock | 199 | traçabilité complète pépins → flacon vendu |

## Évaluation (faite sur une vraie base MariaDB 10.11, puis lue par l'API de TinOR)

Contrôles passés : stock de chaque lot = somme de ses mouvements (0 écart) ; aucun stock négatif ; lots à 0 = « épuisés » ;
aucun doublon de n° de lot ou de mouvement ; rejeu du fichier SQL sur une base neuve = résultat identique (empreinte) ;
deuxième exécution refusée ; l'application affiche 30 pressages, 23 filtrations, 19 conditionnements, 72 lots, 5 produits.

Recoupements entre registres (exacts) : chaque quantité du mélange correspond au ml près à la filtration
(ex. 0,96 L filtré = 400 ml mélangés + 560 ml restants) ; contenu des flacons = lot fini (sauf 2 ml et 5 ml de pertes notées) ;
flacons vendus = flacons produits pour tous les lots, sauf les écarts ci-dessous. Rendements plausibles :
presse 2,7–4,0 % (litres/kg), filtration 75–93 %.

**Stock restant après import** : pépins 0 · huile en vrac non filtrée **7,909 L** (11 lots) · huile filtrée **8,199 L** (9 lots) ·
produits finis **0** (tout est vendu). Le total « huile non filtrée + filtrée » du classeur est 23 684 ml ; le détail des registres
donne 23 975 ml → **écart de 291 ml (1,2 %) non expliqué** (calcul du classeur à vérifier).

## Corrections de saisie appliquées (à confirmer)

| Registre | Saisi | Retenu | Pourquoi |
|---|---|---|---|
| Filtration n°1 | `01-2312-20231217` | `01-2314-20231217` | le registre de presse dit fournisseur 2314 |
| Filtration n°7 | `25-2312-20242704` (presse `…20240505H`) | `25-2312-20240427` (presse `…20240427H`) | date écrite JJMM ; pressé le 27/04 |
| Filtration n°13 | `08-2312-20241105` | `08-2313-20241105` | 2312 n'existe pas ce jour-là ; 0,03 + 0,69 L = les 0,72 L pressés du 2313 |
| Filtration n°14 | `03-JG01/2023-20251105` | `03-GJ01/2023-20250115` | JG→GJ ; filtré le 15/01/2025 (utilisé en mélange dès 04/2025) |
| Mélange 030808 | `08-GJ01/2320240210`, `08-231320240210h` | filtrés `…-20241105` (27 + 28 ml) | références illisibles ; quantités = filtrations du 05/11/2024 |
| Presse n°12 | date 18/02/2024 | 18/03/2024 | n° de lot `…20240318H`, ordre chronologique |
| Lots finis | `11823`… | `011823`… | Excel avait retiré le 0 initial |

Les 16 substitutions sont listées à l'exécution du script ; le n° saisi est conservé dans les notes du lot filtré.

## Points à trancher avec vous

1. ~~Lot 100106~~ **Réglé** : le registre de stock mis à jour indique 26 flacons de 30 ml et 59 de 10 ml vendus, comme le registre des ventes du 19/07/2026 → stock 0. (Les colonnes « restant 590 », « 192 » et « 360 » de ces lignes ne sont pas reprises : elles ne correspondent à aucune quantité de flacons.)
2. **Lot 100106** : mélange daté du 20/05/2026 mais flaconné les 10-11/05/2026 → date de flaconnage retenue.
3. **Vente n°6 (19/08/2025, lot 082415)** : « 6×30 + 2×10 » alors que le lot n'a que 4 flacons de 30 ml (sortis le 04/05/2025). Enregistrée en 20 flacons de 10 ml (mêmes 200 ml).
4. **Sortie du 04/05/2025** (4×30 ml du lot 082415) : présente au registre mélange, absente du registre des ventes ; client inconnu.
5. **Total « prod 2 » du registre mélange** : 2 868 ml affiché, la somme des lignes fait 4 059 ml (le total initial 7 867 est juste).
6. **Pépins** : quantités reçues inconnues → égales aux kg pressés (stock 0). Faire un inventaire des pépins réellement en stock.
7. **Péremption** : colonne « Date d'expiration » = 3 pour tous → interprétée comme 3 ans après la production. À confirmer.
8. **Intermédiaires non modélisés** : flacon de 55 ml (lot 030808, reconditionné en 1×30 + 2×10 le 09/05/2026) et bidon de 1000 ml (372 ml, lot 090808).
9. **Clients** : `artisanet`/`artizanet` regroupés ; `Berntrard`/`bernard` et `client Passage`/`client passaget`/`passaget claude` laissés distincts. Type (particulier/revendeur) à compléter.
10. **Absent des registres, donc non importé** : commandes/factures (prix de vente ajoutés ensuite : 24,7 DT le flacon 10 ml, 76,5 DT le 30 ml (soit 20,007 et 61,965 DT après remise) avec une remise « Remise 19 % » créée ; les sorties restent de simples sorties de stock) (pas de commandes/factures créées, seulement des sorties de stock), bio/certificat (lots « à vérifier »),
    fournisseurs, employés. N° de vente répété (n°18 ×5) et valeur isolée « 2730 » ignorés.
11. **Numérotation** : le registre ne repart pas à 01 chaque année (04…10 sur 2025-2026) ; compteurs réglés sur 03 / 09 / 10, le prochain lot fini de 2026 sera `11…`.
