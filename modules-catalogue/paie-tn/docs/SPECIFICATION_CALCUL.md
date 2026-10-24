# Spécification du calcul — contrat commun Java / JS

Les deux moteurs (`tn.jas.paie.engine.MoteurPaie` en Java, `src/engine/moteur.js` en JS) appliquent **exactement** les étapes ci-dessous, dans cet ordre. Toute évolution doit être faite dans les deux moteurs puis validée par les tests d'équivalence (15 cas fixes + tirage aléatoire).

## 0. Entrée

Structure JSON commune (voir `shared/tests/cas-equivalence.json`) :

```json
{ "periode": "2026-10",
  "entreprise": { "tauxAT": "0.004", "tauxTFP": "0.01" },
  "salarie": { "matricule": "M001", "regime": "CNSS_RSNA", "dateEntree": "2020-01-01", "dateSortie": null,
               "chefFamille": true, "nbEnfants": 2, "nbEnfantsEtudiants": 0, "nbEnfantsHandicapes": 0 },
  "contrat": { "salaireBase": "2000", "horaireMensuel": "208", "tauxHoraire": null },
  "variables": [ { "rubrique": "HS_1", "quantite": "8" }, { "rubrique": "AVANCE", "montant": "150" } ],
  "validations": [ { "code": "CNSS_SAL_TAUX", "debut": "2019-01-01", "valeur": "0.0918" } ] }
```

Les montants sont transmis **en texte** pour éviter toute perte (jamais de flottant binaire).

**Date de référence** des paramètres : dernier jour du mois de paie. Un paramètre s'applique si `debut ≤ date ≤ fin`.

## Règles d'arrondi

| Opération | Règle |
|---|---|
| Multiplications, additions | exactes (BigDecimal / decimal.js) |
| Divisions | arrondies directement à 3 décimales, HALF_UP |
| Montant publié (ligne, cotisation, impôt) | arrondi au millime, HALF_UP |

HALF_UP = demi arrondi en s'éloignant de zéro (0,0015 → 0,002 ; −0,0015 → −0,002).

## 1. Contrôles d'entrée

Erreurs bloquantes : régime ≠ `CNSS_RSNA`, salaire de base absent ou ≤ 0, horaire ≤ 0, entrée après la période, sortie avant la période, enfants < 0.
Avertissement `MOIS_INCOMPLET` si entrée/sortie en cours de mois (**pas de prorata automatique** : saisir l'absence).

## 2. Lignes de rémunération

1. `SAL_BASE` = salaire de base du contrat (jamais saisi en variable).
2. Variables triées par `ordre` de rubrique (tri stable).
3. Montant selon le mode :
   - `MONTANT` : montant saisi, arrondi au millime
   - `QTE_TAUX` : r3(quantité × taux)
   - `HEURES_SUP` : si taux horaire du contrat : r3(qté × taux horaire × coef) ; sinon div3(qté × salaire de base × coef, horaire mensuel)
   - `ABS_JOURS` : div3(qté × salaire de base, JOURS_OUVRABLES_MOIS) — avertissement si qté > jours
   - `ABS_HEURES` : r3(qté × taux horaire) ou div3(qté × base, horaire)
4. `GAIN` ajoute au brut, `RETENUE_BRUT` retranche, `RETENUE_NET` va dans les retenues après net.
5. Bases : `baseCnss` = Σ lignes soumises CNSS ; `baseIrpp` = Σ soumises IRPP ; `baseCnssIrpp` = Σ soumises aux deux. Bases ramenées à 0 si négatives.

## 3. Cotisations

Chaque montant = r3(base CNSS × taux).
- CNSS salarié `CNSS_SAL_TAUX`, patronal `CNSS_PAT_TAUX`
- Perte d'emploi `CNSS_PE_SAL` / `CNSS_PE_PAT` (facultatif : absent avant 2025, pas d'alerte)
- Accident du travail : taux entreprise, sinon `AT_TAUX_DEFAUT`
- TFP : taux entreprise, sinon `TFP_TAUX_DEFAUT` ; FOPROLOS `FOPROLOS_TAUX` — **assiette retenue : base CNSS** (à confirmer)

## 4. Fiscalité (méthode d'annualisation du mois)

```
cnssDeductible    = r3(baseCnssIrpp × CNSS_SAL_TAUX) + r3(baseCnssIrpp × CNSS_PE_SAL)
imposableMensuel  = max(baseIrpp − cnssDeductible, 0)
imposableAnnuel   = imposableMensuel × 12
fraisPro          = r3(min(imposableAnnuel × FRAIS_PRO_TAUX, FRAIS_PRO_PLAFOND))
deductions        = si chef de famille : DED_CHEF_FAMILLE + min(nbEnfants, DED_ENFANT_MAX) × DED_ENFANT
                    + nbEtudiants × DED_ENFANT_ETUDIANT + nbHandicapés × DED_ENFANT_HANDICAPE
                    (sinon 0, avec avertissement si enfants déclarés)
netImposableAnnuel = max(imposableAnnuel − fraisPro − deductions, 0)
irppAnnuel        = r3(barème IRPP(netImposableAnnuel))
irppMensuel       = div3(irppAnnuel, 12)
CSS               = si netImposableAnnuel > CSS_SEUIL_EXONERATION :
                      r3(barème majoré de CSS_MAJORATION − barème normal) ; mensuel = div3(annuel, 12)
                    CSS_MODE = TOUTES (y compris tranche à 0 %) ou HORS_TRANCHE_ZERO
```

Paramètre CSS absent pour la période (ex. 2027) → erreur bloquante `PARAM_MANQUANT`.

## 5. Net et coût

```
net          = brut − cnssSalarial − irppMensuel − cssMensuel − Σ retenues nettes   (erreur si < 0)
charges      = CNSS pat + PE pat + AT + TFP + FOPROLOS
coutEmployeur = brut + charges
```

## 6. Certification

Chaque paramètre, barème et rubrique utilisé est listé avec sa valeur canonique (sans zéros finaux). Il est **validé** seulement si une validation existe pour le même `code`, la même date de début et la **même valeur**. Toute modification du fichier invalide donc automatiquement la validation.

`certifiable = aucune erreur ET tous les éléments utilisés validés`. Sinon le bulletin porte « NON CERTIFIÉ ».

## Limites connues (V1)

- Méthode d'annualisation mensuelle : **pas de régularisation annuelle** de l'IRPP sur cumuls réels.
- Pas de prorata automatique en cas d'entrée/sortie en cours de mois.
- Seul le régime CNSS général non agricole (`CNSS_RSNA`) est calculé ; CNRPS, régime agricole, SIVP/KARAMA exonérés non gérés.
- Pas de contrôle du SMIG, pas de solde de tout compte, pas de rappel sur période antérieure.
- Fichiers déclaratifs officiels (CNSS trimestrielle, déclaration employeur) **non produits** : seuls des états récapitulatifs CSV/Excel.
