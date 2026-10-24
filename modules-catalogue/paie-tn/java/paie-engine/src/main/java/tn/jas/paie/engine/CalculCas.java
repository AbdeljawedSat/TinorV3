package tn.jas.paie.engine;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Outil en ligne de commande : calcule un fichier de cas (format shared/tests/cas-equivalence.json)
 * et écrit les résultats en JSON. Sert à la vérification d'équivalence Java / JS.
 *
 * Usage : java -cp paie-engine.jar tn.jas.paie.engine.CalculCas cas.json resultats.json
 */
public final class CalculCas {
    private CalculCas() { }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage : CalculCas <cas.json> <resultats.json>");
            System.exit(2);
        }
        Map<String, Object> racine = (Map<String, Object>) Json.parse(Files.readString(Path.of(args[0]), StandardCharsets.UTF_8));
        MoteurPaie moteur = new MoteurPaie(Referentiel.charger());
        List<Object> sortie = new ArrayList<>();
        for (Object o : (List<Object>) racine.get("cas")) {
            Map<String, Object> cas = (Map<String, Object>) o;
            ResultatPaie r = moteur.calculer(EntreePaie.depuisMap((Map<String, Object>) cas.get("entree")));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", cas.get("id"));
            m.put("resultat", r.donnees());
            sortie.add(m);
        }
        Files.writeString(Path.of(args[1]), Json.write(Map.of("resultats", sortie)) + "\n", StandardCharsets.UTF_8);
        System.out.println(sortie.size() + " cas calculés -> " + args[1]);
    }
}
