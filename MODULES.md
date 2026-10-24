# Modules TinOR

TinOR s'étend par des **modules** : Réglages › **Modules** permet d'ajouter, activer, désactiver et retirer des modules sans toucher au code de TinOR ni redémarrer le serveur.

## Pour l'utilisateur (gérant)

1. **Réglages › Modules.**
2. *Modules disponibles* : ceux fournis avec TinOR (dossier `modules-catalogue/`) → **Installer**. Ou *Ajouter un module* : choisir un fichier `.zip`, cocher « Je connais l'auteur », **Installer**.
3. Le module est actif aussitôt : une rubrique **Modules** apparaît dans le menu, avec son écran.
4. **Réglages et droits** : réglages propres au module et rôle de chaque utilisateur dans le module (par défaut selon son rôle TinOR).
5. **Désactiver** retire le module du menu et de l'API ; **Retirer** supprime son code et ses réglages. **Les données du module ne sont jamais supprimées** : réinstaller le module les retrouve.

⚠ Un module s'exécute dans le serveur TinOR, avec ses droits (il peut lire et modifier toute la base). N'installer que des modules dont on connaît l'auteur. Chaque installation, activation ou retrait est tracé dans le journal d'audit ; les modules sont installés dans le dossier `modules/` (non suivi par git : une mise à jour de TinOR ne les efface pas).

## Pour le développeur d'un module

Un module est un dossier contenant :

```
module.json        description du module (obligatoire)
tinor-module.js    point d'entrée serveur : exports { installer(ctx) } → routeur Express
ui/…               interface (facultatif) : un script qui expose  Global.monter(élément, options)
node_modules/…     dépendances embarquées (le zip est autonome)
```

### module.json

| Champ | Rôle |
|---|---|
| `id`, `nom`, `version` | identifiant (minuscules, chiffres, tirets), nom affiché, `1.2.3` |
| `description`, `auteur`, `licence` | informations affichées dans l'écran Modules |
| `tinor` | version minimale de TinOR (`">=4.0.0"`) |
| `main` | fichier serveur (`tinor-module.js`) |
| `dependances` | paquets npm à embarquer dans le zip (copiés depuis `node_modules` par l'outil d'empaquetage) |
| `ecran` | `{ titre, icone, ui: { script: "ui/xxx.js", global: "NomGlobal", monter: "monter" } }` : entrée de menu et interface |
| `roles` | `{ liste: [...], parDefaut: { gerant: "ADMIN", comptable: "GESTIONNAIRE" }, descriptions: {...} }` : rôles propres au module ; sans ce bloc, les rôles TinOR sont transmis tels quels |
| `config` | réglages `[{ cle, type: "booleen"/"texte"/"nombre", defaut, libelle }]` modifiables dans l'écran Modules |
| `donnees` | phrase d'information sur les tables du module |
| `empaqueter.exclure` | fichiers du dossier source à ne pas mettre dans le zip |

### Ce que reçoit `installer(ctx)`

| `ctx` | |
|---|---|
| `ctx.poolBrut()` | pool `mysql2/promise` dédié au module (les DECIMAL restent du texte exact) — le module crée lui-même ses tables (préfixer par `<id>_`) |
| `ctx.pool` | pool TinOR (`pool.query(sql, [$1…])` → `{ rows }`) |
| `ctx.utilisateur(req)` | `{ id, login, roleTinor, role }` — `role` est le rôle du module décidé par le gérant ; la requête n'arrive au module que si ce rôle existe |
| `ctx.config()` | réglages courants (le module est redémarré quand le gérant les modifie) |
| `ctx.version`, `ctx.dossier`, `ctx.journaliser(action, détail)` | version de TinOR, dossier du module, trace |

Le routeur renvoyé est monté sur **`/api/m/<id>/…`**, derrière la connexion TinOR. L'interface est servie sur `/modules-ui/<id>/` (dossier `ui/` seulement) ; la console appelle `Global.monter(élément, { api: "<serveur>/api/m/<id>", entetes: () => ({ Authorization: "Bearer …" }), credentials: "omit" })`.

### Empaqueter et vérifier

```
npm run module:empaqueter -- modules-catalogue/mon-module            # → modules-catalogue/mon-module-1.0.0.zip
node scripts/empaqueter-module.js modules-catalogue/mon-module --verifier   # la CI vérifie que le zip est à jour
```

L'installation refuse : zip invalide ou trop gros (30 Mo, 80 Mo décompressés, 3 000 fichiers), chemins sortant du dossier (`../`), liens symboliques, `module.json` invalide, TinOR trop ancien, version plus ancienne que celle installée, module qui plante au démarrage (rien n'est alors installé). Une mise à jour qui ne démarre pas est annulée : la version précédente est rétablie.

Un exemple minimal figure dans `test/stock/modules.js` ; un module complet (paie) dans `modules-catalogue/paie-tn/`.

## Module fourni : Paie Tunisie (`paie-tn`)

Salariés et contrats, éléments variables, simulation, validation à deux niveaux, clôture / réouverture motivée, bulletins imprimables (FR ou FR/AR), livre de paie et états CNSS / IRPP / CSS (CSV, Excel), paramètres réglementaires **datés et modifiables** avec source et validation, journal propre. Moteur en décimal exact, identique au millime à la version Java (NetBeans) livrée dans `modules-catalogue/paie-tn/java/`.

- Rôles : `ADMIN` (gérant par défaut), `GESTIONNAIRE` (comptable par défaut), `VALIDEUR`, `CONSULTATION`. Pour valider, **nommer une autre personne VALIDEUR** (Modules › Réglages et droits) : le contrôle à deux niveaux interdit de valider sa propre simulation (désactivable s'il n'y a qu'un utilisateur).
- ⚠ **Aucun bulletin n'est « certifié » tant que les paramètres réglementaires n'ont pas été vérifiés** sur les textes officiels et validés dans le module (écran Paramètres réglementaires) — voir `modules-catalogue/paie-tn/docs/PARAMETRES_A_CONFIRMER.md` (notamment fonds de perte d'emploi et mode de calcul de la CSS). Les fichiers déclaratifs officiels CNSS / DGI ne sont pas produits.
- Limites V1 : régime CNSS général non agricole ; pas de prorata automatique d'entrée/sortie ni de régularisation annuelle de l'IRPP.
- Les données sont dans les tables `paie_*` de la base TinOR, sauvegardées avec elle (`npm run backup`).
