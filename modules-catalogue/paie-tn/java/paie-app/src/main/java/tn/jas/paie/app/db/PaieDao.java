package tn.jas.paie.app.db;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import tn.jas.paie.app.model.Modeles.Audit;
import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Contrat;
import tn.jas.paie.app.model.Modeles.Entreprise;
import tn.jas.paie.app.model.Modeles.Periode;
import tn.jas.paie.app.model.Modeles.Role;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.model.Modeles.StatutPeriode;
import tn.jas.paie.app.model.Modeles.Utilisateur;
import tn.jas.paie.app.model.Modeles.Validation;
import tn.jas.paie.app.model.Modeles.VariableSaisie;
import tn.jas.paie.app.model.Modeles.VersionParam;

/** Accès aux données (JDBC, requêtes paramétrées uniquement). */
public final class PaieDao {

    private final Database db;

    public PaieDao(Database db) { this.db = db; }

    public Connection connexion() throws SQLException { return db.connexion(); }

    // =============== Entreprise ===============

    public Entreprise entreprise() throws SQLException {
        try (Connection c = db.connexion();
             PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_entreprise ORDER BY id LIMIT 1");
             ResultSet rs = ps.executeQuery()) {
            Entreprise e = new Entreprise();
            if (rs.next()) {
                e.id = rs.getInt("id");
                e.raisonSociale = rs.getString("raison_sociale");
                e.matriculeFiscal = rs.getString("matricule_fiscal");
                e.numEmployeurCnss = rs.getString("num_employeur_cnss");
                e.adresse = rs.getString("adresse");
                e.tauxAT = rs.getBigDecimal("taux_at");
                e.tauxTFP = rs.getBigDecimal("taux_tfp");
            }
            return e;
        }
    }

    public void enregistrerEntreprise(Entreprise e) throws SQLException {
        String sql = e.id == 0
                ? "INSERT INTO paie_entreprise (raison_sociale, matricule_fiscal, num_employeur_cnss, adresse, taux_at, taux_tfp) VALUES (?,?,?,?,?,?)"
                : "UPDATE paie_entreprise SET raison_sociale=?, matricule_fiscal=?, num_employeur_cnss=?, adresse=?, taux_at=?, taux_tfp=? WHERE id=?";
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, e.raisonSociale);
            ps.setString(2, e.matriculeFiscal);
            ps.setString(3, e.numEmployeurCnss);
            ps.setString(4, e.adresse);
            ps.setBigDecimal(5, e.tauxAT);
            ps.setBigDecimal(6, e.tauxTFP);
            if (e.id != 0) ps.setInt(7, e.id);
            ps.executeUpdate();
            if (e.id == 0) e.id = cle(ps);
        }
    }

    // =============== Salariés ===============

    public List<Salarie> salaries(String recherche, boolean actifsSeulement) throws SQLException {
        StringBuilder sql = new StringBuilder("SELECT * FROM paie_salaries WHERE 1=1");
        List<Object> p = new ArrayList<>();
        if (actifsSeulement) sql.append(" AND actif=1");
        if (recherche != null && !recherche.isBlank()) {
            sql.append(" AND (matricule LIKE ? OR nom LIKE ? OR prenom LIKE ? OR fonction LIKE ?)");
            String r = "%" + recherche.trim() + "%";
            p.add(r); p.add(r); p.add(r); p.add(r);
        }
        sql.append(" ORDER BY nom, prenom");
        List<Salarie> l = new ArrayList<>();
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql.toString())) {
            for (int i = 0; i < p.size(); i++) ps.setObject(i + 1, p.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) l.add(salarie(rs));
            }
        }
        return l;
    }

    public Optional<Salarie> salarie(int id) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_salaries WHERE id=?")) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(salarie(rs)) : Optional.empty();
            }
        }
    }

    private static Salarie salarie(ResultSet rs) throws SQLException {
        Salarie s = new Salarie();
        s.id = rs.getInt("id");
        s.matricule = rs.getString("matricule");
        s.nom = rs.getString("nom");
        s.prenom = rs.getString("prenom");
        s.fonction = rs.getString("fonction");
        s.categorie = rs.getString("categorie");
        s.numCnss = rs.getString("num_cnss");
        s.dateEntree = date(rs, "date_entree");
        s.dateSortie = date(rs, "date_sortie");
        s.regime = rs.getString("regime");
        s.chefFamille = rs.getBoolean("chef_famille");
        s.nbEnfants = rs.getInt("nb_enfants");
        s.nbEnfantsEtudiants = rs.getInt("nb_enfants_etudiants");
        s.nbEnfantsHandicapes = rs.getInt("nb_enfants_handicapes");
        s.modePaiement = rs.getString("mode_paiement");
        s.rib = rs.getString("rib");
        s.actif = rs.getBoolean("actif");
        return s;
    }

    public void enregistrerSalarie(Salarie s) throws SQLException {
        String sql = s.id == 0
                ? "INSERT INTO paie_salaries (matricule, nom, prenom, fonction, categorie, num_cnss, date_entree, date_sortie, regime, chef_famille, nb_enfants, nb_enfants_etudiants, nb_enfants_handicapes, mode_paiement, rib, actif) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
                : "UPDATE paie_salaries SET matricule=?, nom=?, prenom=?, fonction=?, categorie=?, num_cnss=?, date_entree=?, date_sortie=?, regime=?, chef_famille=?, nb_enfants=?, nb_enfants_etudiants=?, nb_enfants_handicapes=?, mode_paiement=?, rib=?, actif=? WHERE id=?";
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            int i = 1;
            ps.setString(i++, s.matricule);
            ps.setString(i++, s.nom);
            ps.setString(i++, s.prenom);
            ps.setString(i++, s.fonction);
            ps.setString(i++, s.categorie);
            ps.setString(i++, s.numCnss);
            setDate(ps, i++, s.dateEntree);
            setDate(ps, i++, s.dateSortie);
            ps.setString(i++, s.regime);
            ps.setBoolean(i++, s.chefFamille);
            ps.setInt(i++, s.nbEnfants);
            ps.setInt(i++, s.nbEnfantsEtudiants);
            ps.setInt(i++, s.nbEnfantsHandicapes);
            ps.setString(i++, s.modePaiement);
            ps.setString(i++, s.rib);
            ps.setBoolean(i++, s.actif);
            if (s.id != 0) ps.setInt(i, s.id);
            ps.executeUpdate();
            if (s.id == 0) s.id = cle(ps);
        }
    }

    // =============== Contrats ===============

    public List<Contrat> contrats(int salarieId) throws SQLException {
        List<Contrat> l = new ArrayList<>();
        try (Connection c = db.connexion();
             PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_contrats WHERE salarie_id=? ORDER BY date_debut DESC, id DESC")) {
            ps.setInt(1, salarieId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) l.add(contrat(rs));
            }
        }
        return l;
    }

    /** Contrat applicable : le plus récent ayant débuté au plus tard en fin de période et non terminé avant le début. */
    public Optional<Contrat> contratApplicable(int salarieId, LocalDate debut, LocalDate fin) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "SELECT * FROM paie_contrats WHERE salarie_id=? AND date_debut<=? AND (date_fin IS NULL OR date_fin>=?) ORDER BY date_debut DESC, id DESC LIMIT 1")) {
            ps.setInt(1, salarieId);
            ps.setDate(2, Date.valueOf(fin));
            ps.setDate(3, Date.valueOf(debut));
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(contrat(rs)) : Optional.empty();
            }
        }
    }

    private static Contrat contrat(ResultSet rs) throws SQLException {
        Contrat k = new Contrat();
        k.id = rs.getInt("id");
        k.salarieId = rs.getInt("salarie_id");
        k.typeContrat = rs.getString("type_contrat");
        k.dateDebut = date(rs, "date_debut");
        k.dateFin = date(rs, "date_fin");
        k.salaireBase = rs.getBigDecimal("salaire_base");
        k.horaireMensuel = rs.getBigDecimal("horaire_mensuel");
        k.tauxHoraire = rs.getBigDecimal("taux_horaire");
        return k;
    }

    public void ajouterContrat(Contrat k) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_contrats (salarie_id, type_contrat, date_debut, date_fin, salaire_base, horaire_mensuel, taux_horaire) VALUES (?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, k.salarieId);
            ps.setString(2, k.typeContrat);
            setDate(ps, 3, k.dateDebut);
            setDate(ps, 4, k.dateFin);
            ps.setBigDecimal(5, k.salaireBase);
            ps.setBigDecimal(6, k.horaireMensuel);
            ps.setBigDecimal(7, k.tauxHoraire);
            ps.executeUpdate();
            k.id = cle(ps);
        }
    }

    // =============== Périodes ===============

    public List<Periode> periodes() throws SQLException {
        List<Periode> l = new ArrayList<>();
        try (Connection c = db.connexion();
             PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_periodes ORDER BY annee DESC, mois DESC");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) l.add(periode(rs));
        }
        return l;
    }

    public Optional<Periode> periode(int id) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_periodes WHERE id=?")) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(periode(rs)) : Optional.empty();
            }
        }
    }

    private static Periode periode(ResultSet rs) throws SQLException {
        Periode p = new Periode();
        p.id = rs.getInt("id");
        p.annee = rs.getInt("annee");
        p.mois = rs.getInt("mois");
        p.statut = StatutPeriode.valueOf(rs.getString("statut"));
        p.calculePar = rs.getString("calcule_par");
        p.calculeLe = dt(rs, "calcule_le");
        p.valideePar = rs.getString("validee_par");
        p.valideeLe = dt(rs, "validee_le");
        p.clotureePar = rs.getString("cloturee_par");
        p.clotureeLe = dt(rs, "cloturee_le");
        return p;
    }

    public Periode creerPeriode(int annee, int mois) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_periodes (annee, mois) VALUES (?,?)", Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, annee);
            ps.setInt(2, mois);
            ps.executeUpdate();
            return periode(cle(ps)).orElseThrow();
        }
    }

    /** Changement de statut conditionnel (verrou optimiste sur l'ancien statut). */
    public boolean changerStatut(Connection c, int periodeId, StatutPeriode attendu, StatutPeriode nouveau, String champ, String user) throws SQLException {
        String extra = switch (champ == null ? "" : champ) {
            case "calcule" -> ", calcule_par=?, calcule_le=NOW()";
            case "validee" -> ", validee_par=?, validee_le=NOW()";
            case "cloturee" -> ", cloturee_par=?, cloturee_le=NOW()";
            case "reouverture" -> ", validee_par=NULL, validee_le=NULL, cloturee_par=NULL, cloturee_le=NULL";
            default -> "";
        };
        try (PreparedStatement ps = c.prepareStatement("UPDATE paie_periodes SET statut=?" + extra + " WHERE id=? AND statut=?")) {
            int i = 1;
            ps.setString(i++, nouveau.name());
            if (extra.contains("?")) ps.setString(i++, user);
            ps.setInt(i++, periodeId);
            ps.setString(i, attendu.name());
            return ps.executeUpdate() == 1;
        }
    }

    // =============== Variables ===============

    public List<VariableSaisie> variables(int periodeId, Integer salarieId) throws SQLException {
        String sql = "SELECT * FROM paie_variables WHERE periode_id=?" + (salarieId != null ? " AND salarie_id=?" : "") + " ORDER BY salarie_id, id";
        List<VariableSaisie> l = new ArrayList<>();
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, periodeId);
            if (salarieId != null) ps.setInt(2, salarieId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    VariableSaisie v = new VariableSaisie();
                    v.id = rs.getInt("id");
                    v.periodeId = rs.getInt("periode_id");
                    v.salarieId = rs.getInt("salarie_id");
                    v.rubrique = rs.getString("rubrique_code");
                    v.quantite = rs.getBigDecimal("quantite");
                    v.taux = rs.getBigDecimal("taux");
                    v.montant = rs.getBigDecimal("montant");
                    v.commentaire = rs.getString("commentaire");
                    v.creePar = rs.getString("created_by");
                    l.add(v);
                }
            }
        }
        return l;
    }

    public void ajouterVariable(VariableSaisie v) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_variables (periode_id, salarie_id, rubrique_code, quantite, taux, montant, commentaire, created_by) VALUES (?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, v.periodeId);
            ps.setInt(2, v.salarieId);
            ps.setString(3, v.rubrique);
            ps.setBigDecimal(4, v.quantite);
            ps.setBigDecimal(5, v.taux);
            ps.setBigDecimal(6, v.montant);
            ps.setString(7, v.commentaire);
            ps.setString(8, v.creePar);
            ps.executeUpdate();
            v.id = cle(ps);
        }
    }

    public void supprimerVariable(int id) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("DELETE FROM paie_variables WHERE id=?")) {
            ps.setInt(1, id);
            ps.executeUpdate();
        }
    }

    // =============== Calculs ===============

    public int prochaineVersion(Connection c, int periodeId, int salarieId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT COALESCE(MAX(version),0)+1 FROM paie_calculs WHERE periode_id=? AND salarie_id=?")) {
            ps.setInt(1, periodeId);
            ps.setInt(2, salarieId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    public void insererCalcul(Connection c, Calcul k) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_calculs (periode_id, salarie_id, version, statut, brut, cnss_sal, irpp, css, net, charges_pat, cout_employeur, certifiable, moteur, params_version, resultat_json, calcule_par) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            int i = 1;
            ps.setInt(i++, k.periodeId);
            ps.setInt(i++, k.salarieId);
            ps.setInt(i++, k.version);
            ps.setString(i++, k.statut);
            ps.setBigDecimal(i++, k.brut);
            ps.setBigDecimal(i++, k.cnssSal);
            ps.setBigDecimal(i++, k.irpp);
            ps.setBigDecimal(i++, k.css);
            ps.setBigDecimal(i++, k.net);
            ps.setBigDecimal(i++, k.chargesPat);
            ps.setBigDecimal(i++, k.coutEmployeur);
            ps.setBoolean(i++, k.certifiable);
            ps.setString(i++, k.moteur);
            ps.setString(i++, k.paramsVersion);
            ps.setString(i++, k.json);
            ps.setString(i, k.calculePar);
            ps.executeUpdate();
            k.id = cle(ps);
        }
    }

    /** Dernier calcul (toutes versions confondues hors REMPLACE) de chaque salarié pour une période. */
    public List<Calcul> derniersCalculs(int periodeId) throws SQLException {
        String sql = "SELECT k.* FROM paie_calculs k JOIN (SELECT salarie_id, MAX(version) v FROM paie_calculs WHERE periode_id=? GROUP BY salarie_id) m "
                + "ON k.salarie_id=m.salarie_id AND k.version=m.v WHERE k.periode_id=? ORDER BY k.salarie_id";
        List<Calcul> l = new ArrayList<>();
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, periodeId);
            ps.setInt(2, periodeId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) l.add(calcul(rs));
            }
        }
        return l;
    }

    public List<Calcul> historiqueCalculs(int periodeId, int salarieId) throws SQLException {
        List<Calcul> l = new ArrayList<>();
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "SELECT * FROM paie_calculs WHERE periode_id=? AND salarie_id=? ORDER BY version DESC")) {
            ps.setInt(1, periodeId);
            ps.setInt(2, salarieId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) l.add(calcul(rs));
            }
        }
        return l;
    }

    private static Calcul calcul(ResultSet rs) throws SQLException {
        Calcul k = new Calcul();
        k.id = rs.getInt("id");
        k.periodeId = rs.getInt("periode_id");
        k.salarieId = rs.getInt("salarie_id");
        k.version = rs.getInt("version");
        k.statut = rs.getString("statut");
        k.brut = rs.getBigDecimal("brut");
        k.cnssSal = rs.getBigDecimal("cnss_sal");
        k.irpp = rs.getBigDecimal("irpp");
        k.css = rs.getBigDecimal("css");
        k.net = rs.getBigDecimal("net");
        k.chargesPat = rs.getBigDecimal("charges_pat");
        k.coutEmployeur = rs.getBigDecimal("cout_employeur");
        k.certifiable = rs.getBoolean("certifiable");
        k.moteur = rs.getString("moteur");
        k.paramsVersion = rs.getString("params_version");
        k.json = rs.getString("resultat_json");
        k.calculePar = rs.getString("calcule_par");
        k.calculeLe = dt(rs, "calcule_le");
        return k;
    }

    public int marquerCalculs(Connection c, int periodeId, String deStatut, String versStatut) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("UPDATE paie_calculs SET statut=? WHERE periode_id=? AND statut=?")) {
            ps.setString(1, versStatut);
            ps.setInt(2, periodeId);
            ps.setString(3, deStatut);
            return ps.executeUpdate();
        }
    }

    // =============== Validations des paramètres ===============

    public List<Validation> validations() throws SQLException {
        List<Validation> l = new ArrayList<>();
        try (Connection c = db.connexion();
             PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_validations_param ORDER BY code, debut");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Validation v = new Validation();
                v.code = rs.getString("code");
                v.debut = date(rs, "debut");
                v.valeur = rs.getString("valeur");
                v.validePar = rs.getString("valide_par");
                v.valideLe = dt(rs, "valide_le");
                v.reference = rs.getString("reference");
                l.add(v);
            }
        }
        return l;
    }

    public void enregistrerValidation(Validation v) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "REPLACE INTO paie_validations_param (code, debut, valeur, valide_par, reference) VALUES (?,?,?,?,?)")) {
            ps.setString(1, v.code);
            setDate(ps, 2, v.debut);
            ps.setString(3, v.valeur);
            ps.setString(4, v.validePar);
            ps.setString(5, v.reference);
            ps.executeUpdate();
        }
    }

    public void retirerValidation(String code, LocalDate debut) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("DELETE FROM paie_validations_param WHERE code=? AND debut=?")) {
            ps.setString(1, code);
            setDate(ps, 2, debut);
            ps.executeUpdate();
        }
    }

    // =============== Documents ===============

    public void archiverDocument(int periodeId, Integer salarieId, String type, Integer calculId, String fichier, String sha256, String user) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_documents (periode_id, salarie_id, type_doc, calcul_id, fichier, sha256, cree_par) VALUES (?,?,?,?,?,?,?)")) {
            ps.setInt(1, periodeId);
            if (salarieId == null) ps.setNull(2, Types.INTEGER); else ps.setInt(2, salarieId);
            ps.setString(3, type);
            if (calculId == null) ps.setNull(4, Types.INTEGER); else ps.setInt(4, calculId);
            ps.setString(5, fichier);
            ps.setString(6, sha256);
            ps.setString(7, user);
            ps.executeUpdate();
        }
    }

    // =============== Versions de paramètres saisies ===============

    public List<VersionParam> versionsParametres() throws SQLException {
        List<VersionParam> l = new ArrayList<>();
        try (Connection c = db.connexion();
             PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_parametres_versions ORDER BY code, debut");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                VersionParam v = new VersionParam();
                v.id = rs.getInt("id");
                v.code = rs.getString("code");
                v.debut = date(rs, "debut");
                v.fin = date(rs, "fin");
                v.valeur = rs.getString("valeur");
                v.tranchesJson = rs.getString("tranches_json");
                v.source = rs.getString("source");
                v.note = rs.getString("note");
                v.creePar = rs.getString("cree_par");
                v.creeLe = dt(rs, "cree_le");
                l.add(v);
            }
        }
        return l;
    }

    public void insererVersion(VersionParam v) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_parametres_versions (code, debut, fin, valeur, tranches_json, source, note, cree_par) VALUES (?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, v.code);
            setDate(ps, 2, v.debut);
            setDate(ps, 3, v.fin);
            ps.setString(4, v.valeur);
            ps.setString(5, v.tranchesJson);
            ps.setString(6, v.source);
            ps.setString(7, v.note);
            ps.setString(8, v.creePar);
            ps.executeUpdate();
            v.id = cle(ps);
        }
    }

    public void supprimerVersion(int id) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("DELETE FROM paie_parametres_versions WHERE id=?")) {
            ps.setInt(1, id);
            ps.executeUpdate();
        }
    }

    /** Dernier jour de la plus récente période validée ou clôturée (null s'il n'y en a pas). */
    public LocalDate finDernierePeriodeFigee() throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(
                "SELECT annee, mois FROM paie_periodes WHERE statut IN ('VALIDEE','CLOTUREE') ORDER BY annee DESC, mois DESC LIMIT 1");
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? java.time.YearMonth.of(rs.getInt(1), rs.getInt(2)).atEndOfMonth() : null;
        }
    }

    // =============== Utilisateurs ===============

    public int nombreUtilisateurs() throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM paie_utilisateurs");
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getInt(1);
        }
    }

    public Optional<Utilisateur> utilisateur(String login) throws SQLException {
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_utilisateurs WHERE login=?")) {
            ps.setString(1, login);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(utilisateur(rs)) : Optional.empty();
            }
        }
    }

    public List<Utilisateur> utilisateurs() throws SQLException {
        List<Utilisateur> l = new ArrayList<>();
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement("SELECT * FROM paie_utilisateurs ORDER BY login");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) l.add(utilisateur(rs));
        }
        return l;
    }

    private static Utilisateur utilisateur(ResultSet rs) throws SQLException {
        Utilisateur u = new Utilisateur();
        u.id = rs.getInt("id");
        u.login = rs.getString("login");
        u.hash = rs.getString("hash");
        u.role = Role.valueOf(rs.getString("role"));
        u.actif = rs.getBoolean("actif");
        return u;
    }

    public void enregistrerUtilisateur(Utilisateur u) throws SQLException {
        String sql = u.id == 0
                ? "INSERT INTO paie_utilisateurs (login, hash, role, actif) VALUES (?,?,?,?)"
                : "UPDATE paie_utilisateurs SET login=?, hash=?, role=?, actif=? WHERE id=?";
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, u.login);
            ps.setString(2, u.hash);
            ps.setString(3, u.role.name());
            ps.setBoolean(4, u.actif);
            if (u.id != 0) ps.setInt(5, u.id);
            ps.executeUpdate();
            if (u.id == 0) u.id = cle(ps);
        }
    }

    // =============== Audit ===============

    public void audit(String user, String action, String entite, Object entiteId, String details) throws SQLException {
        try (Connection c = db.connexion()) {
            audit(c, user, action, entite, entiteId, details);
        }
    }

    public void audit(Connection c, String user, String action, String entite, Object entiteId, String details) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO paie_audit (utilisateur, action, entite, entite_id, details) VALUES (?,?,?,?,?)")) {
            ps.setString(1, user);
            ps.setString(2, action);
            ps.setString(3, entite);
            ps.setString(4, entiteId == null ? null : entiteId.toString());
            ps.setString(5, details);
            ps.executeUpdate();
        }
    }

    public List<Audit> journal(String filtre, int limite) throws SQLException {
        String sql = "SELECT * FROM paie_audit" + (filtre == null || filtre.isBlank() ? "" :
                " WHERE utilisateur LIKE ? OR action LIKE ? OR entite LIKE ? OR details LIKE ?") + " ORDER BY id DESC LIMIT ?";
        List<Audit> l = new ArrayList<>();
        try (Connection c = db.connexion(); PreparedStatement ps = c.prepareStatement(sql)) {
            int i = 1;
            if (filtre != null && !filtre.isBlank()) {
                String f = "%" + filtre.trim() + "%";
                for (int k = 0; k < 4; k++) ps.setString(i++, f);
            }
            ps.setInt(i, limite);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Audit a = new Audit();
                    a.id = rs.getLong("id");
                    a.horodatage = dt(rs, "horodatage");
                    a.utilisateur = rs.getString("utilisateur");
                    a.action = rs.getString("action");
                    a.entite = rs.getString("entite");
                    a.entiteId = rs.getString("entite_id");
                    a.details = rs.getString("details");
                    l.add(a);
                }
            }
        }
        return l;
    }

    // =============== utilitaires ===============

    private static int cle(PreparedStatement ps) throws SQLException {
        try (ResultSet rs = ps.getGeneratedKeys()) {
            if (!rs.next()) throw new SQLException("Clé générée absente");
            return rs.getInt(1);
        }
    }

    private static LocalDate date(ResultSet rs, String col) throws SQLException {
        Date d = rs.getDate(col);
        return d == null ? null : d.toLocalDate();
    }

    private static LocalDateTime dt(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toLocalDateTime();
    }

    private static void setDate(PreparedStatement ps, int i, LocalDate d) throws SQLException {
        if (d == null) ps.setNull(i, Types.DATE); else ps.setDate(i, Date.valueOf(d));
    }

    public static BigDecimal nz(BigDecimal b) { return b == null ? BigDecimal.ZERO : b; }
}
