package tn.jas.paie.app;

import java.awt.BorderLayout;
import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.Properties;

import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;

import tn.jas.paie.app.db.Database;
import tn.jas.paie.app.db.PaieDao;
import tn.jas.paie.app.model.Modeles.Role;
import tn.jas.paie.app.model.Modeles.Utilisateur;
import tn.jas.paie.app.service.PaieService;
import tn.jas.paie.app.service.Securite;
import tn.jas.paie.app.ui.MainFrame;
import tn.jas.paie.app.ui.Ui;
import tn.jas.paie.engine.Referentiel;

/**
 * Application de bureau de test : intègre le moteur de paie tunisien (paie-engine)
 * avec une base MariaDB/MySQL. Point d'entrée : configuration, migrations, connexion.
 */
public final class App {
    private App() { }

    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        try {
            UIManager.setLookAndFeel("javax.swing.plaf.nimbus.NimbusLookAndFeel");
        } catch (Exception ignore) { /* look & feel par défaut */ }
        SwingUtilities.invokeLater(App::demarrer);
    }

    /** Emplacement de la configuration : -Dpaie.config, sinon ./paie.properties, sinon ~/.paie-tn/paie.properties. */
    public static Path fichierConfig() {
        String p = System.getProperty("paie.config");
        if (p != null) return Path.of(p);
        Path local = Path.of("paie.properties");
        if (Files.exists(local)) return local;
        return Path.of(System.getProperty("user.home"), ".paie-tn", "paie.properties");
    }

    private static void demarrer() {
        try {
            Path cfgPath = fichierConfig();
            Properties cfg = new Properties();
            boolean premiere = !Files.exists(cfgPath);
            if (premiere) {
                try (InputStream in = App.class.getResourceAsStream("/paie.properties.exemple")) {
                    cfg.load(new java.io.InputStreamReader(in, StandardCharsets.UTF_8));
                }
                cfg.setProperty("db.url", "jdbc:mariadb://localhost:3306/paie_test");
                cfg.setProperty("db.user", "root");
                cfg.setProperty("db.password", "");
                cfg.setProperty("documents.dir", Path.of(System.getProperty("user.home"), "paie-tn-documents").toString());
            } else {
                try (Reader r = Files.newBufferedReader(cfgPath, StandardCharsets.UTF_8)) {
                    cfg.load(r);
                }
            }

            // Connexion + migrations ; en cas d'échec, l'assistant explique la cause et permet de corriger.
            Database db = null;
            java.sql.SQLException echec = null;
            if (premiere) {
                cfg = ConfigBase.assistant(cfgPath, cfg, null);
                if (cfg == null) System.exit(0);
            }
            while (db == null) {
                try {
                    Database essai = new Database(cfg);
                    List<String> appliquees = essai.migrer();
                    if (!appliquees.isEmpty()) System.out.println("[Paie] Migrations appliquées : " + appliquees);
                    db = essai;
                } catch (java.sql.SQLException e) {
                    echec = e;
                    System.err.println("[Paie] Connexion à la base impossible : " + e.getMessage());
                    cfg = ConfigBase.assistant(cfgPath, cfg, echec);
                    if (cfg == null) System.exit(0);
                }
            }

            Referentiel ref = chargerReferentiel(cfg);
            PaieDao dao = new PaieDao(db);
            PaieService service = new PaieService(dao, ref,
                    Boolean.parseBoolean(cfg.getProperty("controle.deux.niveaux", "true")));
            service.rechargerReferentiel(); // fichier + versions de paramètres saisies dans l'application
            Path docs = Path.of(cfg.getProperty("documents.dir", Path.of(System.getProperty("user.home"), "paie-tn-documents").toString()));

            if (dao.nombreUtilisateurs() == 0 && !creerPremierAdmin(dao)) System.exit(0);
            Optional<Utilisateur> u = connexion(dao);
            if (u.isEmpty()) System.exit(0);

            MainFrame f = new MainFrame(service, u.get(), docs, db.url());
            f.setVisible(true);
        } catch (Exception e) {
            System.err.println("[Paie] ERREUR AU DÉMARRAGE – " + e + " (configuration : " + fichierConfig().toAbsolutePath() + ")");
            e.printStackTrace();
            Ui.erreur(null, e);
            System.exit(1);
        }
    }

    /** Paramètres réglementaires : fichiers externes si configurés (mise à jour sans recompiler), sinon ceux du JAR. */
    static Referentiel chargerReferentiel(Properties cfg) throws IOException {
        String p = cfg.getProperty("parametres.fichier"), r = cfg.getProperty("rubriques.fichier");
        if (p != null && !p.isBlank() && r != null && !r.isBlank()) return Referentiel.charger(Path.of(p), Path.of(r));
        return Referentiel.charger();
    }

    private static boolean creerPremierAdmin(PaieDao dao) throws Exception {
        JTextField login = new JTextField("admin", 18);
        JPasswordField mdp = new JPasswordField(18), mdp2 = new JPasswordField(18);
        JPanel p = new JPanel(new BorderLayout(0, 8));
        p.add(new JLabel("<html>Première utilisation : créez le compte administrateur.<br>"
                + "Mot de passe : 10 caractères minimum, lettres et chiffres.</html>"), BorderLayout.NORTH);
        p.add(Ui.formulaire("Identifiant", login, "Mot de passe", mdp, "Confirmation", mdp2), BorderLayout.CENTER);
        while (true) {
            if (JOptionPane.showConfirmDialog(null, p, "Paie Tunisie – initialisation", JOptionPane.OK_CANCEL_OPTION,
                    JOptionPane.PLAIN_MESSAGE) != JOptionPane.OK_OPTION) return false;
            try {
                if (login.getText().isBlank()) throw new IllegalArgumentException("Identifiant obligatoire");
                if (!java.util.Arrays.equals(mdp.getPassword(), mdp2.getPassword()))
                    throw new IllegalArgumentException("Les deux mots de passe ne correspondent pas");
                Securite.controlerRobustesse(mdp.getPassword());
                Utilisateur u = new Utilisateur();
                u.login = login.getText().trim();
                u.hash = Securite.hacher(mdp.getPassword());
                u.role = Role.ADMIN;
                dao.enregistrerUtilisateur(u);
                dao.audit(u.login, "CREATION", "UTILISATEUR", u.id, "Premier administrateur");
                return true;
            } catch (IllegalArgumentException ex) {
                Ui.erreur(null, ex);
            }
        }
    }

    private static Optional<Utilisateur> connexion(PaieDao dao) throws Exception {
        JTextField login = new JTextField(18);
        JPasswordField mdp = new JPasswordField(18);
        JPanel p = Ui.formulaire("Identifiant", login, "Mot de passe", mdp);
        int essais = 0;
        while (essais < 5) {
            if (JOptionPane.showConfirmDialog(null, p, "Paie Tunisie – connexion", JOptionPane.OK_CANCEL_OPTION,
                    JOptionPane.PLAIN_MESSAGE) != JOptionPane.OK_OPTION) return Optional.empty();
            Optional<Utilisateur> u = dao.utilisateur(login.getText().trim());
            if (u.isPresent() && u.get().actif && Securite.verifier(mdp.getPassword(), u.get().hash)) {
                dao.audit(u.get().login, "CONNEXION", "UTILISATEUR", u.get().id, null);
                return u;
            }
            essais++;
            dao.audit(login.getText().trim().isEmpty() ? "?" : login.getText().trim(), "ECHEC_CONNEXION", "UTILISATEUR", null, null);
            Ui.erreur(null, new IllegalArgumentException("Identifiant ou mot de passe incorrect"));
            mdp.setText("");
        }
        Ui.erreur(null, new IllegalArgumentException("Trop d'essais infructueux"));
        return Optional.empty();
    }

    /** Liste déroulante des rôles (utilisée par l'administration). */
    public static JComboBox<Role> comboRoles() { return new JComboBox<>(Role.values()); }
}
