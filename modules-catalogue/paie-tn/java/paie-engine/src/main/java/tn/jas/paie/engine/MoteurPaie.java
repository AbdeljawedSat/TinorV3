package tn.jas.paie.engine;

import static tn.jas.paie.engine.Dec.ZERO;
import static tn.jas.paie.engine.Dec.div3;
import static tn.jas.paie.engine.Dec.f;
import static tn.jas.paie.engine.Dec.max;
import static tn.jas.paie.engine.Dec.min;
import static tn.jas.paie.engine.Dec.r3;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import tn.jas.paie.engine.EntreePaie.Variable;
import tn.jas.paie.engine.Referentiel.Bareme;
import tn.jas.paie.engine.Referentiel.Parametre;
import tn.jas.paie.engine.Referentiel.Rubrique;
import tn.jas.paie.engine.Referentiel.Tranche;

/**
 * Moteur de paie tunisien — calcul mensuel, déterministe, sans état.
 * Spécification commune : docs/SPECIFICATION_CALCUL.md (le module JS applique exactement les mêmes étapes).
 */
public final class MoteurPaie {

    public static final String VERSION = "1.0.0";
    public static final String MOTEUR = "java-" + VERSION;

    private final Referentiel ref;

    public MoteurPaie(Referentiel ref) { this.ref = ref; }

    public Referentiel referentiel() { return ref; }

    /** Contexte d'un calcul : collecte des paramètres utilisés et des alertes. */
    private final class Ctx {
        final EntreePaie e;
        final LocalDate date;
        final Map<String, Map<String, Object>> utilises = new TreeMap<>();
        final List<Map<String, Object>> alertes = new ArrayList<>();

        Ctx(EntreePaie e) {
            this.e = e;
            this.date = e.periode.atEndOfMonth();
        }

        void alerte(String niveau, String code, String message) {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("niveau", niveau);
            a.put("code", code);
            a.put("message", message);
            alertes.add(a);
        }

        boolean estValide(String code, LocalDate debut, String valeurCanonique) {
            for (EntreePaie.Validation v : e.validations) {
                if (v.code().equals(code) && v.debut().equals(debut) && v.valeur() != null
                        && canonValidation(v.valeur()).equals(valeurCanonique)) return true;
            }
            return false;
        }

        void utilise(String code, LocalDate debut, String valeur, String statut, String source) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", code);
            m.put("debut", debut.toString());
            m.put("valeur", valeur);
            m.put("statut", statut);
            m.put("source", source);
            m.put("valide", estValide(code, debut, valeur));
            utilises.put(code, m);
        }

        /** Paramètre obligatoire : absent => alerte ERREUR et valeur nulle. */
        BigDecimal param(String code) {
            Parametre p = ref.parametre(code, date);
            if (p == null) {
                alerte("ERREUR", "PARAM_MANQUANT", "Paramètre " + code + " absent pour la période " + e.periode);
                return null;
            }
            utilise(p.code(), p.debut(), p.valeurCanonique(), p.statut(), p.source());
            return p.decimal();
        }

        /** Paramètre facultatif (ex. perte d'emploi avant 2025) : absent => 0 sans alerte. */
        BigDecimal paramFacultatif(String code) {
            Parametre p = ref.parametre(code, date);
            if (p == null) return ZERO;
            utilise(p.code(), p.debut(), p.valeurCanonique(), p.statut(), p.source());
            return p.decimal();
        }

        String paramTexte(String code, String defaut) {
            Parametre p = ref.parametre(code, date);
            if (p == null) return defaut;
            utilise(p.code(), p.debut(), p.valeurCanonique(), p.statut(), p.source());
            return p.valeur();
        }
    }

    private static String canonValidation(String v) {
        try {
            return Dec.canon(new BigDecimal(v.trim()));
        } catch (NumberFormatException ex) {
            return v.trim();
        }
    }

    public ResultatPaie calculer(EntreePaie e) {
        Ctx c = new Ctx(e);
        LocalDate debutMois = e.periode.atDay(1);

        // ---- 1. Contrôles d'entrée ----
        if (!"CNSS_RSNA".equals(e.regime))
            c.alerte("ERREUR", "REGIME_NON_GERE", "Régime " + e.regime + " non pris en charge en V1 (seul CNSS_RSNA est calculé)");
        if (e.salaireBase == null || e.salaireBase.signum() <= 0)
            c.alerte("ERREUR", "SALAIRE_BASE", "Salaire de base absent ou nul");
        if (e.horaireMensuel == null || e.horaireMensuel.signum() <= 0)
            c.alerte("ERREUR", "HORAIRE", "Horaire mensuel absent ou nul");
        if (e.dateEntree != null && e.dateEntree.isAfter(c.date))
            c.alerte("ERREUR", "SALARIE_NON_ENTRE", "Date d'entrée postérieure à la période");
        if (e.dateSortie != null && e.dateSortie.isBefore(debutMois))
            c.alerte("ERREUR", "SALARIE_SORTI", "Salarié sorti avant la période");
        if ((e.dateEntree != null && e.dateEntree.isAfter(debutMois))
                || (e.dateSortie != null && e.dateSortie.isBefore(c.date)))
            c.alerte("AVERTISSEMENT", "MOIS_INCOMPLET", "Entrée ou sortie en cours de mois : saisir l'absence correspondante (pas de prorata automatique)");
        if (e.nbEnfants < 0 || e.nbEnfantsEtudiants < 0 || e.nbEnfantsHandicapes < 0)
            c.alerte("ERREUR", "ENFANTS", "Nombre d'enfants négatif");

        BigDecimal base = e.salaireBase == null ? ZERO : e.salaireBase;
        BigDecimal horaire = (e.horaireMensuel == null || e.horaireMensuel.signum() <= 0) ? null : e.horaireMensuel;

        // ---- 2. Lignes de gains et retenues sur brut ----
        List<Map<String, Object>> lignes = new ArrayList<>();
        List<Map<String, Object>> retenuesNet = new ArrayList<>();
        BigDecimal brut = ZERO, baseCnss = ZERO, baseIrpp = ZERO, baseCnssIrpp = ZERO, totalRetNet = ZERO;

        Rubrique rBase = ref.rubriques().get("SAL_BASE");
        List<Object[]> elements = new ArrayList<>(); // {Rubrique, Variable|null}
        elements.add(new Object[]{rBase, null});
        for (Variable v : e.variables) {
            Rubrique r = ref.rubriques().get(v.rubrique());
            if (r == null) {
                c.alerte("ERREUR", "RUBRIQUE_INCONNUE", "Rubrique inconnue : " + v.rubrique());
                continue;
            }
            if ("SAL_BASE".equals(r.code())) {
                c.alerte("ERREUR", "VAR_SAL_BASE", "Le salaire de base provient du contrat : ne pas le saisir en variable");
                continue;
            }
            elements.add(new Object[]{r, v});
        }
        // tri stable par ordre de calcul
        elements.sort(Comparator.comparingInt(o -> ((Rubrique) o[0]).ordre()));

        for (Object[] el : elements) {
            Rubrique r = (Rubrique) el[0];
            Variable v = (Variable) el[1];
            BigDecimal quantite = null, taux = null, montant;
            String lib = r.libelle();
            if (v == null) {
                montant = r3(base);
            } else {
                switch (r.mode()) {
                    case "MONTANT" -> {
                        if (v.montant() == null) { manque(c, r, "montant"); continue; }
                        montant = r3(v.montant());
                    }
                    case "QTE_TAUX" -> {
                        if (v.quantite() == null || v.taux() == null) { manque(c, r, "quantité et taux"); continue; }
                        quantite = v.quantite(); taux = v.taux();
                        montant = r3(quantite.multiply(taux));
                    }
                    case "HEURES_SUP" -> {
                        if (v.quantite() == null) { manque(c, r, "quantité (heures)"); continue; }
                        BigDecimal coef = c.param(r.coefParam());
                        if (coef == null) continue;
                        quantite = v.quantite(); taux = coef;
                        if (e.tauxHoraire != null) montant = r3(quantite.multiply(e.tauxHoraire).multiply(coef));
                        else if (horaire != null) montant = div3(quantite.multiply(base).multiply(coef), horaire);
                        else continue;
                    }
                    case "ABS_JOURS" -> {
                        if (v.quantite() == null) { manque(c, r, "quantité (jours)"); continue; }
                        BigDecimal jours = c.param("JOURS_OUVRABLES_MOIS");
                        if (jours == null) continue;
                        quantite = v.quantite();
                        if (quantite.compareTo(jours) > 0)
                            c.alerte("AVERTISSEMENT", "ABSENCE_ELEVEE", "Absence de " + Dec.canon(quantite) + " jours supérieure aux jours ouvrables du mois");
                        montant = div3(quantite.multiply(base), jours);
                    }
                    case "ABS_HEURES" -> {
                        if (v.quantite() == null) { manque(c, r, "quantité (heures)"); continue; }
                        quantite = v.quantite();
                        if (e.tauxHoraire != null) montant = r3(quantite.multiply(e.tauxHoraire));
                        else if (horaire != null) montant = div3(quantite.multiply(base), horaire);
                        else continue;
                    }
                    default -> {
                        c.alerte("ERREUR", "MODE_INCONNU", "Mode de calcul inconnu pour " + r.code());
                        continue;
                    }
                }
                if (montant.signum() < 0) {
                    c.alerte("ERREUR", "MONTANT_NEGATIF", "Montant négatif pour " + r.code() + " : saisir une rubrique de retenue");
                    continue;
                }
                if (v.commentaire() != null && !v.commentaire().isBlank()) lib = lib + " – " + v.commentaire();
            }
            c.utilise("RUB:" + r.code(), Referentiel.DEBUT_RUBRIQUE, r.valeurCanonique(), r.statut(), "Catalogue des rubriques");

            if ("RETENUE_NET".equals(r.type())) {
                Map<String, Object> rn = new LinkedHashMap<>();
                rn.put("code", r.code());
                rn.put("libelle", lib);
                rn.put("montant", f(montant));
                retenuesNet.add(rn);
                totalRetNet = totalRetNet.add(montant);
                continue;
            }
            BigDecimal signe = "RETENUE_BRUT".equals(r.type()) ? montant.negate() : montant;
            brut = brut.add(signe);
            if (r.cnss()) baseCnss = baseCnss.add(signe);
            if (r.irpp()) baseIrpp = baseIrpp.add(signe);
            if (r.cnss() && r.irpp()) baseCnssIrpp = baseCnssIrpp.add(signe);

            Map<String, Object> l = new LinkedHashMap<>();
            l.put("code", r.code());
            l.put("libelle", lib);
            l.put("type", r.type());
            l.put("quantite", quantite == null ? null : Dec.canon(quantite));
            l.put("taux", taux == null ? null : Dec.canon(taux));
            l.put("montant", f(montant));
            l.put("cnss", r.cnss());
            l.put("irpp", r.irpp());
            lignes.add(l);
        }
        if (brut.signum() < 0) c.alerte("ERREUR", "BRUT_NEGATIF", "Salaire brut négatif");
        baseCnss = max(baseCnss, ZERO);
        baseIrpp = max(baseIrpp, ZERO);
        baseCnssIrpp = max(baseCnssIrpp, ZERO);

        // ---- 3. Cotisations sociales et charges patronales ----
        BigDecimal tSal = nz(c.param("CNSS_SAL_TAUX"));
        BigDecimal tPat = nz(c.param("CNSS_PAT_TAUX"));
        BigDecimal peSal = c.paramFacultatif("CNSS_PE_SAL");
        BigDecimal pePat = c.paramFacultatif("CNSS_PE_PAT");
        BigDecimal tAT = e.tauxAT != null ? e.tauxAT : nz(c.param("AT_TAUX_DEFAUT"));
        BigDecimal tTFP = e.tauxTFP != null ? e.tauxTFP : nz(c.param("TFP_TAUX_DEFAUT"));
        BigDecimal tFop = nz(c.param("FOPROLOS_TAUX"));

        List<Map<String, Object>> cotis = new ArrayList<>();
        BigDecimal cnssS = r3(baseCnss.multiply(tSal)), cnssP = r3(baseCnss.multiply(tPat));
        BigDecimal peS = r3(baseCnss.multiply(peSal)), peP = r3(baseCnss.multiply(pePat));
        BigDecimal at = r3(baseCnss.multiply(tAT)), tfp = r3(baseCnss.multiply(tTFP)), fop = r3(baseCnss.multiply(tFop));
        cotis.add(cotisation("CNSS", "CNSS régime général", baseCnss, tSal, cnssS, tPat, cnssP));
        if (peSal.signum() != 0 || pePat.signum() != 0)
            cotis.add(cotisation("PERTE_EMPLOI", "Fonds perte d'emploi", baseCnss, peSal, peS, pePat, peP));
        cotis.add(cotisation("AT", "Accident du travail", baseCnss, null, null, tAT, at));
        cotis.add(cotisation("TFP", "Taxe formation professionnelle", baseCnss, null, null, tTFP, tfp));
        cotis.add(cotisation("FOPROLOS", "FOPROLOS", baseCnss, null, null, tFop, fop));
        BigDecimal cnssSalarial = cnssS.add(peS);
        BigDecimal chargesPat = cnssP.add(peP).add(at).add(tfp).add(fop);

        // ---- 4. Fiscalité : IRPP et CSS (méthode d'annualisation du mois) ----
        BigDecimal cnssDeductible = r3(baseCnssIrpp.multiply(tSal)).add(r3(baseCnssIrpp.multiply(peSal)));
        BigDecimal imposableMensuel = max(baseIrpp.subtract(cnssDeductible), ZERO);
        BigDecimal imposableAnnuel = imposableMensuel.multiply(Dec.DOUZE);
        BigDecimal fpTaux = nz(c.param("FRAIS_PRO_TAUX"));
        BigDecimal fpPlafond = nz(c.param("FRAIS_PRO_PLAFOND"));
        BigDecimal fraisPro = r3(min(imposableAnnuel.multiply(fpTaux), fpPlafond));

        BigDecimal deductions = ZERO;
        if (e.chefFamille) {
            deductions = deductions.add(nz(c.param("DED_CHEF_FAMILLE")));
            if (e.nbEnfants > 0) {
                BigDecimal maxEnf = nz(c.param("DED_ENFANT_MAX"));
                int n = Math.min(e.nbEnfants, maxEnf.intValue());
                deductions = deductions.add(nz(c.param("DED_ENFANT")).multiply(BigDecimal.valueOf(n)));
            }
            if (e.nbEnfantsEtudiants > 0)
                deductions = deductions.add(nz(c.param("DED_ENFANT_ETUDIANT")).multiply(BigDecimal.valueOf(e.nbEnfantsEtudiants)));
            if (e.nbEnfantsHandicapes > 0)
                deductions = deductions.add(nz(c.param("DED_ENFANT_HANDICAPE")).multiply(BigDecimal.valueOf(e.nbEnfantsHandicapes)));
        } else if (e.nbEnfants + e.nbEnfantsEtudiants + e.nbEnfantsHandicapes > 0) {
            c.alerte("AVERTISSEMENT", "ENFANTS_SANS_CHEF", "Enfants déclarés mais salarié non chef de famille : déductions pour enfants non appliquées");
        }
        BigDecimal netImposableAnnuel = max(imposableAnnuel.subtract(fraisPro).subtract(deductions), ZERO);

        Bareme bIrpp = ref.bareme("IRPP", c.date);
        BigDecimal irppAnnuel = ZERO, irppMensuel = ZERO, cssAnnuel = ZERO, cssMensuel = ZERO;
        if (bIrpp == null) {
            c.alerte("ERREUR", "BAREME_MANQUANT", "Barème IRPP absent pour la période " + e.periode);
        } else {
            c.utilise("BAREME:IRPP", bIrpp.debut(), bIrpp.valeurCanonique(), bIrpp.statut(), bIrpp.source());
            irppAnnuel = r3(appliquerBareme(bIrpp.tranches(), netImposableAnnuel, ZERO, false));
            irppMensuel = div3(irppAnnuel, Dec.DOUZE);

            Parametre pCss = ref.parametre("CSS_MAJORATION", c.date);
            if (pCss == null) {
                c.alerte("ERREUR", "PARAM_MANQUANT", "Paramètre CSS_MAJORATION absent pour la période " + e.periode);
            } else {
                BigDecimal maj = c.param("CSS_MAJORATION");
                BigDecimal seuil = nz(c.param("CSS_SEUIL_EXONERATION"));
                boolean horsZero = "HORS_TRANCHE_ZERO".equals(c.paramTexte("CSS_MODE", "TOUTES"));
                if (netImposableAnnuel.compareTo(seuil) > 0) {
                    BigDecimal majore = appliquerBareme(bIrpp.tranches(), netImposableAnnuel, maj, horsZero);
                    BigDecimal normal = appliquerBareme(bIrpp.tranches(), netImposableAnnuel, ZERO, false);
                    cssAnnuel = r3(majore.subtract(normal));
                    cssMensuel = div3(cssAnnuel, Dec.DOUZE);
                }
            }
        }

        // ---- 5. Net à payer ----
        BigDecimal net = brut.subtract(cnssSalarial).subtract(irppMensuel).subtract(cssMensuel).subtract(totalRetNet);
        if (net.signum() < 0) c.alerte("ERREUR", "NET_NEGATIF", "Net à payer négatif : vérifier les retenues");

        // ---- 6. Certification ----
        List<Map<String, Object>> params = new ArrayList<>(c.utilises.values());
        long nonValides = params.stream().filter(p -> !Boolean.TRUE.equals(p.get("valide"))).count();
        if (nonValides > 0)
            c.alerte("AVERTISSEMENT", "NON_CERTIFIE", nonValides + " élément(s) réglementaire(s) non validé(s) : bulletin NON CERTIFIÉ");
        boolean bloquant = c.alertes.stream().anyMatch(a -> "ERREUR".equals(a.get("niveau")));

        // ---- Assemblage ----
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("moteur", MOTEUR);
        res.put("paramsVersion", ref.version());
        res.put("periode", e.periode.toString());
        res.put("matricule", e.matricule);
        res.put("lignes", lignes);
        Map<String, Object> tot = new LinkedHashMap<>();
        tot.put("brut", f(brut));
        tot.put("baseCnss", f(baseCnss));
        tot.put("baseIrpp", f(baseIrpp));
        res.put("totaux", tot);
        res.put("cotisations", cotis);
        Map<String, Object> fis = new LinkedHashMap<>();
        fis.put("cnssDeductible", f(cnssDeductible));
        fis.put("imposableMensuel", f(imposableMensuel));
        fis.put("imposableAnnuel", f(imposableAnnuel));
        fis.put("fraisProAnnuel", f(fraisPro));
        fis.put("deductionsFamille", f(deductions));
        fis.put("netImposableAnnuel", f(netImposableAnnuel));
        fis.put("irppAnnuel", f(irppAnnuel));
        fis.put("irppMensuel", f(irppMensuel));
        fis.put("cssAnnuel", f(cssAnnuel));
        fis.put("cssMensuel", f(cssMensuel));
        res.put("fiscal", fis);
        res.put("retenuesNet", retenuesNet);
        Map<String, Object> syn = new LinkedHashMap<>();
        syn.put("brut", f(brut));
        syn.put("cnssSalarial", f(cnssSalarial));
        syn.put("irpp", f(irppMensuel));
        syn.put("css", f(cssMensuel));
        syn.put("totalRetenuesNet", f(totalRetNet));
        syn.put("netAPayer", f(net));
        syn.put("chargesPatronales", f(chargesPat));
        syn.put("coutEmployeur", f(brut.add(chargesPat)));
        res.put("synthese", syn);
        res.put("parametres", params);
        res.put("certifiable", !bloquant && nonValides == 0);
        res.put("bloquant", bloquant);
        res.put("alertes", c.alertes);
        return new ResultatPaie(res);
    }

    /**
     * Applique un barème progressif. Si majoration > 0, chaque taux est majoré
     * (sauf la tranche à 0 % si horsTrancheZero). Résultat exact, non arrondi.
     */
    public static BigDecimal appliquerBareme(List<Tranche> tranches, BigDecimal revenu, BigDecimal majoration, boolean horsTrancheZero) {
        BigDecimal total = ZERO;
        for (Tranche t : tranches) {
            if (revenu.compareTo(t.de()) <= 0) break;
            BigDecimal haut = t.a() == null ? revenu : min(revenu, t.a());
            BigDecimal taux = t.taux();
            if (majoration.signum() != 0 && !(horsTrancheZero && taux.signum() == 0)) taux = taux.add(majoration);
            total = total.add(haut.subtract(t.de()).multiply(taux));
        }
        return total;
    }

    private static void manque(Ctx c, Rubrique r, String quoi) {
        c.alerte("ERREUR", "VARIABLE_INCOMPLETE", "Rubrique " + r.code() + " : " + quoi + " manquant(e)");
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? ZERO : v; }

    private static Map<String, Object> cotisation(String code, String libelle, BigDecimal base,
                                                  BigDecimal tauxSal, BigDecimal montSal,
                                                  BigDecimal tauxPat, BigDecimal montPat) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("libelle", libelle);
        m.put("base", f(base));
        m.put("tauxSalarial", tauxSal == null ? null : Dec.canon(tauxSal));
        m.put("montantSalarial", montSal == null ? null : f(montSal));
        m.put("tauxPatronal", tauxPat == null ? null : Dec.canon(tauxPat));
        m.put("montantPatronal", montPat == null ? null : f(montPat));
        return m;
    }
}
