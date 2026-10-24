package tn.jas.paie.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Tests unitaires des mécanismes de calcul. Les valeurs attendues sont recalculées à la main
 * à partir des paramètres du fichier (ce sont des contrôles arithmétiques, pas des cas de
 * référence réglementaires validés).
 */
class MoteurPaieTest {

    private final Referentiel ref = Referentiel.charger();
    private final MoteurPaie moteur = new MoteurPaie(ref);

    private static BigDecimal d(String s) { return new BigDecimal(s); }

    private EntreePaie entree(String periode, String base) {
        EntreePaie e = new EntreePaie();
        e.periode = YearMonth.parse(periode);
        e.matricule = "U1";
        e.salaireBase = d(base);
        return e;
    }

    private static String alerteCodes(ResultatPaie r) {
        return r.alertes().stream().map(a -> (String) a.get("code")).reduce("", (x, y) -> x + y + ";");
    }

    // ---------- Barème ----------

    @Test
    void bareme2025_parTranches() {
        var t = ref.bareme("IRPP", LocalDate.of(2026, 1, 31)).tranches();
        assertEquals(0, MoteurPaie.appliquerBareme(t, d("5000"), Dec.ZERO, false).signum());
        assertEquals(0, d("750").compareTo(MoteurPaie.appliquerBareme(t, d("10000"), Dec.ZERO, false)));
        // 750 + 1705.472 × 25 %
        assertEquals(0, d("1176.368").compareTo(MoteurPaie.appliquerBareme(t, d("11705.472"), Dec.ZERO, false)));
        // 750 + 2500 + 3000 + 3300 + 3600 + 7600 + 30000 × 40 %
        assertEquals(0, d("32750").compareTo(MoteurPaie.appliquerBareme(t, d("100000"), Dec.ZERO, false)));
    }

    @Test
    void bareme_selonDateEffet() {
        assertEquals(LocalDate.of(2017, 1, 1), ref.bareme("IRPP", LocalDate.of(2024, 12, 31)).debut());
        assertEquals(LocalDate.of(2025, 1, 1), ref.bareme("IRPP", LocalDate.of(2025, 1, 1)).debut());
    }

    @Test
    void css_majorationToutesTranchesOuHorsZero() {
        var t = ref.bareme("IRPP", LocalDate.of(2026, 1, 31)).tranches();
        BigDecimal r = d("12000");
        BigDecimal normal = MoteurPaie.appliquerBareme(t, r, Dec.ZERO, false);
        assertEquals(0, d("60").compareTo(MoteurPaie.appliquerBareme(t, r, d("0.005"), false).subtract(normal)));
        assertEquals(0, d("35").compareTo(MoteurPaie.appliquerBareme(t, r, d("0.005"), true).subtract(normal)));
    }

    // ---------- Calcul complet ----------

    @Test
    void calculCelibataire1200_controleArithmetique() {
        ResultatPaie r = moteur.calculer(entree("2026-10", "1200"));
        // CNSS 1200 × 9,18 % = 110,160 ; perte d'emploi 1200 × 0,25 % = 3,000
        assertEquals(d("113.160"), r.cnssSalarial());
        Map<String, Object> f = r.fiscal();
        assertEquals("1086.840", f.get("imposableMensuel"));
        assertEquals("13042.080", f.get("imposableAnnuel"));
        assertEquals("1304.208", f.get("fraisProAnnuel"));
        assertEquals("11737.872", f.get("netImposableAnnuel"));
        // 750 + 1737,872 × 25 % = 1184,468 ; / 12 = 98,706
        assertEquals("1184.468", f.get("irppAnnuel"));
        assertEquals(d("98.706"), r.irpp());
        // 11737,872 × 0,5 % = 58,689 ; / 12 = 4,891
        assertEquals("58.689", f.get("cssAnnuel"));
        assertEquals(d("4.891"), r.css());
        assertEquals(d("983.243"), r.netAPayer());
        // 198,840 + 3,000 + 4,800 + 12,000 + 12,000
        assertEquals(d("230.640"), r.chargesPatronales());
        assertEquals(d("1430.640"), r.coutEmployeur());
        assertFalse(r.certifiable(), "Paramètres non validés : ne doit pas être certifiable");
        assertFalse(r.bloquant());
    }

    @Test
    void fraisProfessionnelsPlafonnes() {
        ResultatPaie r = moteur.calculer(entree("2026-10", "5000"));
        assertEquals("2000.000", r.fiscal().get("fraisProAnnuel"));
    }

    @Test
    void deductionsFamille_limiteQuatreEnfants() {
        EntreePaie e = entree("2026-10", "3000");
        e.chefFamille = true;
        e.nbEnfants = 6;
        e.nbEnfantsEtudiants = 1;
        e.nbEnfantsHandicapes = 1;
        ResultatPaie r = moteur.calculer(e);
        // 300 + 4 × 100 + 1000 + 2000
        assertEquals("3700.000", r.fiscal().get("deductionsFamille"));
    }

    @Test
    void enfantsSansChefDeFamille_alerteEtPasDeDeduction() {
        EntreePaie e = entree("2026-10", "1500");
        e.nbEnfants = 2;
        ResultatPaie r = moteur.calculer(e);
        assertEquals("0.000", r.fiscal().get("deductionsFamille"));
        assertTrue(alerteCodes(r).contains("ENFANTS_SANS_CHEF"));
    }

    @Test
    void basSalaire_exonereIrppEtCss() {
        ResultatPaie r = moteur.calculer(entree("2026-10", "450"));
        assertEquals(0, r.irpp().signum());
        assertEquals(0, r.css().signum());
    }

    @Test
    void heuresSupplementaires_tauxHoraireCalcule() {
        EntreePaie e = entree("2026-10", "1500");
        e.variables.add(new EntreePaie.Variable("HS_1", d("10"), null, null, null));
        ResultatPaie r = moteur.calculer(e);
        // 10 × 1500 × 1,25 / 208 = 90,1442 → 90,144
        Map<String, Object> hs = r.lignes().stream().filter(l -> "HS_1".equals(l.get("code"))).findFirst().orElseThrow();
        assertEquals("90.144", hs.get("montant"));
        assertEquals(d("1590.144"), r.brut());
    }

    @Test
    void absenceEtRetenuesNettes() {
        EntreePaie e = entree("2026-10", "1300");
        e.variables.add(new EntreePaie.Variable("ABS_JOURS", d("2"), null, null, null));
        e.variables.add(new EntreePaie.Variable("AVANCE", null, null, d("200"), null));
        ResultatPaie r = moteur.calculer(e);
        // 2 × 1300 / 26 = 100
        assertEquals(d("1200.000"), r.brut());
        assertEquals(1, r.retenuesNet().size());
        assertEquals("200.000", r.synthese("totalRetenuesNet"));
        // même net que le cas 1200 moins l'avance
        assertEquals(d("783.243"), r.netAPayer());
    }

    @Test
    void remboursementFraisNonSoumis() {
        EntreePaie e = entree("2026-10", "1200");
        e.variables.add(new EntreePaie.Variable("REMB_FRAIS", null, null, d("80"), null));
        ResultatPaie r = moteur.calculer(e);
        assertEquals(d("1280.000"), r.brut());
        assertEquals("1200.000", ((Map<?, ?>) r.donnees().get("totaux")).get("baseCnss"));
        assertEquals(d("1063.243"), r.netAPayer());
    }

    @Test
    void periode2024_sansPerteEmploi() {
        ResultatPaie r = moteur.calculer(entree("2024-06", "1200"));
        assertEquals(d("110.160"), r.cnssSalarial());
        assertTrue(r.cotisations().stream().noneMatch(c -> "PERTE_EMPLOI".equals(c.get("code"))));
    }

    @Test
    void periode2027_cssAbsente_bloquant() {
        ResultatPaie r = moteur.calculer(entree("2027-01", "1200"));
        assertTrue(r.bloquant());
        assertTrue(alerteCodes(r).contains("PARAM_MANQUANT"));
        assertFalse(r.certifiable());
    }

    @Test
    void erreursDeSaisie() {
        EntreePaie e = entree("2026-10", "1000");
        e.variables.add(new EntreePaie.Variable("XXX", null, null, d("10"), null));
        e.variables.add(new EntreePaie.Variable("SAL_BASE", null, null, d("10"), null));
        e.variables.add(new EntreePaie.Variable("PRIME_PRESENCE", null, null, null, null));
        e.variables.add(new EntreePaie.Variable("PRIME_RENDEMENT", null, null, d("-5"), null));
        ResultatPaie r = moteur.calculer(e);
        String codes = alerteCodes(r);
        assertTrue(codes.contains("RUBRIQUE_INCONNUE"));
        assertTrue(codes.contains("VAR_SAL_BASE"));
        assertTrue(codes.contains("VARIABLE_INCOMPLETE"));
        assertTrue(codes.contains("MONTANT_NEGATIF"));
        assertTrue(r.bloquant());
        assertEquals(d("1000.000"), r.brut());
    }

    @Test
    void netNegatif_bloquant() {
        EntreePaie e = entree("2026-10", "500");
        e.variables.add(new EntreePaie.Variable("AVANCE", null, null, d("600"), null));
        assertTrue(moteur.calculer(e).bloquant());
    }

    @Test
    void certification_valideSeulementPourLaValeurValidee() {
        EntreePaie e = entree("2026-10", "1200");
        e.tauxAT = d("0.004");
        e.tauxTFP = d("0.01");
        ResultatPaie sans = moteur.calculer(e);
        for (Map<String, Object> p : sans.parametres())
            e.validations.add(new EntreePaie.Validation((String) p.get("code"), LocalDate.parse((String) p.get("debut")), (String) p.get("valeur")));
        assertTrue(moteur.calculer(e).certifiable());

        // une validation portant sur une autre valeur n'est pas reconnue
        e.validations.removeIf(v -> v.code().equals("CNSS_SAL_TAUX"));
        e.validations.add(new EntreePaie.Validation("CNSS_SAL_TAUX", LocalDate.of(2019, 1, 1), "0.0968"));
        assertFalse(moteur.calculer(e).certifiable());
    }

    @Test
    void validationAvecZerosFinaux() {
        EntreePaie e = entree("2026-10", "1200");
        e.validations.add(new EntreePaie.Validation("FRAIS_PRO_PLAFOND", LocalDate.of(2017, 1, 1), "2000.000"));
        ResultatPaie r = moteur.calculer(e);
        Map<String, Object> p = r.parametres().stream().filter(x -> "FRAIS_PRO_PLAFOND".equals(x.get("code"))).findFirst().orElseThrow();
        assertEquals(Boolean.TRUE, p.get("valide"));
    }

    @Test
    void arrondiHalfUp() {
        assertEquals("0.002", Dec.f(d("0.0015")));
        assertEquals("-0.002", Dec.f(d("-0.0015")));
        assertEquals("0.333", Dec.div3(d("1"), d("3")).toPlainString());
        assertEquals("0.667", Dec.div3(d("2"), d("3")).toPlainString());
    }

    // ---------- Référentiel ----------

    @Test
    void referentiel_parametreEnVigueur() {
        assertNull(ref.parametre("CNSS_PE_SAL", LocalDate.of(2024, 12, 31)));
        assertNotNull(ref.parametre("CNSS_PE_SAL", LocalDate.of(2025, 1, 1)));
        assertNull(ref.parametre("CSS_MAJORATION", LocalDate.of(2027, 1, 1)));
    }

    @Test
    void referentiel_refuseChevauchement() {
        String p = "{\"version\":\"x\",\"parametres\":["
                + "{\"code\":\"A\",\"type\":\"TAUX\",\"valeur\":\"1\",\"debut\":\"2020-01-01\",\"fin\":null},"
                + "{\"code\":\"A\",\"type\":\"TAUX\",\"valeur\":\"2\",\"debut\":\"2021-01-01\",\"fin\":null}],\"baremes\":[]}";
        assertThrows(IllegalArgumentException.class, () -> Referentiel.charger(p, "{\"rubriques\":[]}"));
    }

    @Test
    void referentiel_refuseTranchesNonContigues() {
        String p = "{\"version\":\"x\",\"parametres\":[],\"baremes\":[{\"code\":\"IRPP\",\"debut\":\"2020-01-01\",\"tranches\":["
                + "{\"de\":\"0\",\"a\":\"5000\",\"taux\":\"0\"},{\"de\":\"6000\",\"a\":null,\"taux\":\"0.2\"}]}]}";
        assertThrows(IllegalArgumentException.class, () -> Referentiel.charger(p, "{\"rubriques\":[]}"));
    }

    @Test
    void json_allerRetour() {
        String src = "{\"a\":[1,2.50,{\"b\":null,\"c\":true}],\"d\":\"é\\\"x\"}";
        Object o = Json.parse(src);
        assertEquals(o, Json.parse(Json.write(o)));
        assertEquals(new BigDecimal("2.50"), ((List<?>) ((Map<?, ?>) o).get("a")).get(1));
    }

    // ---------- versions saisies dans l'application ----------

    @Test
    void ajout_tauxCss2027_debloqueLaPeriode() {
        Referentiel r2 = ref.avecAjouts(List.of(new Referentiel.Ajout("CSS_MAJORATION", LocalDate.of(2027, 1, 1), null, "0.01", null, "test", null)), "+t1");
        assertEquals("2026.10-1+t1", r2.version());
        ResultatPaie r = new MoteurPaie(r2).calculer(entree("2027-01", "1200"));
        assertFalse(r.bloquant());
        // 1 % × 11 737,872 = 117,379 ; / 12 = 9,782
        assertEquals("117.379", r.fiscal().get("cssAnnuel"));
        assertEquals(d("978.352"), r.netAPayer());
        // 2026 inchangé (ancienne version conservée)
        assertEquals(d("983.243"), new MoteurPaie(r2).calculer(entree("2026-10", "1200")).netAPayer());
    }

    @Test
    void ajout_nouveauBareme_chaineLesDates() {
        var tr = List.of(new Referentiel.Tranche(d("0"), d("6000"), d("0")), new Referentiel.Tranche(d("6000"), null, d("0.2")));
        Referentiel r2 = ref.avecAjouts(List.of(new Referentiel.Ajout("BAREME:IRPP", LocalDate.of(2026, 1, 1), null, null, tr, "test", null)), "+t2");
        assertEquals(LocalDate.of(2025, 12, 31), r2.bareme("IRPP", LocalDate.of(2025, 6, 30)).fin());
        ResultatPaie r = new MoteurPaie(r2).calculer(entree("2026-10", "1200"));
        // (11 737,872 − 6 000) × 20 % = 1 147,574 ; / 12 = 95,631
        assertEquals("1147.574", r.fiscal().get("irppAnnuel"));
        assertEquals(d("986.318"), r.netAPayer());
        assertEquals(d("983.243"), new MoteurPaie(r2).calculer(entree("2025-06", "1200")).netAPayer()); // ancien barème 2025
    }

    @Test
    void ajout_tauxCnss_fermeLaVersionPrecedente() {
        Referentiel r2 = ref.avecAjouts(List.of(new Referentiel.Ajout("CNSS_SAL_TAUX", LocalDate.of(2026, 7, 1), null, "0.0968", null, "test", null)), "+t3");
        assertEquals(LocalDate.of(2026, 6, 30), r2.parametre("CNSS_SAL_TAUX", LocalDate.of(2026, 6, 30)).fin());
        assertEquals("0.0968", r2.parametre("CNSS_SAL_TAUX", LocalDate.of(2026, 7, 31)).valeur());
        // 1200 × (9,68 % + 0,25 %) = 119,160
        assertEquals(d("119.160"), new MoteurPaie(r2).calculer(entree("2026-10", "1200")).cnssSalarial());
        assertEquals(d("113.160"), new MoteurPaie(r2).calculer(entree("2026-06", "1200")).cnssSalarial());
    }

    @Test
    void ajout_baremeInvalideRefuse() {
        var tr = List.of(new Referentiel.Tranche(d("0"), d("5000"), d("0")), new Referentiel.Tranche(d("6000"), null, d("0.2")));
        assertThrows(IllegalArgumentException.class, () -> ref.avecAjouts(
                List.of(new Referentiel.Ajout("BAREME:IRPP", LocalDate.of(2026, 1, 1), null, null, tr, "t", null)), "+x"));
    }
}
