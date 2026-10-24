package tn.jas.paie.app.ui;

import java.util.Map;

import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.report.BulletinPdf;
import tn.jas.paie.engine.ResultatPaie;

/** Détail transparent d'un calcul, en HTML pour les panneaux Swing. */
final class Detail {
    private Detail() { }

    private static String e(Object o) {
        if (o == null) return "";
        return o.toString().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String m(Object o) { return o == null ? "" : BulletinPdf.m(o); }

    static String html(Salarie s, Calcul k, ResultatPaie r) {
        StringBuilder b = new StringBuilder("<html><body style='font-family:sans-serif;font-size:11px'>");
        b.append("<b style='font-size:13px'>").append(e(s == null ? r.donnees().get("matricule") : s.nomComplet())).append("</b>");
        if (k != null) b.append(" — version ").append(k.version).append(" (").append(e(k.statut)).append(")");
        b.append(r.certifiable() ? " — <span style='color:#2e5e3e'>certifiable</span>" : " — <span style='color:#b00020'><b>NON CERTIFIÉ</b></span>");

        if (!r.alertes().isEmpty()) {
            b.append("<ul>");
            for (Map<String, Object> a : r.alertes()) {
                String c = "ERREUR".equals(a.get("niveau")) ? "#b00020" : "#8a6d00";
                b.append("<li style='color:").append(c).append("'>").append(e(a.get("niveau"))).append(" : ").append(e(a.get("message"))).append("</li>");
            }
            b.append("</ul>");
        }

        b.append("<table cellpadding=2 cellspacing=0 border=0><tr><td valign=top>");
        b.append("<b>Rémunération</b><table cellpadding=2>");
        for (Map<String, Object> l : r.lignes()) {
            boolean ret = "RETENUE_BRUT".equals(l.get("type"));
            b.append("<tr><td>").append(e(l.get("libelle")));
            if (l.get("quantite") != null) b.append(" (").append(e(l.get("quantite"))).append(l.get("taux") != null ? " × " + e(l.get("taux")) : "").append(")");
            b.append("</td><td align=right>").append(ret ? "−" : "").append(m(l.get("montant"))).append("</td></tr>");
        }
        b.append("<tr><td><b>Brut</b></td><td align=right><b>").append(m(r.synthese("brut"))).append("</b></td></tr></table>");

        b.append("<br><b>Cotisations</b><table cellpadding=2><tr><td></td><td>Base</td><td>Salarié</td><td>Employeur</td></tr>");
        for (Map<String, Object> c : r.cotisations())
            b.append("<tr><td>").append(e(c.get("libelle"))).append("</td><td align=right>").append(m(c.get("base")))
                    .append("</td><td align=right>").append(m(c.get("montantSalarial"))).append("</td><td align=right>")
                    .append(m(c.get("montantPatronal"))).append("</td></tr>");
        b.append("</table></td><td width=24></td><td valign=top>");

        Map<String, Object> f = r.fiscal();
        b.append("<b>Fiscalité (annualisation)</b><table cellpadding=2>");
        String[][] lf = {{"CNSS déductible", "cnssDeductible"}, {"Imposable mensuel", "imposableMensuel"}, {"Imposable annualisé", "imposableAnnuel"},
                {"Frais professionnels", "fraisProAnnuel"}, {"Déductions famille", "deductionsFamille"}, {"Net imposable annuel", "netImposableAnnuel"},
                {"IRPP annuel", "irppAnnuel"}, {"IRPP du mois", "irppMensuel"}, {"CSS annuelle", "cssAnnuel"}, {"CSS du mois", "cssMensuel"}};
        for (String[] x : lf) b.append("<tr><td>").append(x[0]).append("</td><td align=right>").append(m(f.get(x[1]))).append("</td></tr>");
        b.append("</table><br><b>Synthèse</b><table cellpadding=2>");
        for (Map<String, Object> rn : r.retenuesNet())
            b.append("<tr><td>").append(e(rn.get("libelle"))).append("</td><td align=right>−").append(m(rn.get("montant"))).append("</td></tr>");
        b.append("<tr><td><b>Net à payer</b></td><td align=right><b>").append(m(r.synthese("netAPayer"))).append("</b></td></tr>");
        b.append("<tr><td>Charges patronales</td><td align=right>").append(m(r.synthese("chargesPatronales"))).append("</td></tr>");
        b.append("<tr><td>Coût employeur</td><td align=right>").append(m(r.synthese("coutEmployeur"))).append("</td></tr></table>");
        b.append("</td></tr></table>");

        b.append("<br><b>Éléments réglementaires utilisés</b><table cellpadding=2>");
        for (Map<String, Object> p : r.parametres()) {
            boolean ok = Boolean.TRUE.equals(p.get("valide"));
            String v = String.valueOf(p.get("valeur"));
            if (v.length() > 60) v = v.substring(0, 60) + "…";
            b.append("<tr><td>").append(e(p.get("code"))).append("</td><td>").append(e(v)).append("</td><td style='color:")
                    .append(ok ? "#2e5e3e'>validé" : "#b00020'>à confirmer").append("</td></tr>");
        }
        b.append("</table><p style='color:#6c757d'>Moteur ").append(e(r.donnees().get("moteur"))).append(" – paramètres ")
                .append(e(r.donnees().get("paramsVersion"))).append("</p></body></html>");
        return b.toString();
    }
}
