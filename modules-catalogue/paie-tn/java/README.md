# Paie Tunisie — solution Java (NetBeans)

Deux modules Maven :

| Module | Contenu |
|---|---|
| `paie-engine` | Moteur de calcul **sans aucune dépendance** (JDK 17+) : paramètres datés, BigDecimal, résultats identiques au module JS. Réutilisable dans n'importe quelle application Java. |
| `paie-app` | Application de test Swing qui intègre le moteur : MariaDB, rôles, workflow, bulletins PDF, états CSV, audit. |

## Essai immédiat (sans NetBeans)

`java -jar ../dist/paie-app-1.0.0-autonome.jar` (Java 17+ ; JAR autonome contenant le moteur, PDFBox et le pilote MariaDB, construit et testé sur MariaDB 10.11).

## Ouvrir dans NetBeans

1. *File > Open Project* → sélectionner le dossier `java/` (le `pom.xml` parent est reconnu, les deux modules apparaissent).
2. Clic droit sur le projet parent → *Build with Dependencies* (télécharge PDFBox, le pilote MariaDB et JUnit depuis Maven Central).
3. Clic droit sur `paie-app` → *Run*.

Ligne de commande équivalente : `mvn package` puis `java -jar paie-app/target/paie-app-1.0.0.jar`.

## Premier lancement

1. Démarrer MariaDB / MySQL (XAMPP : bouton *Start* de MySQL).
2. Lancer l'application : un **assistant de connexion** s'ouvre (serveur, port, base, utilisateur, mot de passe ; avec XAMPP : `root`, mot de passe vide). *Tester et enregistrer* vérifie la connexion, **propose de créer la base** si elle n'existe pas, puis enregistre `paie.properties` (dans `C:\Users\<nom>\.paie-tn\`).
3. En cas d'échec, l'assistant affiche la cause en clair (serveur arrêté, mot de passe refusé, base absente) et permet de corriger sans éditer de fichier.
4. Les tables `paie_*` sont créées automatiquement, puis l'écran demande de créer le compte **administrateur** (mot de passe ≥ 10 caractères, lettres et chiffres).
5. Administration > Entreprise : raison sociale, taux AT et TFP notifiés. Administration > Utilisateurs : créer au moins un VALIDEUR distinct (contrôle à deux niveaux actif par défaut).

## Parcours

Salariés & contrats → Éléments variables (aperçu immédiat) → Paie du mois : *Lancer la simulation* → contrôle du détail → *Valider la paie* (par un autre utilisateur) → *Bulletins PDF* / *États CSV* → *Clôturer*. Toute réouverture exige un motif, journalisé.

Les taux et barèmes se modifient dans l'onglet *Paramètres réglementaires* (rôle ADMIN) : chaque modification crée une version datée, l'historique est conservé.

Les bulletins portent la mention **NON CERTIFIÉ** tant que les paramètres réglementaires utilisés ne sont pas validés (onglet Paramètres réglementaires, rôle VALIDEUR ou ADMIN). Voir `../docs/PARAMETRES_A_CONFIRMER.md`.

## Tests

- `mvn test` : 26 tests unitaires du moteur (contrôles arithmétiques à la main, barèmes, arrondis, dates d'effet, certification).
- `mvn verify -Dit.user=... -Dit.password=...` : test d'intégration complet sur MariaDB (`WorkflowIT`, base `paie_it` recréée).
- Sans Maven : `./build-local.sh` (javac + bibliothèques de `/usr/share/java`), `IT_USER=... IT_PASSWORD=... ./build-local.sh` pour l'intégration.

## Utiliser le moteur seul

```java
MoteurPaie moteur = new MoteurPaie(Referentiel.charger());   // ou Referentiel.charger(Path, Path)
ResultatPaie r = moteur.calculer(EntreePaie.depuisMap(entreeJson));
r.netAPayer(); r.certifiable(); r.alertes(); r.json();
```

Outil en ligne de commande : `java -cp paie-engine.jar tn.jas.paie.engine.CalculCas cas.json resultats.json`.

## Note de construction

Les POM Maven n'ont pas pu être exécutés dans l'environnement de développement (accès à Maven Central bloqué) : le code a été compilé et testé avec `build-local.sh`, sur les mêmes versions majeures de bibliothèques (PDFBox 2.0, pilote MariaDB, JUnit 5). Signaler toute erreur à la première construction Maven.
