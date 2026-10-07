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

## Écarts de stock — causes trouvées et corrigées

Contrôle : quantité de chaque lot comparée à la somme de ses mouvements. Causes reproduites puis corrigées :

| Cause | Effet avant correction | Correction |
|---|---|---|
| Même produit sur deux lignes d'une commande | erreur 500 après décrément du lot : stock baissé sans mouvement, commande à moitié créée | n° de mouvement unique + transaction |
| Facture annulée puis commande refacturée | stock réintégré à l'annulation, jamais ressorti : stock fantôme | la refacturation ressort le stock |
| Deux commandes / pressages simultanés sur un lot | stock négatif | décrément conditionnel (`decrementerLot`) + transaction |
| Double clic sur « Annuler la facture » | risque de double réintégration | annulation conditionnelle sur le statut |
| Inventaire clôturé alors que le lot a bougé pendant le comptage | mouvement ≠ variation appliquée | mouvement = variation réelle |
| Statut de commande invalide via l'API | erreur 500 | refus clair (400) |

Un écart de type « stock fantôme » reste cohérent avec les mouvements : seul un **inventaire** le révèle.

## Compatibilité MySQL 8 (Railway)

La version initiale ne s'installait pas sur MySQL 8 : la colonne `sequences.last_value` porte le nom
d'une fonction réservée de MySQL 8 (`LAST_VALUE`). Elle est désormais écrite entre accents graves dans
le schéma et les requêtes — même colonne, base identique. Toute l'API (41 routes), l'installation,
les données de démonstration et les tests de stock passent sur MariaDB 10.11 et MySQL 8.4.

## Règles de production : presse et savon

- **Lot de presse** : la matière consommée est uniquement un **lot de graines** (matière première
  « Graines de … ») et le produit obtenu uniquement l'**huile en vrac de la même graine**
  (« Graines de Sésame » → « Huile de Sésame — Vrac »). Correspondance par le nom, sans tenir compte
  des accents ni des majuscules (`src/services/graines.js`, même logique dans la console).
  Appliqué dans le formulaire (listes filtrées, matière choisie en premier) **et** par l'API (refus 400).
- **Bilan matière du pressage** : quantité de matière utilisée **≥ huile + tourteau** (donc jamais
  inférieure à la somme, ni à l'un des deux) ; huile > 0, tourteau ≥ 0. Contrôle en direct dans le
  formulaire (bilan avec pertes et rendement) et refus par l'API.
- **Savon en vrac** : ne passe ni par la presse ni par la filtration ; il entre en stock par
  réception puis est **conditionné directement** depuis son lot.
- Données de démonstration et fichiers `base/*.sql` régénérés en conséquence.

## Pressage de plusieurs lots de graines en une opération

Une opération de presse peut consommer **plusieurs lots de graines**, de la même graine ou de graines
différentes, et produit **une huile en vrac par graine** (ex. 2 lots de sésame + 1 lot de nigelle →
huile de sésame + huile de nigelle). Chaque huile devient un lot de presse relié à ses lots de graines
(traçabilité, colonne « Graines » de l'écran Lots de presse).

Bilan vérifié **par graine** (et donc au total) : graines utilisées ≥ huile + tourteau. Un excédent
d'une graine ne peut pas compenser le manque d'une autre. Refusés aussi : graines sans huile obtenue,
huile sans graines correspondantes, même lot saisi deux fois.

API : `POST /api/presse` avec `sources: [{lot_id, quantite}]` et
`sorties: [{produit_id, quantite_produite, quantite_tourteau}]` (l'ancien format un lot → une huile reste accepté).

## Contraintes de cohérence ajoutées (audit)

| Opération | Contrainte | Risque évité |
|---|---|---|
| Toute consommation de stock | quantité > 0 (contrôle central dans `decrementerLot`) | une quantité négative **ajoutait** du stock |
| Filtration | huile filtrée + déchet ≤ huile pressée utilisée ; produit obtenu = huile en vrac | huile créée à partir de rien |
| Conditionnement | source = vrac du produit ; nombre × format ≤ vrac utilisé (ml→L, g→kg) ; quantité entière | flacon de sésame rempli de nigelle, contenu créé à partir de rien |
| Commandes | quantité > 0, entière pour les produits à l'unité ; prix ≥ 0 | stock augmenté, total négatif |
| Paiements | montant > 0, ≤ reste à payer, facture non annulée (verrou contre les paiements simultanés) | trop-perçu, paiement sur facture annulée |
| Remises | pourcentage entre 0 et 100 ; remise « lot » : entiers ≥ 1 | prix négatif |
| Réceptions / achats | quantité > 0, prix ≥ 0, expiration ≥ date de réception / d'achat | lot reçu déjà périmé |
| Lots manuels | quantité ≥ 0, expiration ≥ production | dates incohérentes |
| Ordres de production / recettes | quantités > 0 | consommation négative |
| Produits | prix, coût, stock minimum ≥ 0 ; TVA entre 0 et 100 | calculs faussés |

Règles communes : `src/services/regles.js`. Tests : `test/stock/contraintes.js` (inclus dans `npm run test:stock`).

## V3.3 — refonte de l'interface (12 propositions)

Aucune modification de l'API ni de la base : tout est dans `admin/tinor_admin.html`.

| # | Proposition | Ce qui change |
|---|---|---|
| 1 | Listes en cartes (téléphone) | Sous 700 px, chaque ligne devient une carte : nom en titre, libellé devant chaque valeur |
| 2 | Onglets en bas, formulaires plein écran | Accueil / Ventes / Production / Stock / Plus ; fenêtres de saisie sur tout l'écran |
| 3 | Saisie de commande en une étape | Entrée choisit le produit puis ajoute la ligne ; stock disponible affiché, alerte si dépassé |
| 4 | Une action par ligne + « ⋯ » | Facturer / Encaisser / Imprimer ; le reste dans « ⋯ » (même menu que le clic droit), annulation séparée et confirmée |
| 5 | Exporter ▾ + périodes | Un bouton Word / Excel / PDF ; Tout, Aujourd'hui, 7 jours, Ce mois, Autre période |
| 6 | Statut par bouton | Badge + « → étape suivante » ; autres statuts dans « ⋯ » |
| 7 | Menu par activité | Ventes, Production, Stock, Achats, Réglages (icônes, sans les codes 00–04) |
| 8 | Recherche universelle | Ctrl+K : écrans, créations, clients, lots, commandes, factures, au clavier |
| 9 | Connexion simplifiée | « Serveur : … changer » ; le champ s'ouvre seul si le serveur est injoignable |
| 10 | Messages intégrés | Notifications et confirmations dans la page (plus de fenêtres du navigateur) |
| 11 | « À faire aujourd'hui » | Commandes à confirmer / livrer / facturer, factures à encaisser, lots qui périment ; ventes des 6 derniers mois |
| 12 | Finitions | États vides avec action, contraste des textes secondaires, contour de focus clavier |

## Ventes, factures et paiements : bugs corrigés et modules ajoutés (V3.3)

| # | Bug constaté | Correction |
|---|---|---|
| A | Une commande dont une ligne attend un conditionnement (sans lot) pouvait être facturée : marchandise vendue mais jamais sortie du stock | Facture refusée tant qu'une ligne attend son conditionnement |
| B | Une commande pouvait être marquée « Payée » sans aucun paiement | « Payée » devient automatique quand la facture est soldée ; refusé à la main sinon. Un paiement annulé la remet « Livrée » |
| C | Annuler une facture payée laissait l'argent encaissé sur une facture annulée | Annulation refusée tant que des paiements restent : annuler d'abord les paiements (remboursement) |
| D | Impossible d'annuler une commande non facturée (client qui renonce) : le stock restait sorti | « Annuler la commande » (gérant, motif obligatoire) : stock réintégré, une seule fois même après une facture annulée |

Modules ajoutés :
- **Annulation d'un paiement** (gérant, motif obligatoire) : le paiement reste visible, barré, avec son motif, et ne compte plus.
- **Solde client** : colonne « Reste dû » dans Clients, et **relevé de compte** (factures, paiements, solde après chaque opération) imprimable.
- Statistiques, totaux clients et panier moyen hors commandes annulées.

Mise à jour de la base : `npm run migrate` (ou `npm run reset:demo`) ajoute le statut « annulée » des
commandes et les colonnes d'annulation des paiements, sans toucher aux données (MariaDB et MySQL 8).
Tests : `test/stock/ventes.js` (27 vérifications), inclus dans `npm run test:stock`.

Reste à faire : suivi des paiements fournisseurs (achats).

## Repère visuel par rubrique (V3.3)

Chaque rubrique a sa couleur, discrète : Ventes (ocre), Production (olive), Stock (bleu ardoise),
Achats (terre cuite), Réglages (gris). Elle colore le liseré sous la barre du haut, un léger fond en
haut de page, le repère « VENTES » au-dessus du titre et le trait sous le titre ; l'écran apparaît
avec un fondu court (désactivé si le système demande moins d'animations).

## Avoirs : une facture émise ne s'annule plus (V3.3)

Règle comptable retenue : une facture émise ne s'annule jamais ; on la corrige par un **avoir**
(numéroté AV-0001, AV-0002…), lié à la facture.

- **Émettre un avoir** (menu ⋯ d'une facture, ou sa fiche ; gérant ; motif obligatoire) : on choisit
  les quantités reprises par ligne (« Tout reprendre » pour un avoir total), et si la marchandise
  revient en stock (retour client) ou non (geste commercial).
- TVA et FODEC recalculées sur les lignes reprises ; le dernier avoir qui reprend tout prend
  exactement le reliquat de la facture (timbre compris), au millime.
- Effets : reste dû de la facture et solde client diminués ; si le client avait déjà payé, il
  apparaît un **crédit en sa faveur** ; stock réintégré si retour ; vente entièrement reprise →
  commande « annulée » ; facture soldée par l'avoir → plus d'encaissement possible.
- Écran **Ventes › Avoirs** (liste, impression de l'avoir), avoirs dans la fiche facture et au
  crédit du relevé client ; chiffre d'affaires et graphique des ventes nets des avoirs.
- « Annuler la facture » est supprimé (l'API répond « émettez un avoir ») ; les factures annulées
  avant cette version restent affichées comme telles.
- Base : tables `avoirs` et `avoir_lignes`, créées par `npm run migrate` sur une base existante.
- Tests : `test/stock/ventes.js` (avoir partiel, avoir sans retour, reliquat exact, crédit client,
  refus au-delà du facturé) et `test/stock/ecarts.js` (avoir total, double clic).

## Palette Méditerranée et nouvelle recherche (V3.3)

Choix faits sur les pages de propositions (maquettes interactives) :

- **Palette Méditerranée** : menu bleu nuit ; Ventes bleu de la mer, Production vert de l'olivier,
  Stock sable doré, Achats terre cuite, Réglages ardoise. Les numéros de document, bandeaux,
  onglets et boutons suivent ces couleurs.
- **Recherche 1 + 5** dans chaque liste :
  - *Vues rapides en onglets*, avec leur nombre : Commandes (À confirmer, À livrer, À facturer,
    Payées, Annulées), Factures (À encaisser, Ce mois, Payées, Avec avoir), Lots (Libérés,
    Périment sous 30 jours, Épuisés, Bloqués / périmés), Clients (Avec reste dû, Avec crédit),
    Paiements (Ce mois, Annulés). Les liens « À faire aujourd'hui » ouvrent la bonne vue.
  - *Barre compacte* sur tous les écrans à filtres : recherche + « Période ▾ » (Aujourd'hui,
    7 jours, Ce mois, Autre période avec dates) ; les filtres actifs deviennent des étiquettes
    retirables (×) avec « Tout effacer ». Gain d'environ 120 px de hauteur.

## Style « Rivage » (V3.3)

Style A choisi sur la page des trois styles, appliqué à toute la console :

- **Menu blanc en accordéon** : chaque rubrique a son icône de couleur ; un clic déplie ses écrans
  juste en dessous, et ouvrir une autre rubrique referme la précédente (une seule liste ouverte).
  L'écran actif est rempli de la couleur de sa rubrique.
- **Bandeau en dégradé** de la rubrique en tête de chaque écran, terminé par une vague, avec
  l'illustration de la rubrique ; la carte de la liste « flotte » sur la vague.
- **Accueil** : grand bandeau mer avec branche d'olivier, les quatre indicateurs en cartes
  blanches posées sur la vague, chacun dans sa couleur.
- Cartes et panneaux arrondis avec ombre douce ; téléphone : même bandeau, onglets en bas inchangés.
- **Bandeau compact** (après comparatif ancien / nouveau) : dégradé foncé sans le bout clair (moins
  lumineux), environ deux fois moins haut, titre plus petit, vague fine, illustration retirée ;
  l'accueil garde une petite branche d'olivier discrète.

## Un produit par étape de l'huile (V3.3)

Chaque étape ne propose que le produit qui lui correspond :

| Étape | Produit obtenu | Exemple |
|---|---|---|
| Presse | huile en vrac | « Huile de Sésame — Vrac » |
| Filtration | huile filtrée | « Huile de Sésame — Filtrée » |
| Conditionnement | huile en flacon (10 ml, 30 ml, 100 ml, 250 ml, 1 L) | « Huile de Sésame — Flacon 30ml » |

- **Filtration** : la liste « Produit obtenu » ne montre que les huiles filtrées ; les lots de presse
  proposés sont ceux de la même huile (sauf « mélange » coché). L'API refuse une huile vrac ou un
  flacon en sortie, et une huile de nigelle filtrée à partir d'huile de sésame.
- **Conditionnement** : la liste ne montre que les huiles en flacon ; formats en volume seulement
  (du plus petit au plus grand). La source peut être le vrac de presse ou l'huile filtrée de la même
  huile (l'huile filtrée est proposée en premier). L'API refuse un produit sans format.
- **Mise à jour** : `npm run migrate` crée la fiche « Huile de … — Filtrée » de chaque huile en vrac
  qui n'en a pas (même catégorie, unité, prix et TVA ; source = le vrac). Les filtrations déjà
  enregistrées gardent leur produit d'origine.
- Pour vendre en 100 ml ou 1 L : créer le produit (ex. « Huile de Sésame — Flacon 100ml », format
  100 ml, source « Huile de Sésame — Vrac ») dans Produits ; il apparaît alors au conditionnement.

### Mélange de plusieurs huiles à la filtration

- Case **« Mélange de plusieurs huiles »** en tête du formulaire : tous les lots de presse sont
  proposés, chacun avec sa part en % ; une barre montre la composition (ex. Sésame 60 % · Nigelle 40 %).
- **Produit obtenu** : seulement les huiles « Mélange … — Filtrée » quand la case est cochée.
  **« ＋ Créer un autre produit mélange »** crée la fiche sans quitter la filtration (nom proposé
  d'après les huiles choisies, modifiable ; catégorie, unité et TVA reprises du vrac) et la sélectionne.
- API : un mélange exige au moins deux huiles différentes et un produit mélange ; un produit mélange
  est refusé si la case n'est pas cochée. La composition (huile, quantité, %) est renvoyée par
  `GET /api/filtration` et affichée sous le produit dans la liste des filtrations.
- Conditionnement : un flacon de mélange (« Huile Mélange Sésame-Nigelle — Flacon 30ml », source =
  le mélange filtré) apparaît dans la liste et se remplit avec ce mélange.

## Conditionnement repensé et mélange dans les 3 étapes (V3.3)

**Formulaire de conditionnement en 4 étapes**, dans l'ordre du travail :
1. **Source utilisée** : un seul choix « lot », groupé en *Huile filtrée* / *Huile en vrac* / *Vrac
   acheté*, avec le stock disponible sous la ligne.
2. **Format et quantité** : le format donne la contenance d'une unité (10 ml … 1 L, ou g) ; l'ancien
   champ « volume/poids par unité » (doublon) est supprimé. L'huile nécessaire (unités × contenance)
   est toujours calculée et reportée dans la source s'il n'y en a qu'une.
3. **Produit fini** : liste filtrée sur la même huile et le même format ; case « Afficher tous les
   produits finis » ; case « Nouveau produit fini » avec nom proposé (ex. « Huile de Sésame — Flacon
   100ml »), créé par l'API dans la même transaction (format, unité pièce, source = le vrac, TVA et
   catégorie reprises ; refusé si le nom existe déjà).
4. **Consommables** proposés : flacon du même format + étiquette, quantité = nombre d'unités
   (modifiables ; une modification manuelle n'est plus écrasée).
Bilan en direct (pris sur chaque lot, reste, unités créées) ; enregistrement bloqué si stock
insuffisant, sources inférieures au besoin, ou plusieurs huiles sans « Mélange ».

**Case « Mélange » à chaque étape** (au moins deux huiles / graines différentes, composition en %) :
- **Presse** : « Mélange de graines » → une seule huile « Huile Mélange … — Vrac » (création rapide du
  produit) ; composition renvoyée par `GET /api/presse` (d'après les lots consommés).
- **Filtration** : un vrac mélange se filtre aussi sans cocher, vers la même huile mélange filtrée.
- **Conditionnement** : sources de plusieurs huiles (vrac ou filtrées) → « Huile Mélange … — Flacon » ;
  une source déjà mélange se conditionne directement en flacon mélange.
- Règle commune côté API : la « clé d'huile » (`cleHuile`) relie vrac, filtrée et flacon d'une même
  huile, mélanges compris.
- **Filtration — produit obtenu par défaut** : il suit la source disponible (lot pressé le plus récent
  avec du stock) au lieu du premier produit de la liste ; changer la 1re source fait suivre le
  produit, et s'il manque la fiche « Huile de … — Filtrée », un lien « ＋ Créer » la crée (catégorie,
  unité, prix, TVA et source repris du vrac) et la sélectionne.

## Recettes : nouveau produit fini et changement de produit (V3.3)

- Case **« Nouveau produit fini »** dans le formulaire de recette : nom, catégorie, unité, format
  (optionnel), prix TTC (optionnel). Le produit est créé par l'API **avec** la recette, dans la même
  transaction (rien n'est créé si la recette est refusée ; nom déjà existant refusé).
- La liste « Produit fini » ne propose plus les matières premières, emballages, consommables ni les
  produits qui ont déjà une recette.
- **Changer le produit d'une recette** (produit existant ou nouveau) est possible tant qu'elle n'a
  servi à aucune production ; ensuite le choix est verrouillé avec l'explication.
- Fonction commune `creerProduitFini` (`src/services/produitCode.js`), aussi utilisée par le
  conditionnement.

## Mode hors ligne complet, synchronisation dans les deux sens (V3.3)

L'application (Android ou navigateur) continue de fonctionner sans connexion au serveur.

- **Copie locale** : chaque donnée lue en ligne est gardée sur l'appareil (IndexedDB). Sans
  réseau, tous les écrans déjà ouverts s'affichent depuis cette copie ; le bandeau indique
  « Hors ligne — données du … ».
- **Connexion hors ligne** : un compte qui s'est connecté en ligne sur l'appareil peut se reconnecter
  sans réseau pendant 7 jours (mot de passe vérifié par empreinte, jamais stocké en clair).
- **Opérations possibles hors ligne** : commandes, réceptions, presse, filtration, conditionnement,
  encaissements, comptages d'inventaire. Chacune reçoit un numéro provisoire (`CMD-HL-K4P2-3`) et le
  stock local en tient compte (lots, produits, solde des factures).
  **En ligne seulement** : factures, avoirs, annulations, clients, produits, réglages (message clair).
- **Retour du réseau** (détecté automatiquement, vérification toutes les 20 s, ou bouton
  « Synchroniser maintenant ») : envoi dans l'ordre, puis rechargement de toutes les données (ce qui
  a été fait sur le PC arrive sur le téléphone).
- **Jamais de doublon** : chaque opération porte un identifiant unique (en-tête `X-Operation-Id`,
  table `operations_sync`). Si la réponse se perd, le renvoi rejoue la réponse déjà donnée.
- **À corriger** (écran Synchronisation) : une opération refusée (stock insuffisant, lot épuisé…)
  n'est jamais perdue. Actions : modifier les quantités puis « Renvoyer », « Ramener au stock
  disponible », « Mettre en attente de production » (commande en attente + notification de rupture),
  « Abandonner ». Notification Android sur le téléphone et notification « Opération hors ligne à
  corriger » au bureau, résolue automatiquement une fois corrigée.
- **Sécurité** : bouton « Effacer les données de cet appareil » ; jeton renouvelé automatiquement au
  retour du réseau.
- Tests : `test/stock/hors-ligne.js` (rejeu, envois simultanés, refus puis correction, rupture
  acceptée, conflits) et parcours complet dans la console (toutes les opérations hors ligne,
  réponse perdue, rechargement de l'application hors ligne, corrections).
- Mise à jour : `npm run migrate` crée la table `operations_sync`. Nouvel APK nécessaire pour la
  notification Android.
