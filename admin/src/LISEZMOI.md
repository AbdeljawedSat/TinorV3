# Sources de la console

`admin/tinor_admin.html` est **assemblé** à partir des fichiers de ce dossier (`npm run console`). C'est ce fichier unique que sert
l'API et qu'embarque l'application Android : il reste donc enregistré dans le dépôt.

- Les fichiers sont collés dans l'ordre de leur nom : `NNN-titre.ext` (`.css` styles, `.html` structure et fenêtres, `.js` logique).
- Pour modifier : éditer le fichier concerné, lancer `npm run console`, enregistrer les deux.
- Pour insérer un morceau entre `124-…` et `125-…` : le nommer `124a-…` (le nom trie après `124-` et avant `125-`).
- La CI refuse une modification si `tinor_admin.html` n'est pas à jour (`npm run console -- --verifier`).
