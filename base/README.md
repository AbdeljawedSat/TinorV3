# Base de données TinOR V3 (MariaDB / MySQL)

| Fichier | Contenu |
|---|---|
| `tinor_v3_vierge.sql` | Base prête à l'emploi : 45 tables, données de référence (unités, catégories, formats, local, structure des lots, paramètres) et compte **admin / changeme** |
| `tinor_v3_demo.sql` | La même + un jeu de données d'exemple complet (réceptions, presse, filtration, conditionnement, commandes, factures, paiements, certificat bio) |

**Structure identique à la version initiale** (`tinor_erp_v3_schema.sql` de l'archive d'origine) :
les améliorations (péremption, inventaires, étiquettes, cohérence du stock…) sont toutes dans le
code, aucune ne modifie la base. Vérifié en construisant la base avec le code d'origine et avec le
code actuel : contenu identique. Seule retouche : `sequences.last_value` est écrite `` `last_value` ``
(entre accents graves) car c'est un mot réservé de **MySQL 8** — sans elle, la base ne
s'installait pas sur MySQL (dont celui de Railway). Même colonne, même type.

Testé à l'import sur **MariaDB 10.11** et **MySQL 8.4**, avec l'API et les tests de stock.

## Importer

Dans une base **vide** :

```
mysql -u tinor -p tinor_v3 < base/tinor_v3_vierge.sql
```

ou phpMyAdmin / HeidiSQL : sélectionner la base → **Importer** → choisir le fichier.

Avec Docker (voir `TESTER-SUR-PC.md`), base démarrée :

```
docker exec -i tinor-mariadb mariadb -utinor -ptinor tinor_v3 < base/tinor_v3_demo.sql
```

Puis démarrer l'API (`npm start`) : `npm run migrate` détecte que les tables existent et ne touche à rien.

⚠ Changer le mot de passe **admin** après la première connexion.

## Régénérer ces fichiers

Ils sont produits depuis une base neuve (`npm run setup`, puis `npm run demo` pour la version
démonstration) : structure = `tinor_erp_v3_schema.sql`, données = `mysqldump --no-create-info`.
