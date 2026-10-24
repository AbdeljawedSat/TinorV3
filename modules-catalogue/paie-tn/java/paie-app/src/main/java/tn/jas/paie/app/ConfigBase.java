package tn.jas.paie.app;

import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;

import tn.jas.paie.app.ui.Ui;

/**
 * Assistant de connexion à la base : affiche la cause d'un échec en clair, permet de corriger
 * serveur / port / base / utilisateur / mot de passe, teste la connexion, crée la base si elle n'existe pas
 * et enregistre paie.properties. Évite d'éditer le fichier à la main.
 */
final class ConfigBase {
    private ConfigBase() { }

    private static final Pattern URL = Pattern.compile("jdbc:(mariadb|mysql)://([^:/]+)(?::(\\d+))?/([^?]*)(\\?.*)?");

    /** Explication en français d'une erreur de connexion JDBC. */
    static String diagnostic(SQLException e, String hote, String port, String base) {
        String m = String.valueOf(e.getMessage());
        int code = e.getErrorCode();
        if (code == 1049 || m.contains("Unknown database"))
            return "La base « " + base + " » n'existe pas encore. Cliquez sur « Tester et enregistrer » : elle peut être créée automatiquement.";
        if (code == 1045 || m.contains("Access denied"))
            return "Utilisateur ou mot de passe refusé par le serveur. Avec XAMPP, l'utilisateur par défaut est « root » avec un mot de passe vide.";
        if (m.contains("Connection refused") || m.contains("Socket fail") || m.contains("Could not connect") || m.contains("connect timed out"))
            return "Aucun serveur MariaDB/MySQL ne répond sur " + hote + ":" + port + ". Démarrez-le (XAMPP : bouton « Start » de MySQL ; "
                    + "sinon services.msc → MariaDB ou MySQL), ou corrigez le port.";
        if (m.contains("No suitable driver"))
            return "Pilote MariaDB absent du classpath (relancer « Build with Dependencies »).";
        return m;
    }

    /**
     * Affiche l'assistant jusqu'à obtenir une connexion valide. Renvoie la configuration enregistrée,
     * ou null si l'utilisateur abandonne.
     */
    static Properties assistant(Path fichier, Properties cfg, SQLException erreur) {
        String url = cfg.getProperty("db.url", "jdbc:mariadb://localhost:3306/paie_test");
        Matcher mu = URL.matcher(url.trim());
        String hote = "localhost", port = "3306", base = "paie_test", options = "";
        if (mu.matches()) {
            hote = mu.group(2);
            port = mu.group(3) == null ? "3306" : mu.group(3);
            base = mu.group(4).isBlank() ? "paie_test" : mu.group(4);
            options = mu.group(5) == null ? "" : mu.group(5);
        }
        JTextField tHote = new JTextField(hote, 18), tPort = new JTextField(port, 6), tBase = new JTextField(base, 18),
                tUser = new JTextField(cfg.getProperty("db.user", "root"), 18);
        JPasswordField tMdp = new JPasswordField(cfg.getProperty("db.password", ""), 18);
        JLabel cause = new JLabel();
        String explication = erreur == null ? "Première utilisation : indiquez la base MariaDB/MySQL à utiliser."
                : diagnostic(erreur, hote, port, base);

        while (true) {
            cause.setText("<html><div style='width:420px'><b>" + (erreur == null ? "Configuration de la base" : "Connexion impossible")
                    + "</b><br>" + esc(explication) + "<br><br><span style='color:gray'>Fichier : " + esc(fichier.toAbsolutePath().toString())
                    + "</span></div></html>");
            JPanel p = new JPanel(new java.awt.BorderLayout(0, 10));
            p.add(cause, java.awt.BorderLayout.NORTH);
            p.add(Ui.formulaire("Serveur", tHote, "Port", tPort, "Base de données", tBase, "Utilisateur", tUser,
                    "Mot de passe (vide si aucun)", tMdp), java.awt.BorderLayout.CENTER);
            Object[] choix = {"Tester et enregistrer", "Quitter"};
            int r = JOptionPane.showOptionDialog(null, p, "Paie Tunisie – connexion à la base", JOptionPane.DEFAULT_OPTION,
                    erreur == null ? JOptionPane.QUESTION_MESSAGE : JOptionPane.WARNING_MESSAGE, null, choix, choix[0]);
            if (r != 0) return null;

            String h = tHote.getText().trim(), pt = tPort.getText().trim(), b = tBase.getText().trim(), u = tUser.getText().trim();
            String mdp = new String(tMdp.getPassword());
            if (!b.matches("[A-Za-z0-9_]{1,64}")) { explication = "Nom de base invalide : lettres, chiffres et _ uniquement."; erreur = new SQLException(); continue; }
            if (!pt.matches("\\d{1,5}")) { explication = "Port invalide."; erreur = new SQLException(); continue; }
            String serveur = "jdbc:mariadb://" + h + ":" + pt + "/";
            try {
                try (Connection c = DriverManager.getConnection(serveur + b + options, u, mdp)) {
                    c.isValid(3);
                }
            } catch (SQLException e) {
                if (e.getErrorCode() == 1049 || String.valueOf(e.getMessage()).contains("Unknown database")) {
                    if (!Ui.confirmer(null, "La base « " + b + " » n'existe pas sur " + h + ":" + pt + ".\nLa créer maintenant ?")) {
                        explication = diagnostic(e, h, pt, b);
                        erreur = e;
                        continue;
                    }
                    try (Connection c = DriverManager.getConnection(serveur + options, u, mdp); Statement st = c.createStatement()) {
                        st.execute("CREATE DATABASE IF NOT EXISTS `" + b + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    } catch (SQLException e2) {
                        explication = "Création de la base refusée : " + diagnostic(e2, h, pt, b)
                                + " (l'utilisateur doit avoir le droit CREATE, ou créez la base dans phpMyAdmin / HeidiSQL).";
                        erreur = e2;
                        continue;
                    }
                } else {
                    explication = diagnostic(e, h, pt, b);
                    erreur = e;
                    System.err.println("[Paie] Connexion impossible : " + e.getMessage());
                    continue;
                }
            }
            cfg.setProperty("db.url", serveur + b + options);
            cfg.setProperty("db.user", u);
            cfg.setProperty("db.password", mdp);
            try {
                enregistrer(fichier, cfg);
            } catch (IOException io) {
                Ui.erreur(null, new IllegalArgumentException("Connexion réussie mais impossible d'écrire " + fichier + " : " + io.getMessage()));
            }
            System.out.println("[Paie] Connexion réussie, configuration enregistrée : " + fichier.toAbsolutePath());
            return cfg;
        }
    }

    static void enregistrer(Path fichier, Properties cfg) throws IOException {
        Path dossier = fichier.toAbsolutePath().getParent();
        if (dossier != null) Files.createDirectories(dossier);
        try (Writer w = Files.newBufferedWriter(fichier, StandardCharsets.UTF_8)) {
            cfg.store(w, "Configuration Paie Tunisie (modifiable aussi depuis l'assistant de connexion)");
        }
    }

    private static String esc(String s) { return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); }
}
