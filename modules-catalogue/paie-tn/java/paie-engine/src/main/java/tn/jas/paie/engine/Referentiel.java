package tn.jas.paie.engine;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Référentiel réglementaire : paramètres datés, barèmes datés et catalogue des rubriques.
 * Chargé depuis parametres-tn.json et rubriques-tn.json (fichiers partagés avec le module JS).
 */
public final class Referentiel {

    public record Parametre(String code, String libelle, String type, String valeur,
                            LocalDate debut, LocalDate fin, String statut, String source, String note) {
        public BigDecimal decimal() { return new BigDecimal(valeur); }
        public String valeurCanonique() { return canon(valeur, type); }
        public boolean enVigueur(LocalDate d) { return !d.isBefore(debut) && (fin == null || !d.isAfter(fin)); }
    }

    public record Tranche(BigDecimal de, BigDecimal a, BigDecimal taux) { }

    public record Bareme(String code, String libelle, LocalDate debut, LocalDate fin, String statut,
                         String source, List<Tranche> tranches) {
        public boolean enVigueur(LocalDate d) { return !d.isBefore(debut) && (fin == null || !d.isAfter(fin)); }
        public String valeurCanonique() {
            return tranches.stream()
                    .map(t -> Dec.canon(t.de()) + "|" + (t.a() == null ? "" : Dec.canon(t.a())) + "|" + Dec.canon(t.taux()))
                    .collect(Collectors.joining(";"));
        }
    }

    public record Rubrique(String code, String libelle, String type, String mode, String coefParam,
                           boolean cnss, boolean irpp, int ordre, String statut) {
        public String valeurCanonique() {
            return type + "|" + mode + "|" + cnss + "|" + irpp + "|" + (coefParam == null ? "" : coefParam);
        }
    }

    /** Date de référence utilisée pour valider une rubrique (les rubriques ne sont pas datées en V1). */
    public static final LocalDate DEBUT_RUBRIQUE = LocalDate.of(1900, 1, 1);

    private final String version;
    /** Sources brutes (JSON analysé) conservées pour dériver un référentiel enrichi des versions saisies. */
    private String srcParametres, srcRubriques;
    private final List<Parametre> parametres;
    private final List<Bareme> baremes;
    private final Map<String, Rubrique> rubriques;

    private Referentiel(String version, List<Parametre> p, List<Bareme> b, Map<String, Rubrique> r) {
        this.version = version;
        this.parametres = Collections.unmodifiableList(p);
        this.baremes = Collections.unmodifiableList(b);
        this.rubriques = Collections.unmodifiableMap(r);
    }

    public String version() { return version; }
    public List<Parametre> parametres() { return parametres; }
    public List<Bareme> baremes() { return baremes; }
    public Map<String, Rubrique> rubriques() { return rubriques; }

    /** Paramètre en vigueur à la date donnée, ou null s'il n'existe pas. */
    public Parametre parametre(String code, LocalDate date) {
        Parametre trouve = null;
        for (Parametre p : parametres) {
            if (p.code().equals(code) && p.enVigueur(date)) {
                if (trouve != null) throw new IllegalStateException("Chevauchement de dates pour le paramètre " + code);
                trouve = p;
            }
        }
        return trouve;
    }

    public Bareme bareme(String code, LocalDate date) {
        Bareme trouve = null;
        for (Bareme b : baremes) {
            if (b.code().equals(code) && b.enVigueur(date)) {
                if (trouve != null) throw new IllegalStateException("Chevauchement de dates pour le barème " + code);
                trouve = b;
            }
        }
        return trouve;
    }

    // ---------- chargement ----------

    /** Charge les fichiers embarqués dans le JAR (ressources par défaut). */
    public static Referentiel charger() {
        return charger(lireRessource("parametres-tn.json"), lireRessource("rubriques-tn.json"));
    }

    /** Charge depuis des fichiers externes (permet de mettre à jour les paramètres sans recompiler). */
    public static Referentiel charger(Path parametres, Path rubriques) throws IOException {
        return charger(Files.readString(parametres, StandardCharsets.UTF_8), Files.readString(rubriques, StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    public static Referentiel charger(String jsonParametres, String jsonRubriques) {
        Map<String, Object> jp = (Map<String, Object>) Json.parse(jsonParametres);
        Map<String, Object> jr = (Map<String, Object>) Json.parse(jsonRubriques);

        List<Parametre> ps = new ArrayList<>();
        for (Object o : (List<Object>) jp.get("parametres")) {
            Map<String, Object> m = (Map<String, Object>) o;
            ps.add(new Parametre(str(m, "code"), str(m, "libelle"), str(m, "type"), str(m, "valeur"),
                    date(m, "debut"), date(m, "fin"), str(m, "statut"), str(m, "source"), str(m, "note")));
        }
        List<Bareme> bs = new ArrayList<>();
        for (Object o : (List<Object>) jp.get("baremes")) {
            Map<String, Object> m = (Map<String, Object>) o;
            List<Tranche> ts = new ArrayList<>();
            for (Object t : (List<Object>) m.get("tranches")) {
                Map<String, Object> tm = (Map<String, Object>) t;
                ts.add(new Tranche(new BigDecimal(str(tm, "de")),
                        tm.get("a") == null ? null : new BigDecimal(str(tm, "a")),
                        new BigDecimal(str(tm, "taux"))));
            }
            verifierTranches(str(m, "code"), ts);
            bs.add(new Bareme(str(m, "code"), str(m, "libelle"), date(m, "debut"), date(m, "fin"),
                    str(m, "statut"), str(m, "source"), List.copyOf(ts)));
        }
        Map<String, Rubrique> rs = new LinkedHashMap<>();
        for (Object o : (List<Object>) jr.get("rubriques")) {
            Map<String, Object> m = (Map<String, Object>) o;
            Rubrique r = new Rubrique(str(m, "code"), str(m, "libelle"), str(m, "type"), str(m, "mode"),
                    str(m, "coefParam"), Boolean.TRUE.equals(m.get("cnss")), Boolean.TRUE.equals(m.get("irpp")),
                    ((BigDecimal) m.get("ordre")).intValue(), str(m, "statut"));
            if (rs.put(r.code(), r) != null) throw new IllegalArgumentException("Rubrique en double : " + r.code());
        }
        Referentiel ref = new Referentiel(str(jp, "version"), ps, bs, rs);
        ref.verifierChevauchements();
        ref.srcParametres = jsonParametres;
        ref.srcRubriques = jsonRubriques;
        return ref;
    }

    // ---------- versions saisies dans l'application ----------

    /**
     * Nouvelle version datée d'un paramètre (code du fichier) ou d'un barème (code « BAREME:IRPP »),
     * saisie dans l'application. valeur pour un paramètre, tranches pour un barème.
     */
    public record Ajout(String code, LocalDate debut, LocalDate fin, String valeur, List<Tranche> tranches, String source, String note) { }

    /**
     * Référentiel = fichier de base + versions saisies. Règle commune Java/JS : pour chaque code, les versions
     * sont triées par date de début et la date de fin de chacune est ramenée à la veille de la suivante.
     * Les valeurs antérieures restent intactes (reproduction des bulletins historiques).
     */
    @SuppressWarnings("unchecked")
    public Referentiel avecAjouts(List<Ajout> ajouts, String suffixeVersion) {
        if (ajouts == null || ajouts.isEmpty()) return this;
        Map<String, Object> jp = (Map<String, Object>) Json.parse(srcParametres);
        List<Object> lp = (List<Object>) jp.get("parametres");
        List<Object> lb = (List<Object>) jp.get("baremes");
        for (Ajout a : ajouts) {
            Map<String, Object> m = new LinkedHashMap<>();
            if (a.code().startsWith("BAREME:")) {
                String code = a.code().substring(7);
                Map<String, Object> modele = dernier(lb, code);
                if (modele == null) throw new IllegalArgumentException("Barème inconnu : " + code);
                m.put("code", code);
                m.put("libelle", modele.get("libelle"));
                m.put("debut", a.debut().toString());
                m.put("fin", a.fin() == null ? null : a.fin().toString());
                m.put("statut", "A_CONFIRMER");
                m.put("source", a.source());
                List<Object> ts = new ArrayList<>();
                for (Tranche t : a.tranches()) {
                    Map<String, Object> tm = new LinkedHashMap<>();
                    tm.put("de", t.de().toPlainString());
                    tm.put("a", t.a() == null ? null : t.a().toPlainString());
                    tm.put("taux", t.taux().toPlainString());
                    ts.add(tm);
                }
                m.put("tranches", ts);
                lb.add(m);
            } else {
                Map<String, Object> modele = dernier(lp, a.code());
                if (modele == null) throw new IllegalArgumentException("Paramètre inconnu : " + a.code());
                m.put("code", a.code());
                m.put("libelle", modele.get("libelle"));
                m.put("type", modele.get("type"));
                m.put("valeur", a.valeur());
                m.put("debut", a.debut().toString());
                m.put("fin", a.fin() == null ? null : a.fin().toString());
                m.put("statut", "A_CONFIRMER");
                m.put("source", a.source());
                m.put("note", a.note());
                lp.add(m);
            }
        }
        chainer(lp);
        chainer(lb);
        jp.put("version", version + (suffixeVersion == null ? "" : suffixeVersion));
        return charger(Json.write(jp), srcRubriques);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> dernier(List<Object> l, String code) {
        Map<String, Object> r = null;
        for (Object o : l) {
            Map<String, Object> m = (Map<String, Object>) o;
            if (code.equals(m.get("code")) && (r == null || ((String) m.get("debut")).compareTo((String) r.get("debut")) > 0)) r = m;
        }
        return r;
    }

    /** Ramène la fin de chaque version à la veille de la version suivante du même code. */
    @SuppressWarnings("unchecked")
    private static void chainer(List<Object> l) {
        Map<String, List<Map<String, Object>>> parCode = new LinkedHashMap<>();
        for (Object o : l) {
            Map<String, Object> m = (Map<String, Object>) o;
            parCode.computeIfAbsent((String) m.get("code"), k -> new ArrayList<>()).add(m);
        }
        for (List<Map<String, Object>> v : parCode.values()) {
            v.sort((x, y) -> ((String) x.get("debut")).compareTo((String) y.get("debut")));
            for (int i = 0; i + 1 < v.size(); i++) {
                String veille = LocalDate.parse((String) v.get(i + 1).get("debut")).minusDays(1).toString();
                Object fin = v.get(i).get("fin");
                if (fin == null || ((String) fin).compareTo(veille) > 0) v.get(i).put("fin", veille);
            }
        }
    }

    private static void verifierTranches(String code, List<Tranche> ts) {
        BigDecimal attendu = BigDecimal.ZERO;
        for (int k = 0; k < ts.size(); k++) {
            Tranche t = ts.get(k);
            if (t.de().compareTo(attendu) != 0)
                throw new IllegalArgumentException("Barème " + code + " : tranches non contiguës à " + t.de());
            if (t.a() == null && k != ts.size() - 1)
                throw new IllegalArgumentException("Barème " + code + " : seule la dernière tranche peut être ouverte");
            attendu = t.a();
        }
        if (attendu != null) throw new IllegalArgumentException("Barème " + code + " : la dernière tranche doit être ouverte");
    }

    private void verifierChevauchements() {
        for (Parametre a : parametres)
            for (Parametre b : parametres)
                if (a != b && a.code().equals(b.code()) && chevauche(a.debut(), a.fin(), b.debut(), b.fin()))
                    throw new IllegalArgumentException("Périodes d'effet qui se chevauchent pour " + a.code());
        for (Bareme a : baremes)
            for (Bareme b : baremes)
                if (a != b && a.code().equals(b.code()) && chevauche(a.debut(), a.fin(), b.debut(), b.fin()))
                    throw new IllegalArgumentException("Périodes d'effet qui se chevauchent pour le barème " + a.code());
    }

    private static boolean chevauche(LocalDate d1, LocalDate f1, LocalDate d2, LocalDate f2) {
        return (f2 == null || !d1.isAfter(f2)) && (f1 == null || !d2.isAfter(f1));
    }

    private static String lireRessource(String nom) {
        try (InputStream in = Referentiel.class.getResourceAsStream("/tn/jas/paie/" + nom)) {
            Objects.requireNonNull(in, "Ressource introuvable : " + nom);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return null;
        return v instanceof BigDecimal bd ? bd.toPlainString() : v.toString();
    }

    private static LocalDate date(Map<String, Object> m, String k) {
        String v = str(m, k);
        return v == null ? null : LocalDate.parse(v);
    }

    static String canon(String valeur, String type) {
        if ("TEXTE".equals(type)) return valeur;
        return Dec.canon(new BigDecimal(valeur));
    }
}
