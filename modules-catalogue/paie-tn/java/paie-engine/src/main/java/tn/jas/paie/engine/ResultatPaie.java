package tn.jas.paie.engine;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Résultat d'un calcul. La structure interne est une Map ordonnée, sérialisable en JSON,
 * strictement identique (hors champ "moteur") à celle produite par le module JavaScript.
 */
public final class ResultatPaie {
    private final Map<String, Object> donnees;

    ResultatPaie(Map<String, Object> donnees) { this.donnees = donnees; }

    public Map<String, Object> donnees() { return donnees; }

    public String json() { return Json.write(donnees); }

    @SuppressWarnings("unchecked")
    private Map<String, Object> syn() { return (Map<String, Object>) donnees.get("synthese"); }

    /** Valeur brute (texte, 3 décimales) d'un champ de la synthèse. */
    public String synthese(String k) { return (String) syn().get(k); }

    private BigDecimal s(String k) { return new BigDecimal(synthese(k)); }

    public BigDecimal brut() { return s("brut"); }
    public BigDecimal cnssSalarial() { return s("cnssSalarial"); }
    public BigDecimal irpp() { return s("irpp"); }
    public BigDecimal css() { return s("css"); }
    public BigDecimal netAPayer() { return s("netAPayer"); }
    public BigDecimal chargesPatronales() { return s("chargesPatronales"); }
    public BigDecimal coutEmployeur() { return s("coutEmployeur"); }
    public boolean certifiable() { return Boolean.TRUE.equals(donnees.get("certifiable")); }
    public boolean bloquant() { return Boolean.TRUE.equals(donnees.get("bloquant")); }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> alertes() { return (List<Map<String, Object>>) donnees.get("alertes"); }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> lignes() { return (List<Map<String, Object>>) donnees.get("lignes"); }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> cotisations() { return (List<Map<String, Object>>) donnees.get("cotisations"); }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> retenuesNet() { return (List<Map<String, Object>>) donnees.get("retenuesNet"); }

    @SuppressWarnings("unchecked")
    public Map<String, Object> fiscal() { return (Map<String, Object>) donnees.get("fiscal"); }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> parametres() { return (List<Map<String, Object>>) donnees.get("parametres"); }

    @SuppressWarnings("unchecked")
    public static ResultatPaie depuisJson(String json) {
        return new ResultatPaie((Map<String, Object>) Json.parse(json));
    }
}
