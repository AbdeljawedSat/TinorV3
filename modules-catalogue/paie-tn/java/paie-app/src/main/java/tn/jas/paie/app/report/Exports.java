package tn.jas.paie.app.report;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.engine.ResultatPaie;

/**
 * États récapitulatifs au format CSV (séparateur « ; », UTF-8 avec BOM : s'ouvre directement dans Excel).
 * Ce ne sont PAS des fichiers déclaratifs officiels CNSS / DGI : leur format exact reste à confirmer.
 */
public final class Exports {
    private Exports() { }

    public record Ligne(Salarie salarie, Calcul calcul) { }

    public static void livreDePaie(Path f, String periode, List<Ligne> lignes) throws IOException {
        StringBuilder b = new StringBuilder("﻿");
        b.append("Période;Matricule;Nom;Prénom;Brut;Base CNSS;CNSS salarié;Imposable mensuel;IRPP;CSS;Retenues nettes;Net à payer;Charges patronales;Coût employeur;Version;Statut;Certifiable\n");
        BigDecimal[] t = new BigDecimal[10];
        java.util.Arrays.fill(t, BigDecimal.ZERO);
        for (Ligne l : lignes) {
            ResultatPaie r = ResultatPaie.depuisJson(l.calcul().json);
            @SuppressWarnings("unchecked")
            Map<String, Object> tot = (Map<String, Object>) r.donnees().get("totaux");
            String[] v = {r.synthese("brut"), (String) tot.get("baseCnss"), r.synthese("cnssSalarial"),
                    (String) r.fiscal().get("imposableMensuel"), r.synthese("irpp"), r.synthese("css"),
                    r.synthese("totalRetenuesNet"), r.synthese("netAPayer"), r.synthese("chargesPatronales"), r.synthese("coutEmployeur")};
            b.append(periode).append(';').append(c(l.salarie().matricule)).append(';').append(c(l.salarie().nom)).append(';')
                    .append(c(l.salarie().prenom));
            for (int i = 0; i < v.length; i++) {
                b.append(';').append(n(v[i]));
                t[i] = t[i].add(new BigDecimal(v[i]));
            }
            b.append(';').append(l.calcul().version).append(';').append(l.calcul().statut).append(';')
                    .append(l.calcul().certifiable ? "oui" : "NON").append('\n');
        }
        b.append(periode).append(";TOTAL;;");
        for (BigDecimal x : t) b.append(';').append(n(x.toPlainString()));
        b.append(";;;\n");
        Files.writeString(f, b.toString(), StandardCharsets.UTF_8);
    }

    /** État des cotisations sociales (aide à la préparation de la déclaration trimestrielle CNSS). */
    public static void etatCnss(Path f, String periode, List<Ligne> lignes) throws IOException {
        StringBuilder b = new StringBuilder("﻿");
        b.append("Période;Matricule;N° CNSS;Nom;Prénom;Base;Cotisation salariale;Cotisation patronale CNSS+PE;Accident du travail\n");
        for (Ligne l : lignes) {
            ResultatPaie r = ResultatPaie.depuisJson(l.calcul().json);
            BigDecimal sal = BigDecimal.ZERO, pat = BigDecimal.ZERO, at = BigDecimal.ZERO;
            String base = "0.000";
            for (Map<String, Object> c : r.cotisations()) {
                String code = (String) c.get("code");
                if ("CNSS".equals(code) || "PERTE_EMPLOI".equals(code)) {
                    base = (String) c.get("base");
                    sal = sal.add(new BigDecimal((String) c.get("montantSalarial")));
                    pat = pat.add(new BigDecimal((String) c.get("montantPatronal")));
                } else if ("AT".equals(code)) at = new BigDecimal((String) c.get("montantPatronal"));
            }
            b.append(periode).append(';').append(c(l.salarie().matricule)).append(';').append(c(l.salarie().numCnss)).append(';')
                    .append(c(l.salarie().nom)).append(';').append(c(l.salarie().prenom)).append(';').append(n(base)).append(';')
                    .append(n(sal.toPlainString())).append(';').append(n(pat.toPlainString())).append(';').append(n(at.toPlainString())).append('\n');
        }
        Files.writeString(f, b.toString(), StandardCharsets.UTF_8);
    }

    /** État des retenues à la source IRPP et CSS. */
    public static void etatRetenues(Path f, String periode, List<Ligne> lignes) throws IOException {
        StringBuilder b = new StringBuilder("﻿");
        b.append("Période;Matricule;Nom;Prénom;Brut;Imposable mensuel;Net imposable annualisé;IRPP retenu;CSS retenue\n");
        for (Ligne l : lignes) {
            ResultatPaie r = ResultatPaie.depuisJson(l.calcul().json);
            b.append(periode).append(';').append(c(l.salarie().matricule)).append(';').append(c(l.salarie().nom)).append(';')
                    .append(c(l.salarie().prenom)).append(';').append(n(r.synthese("brut"))).append(';')
                    .append(n((String) r.fiscal().get("imposableMensuel"))).append(';')
                    .append(n((String) r.fiscal().get("netImposableAnnuel"))).append(';')
                    .append(n(r.synthese("irpp"))).append(';').append(n(r.synthese("css"))).append('\n');
        }
        Files.writeString(f, b.toString(), StandardCharsets.UTF_8);
    }

    /** Ordre de virement interne (état de paiement des salaires). */
    public static void etatPaiement(Path f, String periode, List<Ligne> lignes) throws IOException {
        StringBuilder b = new StringBuilder("﻿");
        b.append("Période;Matricule;Nom;Prénom;Mode de paiement;RIB;Net à payer\n");
        BigDecimal tot = BigDecimal.ZERO;
        for (Ligne l : lignes) {
            String net = ResultatPaie.depuisJson(l.calcul().json).synthese("netAPayer");
            tot = tot.add(new BigDecimal(net));
            b.append(periode).append(';').append(c(l.salarie().matricule)).append(';').append(c(l.salarie().nom)).append(';')
                    .append(c(l.salarie().prenom)).append(';').append(c(l.salarie().modePaiement)).append(';')
                    .append(c(l.salarie().rib)).append(';').append(n(net)).append('\n');
        }
        b.append(periode).append(";TOTAL;;;;;").append(n(tot.toPlainString())).append('\n');
        Files.writeString(f, b.toString(), StandardCharsets.UTF_8);
    }

    public static String sha256(Path f) throws IOException {
        try (InputStream in = Files.newInputStream(f)) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            return HexFormat.of().formatHex(md.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Nombre au format français (virgule décimale) pour Excel FR. */
    private static String n(String v) { return v == null ? "" : v.replace('.', ','); }

    /** Cellule texte protégée (guillemets, et neutralisation des formules). */
    private static String c(String v) {
        if (v == null) return "";
        String s = v;
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        if (s.contains(";") || s.contains("\"") || s.contains("\n")) s = "\"" + s.replace("\"", "\"\"") + "\"";
        return s;
    }
}
