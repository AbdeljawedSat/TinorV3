package tn.jas.paie.app.service;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import tn.jas.paie.app.db.PaieDao;
import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Contrat;
import tn.jas.paie.app.model.Modeles.Entreprise;
import tn.jas.paie.app.model.Modeles.Periode;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.model.Modeles.StatutPeriode;
import tn.jas.paie.app.model.Modeles.Utilisateur;
import tn.jas.paie.app.model.Modeles.Validation;
import tn.jas.paie.app.model.Modeles.VariableSaisie;
import tn.jas.paie.app.model.Modeles.VersionParam;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.engine.Dec;
import tn.jas.paie.engine.EntreePaie;
import tn.jas.paie.engine.Json;
import tn.jas.paie.engine.MoteurPaie;
import tn.jas.paie.engine.Referentiel;
import tn.jas.paie.engine.ResultatPaie;

/** Orchestration du workflow de paie : droits, contrôles, appel du moteur, persistance et audit. */
public final class PaieService {

    private final PaieDao dao;
    private final Referentiel base;
    private volatile MoteurPaie moteur;
    private final boolean controleDeuxNiveaux;

    public PaieService(PaieDao dao, Referentiel ref, boolean controleDeuxNiveaux) {
        this.dao = dao;
        this.base = ref;
        this.moteur = new MoteurPaie(ref);
        this.controleDeuxNiveaux = controleDeuxNiveaux;
    }

    public PaieDao dao() { return dao; }
    public Referentiel referentiel() { return moteur.referentiel(); }
    public boolean controleDeuxNiveaux() { return controleDeuxNiveaux; }

    /** Erreur métier affichable telle quelle à l'utilisateur. */
    public static final class RegleMetier extends RuntimeException {
        public RegleMetier(String m) { super(m); }
    }

    /** Résultat d'un traitement de masse : calculs produits et anomalies hors moteur. */
    public record Traitement(List<Calcul> calculs, List<String> anomalies) { }

    // ---------------- Salariés & contrats ----------------

    public void enregistrerSalarie(Utilisateur u, Salarie s) throws SQLException {
        Securite.exiger(u, Droit.GERER_SALARIES);
        if (s.matricule == null || s.matricule.isBlank()) throw new RegleMetier("Le matricule est obligatoire");
        if (s.nom == null || s.nom.isBlank() || s.prenom == null || s.prenom.isBlank()) throw new RegleMetier("Nom et prénom obligatoires");
        if (s.dateEntree == null) throw new RegleMetier("La date d'entrée est obligatoire");
        if (s.dateSortie != null && s.dateSortie.isBefore(s.dateEntree)) throw new RegleMetier("La date de sortie précède la date d'entrée");
        if (s.nbEnfants < 0 || s.nbEnfantsEtudiants < 0 || s.nbEnfantsHandicapes < 0) throw new RegleMetier("Nombre d'enfants invalide");
        boolean creation = s.id == 0;
        try {
            dao.enregistrerSalarie(s);
        } catch (SQLException e) {
            if (e.getMessage() != null && e.getMessage().contains("uk_paie_sal_matricule"))
                throw new RegleMetier("Le matricule " + s.matricule + " existe déjà");
            throw e;
        }
        dao.audit(u.login, creation ? "CREATION" : "MODIFICATION", "SALARIE", s.id,
                "matricule=" + s.matricule + " chefFamille=" + s.chefFamille + " enfants=" + s.nbEnfants
                        + "/" + s.nbEnfantsEtudiants + "/" + s.nbEnfantsHandicapes + " actif=" + s.actif);
    }

    public void ajouterContrat(Utilisateur u, Contrat k) throws SQLException {
        Securite.exiger(u, Droit.GERER_SALARIES);
        if (k.dateDebut == null) throw new RegleMetier("Date de début obligatoire");
        if (k.salaireBase == null || k.salaireBase.signum() <= 0) throw new RegleMetier("Le salaire de base doit être positif");
        if (k.horaireMensuel == null || k.horaireMensuel.signum() <= 0) throw new RegleMetier("L'horaire mensuel doit être positif");
        if (k.dateFin != null && k.dateFin.isBefore(k.dateDebut)) throw new RegleMetier("La date de fin précède la date de début");
        dao.ajouterContrat(k);
        dao.audit(u.login, "CREATION", "CONTRAT", k.id, "salarie=" + k.salarieId + " type=" + k.typeContrat
                + " debut=" + k.dateDebut + " salaireBase=" + k.salaireBase.toPlainString() + " horaire=" + k.horaireMensuel.toPlainString());
    }

    // ---------------- Périodes ----------------

    public Periode creerPeriode(Utilisateur u, int annee, int mois) throws SQLException {
        Securite.exiger(u, Droit.SIMULER);
        if (mois < 1 || mois > 12 || annee < 2017 || annee > 2100) throw new RegleMetier("Période invalide");
        try {
            Periode p = dao.creerPeriode(annee, mois);
            dao.audit(u.login, "CREATION", "PERIODE", p.id, p.libelle());
            return p;
        } catch (SQLException e) {
            if (e.getMessage() != null && e.getMessage().contains("uk_paie_per")) throw new RegleMetier("La période existe déjà");
            throw e;
        }
    }

    private Periode periode(int id) throws SQLException {
        return dao.periode(id).orElseThrow(() -> new RegleMetier("Période introuvable"));
    }

    // ---------------- Variables ----------------

    public void ajouterVariable(Utilisateur u, VariableSaisie v) throws SQLException {
        Securite.exiger(u, Droit.SAISIR_VARIABLES);
        Periode p = periode(v.periodeId);
        if (!p.modifiable()) throw new RegleMetier("Période " + p.statut + " : saisie impossible");
        var rub = referentiel().rubriques().get(v.rubrique);
        if (rub == null) throw new RegleMetier("Rubrique inconnue : " + v.rubrique);
        if ("SAL_BASE".equals(v.rubrique)) throw new RegleMetier("Le salaire de base provient du contrat");
        boolean qte = !"MONTANT".equals(rub.mode());
        if (qte && (v.quantite == null || v.quantite.signum() <= 0)) throw new RegleMetier("Quantité positive obligatoire pour " + rub.libelle());
        if (!qte && (v.montant == null || v.montant.signum() <= 0)) throw new RegleMetier("Montant positif obligatoire pour " + rub.libelle());
        if ("QTE_TAUX".equals(rub.mode()) && v.taux == null) throw new RegleMetier("Taux obligatoire pour " + rub.libelle());
        v.creePar = u.login;
        dao.ajouterVariable(v);
        dao.audit(u.login, "CREATION", "VARIABLE", v.id, "periode=" + p.libelle() + " salarie=" + v.salarieId + " " + v.rubrique
                + " qte=" + v.quantite + " montant=" + v.montant);
    }

    public void supprimerVariable(Utilisateur u, VariableSaisie v) throws SQLException {
        Securite.exiger(u, Droit.SAISIR_VARIABLES);
        Periode p = periode(v.periodeId);
        if (!p.modifiable()) throw new RegleMetier("Période " + p.statut + " : modification impossible");
        dao.supprimerVariable(v.id);
        dao.audit(u.login, "SUPPRESSION", "VARIABLE", v.id, "periode=" + p.libelle() + " salarie=" + v.salarieId + " " + v.rubrique);
    }

    // ---------------- Calcul ----------------

    /** Salariés concernés par la période : actifs, entrés avant la fin du mois et non sortis avant son début. */
    public List<Salarie> salariesDeLaPeriode(Periode p) throws SQLException {
        YearMonth ym = YearMonth.of(p.annee, p.mois);
        List<Salarie> l = new ArrayList<>();
        for (Salarie s : dao.salaries(null, true)) {
            if (s.dateEntree != null && s.dateEntree.isAfter(ym.atEndOfMonth())) continue;
            if (s.dateSortie != null && s.dateSortie.isBefore(ym.atDay(1))) continue;
            l.add(s);
        }
        return l;
    }

    /** Construit l'entrée moteur à partir des données en base. Renvoie empty si aucun contrat applicable. */
    public Optional<EntreePaie> entree(Periode p, Salarie s, Entreprise ent, List<Validation> validations) throws SQLException {
        YearMonth ym = YearMonth.of(p.annee, p.mois);
        Optional<Contrat> k = dao.contratApplicable(s.id, ym.atDay(1), ym.atEndOfMonth());
        if (k.isEmpty()) return Optional.empty();
        EntreePaie e = new EntreePaie();
        e.periode = ym;
        e.tauxAT = ent.tauxAT;
        e.tauxTFP = ent.tauxTFP;
        e.matricule = s.matricule;
        e.nom = s.nom;
        e.prenom = s.prenom;
        e.regime = s.regime;
        e.dateEntree = s.dateEntree;
        e.dateSortie = s.dateSortie;
        e.chefFamille = s.chefFamille;
        e.nbEnfants = s.nbEnfants;
        e.nbEnfantsEtudiants = s.nbEnfantsEtudiants;
        e.nbEnfantsHandicapes = s.nbEnfantsHandicapes;
        e.salaireBase = k.get().salaireBase;
        e.horaireMensuel = k.get().horaireMensuel;
        e.tauxHoraire = k.get().tauxHoraire;
        for (VariableSaisie v : dao.variables(p.id, s.id))
            e.variables.add(new EntreePaie.Variable(v.rubrique, v.quantite, v.taux, v.montant, v.commentaire));
        for (Validation v : validations)
            e.validations.add(new EntreePaie.Validation(v.code, v.debut, v.valeur));
        return Optional.of(e);
    }

    /** Aperçu d'un seul salarié, sans enregistrement. */
    public ResultatPaie apercu(Utilisateur u, int periodeId, Salarie s) throws SQLException {
        Securite.exiger(u, Droit.CONSULTER);
        Periode p = periode(periodeId);
        EntreePaie e = entree(p, s, dao.entreprise(), dao.validations())
                .orElseThrow(() -> new RegleMetier("Aucun contrat applicable pour " + s.nomComplet() + " sur " + p.libelle()));
        return moteur.calculer(e);
    }

    /** Simulation de la période : nouvelle version de calcul pour chaque salarié, les précédentes sont conservées. */
    public Traitement simuler(Utilisateur u, int periodeId) throws SQLException {
        Securite.exiger(u, Droit.SIMULER);
        Periode p = periode(periodeId);
        if (!p.modifiable()) throw new RegleMetier("Période " + p.statut + " : rouvrir la période pour recalculer");
        Entreprise ent = dao.entreprise();
        List<Validation> vals = dao.validations();
        List<Calcul> calculs = new ArrayList<>();
        List<String> anomalies = new ArrayList<>();
        if (ent.id == 0) anomalies.add("Fiche entreprise non renseignée (Administration > Entreprise)");

        try (Connection c = dao.connexion()) {
            c.setAutoCommit(false);
            try {
                dao.marquerCalculs(c, p.id, "SIMULATION", "REMPLACE");
                for (Salarie s : salariesDeLaPeriode(p)) {
                    Optional<EntreePaie> e = entree(p, s, ent, vals);
                    if (e.isEmpty()) {
                        anomalies.add(s + " : aucun contrat applicable sur la période");
                        continue;
                    }
                    ResultatPaie r = moteur.calculer(e.get());
                    Calcul k = versCalcul(r, p.id, s.id, u.login);
                    k.version = dao.prochaineVersion(c, p.id, s.id);
                    dao.insererCalcul(c, k);
                    calculs.add(k);
                }
                if (calculs.isEmpty()) throw new RegleMetier("Aucun salarié calculable sur la période" + (anomalies.isEmpty() ? "" : " : " + anomalies));
                if (!dao.changerStatut(c, p.id, p.statut, StatutPeriode.CALCULEE, "calcule", u.login))
                    throw new RegleMetier("La période a été modifiée par un autre utilisateur, réessayer");
                long bloquants = calculs.stream().filter(k -> bloquant(k)).count();
                dao.audit(c, u.login, "SIMULATION", "PERIODE", p.id, p.libelle() + " : " + calculs.size()
                        + " calcul(s), " + bloquants + " bloquant(s), " + anomalies.size() + " anomalie(s)");
                c.commit();
            } catch (SQLException | RuntimeException ex) {
                c.rollback();
                throw ex;
            }
        }
        return new Traitement(calculs, anomalies);
    }

    private static boolean bloquant(Calcul k) {
        return ResultatPaie.depuisJson(k.json).bloquant();
    }

    private static Calcul versCalcul(ResultatPaie r, int periodeId, int salarieId, String user) {
        Calcul k = new Calcul();
        k.periodeId = periodeId;
        k.salarieId = salarieId;
        k.statut = "SIMULATION";
        k.brut = r.brut();
        k.cnssSal = r.cnssSalarial();
        k.irpp = r.irpp();
        k.css = r.css();
        k.net = r.netAPayer();
        k.chargesPat = r.chargesPatronales();
        k.coutEmployeur = r.coutEmployeur();
        k.certifiable = r.certifiable();
        k.moteur = MoteurPaie.MOTEUR;
        k.paramsVersion = r.donnees().get("paramsVersion").toString();
        k.json = Json.writeCompact(r.donnees());
        k.calculePar = user;
        return k;
    }

    /** Contrôles préalables à la validation. Renvoie les avertissements non bloquants. */
    public List<String> controlerAvantValidation(Utilisateur u, int periodeId) throws SQLException {
        Securite.exiger(u, Droit.VALIDER_PAIE);
        Periode p = periode(periodeId);
        if (p.statut != StatutPeriode.CALCULEE) throw new RegleMetier("Seule une période CALCULEE peut être validée (statut : " + p.statut + ")");
        if (controleDeuxNiveaux && u.login.equals(p.calculePar))
            throw new RegleMetier("Contrôle à deux niveaux : la validation doit être faite par une autre personne que celle qui a lancé le calcul (" + p.calculePar + ")");
        List<Calcul> derniers = dao.derniersCalculs(p.id);
        Entreprise ent = dao.entreprise();
        List<Validation> vals = dao.validations();
        List<String> avert = new ArrayList<>();
        List<Integer> calcules = new ArrayList<>();
        for (Calcul k : derniers) {
            if (!"SIMULATION".equals(k.statut)) continue;
            calcules.add(k.salarieId);
            ResultatPaie stocke = ResultatPaie.depuisJson(k.json);
            Salarie s = dao.salarie(k.salarieId).orElseThrow();
            if (stocke.bloquant()) throw new RegleMetier(s + " : le calcul comporte des erreurs bloquantes, corriger puis relancer la simulation");
            // Données modifiées depuis la simulation ? On recalcule et on compare (moteur déterministe).
            Optional<EntreePaie> e = entree(p, s, ent, vals);
            Object recalc = e.isEmpty() ? null : Json.parse(Json.writeCompact(moteur.calculer(e.get()).donnees()));
            if (!Objects.equals(recalc, Json.parse(k.json)))
                throw new RegleMetier(s + " : données ou paramètres modifiés depuis la simulation. Relancer la simulation avant de valider.");
            if (!stocke.certifiable()) avert.add(s + " : NON CERTIFIÉ (paramètres non validés)");
        }
        if (calcules.isEmpty()) throw new RegleMetier("Aucun calcul en simulation à valider");
        for (Salarie s : salariesDeLaPeriode(p))
            if (!calcules.contains(s.id)) throw new RegleMetier(s + " n'a pas de calcul pour la période : relancer la simulation");
        return avert;
    }

    public void valider(Utilisateur u, int periodeId) throws SQLException {
        List<String> avert = controlerAvantValidation(u, periodeId);
        Periode p = periode(periodeId);
        try (Connection c = dao.connexion()) {
            c.setAutoCommit(false);
            try {
                int n = dao.marquerCalculs(c, p.id, "SIMULATION", "VALIDE");
                if (!dao.changerStatut(c, p.id, StatutPeriode.CALCULEE, StatutPeriode.VALIDEE, "validee", u.login))
                    throw new RegleMetier("La période a changé de statut entre-temps");
                dao.audit(c, u.login, "VALIDATION", "PERIODE", p.id, p.libelle() + " : " + n + " bulletin(s) validé(s), "
                        + avert.size() + " non certifié(s)");
                c.commit();
            } catch (SQLException | RuntimeException ex) {
                c.rollback();
                throw ex;
            }
        }
    }

    public void cloturer(Utilisateur u, int periodeId) throws SQLException {
        Securite.exiger(u, Droit.CLOTURER);
        Periode p = periode(periodeId);
        if (p.statut != StatutPeriode.VALIDEE) throw new RegleMetier("Seule une période VALIDEE peut être clôturée");
        try (Connection c = dao.connexion()) {
            if (!dao.changerStatut(c, p.id, StatutPeriode.VALIDEE, StatutPeriode.CLOTUREE, "cloturee", u.login))
                throw new RegleMetier("La période a changé de statut entre-temps");
            dao.audit(c, u.login, "CLOTURE", "PERIODE", p.id, p.libelle());
        }
    }

    public void rouvrir(Utilisateur u, int periodeId, String motif) throws SQLException {
        Securite.exiger(u, Droit.ROUVRIR);
        if (motif == null || motif.trim().length() < 5) throw new RegleMetier("Un motif de réouverture explicite est obligatoire");
        Periode p = periode(periodeId);
        if (p.statut != StatutPeriode.VALIDEE && p.statut != StatutPeriode.CLOTUREE)
            throw new RegleMetier("Seule une période validée ou clôturée peut être rouverte");
        try (Connection c = dao.connexion()) {
            c.setAutoCommit(false);
            try {
                dao.marquerCalculs(c, p.id, "VALIDE", "SIMULATION");
                if (!dao.changerStatut(c, p.id, p.statut, StatutPeriode.CALCULEE, "reouverture", u.login))
                    throw new RegleMetier("La période a changé de statut entre-temps");
                dao.audit(c, u.login, "REOUVERTURE", "PERIODE", p.id, p.libelle() + " (était " + p.statut + ") motif : " + motif.trim());
                c.commit();
            } catch (SQLException | RuntimeException ex) {
                c.rollback();
                throw ex;
            }
        }
    }

    // ---------------- Paramètres réglementaires ----------------

    public void validerParametre(Utilisateur u, String code, LocalDate debut, String valeur, String validePar, String reference) throws SQLException {
        Securite.exiger(u, Droit.VALIDER_PARAMETRES);
        if (validePar == null || validePar.isBlank()) throw new RegleMetier("Indiquer le nom du professionnel qui valide");
        if (reference == null || reference.isBlank()) throw new RegleMetier("Indiquer la référence officielle consultée (JORT, note commune...)");
        Validation v = new Validation();
        v.code = code;
        v.debut = debut;
        v.valeur = valeur;
        v.validePar = validePar.trim();
        v.reference = reference.trim();
        dao.enregistrerValidation(v);
        dao.audit(u.login, "VALIDATION_PARAM", "PARAMETRE", code + "@" + debut, "valeur=" + valeur + " par=" + v.validePar + " ref=" + v.reference);
    }

    public void retirerValidation(Utilisateur u, String code, LocalDate debut) throws SQLException {
        Securite.exiger(u, Droit.VALIDER_PARAMETRES);
        dao.retirerValidation(code, debut);
        dao.audit(u.login, "RETRAIT_VALIDATION", "PARAMETRE", code + "@" + debut, null);
    }

    // ---------------- Comparaison avant/après ----------------

    /** Écarts entre les deux dernières versions de calcul d'un salarié (champ -> [avant, après]). */
    @SuppressWarnings("unchecked")
    public List<String[]> comparer(int periodeId, int salarieId) throws SQLException {
        List<Calcul> h = dao.historiqueCalculs(periodeId, salarieId);
        List<String[]> ecarts = new ArrayList<>();
        if (h.size() < 2) return ecarts;
        Map<String, Object> apres = (Map<String, Object>) ResultatPaie.depuisJson(h.get(0).json).donnees().get("synthese");
        Map<String, Object> avant = (Map<String, Object>) ResultatPaie.depuisJson(h.get(1).json).donnees().get("synthese");
        for (String k : apres.keySet()) {
            String a = String.valueOf(avant.get(k)), b = String.valueOf(apres.get(k));
            if (!a.equals(b)) {
                BigDecimal delta = new BigDecimal(b).subtract(new BigDecimal(a));
                ecarts.add(new String[]{k, a, b, (delta.signum() > 0 ? "+" : "") + delta.toPlainString()});
            }
        }
        return ecarts;
    }

    // ---------------- Paramètres modifiables (versions datées) ----------------

    /** Référentiel du fichier, sans les versions saisies. */
    public Referentiel referentielBase() { return base; }

    /** Recharge le référentiel : fichier + versions saisies en base. À appeler au démarrage et après chaque modification. */
    public void rechargerReferentiel() throws SQLException {
        List<VersionParam> vs = dao.versionsParametres();
        List<Referentiel.Ajout> aj = new ArrayList<>();
        int maxId = 0;
        for (VersionParam v : vs) {
            aj.add(new Referentiel.Ajout(v.code, v.debut, v.fin, v.valeur, tranches(v.tranchesJson), v.source, v.note));
            maxId = Math.max(maxId, v.id);
        }
        moteur = new MoteurPaie(base.avecAjouts(aj, aj.isEmpty() ? null : "+p" + aj.size() + "." + maxId));
    }

    @SuppressWarnings("unchecked")
    static List<Referentiel.Tranche> tranches(String json) {
        if (json == null || json.isBlank()) return null;
        List<Referentiel.Tranche> l = new ArrayList<>();
        for (Object o : (List<Object>) Json.parse(json)) {
            Map<String, Object> m = (Map<String, Object>) o;
            l.add(new Referentiel.Tranche(new BigDecimal(m.get("de").toString()),
                    m.get("a") == null ? null : new BigDecimal(m.get("a").toString()), new BigDecimal(m.get("taux").toString())));
        }
        return l;
    }

    static String tranchesJson(List<Referentiel.Tranche> ts) {
        List<Object> l = new ArrayList<>();
        for (Referentiel.Tranche t : ts) {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("de", t.de().toPlainString());
            m.put("a", t.a() == null ? null : t.a().toPlainString());
            m.put("taux", t.taux().toPlainString());
            l.add(m);
        }
        return Json.writeCompact(l);
    }

    /** Contrôle commun : date d'effet au 1er du mois, postérieure aux versions existantes et aux périodes figées. */
    private void controlerDateEffet(String code, LocalDate debut) throws SQLException {
        if (debut == null) throw new RegleMetier("La date d'effet est obligatoire");
        if (debut.getDayOfMonth() != 1) throw new RegleMetier("La date d'effet doit être le 1er jour d'un mois (paie mensuelle)");
        LocalDate fige = dao.finDernierePeriodeFigee();
        if (fige != null && !debut.isAfter(fige))
            throw new RegleMetier("La date d'effet doit être postérieure à la dernière période validée ou clôturée (" + fige
                    + ") : les bulletins validés ne peuvent pas changer. Rouvrir la période si une correction est nécessaire.");
        LocalDate dernier = null;
        if (code.startsWith("BAREME:")) {
            for (Referentiel.Bareme b : referentiel().baremes())
                if (b.code().equals(code.substring(7)) && (dernier == null || b.debut().isAfter(dernier))) dernier = b.debut();
        } else {
            for (Referentiel.Parametre p : referentiel().parametres())
                if (p.code().equals(code) && (dernier == null || p.debut().isAfter(dernier))) dernier = p.debut();
        }
        if (dernier != null && !debut.isAfter(dernier))
            throw new RegleMetier("Une version de " + code + " existe déjà à partir du " + dernier + " : choisir une date d'effet postérieure");
    }

    /** Nouvelle valeur datée d'un paramètre. Pour un taux, la valeur est une fraction (9,68 % = 0.0968). */
    public void ajouterVersionParametre(Utilisateur u, String code, LocalDate debut, LocalDate fin, String valeur, String source, String note) throws SQLException {
        Securite.exiger(u, Droit.MODIFIER_PARAMETRES);
        Referentiel.Parametre modele = null;
        for (Referentiel.Parametre p : referentiel().parametres())
            if (p.code().equals(code) && (modele == null || p.debut().isAfter(modele.debut()))) modele = p;
        if (modele == null) throw new RegleMetier("Paramètre inconnu : " + code);
        if (source == null || source.isBlank()) throw new RegleMetier("Indiquer le texte officiel de référence (loi de finances, décret, note commune…)");
        if (fin != null && debut != null && fin.isBefore(debut)) throw new RegleMetier("La date de fin précède la date d'effet");
        String v = valeur == null ? "" : valeur.trim();
        if ("TEXTE".equals(modele.type())) {
            if ("CSS_MODE".equals(code) && !v.equals("TOUTES") && !v.equals("HORS_TRANCHE_ZERO"))
                throw new RegleMetier("Valeur attendue : TOUTES ou HORS_TRANCHE_ZERO");
            if (v.isEmpty()) throw new RegleMetier("Valeur obligatoire");
        } else {
            BigDecimal d;
            try { d = new BigDecimal(v); } catch (NumberFormatException e) { throw new RegleMetier("Valeur numérique invalide : " + valeur); }
            switch (modele.type()) {
                case "TAUX" -> { if (d.signum() < 0 || d.compareTo(BigDecimal.ONE) > 0) throw new RegleMetier("Un taux doit être compris entre 0 et 100 %"); }
                case "MONTANT" -> { if (d.signum() < 0) throw new RegleMetier("Le montant doit être positif ou nul"); }
                case "NOMBRE" -> { if (d.signum() < 0 || d.stripTrailingZeros().scale() > 0) throw new RegleMetier("Nombre entier positif attendu"); }
                case "COEF" -> { if (d.signum() <= 0 || d.compareTo(BigDecimal.TEN) > 0) throw new RegleMetier("Coefficient attendu entre 0 et 10"); }
                default -> { }
            }
            v = Dec.canon(d);
        }
        controlerDateEffet(code, debut);
        VersionParam p = new VersionParam();
        p.code = code; p.debut = debut; p.fin = fin; p.valeur = v; p.source = source.trim();
        p.note = note == null || note.isBlank() ? null : note.trim(); p.creePar = u.login;
        enregistrerVersion(u, p, "valeur=" + v);
    }

    /** Nouveau barème daté (code « BAREME:IRPP »). */
    public void ajouterVersionBareme(Utilisateur u, String code, LocalDate debut, LocalDate fin, List<Referentiel.Tranche> tranches, String source, String note) throws SQLException {
        Securite.exiger(u, Droit.MODIFIER_PARAMETRES);
        if (!code.startsWith("BAREME:") || referentiel().baremes().stream().noneMatch(b -> b.code().equals(code.substring(7))))
            throw new RegleMetier("Barème inconnu : " + code);
        if (source == null || source.isBlank()) throw new RegleMetier("Indiquer le texte officiel de référence");
        if (fin != null && debut != null && fin.isBefore(debut)) throw new RegleMetier("La date de fin précède la date d'effet");
        if (tranches == null || tranches.isEmpty()) throw new RegleMetier("Le barème doit contenir au moins une tranche");
        BigDecimal attendu = BigDecimal.ZERO;
        for (int i = 0; i < tranches.size(); i++) {
            Referentiel.Tranche t = tranches.get(i);
            if (t.de() == null || t.de().compareTo(attendu) != 0) throw new RegleMetier("Tranche " + (i + 1) + " : doit commencer à " + attendu.toPlainString());
            if (t.taux() == null || t.taux().signum() < 0 || t.taux().compareTo(BigDecimal.ONE) > 0) throw new RegleMetier("Tranche " + (i + 1) + " : taux entre 0 et 100 %");
            boolean derniere = i == tranches.size() - 1;
            if (derniere && t.a() != null) throw new RegleMetier("La dernière tranche doit être ouverte (borne haute vide)");
            if (!derniere && (t.a() == null || t.a().compareTo(t.de()) <= 0)) throw new RegleMetier("Tranche " + (i + 1) + " : borne haute invalide");
            attendu = t.a();
        }
        controlerDateEffet(code, debut);
        VersionParam p = new VersionParam();
        p.code = code; p.debut = debut; p.fin = fin; p.tranchesJson = tranchesJson(tranches); p.source = source.trim();
        p.note = note == null || note.isBlank() ? null : note.trim(); p.creePar = u.login;
        enregistrerVersion(u, p, "tranches=" + p.tranchesJson);
    }

    private void enregistrerVersion(Utilisateur u, VersionParam p, String detail) throws SQLException {
        try {
            dao.insererVersion(p);
            rechargerReferentiel();
        } catch (IllegalArgumentException e) {
            dao.supprimerVersion(p.id);
            rechargerReferentiel();
            throw new RegleMetier("Version refusée : " + e.getMessage());
        }
        dao.audit(u.login, "MODIFICATION_PARAM", "PARAMETRE", p.code + "@" + p.debut, detail + " fin=" + p.fin + " source=" + p.source);
    }

    /** Supprime une version saisie, uniquement si elle ne concerne aucune période validée ou clôturée. */
    public void supprimerVersion(Utilisateur u, int id) throws SQLException {
        Securite.exiger(u, Droit.MODIFIER_PARAMETRES);
        VersionParam v = dao.versionsParametres().stream().filter(x -> x.id == id).findFirst()
                .orElseThrow(() -> new RegleMetier("Version introuvable"));
        LocalDate fige = dao.finDernierePeriodeFigee();
        if (fige != null && !v.debut.isAfter(fige))
            throw new RegleMetier("Cette version s'applique à des périodes déjà validées ou clôturées : suppression impossible");
        dao.supprimerVersion(id);
        rechargerReferentiel();
        dao.audit(u.login, "SUPPRESSION_PARAM", "PARAMETRE", v.code + "@" + v.debut, v.valeur != null ? "valeur=" + v.valeur : "tranches=" + v.tranchesJson);
    }
}
