# Paramètres réglementaires à confirmer

État au 23/10/2026, fichier `shared/parametres-tn.json` version `2026.10-1`.
**Aucune valeur n'est validée.** Les sources ci-dessous sont des résumés (presse, cabinets, calculateurs) : chaque valeur doit être confirmée sur le texte officiel (JORT, notes communes DGI, CNSS) puis validée dans l'écran « Paramètres réglementaires » par un professionnel de la paie.

## Points de vigilance prioritaires

| # | Sujet | Ce qui est incertain | Valeur mise par défaut |
|---|---|---|---|
| 1 | **Fonds perte d'emploi (LF 2025)** | Les sources se contredisent : 0,5 % réparti à parts égales (0,25 % / 0,25 %) **ou** +0,5 point de chaque côté (salarié 9,68 %, employeur 17,07 %) | 0,25 % / 0,25 % |
| 2 | **CSS – tranches majorées** | « majoration de chaque taux du barème » : la tranche à 0 % est-elle majorée ? (écart de 25 TND/an pour un revenu > 5 000) | `TOUTES` (= 0,5 % du net imposable) |
| 3 | **CSS – après 2026** | Demi-point prorogé jusqu'au 31/12/2026 (LF 2026 art. 87). Retour à 1 point prévu ensuite | Fin d'effet 31/12/2026 → calcul 2027 bloqué tant qu'un paramètre n'est pas ajouté |
| 4 | **Assiette TFP / FOPROLOS** | Base CNSS retenue ; la loi parle de masse salariale brute (avantages compris) | Base CNSS |
| 5 | **Taux TFP** | 1 % (industries manufacturières) ou 2 % selon l'activité | 1 % (à saisir dans la fiche entreprise) |
| 6 | **Taux accident du travail** | Propre à l'entreprise (notification CNSS) | 0,4 % (à saisir dans la fiche entreprise) |
| 7 | **Indemnités de transport et de panier** | Exonérations partielles possibles (CNSS et/ou IRPP) | Soumises à 100 % |
| 8 | **Plafond enfants** | Le plafond de 4 enfants inclut-il les enfants étudiants / handicapés ? | Plafond appliqué aux seuls enfants ordinaires |
| 9 | **Heures supplémentaires** | Coefficients selon régime horaire et convention collective | 1,25 et 1,50 |
| 10 | **Jours ouvrables / mois** | 26 jours (régime 48 h) ; à adapter | 26 |

## Liste complète

| Code | Valeur | Effet | Source indiquée |
|---|---|---|---|
| CNSS_SAL_TAUX | 9,18 % | 2019 → | sources secondaires, à vérifier sur cnss.tn |
| CNSS_PAT_TAUX | 16,57 % | 2019 → | idem |
| CNSS_PE_SAL / CNSS_PE_PAT | 0,25 % / 0,25 % | 2025 → | LF 2025 (voir point 1) |
| AT_TAUX_DEFAUT | 0,4 % | 2019 → | taux notifié par la CNSS |
| TFP_TAUX_DEFAUT | 1 % | 2019 → | usage courant |
| FOPROLOS_TAUX | 1 % | 2019 → | usage courant |
| FRAIS_PRO_TAUX / PLAFOND | 10 % / 2 000 TND | 2017 → | Code IRPP art. 25 (LF 2017) |
| DED_CHEF_FAMILLE | 300 TND | 2010 → | Code IRPP art. 40 |
| DED_ENFANT / MAX | 100 TND / 4 enfants | 2019 → | Code IRPP art. 40 |
| DED_ENFANT_ETUDIANT | 1 000 TND | 2019 → | Code IRPP art. 40 |
| DED_ENFANT_HANDICAPE | 2 000 TND | 2019 → | Code IRPP art. 40 |
| CSS_MAJORATION | 0,5 point | 2023 → 31/12/2026 | DL 2022-79 art. 22, loi 2025-17 (LF 2026) art. 87 |
| CSS_SEUIL_EXONERATION | 5 000 TND | 2020 → | loi 2019-78 (LF 2020) art. 39 |
| Barème IRPP 2017-2024 | 0 / 26 / 28 / 32 / 35 % | 2017 → 2024 | Code IRPP art. 44 |
| Barème IRPP 2025 → | 0 / 15 / 25 / 30 / 33 / 36 / 38 / 40 % (tranches 5 000, 10 000, 20 000, 30 000, 40 000, 50 000, 70 000) | 2025 → | loi 2024-48 (LF 2025) art. 36 |

## Modifier un taux ou un barème

**Depuis l'application (recommandé)** — onglet *Paramètres réglementaires*, rôle ADMIN, en Java comme dans TinOR :

1. Sélectionner le paramètre ou le barème, puis *Nouvelle valeur* / *Nouveau barème*.
2. Saisir la nouvelle valeur (taux en %, ex. `9,68`) ou les tranches du barème (ajout/retrait de tranches, la borne « De » suit la borne « À » précédente).
3. Indiquer la **date d'effet** (1er du mois), la date de fin éventuelle et le **texte officiel de référence** (obligatoire).

Règles appliquées :
- une modification crée une **nouvelle version** ; l'ancienne est automatiquement close la veille et reste appliquée aux mois antérieurs ;
- la date d'effet doit être postérieure à la dernière période **validée ou clôturée** (les bulletins validés ne changent jamais) et à la dernière version existante ;
- contrôles : taux entre 0 et 100 %, montants positifs, barème contigu commençant à 0 et dont la dernière tranche est ouverte ;
- la nouvelle valeur est « À CONFIRMER » : elle doit ensuite être validée par un professionnel (rôle VALIDEUR) pour que les bulletins redeviennent certifiables ;
- une simulation déjà lancée sur une période concernée est détectée comme périmée à la validation : il faut la relancer ;
- une version saisie peut être supprimée tant qu'aucune période validée ne l'utilise ; tout est tracé dans le journal d'audit (`MODIFICATION_PARAM`, `SUPPRESSION_PARAM`).

Les versions saisies sont stockées dans la table `paie_parametres_versions` (migration `V2`), partagée par les deux applications.

**Par le fichier (mise à jour livrée avec le logiciel)** :

1. Ajouter une **nouvelle entrée datée** dans `shared/parametres-tn.json` (ne jamais écraser l'ancienne : fermer sa date de fin la veille).
2. Incrémenter `version`.
3. Côté Java : recompiler (ou pointer `parametres.fichier` dans `paie.properties`). Côté TinOR : `npm run sync-shared` puis redémarrer.
4. Relancer les tests d'équivalence, puis faire valider la nouvelle valeur dans l'écran Paramètres.

Les bulletins anciens restent reproductibles : chaque calcul stocke la version des paramètres et le détail des valeurs utilisées.
