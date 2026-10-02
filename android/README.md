# TinOR pour Android

Application Android native qui embarque la console de gestion (`admin/tinor_admin.html`,
copiée automatiquement à chaque compilation).

## Installer l'application sur un téléphone

1. Sur le téléphone, ouvrir :
   `https://github.com/AbdeljawedSat/TinorV3/releases/latest/download/TinOR.apk`
2. Ouvrir le fichier `TinOR.apk` téléchargé. Si Android le demande, autoriser
   « Installer des applications inconnues » pour le navigateur.
3. Lancer **TinOR**, saisir l'**adresse de l'API** (ex. `https://<domaine>.up.railway.app/api`),
   l'identifiant et le mot de passe. L'adresse est mémorisée pour les fois suivantes.

Les nouvelles versions s'installent par-dessus l'ancienne (même signature).

## Ce que fait l'application en plus d'un navigateur

| Fonction de la console | Sur Android |
|---|---|
| Imprimer une facture, une étiquette de lot, une liste PDF | Service d'impression Android : imprimante (Wi-Fi / Bluetooth) ou « Enregistrer en PDF » |
| Exports Excel / Word | Enregistrés dans **Téléchargements/TinOR**, puis ouverts si une application le permet |
| Logo de l'entreprise (Paramètres) | Sélecteur de fichiers / galerie |
| Rotation de l'écran | Pas de rechargement : la session reste ouverte |
| API en `http` sur le réseau local | Autorisée (ex. `http://192.168.1.10:3001/api`) |

Le pont entre la page et Android est dans `app/src/main/assets/tinor-android.js`.

## Compilation

Automatique : le workflow GitHub **« Application Android »** (`.github/workflows/android.yml`)
compile l'APK à chaque modification de `android/` ou `admin/` sur `main`, le vérifie et le
publie dans une version GitHub `android-vN`. On peut aussi le lancer à la main
(onglet Actions → Application Android → Run workflow).

En local (Android Studio ou SDK Android installé) :

```
cd android
./gradlew assembleRelease     # → app/build/outputs/apk/release/app-release.apk
```

## Signature

- Par défaut : clé `app/tinor-debug.keystore` du dépôt. Elle suffit pour installer et mettre
  à jour l'application sur vos appareils, **mais elle n'est pas secrète** : ne pas l'utiliser
  pour une diffusion publique.
- Clé de publication (recommandée avant le Play Store) : créer une clé, puis dans GitHub →
  Settings → Secrets and variables → Actions, ajouter `TINOR_KEYSTORE_BASE64` (fichier encodé
  en base64), `TINOR_KEYSTORE_PASSWORD`, `TINOR_KEY_ALIAS`, `TINOR_KEY_PASSWORD`.
  ⚠ Changer de clé oblige à désinstaller l'ancienne version une fois.

```
keytool -genkeypair -keystore tinor-release.keystore -alias tinor -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 tinor-release.keystore   # valeur du secret TINOR_KEYSTORE_BASE64
```

## Alternative sans installation

La console est aussi installable comme application web : ouvrir `https://<domaine>/` dans
Chrome sur Android → menu ⋮ → **Ajouter à l'écran d'accueil**. Les impressions et
téléchargements passent alors par Chrome.
