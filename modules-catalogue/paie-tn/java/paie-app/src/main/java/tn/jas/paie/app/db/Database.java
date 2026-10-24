package tn.jas.paie.app.db;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/** Connexion MariaDB/MySQL et application des migrations versionnées (db/V{n}__*.sql). */
public final class Database {

    private static final String[] MIGRATIONS = { "V1__paie_init.sql", "V2__parametres_versions.sql" };

    private final String url, user, password;

    public Database(Properties cfg) {
        this.url = cfg.getProperty("db.url", "jdbc:mariadb://localhost:3306/paie");
        this.user = cfg.getProperty("db.user", "paie");
        this.password = cfg.getProperty("db.password", "");
    }

    public Connection connexion() throws SQLException {
        return DriverManager.getConnection(url, user, password);
    }

    public String url() { return url; }

    /** Applique les migrations non encore appliquées. Renvoie la liste des fichiers appliqués. */
    public List<String> migrer() throws SQLException, IOException {
        List<String> appliquees = new ArrayList<>();
        try (Connection c = connexion()) {
            int actuelle = versionActuelle(c);
            for (int i = 0; i < MIGRATIONS.length; i++) {
                int v = i + 1;
                if (v <= actuelle) continue;
                String sql = lire("/db/" + MIGRATIONS[i]);
                c.setAutoCommit(false);
                try (Statement st = c.createStatement()) {
                    for (String ordre : decouper(sql)) st.execute(ordre);
                    c.commit();
                } catch (SQLException e) {
                    c.rollback();
                    throw new SQLException("Échec de la migration " + MIGRATIONS[i] + " : " + e.getMessage(), e);
                } finally {
                    c.setAutoCommit(true);
                }
                appliquees.add(MIGRATIONS[i]);
            }
        }
        return appliquees;
    }

    private static int versionActuelle(Connection c) {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COALESCE(MAX(version),0) FROM paie_schema_version")) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            return 0; // table absente : base vierge
        }
    }

    /** Découpe un script en ordres SQL (séparateur ';' en fin de ligne, commentaires '--' ignorés). */
    static List<String> decouper(String sql) {
        List<String> ordres = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String ligne : sql.split("\\R")) {
            String t = ligne.trim();
            if (t.isEmpty() || t.startsWith("--")) continue;
            cur.append(ligne).append('\n');
            if (t.endsWith(";")) {
                String o = cur.toString().trim();
                ordres.add(o.substring(0, o.length() - 1));
                cur.setLength(0);
            }
        }
        if (!cur.toString().isBlank()) ordres.add(cur.toString().trim());
        return ordres;
    }

    private static String lire(String chemin) throws IOException {
        try (InputStream in = Database.class.getResourceAsStream(chemin)) {
            if (in == null) throw new IOException("Script introuvable : " + chemin);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
