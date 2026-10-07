package tn.lesjardinsdejerba.tinor;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * TinOR pour Android : la console d'administration (assets/tinor_admin.html,
 * copiée depuis ../admin au build) affichée dans une WebView.
 *
 * La page est servie sous https://appassets.androidplatform.net (WebViewAssetLoader) :
 * une vraie origine https, donc stockage local, IndexedDB (file d'attente hors
 * ligne) et appels à l'API fonctionnent comme dans un navigateur.
 */
public class MainActivity extends Activity {

    private static final String ORIGINE = "https://appassets.androidplatform.net";
    private static final String PAGE = ORIGINE + "/assets/tinor_admin.html";
    private static final int DEMANDE_FICHIER = 42;
    private static final int DEMANDE_NOTIFICATIONS = 43;
    private static final String CANAL_SYNCHRO = "tinor_synchro";

    private WebView webView;
    private ValueCallback<Uri[]> rappelFichier;
    /** Gardée en mémoire le temps que le service d'impression lise le document. */
    private WebView webViewImpression;
    private String scriptPont;
    private boolean scriptAuDemarrage;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);

        FrameLayout racine = new FrameLayout(this);
        racine.setBackgroundColor(getColor(R.color.encre));
        webView = new WebView(this);
        webView.setBackgroundColor(getColor(R.color.sable));
        racine.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(racine);
        appliquerMargesSysteme(racine);

        WebSettings reglages = webView.getSettings();
        reglages.setJavaScriptEnabled(true);
        reglages.setDomStorageEnabled(true);
        reglages.setDatabaseEnabled(true);
        reglages.setAllowFileAccess(false);
        reglages.setAllowContentAccess(false);
        reglages.setJavaScriptCanOpenWindowsAutomatically(true);
        reglages.setSupportMultipleWindows(false);
        // Page en https, API éventuellement en http sur le réseau local.
        reglages.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        final WebViewAssetLoader chargeur = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        scriptPont = lireAsset("tinor-android.js");
        webView.addJavascriptInterface(new Pont(), "TinorAndroid");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, scriptPont, Collections.singleton(ORIGINE));
            scriptAuDemarrage = true;
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView vue, WebResourceRequest requete) {
                return chargeur.shouldInterceptRequest(requete.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView vue, WebResourceRequest requete) {
                Uri url = requete.getUrl();
                if ("appassets.androidplatform.net".equals(url.getHost())) return false;
                ouvrirExterne(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView vue, String url) {
                // WebView trop ancienne pour l'injection au démarrage : injection
                // en fin de chargement (le pont ne sert qu'aux actions de l'utilisateur).
                if (!scriptAuDemarrage) vue.evaluateJavascript(scriptPont, null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            // alert()/confirm() : boîtes de dialogue natives par défaut de la WebView.
            @Override
            public boolean onShowFileChooser(WebView vue, ValueCallback<Uri[]> rappel, FileChooserParams params) {
                if (rappelFichier != null) rappelFichier.onReceiveValue(null);
                rappelFichier = rappel;
                try {
                    startActivityForResult(params.createIntent(), DEMANDE_FICHIER);
                } catch (ActivityNotFoundException e) {
                    rappelFichier = null;
                    Toast.makeText(MainActivity.this, "Aucune application pour choisir un fichier.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        if (etat != null) webView.restoreState(etat);
        else webView.loadUrl(PAGE);
    }

    /** Android 15 affiche l'application sous les barres système : on réserve leur place. */
    private void appliquerMargesSysteme(View racine) {
        racine.setOnApplyWindowInsetsListener((vue, marges) -> {
            int haut, bas, gauche, droite;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets m = marges.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                haut = m.top; bas = m.bottom; gauche = m.left; droite = m.right;
            } else {
                haut = marges.getSystemWindowInsetTop(); bas = marges.getSystemWindowInsetBottom();
                gauche = marges.getSystemWindowInsetLeft(); droite = marges.getSystemWindowInsetRight();
            }
            vue.setPadding(gauche, haut, droite, bas);
            return marges;
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle etat) {
        super.onSaveInstanceState(etat);
        webView.saveState(etat);
    }

    @Override
    protected void onActivityResult(int demande, int resultat, Intent donnees) {
        super.onActivityResult(demande, resultat, donnees);
        if (demande == DEMANDE_FICHIER && rappelFichier != null) {
            rappelFichier.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultat, donnees));
            rappelFichier = null;
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    // ------------------------------------------------------------------------
    // Pont appelé depuis la page (voir assets/tinor-android.js)
    // ------------------------------------------------------------------------
    private class Pont {
        @JavascriptInterface
        public void imprimer(String html, String titre) {
            runOnUiThread(() -> imprimerHtml(html, titre));
        }

        @JavascriptInterface
        public void enregistrerFichier(String base64, String nom, String type) {
            byte[] contenu;
            try {
                contenu = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Fichier illisible.", Toast.LENGTH_LONG).show());
                return;
            }
            runOnUiThread(() -> enregistrerDansTelechargements(contenu, nom, type));
        }

        @JavascriptInterface
        public void ouvrirLien(String url) {
            runOnUiThread(() -> ouvrirExterne(Uri.parse(url)));
        }

        /** Mode hors ligne : une opération refusée au retour du réseau est à corriger. */
        @JavascriptInterface
        public void notifier(String titre, String texte) {
            runOnUiThread(() -> afficherNotification(titre, texte));
        }
    }

    /** Notification Android (visible même application en arrière-plan) ; message à l'écran si refusée. */
    private void afficherNotification(String titre, String texte) {
        String entete = "TinOR — " + (titre == null ? "" : titre);
        NotificationManager gestionnaire = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        boolean autorise = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        if (gestionnaire == null || !autorise) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, DEMANDE_NOTIFICATIONS);
            }
            Toast.makeText(this, entete + " : " + texte, Toast.LENGTH_LONG).show();
            return;
        }
        Notification.Builder constructeur;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            gestionnaire.createNotificationChannel(new NotificationChannel(
                    CANAL_SYNCHRO, "Synchronisation hors ligne", NotificationManager.IMPORTANCE_DEFAULT));
            constructeur = new Notification.Builder(this, CANAL_SYNCHRO);
        } else {
            constructeur = new Notification.Builder(this);
        }
        Intent ouvrir = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent action = PendingIntent.getActivity(this, 0, ouvrir,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        constructeur.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(entete)
                .setContentText(texte)
                .setStyle(new Notification.BigTextStyle().bigText(texte))
                .setAutoCancel(true)
                .setContentIntent(action);
        gestionnaire.notify(1, constructeur.build());
    }

    /** Imprime un document HTML (facture, étiquette, liste) via le service d'impression Android. */
    private void imprimerHtml(String html, String titre) {
        WebView vue = new WebView(this);
        vue.getSettings().setJavaScriptEnabled(false); // le document n'a besoin que de son HTML/CSS
        vue.setWebViewClient(new WebViewClient() {
            private boolean lance;

            @Override
            public void onPageFinished(WebView v, String url) {
                if (lance) return;
                lance = true;
                PrintManager impression = (PrintManager) getSystemService(PRINT_SERVICE);
                String nomTache = titre == null || titre.isEmpty() ? "TinOR" : titre;
                PrintDocumentAdapter adaptateur = v.createPrintDocumentAdapter(nomTache);
                impression.print(nomTache, adaptateur, new PrintAttributes.Builder().build());
            }
        });
        webViewImpression = vue;
        vue.loadDataWithBaseURL(ORIGINE + "/assets/", html, "text/html", "UTF-8", null);
    }

    /** Enregistre un export dans Téléchargements/TinOR puis propose de l'ouvrir. */
    private void enregistrerDansTelechargements(byte[] contenu, String nom, String type) {
        Uri uri;
        String emplacement;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues valeurs = new ContentValues();
                valeurs.put(MediaStore.Downloads.DISPLAY_NAME, nom);
                valeurs.put(MediaStore.Downloads.MIME_TYPE, type);
                valeurs.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/TinOR");
                ContentResolver resolveur = getContentResolver();
                uri = resolveur.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valeurs);
                if (uri == null) throw new IOException("Création du fichier refusée");
                try (OutputStream sortie = resolveur.openOutputStream(uri)) {
                    if (sortie == null) throw new IOException("Écriture impossible");
                    sortie.write(contenu);
                }
                emplacement = "Téléchargements/TinOR";
            } else {
                // Android 7 à 9 : dossier de l'application (aucune permission requise).
                File dossier = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dossier == null) throw new IOException("Stockage indisponible");
                File fichier = new File(dossier, nom);
                try (FileOutputStream sortie = new FileOutputStream(fichier)) {
                    sortie.write(contenu);
                }
                uri = null;
                emplacement = fichier.getAbsolutePath();
            }
        } catch (IOException e) {
            Toast.makeText(this, "Enregistrement impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
            return;
        }
        Toast.makeText(this, nom + " enregistré dans " + emplacement, Toast.LENGTH_LONG).show();
        if (uri != null) {
            Intent ouvrir = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, type)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(ouvrir);
            } catch (ActivityNotFoundException ignore) {
                // Pas d'application pour ce format : le fichier reste dans Téléchargements.
            }
        }
    }

    private void ouvrirExterne(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Impossible d'ouvrir " + url, Toast.LENGTH_LONG).show();
        }
    }

    private String lireAsset(String nom) {
        try (InputStream entree = getAssets().open(nom)) {
            ByteArrayOutputStream tampon = new ByteArrayOutputStream();
            byte[] bloc = new byte[8192];
            int n;
            while ((n = entree.read(bloc)) != -1) tampon.write(bloc, 0, n);
            return tampon.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return "";
        }
    }
}
