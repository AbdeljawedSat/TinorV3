package tn.jas.paie.app.report;

import java.awt.Color;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;

import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Entreprise;
import tn.jas.paie.app.model.Modeles.Periode;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.engine.ResultatPaie;

/** Génération du bulletin de paie PDF (A4, PDFBox). */
public final class BulletinPdf {
    private BulletinPdf() { }

    private static final PDFont F = PDType1Font.HELVETICA;
    private static final PDFont FB = PDType1Font.HELVETICA_BOLD;
    private static final float M = 36, W = PDRectangle.A4.getWidth() - 2 * M;
    private static final Color ENCRE = new Color(33, 37, 41), GRIS = new Color(108, 117, 125),
            FOND = new Color(241, 243, 245), ACCENT = new Color(46, 94, 62), ROUGE = new Color(176, 0, 32);

    private static final DecimalFormat FMT;
    static {
        DecimalFormatSymbols sy = new DecimalFormatSymbols(Locale.FRANCE);
        sy.setGroupingSeparator(' ');
        sy.setDecimalSeparator(',');
        FMT = new DecimalFormat("#,##0.000", sy);
    }

    public static String m(Object v) {
        if (v == null) return "";
        return FMT.format(new BigDecimal(v.toString()));
    }

    @SuppressWarnings("unchecked")
    public static void generer(Path fichier, Entreprise ent, Salarie s, Periode p, Calcul k) throws IOException {
        ResultatPaie r = ResultatPaie.depuisJson(k.json);
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            float h = PDRectangle.A4.getHeight();
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = h - M;

                // En-tête entreprise
                texte(cs, FB, 13, M, y, ent.raisonSociale == null || ent.raisonSociale.isBlank() ? "(Entreprise non renseignée)" : ent.raisonSociale, ENCRE);
                y -= 14;
                texte(cs, F, 8.5f, M, y, "MF : " + nv(ent.matriculeFiscal) + "   N° employeur CNSS : " + nv(ent.numEmployeurCnss), GRIS);
                y -= 11;
                texte(cs, F, 8.5f, M, y, nv(ent.adresse), GRIS);

                String mois = Month.of(p.mois).getDisplayName(TextStyle.FULL, Locale.FRENCH);
                String titre = "BULLETIN DE PAIE";
                texteDroite(cs, FB, 14, M + W, h - M, titre, ACCENT);
                texteDroite(cs, F, 10, M + W, h - M - 15, cap(mois) + " " + p.annee, ENCRE);
                texteDroite(cs, F, 8, M + W, h - M - 27, "Version de calcul " + k.version + " – " + libelleStatut(k.statut), GRIS);
                y -= 18;

                // Bloc salarié
                rect(cs, M, y - 50, W, 50, FOND);
                float c1 = M + 8, c2 = M + W / 2 + 8;
                texte(cs, FB, 10, c1, y - 14, s.nom + " " + s.prenom, ENCRE);
                texte(cs, F, 8.5f, c1, y - 27, "Matricule : " + s.matricule + "   N° CNSS : " + nv(s.numCnss), ENCRE);
                texte(cs, F, 8.5f, c1, y - 39, "Fonction : " + nv(s.fonction) + "   Catégorie : " + nv(s.categorie), ENCRE);
                texte(cs, F, 8.5f, c2, y - 14, "Date d'entrée : " + (s.dateEntree == null ? "" : String.format("%02d/%02d/%04d", s.dateEntree.getDayOfMonth(), s.dateEntree.getMonthValue(), s.dateEntree.getYear())), ENCRE);
                texte(cs, F, 8.5f, c2, y - 27, "Situation : " + (s.chefFamille ? "chef de famille" : "non chef de famille")
                        + (s.chefFamille ? ", " + s.nbEnfants + " enfant(s)" : ""), ENCRE);
                Map<String, Object> fis = r.fiscal();
                texte(cs, F, 8.5f, c2, y - 39, "Paiement : " + nv(s.modePaiement), ENCRE);
                y -= 64;

                // Lignes de rémunération
                float[] col = {M, M + 92, M + 290, M + 345, M + 400, M + 465, M + W};
                y = entete(cs, y, col, new String[]{"Code", "Libellé", "Quantité", "Taux", "Gain", "Retenue"});
                for (Map<String, Object> l : r.lignes()) {
                    boolean ret = "RETENUE_BRUT".equals(l.get("type"));
                    y = ligne(cs, y, col, new String[]{(String) l.get("code"), (String) l.get("libelle"),
                            fr((String) l.get("quantite")), fr((String) l.get("taux")),
                            ret ? "" : m(l.get("montant")), ret ? m(l.get("montant")) : ""}, false);
                }
                y = ligne(cs, y, col, new String[]{"", "SALAIRE BRUT", "", "", m(r.synthese("brut")), ""}, true);
                y -= 8;

                // Cotisations
                float[] cc = {M, M + 150, M + 240, M + 300, M + 380, M + 440, M + W};
                y = entete(cs, y, cc, new String[]{"Cotisation", "Base", "Taux sal.", "Part salariale", "Taux pat.", "Part patronale"});
                for (Map<String, Object> c : r.cotisations()) {
                    y = ligne(cs, y, cc, new String[]{(String) c.get("libelle"), m(c.get("base")),
                            pct(c.get("tauxSalarial")), m(c.get("montantSalarial")),
                            pct(c.get("tauxPatronal")), m(c.get("montantPatronal"))}, false);
                }
                y = ligne(cs, y, cc, new String[]{"TOTAL", "", "", m(r.synthese("cnssSalarial")), "", m(r.synthese("chargesPatronales"))}, true);
                y -= 8;

                // Fiscalité
                float[] cf = {M, M + 330, M + W};
                y = entete(cs, y, cf, new String[]{"Retenues fiscales", "Montant"});
                y = ligne(cs, y, cf, new String[]{"Salaire imposable mensuel", m(fis.get("imposableMensuel"))}, false);
                y = ligne(cs, y, cf, new String[]{"Revenu net imposable annualisé (après frais pro. "
                        + m(fis.get("fraisProAnnuel")) + " et déductions " + m(fis.get("deductionsFamille")) + ")", m(fis.get("netImposableAnnuel"))}, false);
                y = ligne(cs, y, cf, new String[]{"IRPP du mois (annuel " + m(fis.get("irppAnnuel")) + " / 12)", m(r.synthese("irpp"))}, false);
                y = ligne(cs, y, cf, new String[]{"Contribution sociale de solidarité (CSS)", m(r.synthese("css"))}, false);
                for (Map<String, Object> rn : r.retenuesNet())
                    y = ligne(cs, y, cf, new String[]{(String) rn.get("libelle"), m(rn.get("montant"))}, false);
                y -= 12;

                // Net à payer
                rect(cs, M + W - 230, y - 34, 230, 34, ACCENT);
                texte(cs, FB, 10, M + W - 222, y - 14, "NET À PAYER", Color.WHITE);
                texteDroite(cs, FB, 15, M + W - 8, y - 26, m(r.synthese("netAPayer")) + " TND", Color.WHITE);
                texte(cs, F, 8, M, y - 12, "Coût employeur : " + m(r.synthese("coutEmployeur")) + " TND", GRIS);
                y -= 52;

                // Alertes
                List<Map<String, Object>> al = r.alertes();
                for (Map<String, Object> a : al) {
                    if (y < 90) break;
                    texte(cs, F, 7.5f, M, y, "• " + a.get("niveau") + " : " + a.get("message"),
                            "ERREUR".equals(a.get("niveau")) ? ROUGE : GRIS);
                    y -= 10;
                }

                // Pied de page
                texte(cs, F, 7, M, M, "Moteur " + k.moteur + " – paramètres " + k.paramsVersion + " – calculé par " + nv(k.calculePar)
                        + (k.calculeLe == null ? "" : " le " + k.calculeLe.toLocalDate()) + ". Document à conserver sans limitation de durée.", GRIS);

                // Filigranes
                if (!k.certifiable) filigrane(cs, "NON CERTIFIÉ – paramètres à confirmer", h);
                else if (!"VALIDE".equals(k.statut)) filigrane(cs, "SIMULATION – document provisoire", h);
            }
            doc.save(fichier.toFile());
        }
    }

    private static String libelleStatut(String s) {
        return switch (s) {
            case "VALIDE" -> "validée";
            case "SIMULATION" -> "simulation";
            default -> s.toLowerCase(Locale.ROOT);
        };
    }

    private static String pct(Object t) {
        if (t == null) return "";
        return new BigDecimal(t.toString()).movePointRight(2).stripTrailingZeros().toPlainString().replace('.', ',') + " %";
    }

    private static String nv(String s) { return s == null ? "" : s; }

    private static String fr(String s) { return s == null ? "" : s.replace('.', ','); }

    private static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1); }

    private static float entete(PDPageContentStream cs, float y, float[] col, String[] t) throws IOException {
        rect(cs, col[0], y - 15, col[col.length - 1] - col[0], 15, ACCENT);
        for (int i = 0; i < t.length; i++) {
            if (i >= 2 || (i == t.length - 1 && i > 0)) texteDroite(cs, FB, 8, col[i + 1] - 4, y - 11, t[i], Color.WHITE);
            else texte(cs, FB, 8, col[i] + 4, y - 11, t[i], Color.WHITE);
        }
        return y - 15;
    }

    private static float ligne(PDPageContentStream cs, float y, float[] col, String[] t, boolean gras) throws IOException {
        if (gras) rect(cs, col[0], y - 14, col[col.length - 1] - col[0], 14, FOND);
        PDFont f = gras ? FB : F;
        for (int i = 0; i < t.length; i++) {
            if (t[i] == null || t[i].isEmpty()) continue;
            String v = ajuster(f, 8, t[i], col[i + 1] - col[i] - 8);
            if (i >= 2 || (col.length == 3 && i == 1)) texteDroite(cs, f, 8, col[i + 1] - 4, y - 10, v, ENCRE);
            else texte(cs, f, 8, col[i] + 4, y - 10, v, ENCRE);
        }
        cs.setStrokingColor(new Color(222, 226, 230));
        cs.moveTo(col[0], y - 14);
        cs.lineTo(col[col.length - 1], y - 14);
        cs.stroke();
        return y - 14;
    }

    private static String ajuster(PDFont f, float taille, String s, float largeur) throws IOException {
        s = propre(f, s);
        if (f.getStringWidth(s) / 1000 * taille <= largeur) return s;
        while (s.length() > 1 && f.getStringWidth(s + "…") / 1000 * taille > largeur) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    private static void filigrane(PDPageContentStream cs, String t, float h) throws IOException {
        PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
        gs.setNonStrokingAlphaConstant(0.13f);
        cs.saveGraphicsState();
        cs.setGraphicsStateParameters(gs);
        cs.beginText();
        cs.setFont(FB, 28);
        cs.setNonStrokingColor(ROUGE);
        cs.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(35), 70, h / 2 - 230));
        cs.showText(propre(FB, t));
        cs.endText();
        cs.restoreGraphicsState();
    }

    private static void rect(PDPageContentStream cs, float x, float y, float w, float h, Color c) throws IOException {
        cs.setNonStrokingColor(c);
        cs.addRect(x, y, w, h);
        cs.fill();
    }

    private static void texte(PDPageContentStream cs, PDFont f, float t, float x, float y, String s, Color c) throws IOException {
        cs.beginText();
        cs.setFont(f, t);
        cs.setNonStrokingColor(c);
        cs.newLineAtOffset(x, y);
        cs.showText(propre(f, s));
        cs.endText();
    }

    private static void texteDroite(PDPageContentStream cs, PDFont f, float t, float xDroite, float y, String s, Color c) throws IOException {
        String p = propre(f, s);
        texte(cs, f, t, xDroite - f.getStringWidth(p) / 1000 * t, y, p, c);
    }

    /** Remplace les caractères non représentables dans la police standard (WinAnsi). */
    static String propre(PDFont f, String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == '\n' || ch == '\r' || ch == '\t') { b.append(' '); continue; }
            if (ch == ' ' || ch == ' ') { b.append(' '); continue; }
            try {
                f.encode(String.valueOf(ch));
                b.append(ch);
            } catch (IOException | IllegalArgumentException e) {
                b.append('?');
            }
        }
        return b.toString();
    }
}
