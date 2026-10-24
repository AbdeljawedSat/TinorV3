package tn.jas.paie.engine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Données d'entrée d'un calcul de paie pour un salarié et une période. */
public final class EntreePaie {

    public record Variable(String rubrique, BigDecimal quantite, BigDecimal taux, BigDecimal montant, String commentaire) { }

    /** Validation d'un paramètre par un professionnel : valable uniquement pour la valeur validée. */
    public record Validation(String code, LocalDate debut, String valeur) { }

    public YearMonth periode;
    // entreprise
    public BigDecimal tauxAT;   // null => paramètre par défaut
    public BigDecimal tauxTFP;  // null => paramètre par défaut
    // salarié
    public String matricule;
    public String nom;
    public String prenom;
    public String regime = "CNSS_RSNA";
    public LocalDate dateEntree;
    public LocalDate dateSortie;
    public boolean chefFamille;
    public int nbEnfants;
    public int nbEnfantsEtudiants;
    public int nbEnfantsHandicapes;
    // contrat
    public BigDecimal salaireBase;
    public BigDecimal horaireMensuel = new BigDecimal("208");
    public BigDecimal tauxHoraire; // null => salaireBase / horaireMensuel
    // éléments variables et validations
    public List<Variable> variables = new ArrayList<>();
    public List<Validation> validations = new ArrayList<>();

    /** Construction depuis la structure JSON commune aux moteurs Java et JS. */
    @SuppressWarnings("unchecked")
    public static EntreePaie depuisMap(Map<String, Object> m) {
        EntreePaie e = new EntreePaie();
        e.periode = YearMonth.parse(s(m.get("periode")));
        Map<String, Object> ent = (Map<String, Object>) m.getOrDefault("entreprise", Map.of());
        e.tauxAT = dec(ent.get("tauxAT"));
        e.tauxTFP = dec(ent.get("tauxTFP"));
        Map<String, Object> sal = (Map<String, Object>) m.get("salarie");
        e.matricule = s(sal.get("matricule"));
        e.nom = s(sal.get("nom"));
        e.prenom = s(sal.get("prenom"));
        if (sal.get("regime") != null) e.regime = s(sal.get("regime"));
        e.dateEntree = sal.get("dateEntree") == null ? null : LocalDate.parse(s(sal.get("dateEntree")));
        e.dateSortie = sal.get("dateSortie") == null ? null : LocalDate.parse(s(sal.get("dateSortie")));
        e.chefFamille = Boolean.TRUE.equals(sal.get("chefFamille"));
        e.nbEnfants = entier(sal.get("nbEnfants"));
        e.nbEnfantsEtudiants = entier(sal.get("nbEnfantsEtudiants"));
        e.nbEnfantsHandicapes = entier(sal.get("nbEnfantsHandicapes"));
        Map<String, Object> ctr = (Map<String, Object>) m.get("contrat");
        e.salaireBase = dec(ctr.get("salaireBase"));
        if (ctr.get("horaireMensuel") != null) e.horaireMensuel = dec(ctr.get("horaireMensuel"));
        e.tauxHoraire = dec(ctr.get("tauxHoraire"));
        for (Object o : (List<Object>) m.getOrDefault("variables", List.of())) {
            Map<String, Object> v = (Map<String, Object>) o;
            e.variables.add(new Variable(s(v.get("rubrique")), dec(v.get("quantite")), dec(v.get("taux")),
                    dec(v.get("montant")), s(v.get("commentaire"))));
        }
        for (Object o : (List<Object>) m.getOrDefault("validations", List.of())) {
            Map<String, Object> v = (Map<String, Object>) o;
            e.validations.add(new Validation(s(v.get("code")), LocalDate.parse(s(v.get("debut"))), s(v.get("valeur"))));
        }
        return e;
    }

    private static String s(Object o) {
        if (o == null) return null;
        return o instanceof BigDecimal bd ? bd.toPlainString() : o.toString();
    }

    private static BigDecimal dec(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal bd) return bd;
        String t = o.toString().trim();
        return t.isEmpty() ? null : new BigDecimal(t);
    }

    private static int entier(Object o) {
        BigDecimal d = dec(o);
        return d == null ? 0 : d.intValueExact();
    }
}
