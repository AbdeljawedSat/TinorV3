package tn.jas.paie.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import tn.jas.paie.app.db.Database;
import tn.jas.paie.app.db.PaieDao;
import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Contrat;
import tn.jas.paie.app.model.Modeles.Entreprise;
import tn.jas.paie.app.model.Modeles.Periode;
import tn.jas.paie.app.model.Modeles.Role;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.model.Modeles.StatutPeriode;
import tn.jas.paie.app.model.Modeles.Utilisateur;
import tn.jas.paie.app.model.Modeles.VariableSaisie;
import tn.jas.paie.app.report.BulletinPdf;
import tn.jas.paie.app.report.Exports;
import tn.jas.paie.app.service.PaieService;
import tn.jas.paie.app.service.PaieService.RegleMetier;
import tn.jas.paie.app.service.Securite;
import tn.jas.paie.app.service.Securite.AccesRefuse;
import tn.jas.paie.engine.Referentiel;

/**
 * Test d'intégration du workflow complet sur une vraie base MariaDB/MySQL.
 * Paramètres : -Dit.url=jdbc:mariadb://localhost:3306/ -Dit.user=... -Dit.password=... (la base paie_it est recréée).
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WorkflowIT {

    static PaieService svc;
    static PaieDao dao;
    static Utilisateur gest, valid, admin, lecteur;
    static Periode periode;
    static Salarie s1, s2;
    static Path docs;

    static Utilisateur user(String login, Role r) throws Exception {
        Utilisateur u = new Utilisateur();
        u.login = login;
        u.role = r;
        u.hash = Securite.hacher("motdepasse123".toCharArray());
        dao.enregistrerUtilisateur(u);
        return u;
    }

    @BeforeAll
    static void init() throws Exception {
        String base = System.getProperty("it.url", "jdbc:mariadb://localhost:3306/");
        String u = System.getProperty("it.user", "root"), p = System.getProperty("it.password", "");
        try (Connection c = DriverManager.getConnection(base, u, p); Statement st = c.createStatement()) {
            st.execute("DROP DATABASE IF EXISTS paie_it");
            st.execute("CREATE DATABASE paie_it CHARACTER SET utf8mb4");
        }
        Properties cfg = new Properties();
        cfg.setProperty("db.url", base + "paie_it");
        cfg.setProperty("db.user", u);
        cfg.setProperty("db.password", p);
        Database db = new Database(cfg);
        assertEquals(List.of("V1__paie_init.sql", "V2__parametres_versions.sql"), db.migrer());
        assertEquals(List.of(), db.migrer(), "migration idempotente");
        dao = new PaieDao(db);
        svc = new PaieService(dao, Referentiel.charger(), true);
        gest = user("gestion", Role.GESTIONNAIRE);
        valid = user("validation", Role.VALIDEUR);
        admin = user("admin", Role.ADMIN);
        lecteur = user("lecteur", Role.CONSULTATION);
        docs = Files.createTempDirectory("paie-it");
    }

    @Test @Order(1)
    void motDePasse() {
        String h = Securite.hacher("Secret2026xx".toCharArray());
        assertTrue(Securite.verifier("Secret2026xx".toCharArray(), h));
        assertFalse(Securite.verifier("secret2026xx".toCharArray(), h));
        assertThrows(IllegalArgumentException.class, () -> Securite.controlerRobustesse("court1".toCharArray()));
    }

    @Test @Order(2)
    void referentielEtSalaries() throws Exception {
        Entreprise e = new Entreprise();
        e.raisonSociale = "SOCIÉTÉ TEST SARL";
        e.matriculeFiscal = "0000000/A/M/000";
        e.tauxAT = new BigDecimal("0.004");
        e.tauxTFP = new BigDecimal("0.01");
        dao.enregistrerEntreprise(e);

        assertThrows(AccesRefuse.class, () -> svc.enregistrerSalarie(lecteur, new Salarie()));
        s1 = new Salarie();
        s1.matricule = "M001"; s1.nom = "BEN TEST"; s1.prenom = "Ali"; s1.dateEntree = LocalDate.of(2020, 1, 1);
        s1.chefFamille = true; s1.nbEnfants = 2; s1.numCnss = "12345678";
        svc.enregistrerSalarie(gest, s1);
        s2 = new Salarie();
        s2.matricule = "M002"; s2.nom = "TEST"; s2.prenom = "Salma"; s2.dateEntree = LocalDate.of(2023, 5, 1);
        svc.enregistrerSalarie(gest, s2);

        Salarie doublon = new Salarie();
        doublon.matricule = "M001"; doublon.nom = "X"; doublon.prenom = "Y"; doublon.dateEntree = LocalDate.of(2024, 1, 1);
        RegleMetier ex = assertThrows(RegleMetier.class, () -> svc.enregistrerSalarie(gest, doublon));
        assertTrue(ex.getMessage().contains("existe déjà"));

        contrat(s1, "2020-01-01", "1800");
        contrat(s1, "2026-07-01", "2000");   // avenant : c'est lui qui s'applique en octobre
        contrat(s2, "2023-05-01", "1200");
        Contrat invalide = new Contrat();
        invalide.salarieId = s2.id; invalide.dateDebut = LocalDate.now(); invalide.salaireBase = BigDecimal.ZERO;
        assertThrows(RegleMetier.class, () -> svc.ajouterContrat(gest, invalide));
    }

    static void contrat(Salarie s, String debut, String base) throws Exception {
        Contrat k = new Contrat();
        k.salarieId = s.id;
        k.dateDebut = LocalDate.parse(debut);
        k.salaireBase = new BigDecimal(base);
        svc.ajouterContrat(gest, k);
    }

    static VariableSaisie var(Salarie s, String rub, String qte, String montant) {
        VariableSaisie v = new VariableSaisie();
        v.periodeId = periode.id;
        v.salarieId = s.id;
        v.rubrique = rub;
        v.quantite = qte == null ? null : new BigDecimal(qte);
        v.montant = montant == null ? null : new BigDecimal(montant);
        return v;
    }

    @Test @Order(3)
    void periodeEtVariables() throws Exception {
        periode = svc.creerPeriode(gest, 2026, 10);
        assertThrows(RegleMetier.class, () -> svc.creerPeriode(gest, 2026, 10));
        svc.ajouterVariable(gest, var(s1, "PRIME_PRESENCE", null, "100"));
        svc.ajouterVariable(gest, var(s1, "HS_1", "8", null));
        svc.ajouterVariable(gest, var(s2, "AVANCE", null, "150"));
        assertThrows(RegleMetier.class, () -> svc.ajouterVariable(gest, var(s1, "SAL_BASE", null, "10")));
        assertThrows(RegleMetier.class, () -> svc.ajouterVariable(gest, var(s1, "HS_1", null, null)));
        assertThrows(AccesRefuse.class, () -> svc.ajouterVariable(valid, var(s1, "PRIME_PRESENCE", null, "1")));
        assertEquals(3, dao.variables(periode.id, null).size());
    }

    @Test @Order(4)
    void simulationEtControleDeuxNiveaux() throws Exception {
        PaieService.Traitement t = svc.simuler(gest, periode.id);
        assertEquals(2, t.calculs().size());
        assertTrue(t.anomalies().isEmpty(), t.anomalies().toString());
        Calcul k1 = t.calculs().stream().filter(k -> k.salarieId == s1.id).findFirst().orElseThrow();
        assertEquals(1, k1.version);
        // l'avenant à 2000 s'applique ; 8 h × 2000 × 1,25 / 208 = 96,154
        assertEquals(new BigDecimal("2196.154"), k1.brut);
        assertFalse(k1.certifiable);
        assertEquals(StatutPeriode.CALCULEE, dao.periode(periode.id).orElseThrow().statut);

        // un gestionnaire n'a pas le droit de valider
        assertThrows(AccesRefuse.class, () -> svc.valider(gest, periode.id));
        // contrôle à deux niveaux : l'admin relance le calcul (version 2) puis ne peut pas valider lui-même
        svc.simuler(admin, periode.id);
        RegleMetier ex = assertThrows(RegleMetier.class, () -> svc.valider(admin, periode.id));
        assertTrue(ex.getMessage().contains("deux niveaux"), ex.getMessage());
        assertEquals(StatutPeriode.CALCULEE, dao.periode(periode.id).orElseThrow().statut);
    }

    @Test @Order(5)
    void modificationApresSimulationDetectee() throws Exception {
        svc.ajouterVariable(gest, var(s2, "PRIME_RENDEMENT", null, "50"));
        RegleMetier ex = assertThrows(RegleMetier.class, () -> svc.controlerAvantValidation(valid, periode.id));
        assertTrue(ex.getMessage().contains("Relancer la simulation"), ex.getMessage());

        PaieService.Traitement t = svc.simuler(gest, periode.id);
        Calcul k2 = t.calculs().stream().filter(k -> k.salarieId == s2.id).findFirst().orElseThrow();
        assertEquals(3, k2.version);
        List<String[]> ecarts = svc.comparer(periode.id, s2.id);
        assertTrue(ecarts.stream().anyMatch(e -> e[0].equals("brut") && e[3].equals("+50.000")));
        assertEquals(3, dao.historiqueCalculs(periode.id, s2.id).size());
    }

    @Test @Order(6)
    void validationVerrouillageClotureReouverture() throws Exception {
        List<String> avert = svc.controlerAvantValidation(valid, periode.id);
        assertEquals(2, avert.size(), "les deux bulletins sont NON CERTIFIÉS");
        svc.valider(valid, periode.id);
        assertEquals(StatutPeriode.VALIDEE, dao.periode(periode.id).orElseThrow().statut);
        assertTrue(dao.derniersCalculs(periode.id).stream().allMatch(k -> "VALIDE".equals(k.statut)));

        assertThrows(RegleMetier.class, () -> svc.ajouterVariable(gest, var(s1, "PRIME_PRESENCE", null, "5")));
        assertThrows(RegleMetier.class, () -> svc.simuler(gest, periode.id));
        assertThrows(AccesRefuse.class, () -> svc.cloturer(valid, periode.id));
        svc.cloturer(admin, periode.id);
        assertEquals(StatutPeriode.CLOTUREE, dao.periode(periode.id).orElseThrow().statut);

        assertThrows(RegleMetier.class, () -> svc.rouvrir(admin, periode.id, ""));
        svc.rouvrir(admin, periode.id, "Correction prime oubliée");
        assertEquals(StatutPeriode.CALCULEE, dao.periode(periode.id).orElseThrow().statut);
        svc.valider(valid, periode.id);
        svc.cloturer(admin, periode.id);
    }

    @Test @Order(7)
    void parametreValideDevientCertifiable() throws Exception {
        Periode p = svc.creerPeriode(gest, 2026, 11);
        Calcul k = svc.simuler(gest, p.id).calculs().get(0);
        @SuppressWarnings("unchecked")
        List<java.util.Map<String, Object>> params = (List<java.util.Map<String, Object>>)
                tn.jas.paie.engine.ResultatPaie.depuisJson(k.json).donnees().get("parametres");
        assertThrows(AccesRefuse.class, () -> svc.validerParametre(gest, "X", LocalDate.now(), "1", "a", "b"));
        assertThrows(RegleMetier.class, () -> svc.validerParametre(valid, "X", LocalDate.now(), "1", "a", ""));
        for (var x : params)
            svc.validerParametre(valid, (String) x.get("code"), LocalDate.parse((String) x.get("debut")), (String) x.get("valeur"),
                    "Expert comptable (test)", "Référence de test");
        Calcul apres = svc.simuler(gest, p.id).calculs().stream().filter(c -> c.salarieId == k.salarieId).findFirst().orElseThrow();
        assertTrue(apres.certifiable, "tous les éléments utilisés sont validés");
    }

    @Test @Order(8)
    void documentsEtAudit() throws Exception {
        Entreprise ent = dao.entreprise();
        List<Exports.Ligne> lignes = new ArrayList<>();
        for (Calcul k : dao.derniersCalculs(periode.id)) {
            Salarie s = dao.salarie(k.salarieId).orElseThrow();
            Path f = docs.resolve("BULLETIN_" + s.matricule + ".pdf");
            BulletinPdf.generer(f, ent, s, periode, k);
            assertTrue(Files.size(f) > 1500);
            dao.archiverDocument(periode.id, s.id, "BULLETIN", k.id, f.toString(), Exports.sha256(f), "admin");
            lignes.add(new Exports.Ligne(s, k));
        }
        Path livre = docs.resolve("livre.csv");
        Exports.livreDePaie(livre, "2026-10", lignes);
        List<String> l = Files.readAllLines(livre);
        assertEquals(4, l.size(), "entête + 2 salariés + total");
        assertTrue(l.get(3).contains("TOTAL"));
        Exports.etatCnss(docs.resolve("cnss.csv"), "2026-10", lignes);
        Exports.etatRetenues(docs.resolve("ret.csv"), "2026-10", lignes);
        Exports.etatPaiement(docs.resolve("pay.csv"), "2026-10", lignes);

        var journal = dao.journal(null, 500);
        for (String action : new String[]{"SIMULATION", "VALIDATION", "CLOTURE", "REOUVERTURE", "VALIDATION_PARAM", "CREATION"})
            assertTrue(journal.stream().anyMatch(a -> a.action.equals(action)), "audit " + action);
        assertTrue(journal.stream().anyMatch(a -> a.details != null && a.details.contains("Correction prime oubliée")));
        System.out.println("Documents de test : " + docs);
    }

    @Test @Order(9)
    void parametresModifiablesParVersionsDatees() throws Exception {
        // 2026-10 est clôturée : aucune version ne peut s'y appliquer
        assertThrows(AccesRefuse.class, () -> svc.ajouterVersionParametre(gest, "CNSS_SAL_TAUX", LocalDate.of(2026, 11, 1), null, "0.0968", "LF", null));
        RegleMetier fige = assertThrows(RegleMetier.class, () -> svc.ajouterVersionParametre(admin, "CNSS_SAL_TAUX", LocalDate.of(2026, 10, 1), null, "0.0968", "LF", null));
        assertTrue(fige.getMessage().contains("validée ou clôturée"), fige.getMessage());
        assertThrows(RegleMetier.class, () -> svc.ajouterVersionParametre(admin, "CNSS_SAL_TAUX", LocalDate.of(2026, 11, 15), null, "0.0968", "LF", null));
        assertThrows(RegleMetier.class, () -> svc.ajouterVersionParametre(admin, "CNSS_SAL_TAUX", LocalDate.of(2026, 11, 1), null, "1.5", "LF", null));
        assertThrows(RegleMetier.class, () -> svc.ajouterVersionParametre(admin, "CNSS_SAL_TAUX", LocalDate.of(2026, 11, 1), null, "0.0968", " ", null));
        assertThrows(RegleMetier.class, () -> svc.ajouterVersionParametre(admin, "INCONNU", LocalDate.of(2026, 11, 1), null, "1", "LF", null));

        svc.ajouterVersionParametre(admin, "CNSS_SAL_TAUX", LocalDate.of(2026, 11, 1), null, "0.0968", "Texte de test", null);
        assertTrue(svc.referentiel().version().contains("+p1"), svc.referentiel().version());
        assertEquals("0.0918", svc.referentiel().parametre("CNSS_SAL_TAUX", LocalDate.of(2026, 10, 31)).valeur());
        assertEquals(LocalDate.of(2026, 10, 31), svc.referentiel().parametre("CNSS_SAL_TAUX", LocalDate.of(2026, 10, 31)).fin());
        assertThrows(RegleMetier.class, () -> svc.ajouterVersionParametre(admin, "CNSS_SAL_TAUX", LocalDate.of(2026, 11, 1), null, "0.1", "LF", null));

        // barème : contrôles de cohérence puis ajout
        var trou = List.of(new tn.jas.paie.engine.Referentiel.Tranche(new BigDecimal("0"), new BigDecimal("5000"), BigDecimal.ZERO),
                new tn.jas.paie.engine.Referentiel.Tranche(new BigDecimal("6000"), null, new BigDecimal("0.2")));
        assertThrows(RegleMetier.class, () -> svc.ajouterVersionBareme(admin, "BAREME:IRPP", LocalDate.of(2027, 1, 1), null, trou, "LF", null));
        var ok = List.of(new tn.jas.paie.engine.Referentiel.Tranche(new BigDecimal("0"), new BigDecimal("6000"), BigDecimal.ZERO),
                new tn.jas.paie.engine.Referentiel.Tranche(new BigDecimal("6000"), null, new BigDecimal("0.2")));
        svc.ajouterVersionBareme(admin, "BAREME:IRPP", LocalDate.of(2027, 1, 1), null, ok, "LF 2027 (test)", null);
        assertEquals(LocalDate.of(2027, 1, 1), svc.referentiel().bareme("IRPP", LocalDate.of(2027, 1, 31)).debut());

        // la période 2026-11 calculée avant le changement doit être recalculée
        Periode nov = dao.periodes().stream().filter(p -> p.annee == 2026 && p.mois == 11).findFirst().orElseThrow();
        RegleMetier ex = assertThrows(RegleMetier.class, () -> svc.controlerAvantValidation(valid, nov.id));
        assertTrue(ex.getMessage().contains("Relancer la simulation"), ex.getMessage());
        Calcul k = svc.simuler(gest, nov.id).calculs().stream().filter(c -> c.salarieId == s2.id).findFirst().orElseThrow();
        // 1 200 × (9,68 % + 0,25 %) = 119,160 ; nouvelle valeur non validée => non certifiable
        assertEquals(new BigDecimal("119.160"), k.cnssSal);
        assertFalse(k.certifiable);

        // persistance : un nouveau service (redémarrage) retrouve les mêmes versions
        PaieService autre = new PaieService(dao, Referentiel.charger(), true);
        autre.rechargerReferentiel();
        assertEquals(svc.referentiel().version(), autre.referentiel().version());

        // suppression d'une version future
        int idBareme = dao.versionsParametres().stream().filter(v -> v.code.equals("BAREME:IRPP")).findFirst().orElseThrow().id;
        assertThrows(AccesRefuse.class, () -> svc.supprimerVersion(valid, idBareme));
        svc.supprimerVersion(admin, idBareme);
        assertEquals(LocalDate.of(2025, 1, 1), svc.referentiel().bareme("IRPP", LocalDate.of(2027, 1, 31)).debut());
        assertTrue(dao.journal("MODIFICATION_PARAM", 50).size() >= 2);
    }
}
