package tn.jas.paie.app.ui;

import java.awt.BorderLayout;
import java.awt.Desktop;
import java.awt.FlowLayout;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JEditorPane;
import javax.swing.JLabel;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.SpinnerNumberModel;

import tn.jas.paie.app.model.Modeles.Calcul;
import tn.jas.paie.app.model.Modeles.Entreprise;
import tn.jas.paie.app.model.Modeles.Periode;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.model.Modeles.StatutPeriode;
import tn.jas.paie.app.report.BulletinPdf;
import tn.jas.paie.app.report.Exports;
import tn.jas.paie.app.service.PaieService;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.app.ui.MainFrame.Ctx;
import tn.jas.paie.engine.ResultatPaie;

/** Workflow mensuel : périodes, simulation, contrôle, validation, clôture, bulletins et états. */
final class PaiePanel extends JPanel implements MainFrame.Rafraichissable {

    record LigneCalcul(Salarie s, Calcul k) {
        ResultatPaie r() { return ResultatPaie.depuisJson(k.json); }
    }

    private final Ctx ctx;
    private final Ui.Modele<Periode> mPer = new Ui.Modele<>(new String[]{"Période", "Statut", "Calculée par", "Validée par"},
            Periode::libelle, p -> p.statut.name(), p -> p.calculePar, p -> p.valideePar);
    private final JTable tPer = Ui.table(mPer);
    private final Ui.Modele<LigneCalcul> mCalc = new Ui.Modele<>(
            new String[]{"Matricule", "Nom", "V.", "Statut", "Brut", "CNSS sal.", "IRPP", "CSS", "Net à payer", "Coût employeur", "Certifié", "Alertes"},
            l -> l.s().matricule, l -> l.s().nomComplet(), l -> l.k().version, l -> l.k().statut,
            l -> l.k().brut, l -> l.k().cnssSal, l -> l.k().irpp, l -> l.k().css, l -> l.k().net, l -> l.k().coutEmployeur,
            l -> l.k().certifiable ? "oui" : "NON", l -> resumeAlertes(l.r()));
    private final JTable tCalc = Ui.table(mCalc);
    private final JEditorPane detail = new JEditorPane("text/html", "");
    private final JLabel totaux = new JLabel(" ");
    private final JButton bNouvelle = new JButton("Nouvelle période"), bSimuler = new JButton("Lancer la simulation"),
            bValider = new JButton("Valider la paie"), bCloturer = new JButton("Clôturer"), bRouvrir = new JButton("Rouvrir…"),
            bBulletins = new JButton("Bulletins PDF"), bEtats = new JButton("États CSV ▾"), bComparer = new JButton("Comparer avant/après");

    PaiePanel(Ctx ctx) {
        super(new BorderLayout(6, 6));
        this.ctx = ctx;
        setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));

        tPer.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        tPer.getSelectionModel().addListSelectionListener(e -> { if (!e.getValueIsAdjusting()) chargerCalculs(); });
        tCalc.getSelectionModel().addListSelectionListener(e -> { if (!e.getValueIsAdjusting()) afficherDetail(); });
        detail.setEditable(false);

        JPanel gauche = new JPanel(new BorderLayout(4, 4));
        gauche.add(Ui.titre("Périodes de paie"), BorderLayout.NORTH);
        gauche.add(new JScrollPane(tPer), BorderLayout.CENTER);
        gauche.add(bNouvelle, BorderLayout.SOUTH);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        for (JButton b : new JButton[]{bSimuler, bValider, bCloturer, bRouvrir, bComparer, bBulletins, bEtats}) actions.add(b);
        JPanel centreHaut = new JPanel(new BorderLayout(4, 4));
        centreHaut.add(actions, BorderLayout.NORTH);
        centreHaut.add(new JScrollPane(tCalc), BorderLayout.CENTER);
        centreHaut.add(totaux, BorderLayout.SOUTH);
        JSplitPane centre = new JSplitPane(JSplitPane.VERTICAL_SPLIT, centreHaut, new JScrollPane(detail));
        centre.setResizeWeight(0.5);

        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, gauche, centre);
        split.setDividerLocation(300);
        add(split, BorderLayout.CENTER);

        bNouvelle.addActionListener(e -> nouvellePeriode());
        bSimuler.addActionListener(e -> simuler());
        bValider.addActionListener(e -> valider());
        bCloturer.addActionListener(e -> Ui.essayer(this, () -> {
            Periode p = periode();
            if (p == null) return;
            if (!Ui.confirmer(this, "Clôturer " + p.libelle() + " ? Les données ne pourront plus être modifiées sans réouverture journalisée.")) return;
            ctx.service().cloturer(ctx.user(), p.id);
            rafraichir();
        }));
        bRouvrir.addActionListener(e -> Ui.essayer(this, () -> {
            Periode p = periode();
            if (p == null) return;
            String motif = JOptionPane.showInputDialog(this, "Motif de la réouverture de " + p.libelle() + " (obligatoire, journalisé) :",
                    "Réouverture", JOptionPane.WARNING_MESSAGE);
            if (motif == null) return;
            ctx.service().rouvrir(ctx.user(), p.id, motif);
            rafraichir();
        }));
        bComparer.addActionListener(e -> comparer());
        bBulletins.addActionListener(e -> bulletins());
        JPopupMenu menuEtats = new JPopupMenu();
        ajouterEtat(menuEtats, "Livre de paie", "LIVRE_PAIE");
        ajouterEtat(menuEtats, "État des cotisations CNSS", "ETAT_CNSS");
        ajouterEtat(menuEtats, "État des retenues IRPP / CSS", "ETAT_RETENUES");
        ajouterEtat(menuEtats, "État de paiement des salaires", "ETAT_PAIEMENT");
        bEtats.addActionListener(e -> menuEtats.show(bEtats, 0, bEtats.getHeight()));
        majBoutons();
    }

    @Override public void rafraichir() {
        Ui.essayer(this, () -> {
            Periode sel = periode();
            mPer.definir(ctx.service().dao().periodes());
            if (sel != null) {
                for (int i = 0; i < mPer.getRowCount(); i++)
                    if (mPer.ligne(i).id == sel.id) {
                        int v = tPer.convertRowIndexToView(i);
                        tPer.setRowSelectionInterval(v, v);
                    }
            } else if (mPer.getRowCount() > 0) tPer.setRowSelectionInterval(0, 0);
            chargerCalculs();
        });
    }

    private Periode periode() { return Ui.selection(tPer, mPer); }

    private void chargerCalculs() {
        Ui.essayer(this, () -> {
            Periode p = periode();
            List<LigneCalcul> l = new ArrayList<>();
            if (p != null) {
                Map<Integer, Salarie> sal = new HashMap<>();
                for (Salarie s : ctx.service().dao().salaries(null, false)) sal.put(s.id, s);
                for (Calcul k : ctx.service().dao().derniersCalculs(p.id))
                    if (!"REMPLACE".equals(k.statut) && sal.containsKey(k.salarieId)) l.add(new LigneCalcul(sal.get(k.salarieId), k));
            }
            mCalc.definir(l);
            BigDecimal brut = BigDecimal.ZERO, net = BigDecimal.ZERO, cout = BigDecimal.ZERO;
            int nonCert = 0;
            for (LigneCalcul x : l) {
                brut = brut.add(x.k().brut);
                net = net.add(x.k().net);
                cout = cout.add(x.k().coutEmployeur);
                if (!x.k().certifiable) nonCert++;
            }
            totaux.setText(l.isEmpty() ? (p == null ? "Créez une période pour commencer." : "Aucun calcul : lancez la simulation.")
                    : l.size() + " salarié(s)  •  Brut " + BulletinPdf.m(brut) + "  •  Net " + BulletinPdf.m(net)
                    + "  •  Coût employeur " + BulletinPdf.m(cout) + (nonCert > 0 ? "  •  ⚠ " + nonCert + " NON CERTIFIÉ(S)" : ""));
            detail.setText("");
            majBoutons();
        });
    }

    private void majBoutons() {
        Periode p = periode();
        StatutPeriode s = p == null ? null : p.statut;
        boolean calculs = mCalc.getRowCount() > 0;
        bNouvelle.setEnabled(ctx.peut(Droit.SIMULER));
        bSimuler.setEnabled(p != null && ctx.peut(Droit.SIMULER) && p.modifiable());
        bValider.setEnabled(s == StatutPeriode.CALCULEE && ctx.peut(Droit.VALIDER_PAIE));
        bCloturer.setEnabled(s == StatutPeriode.VALIDEE && ctx.peut(Droit.CLOTURER));
        bRouvrir.setEnabled((s == StatutPeriode.VALIDEE || s == StatutPeriode.CLOTUREE) && ctx.peut(Droit.ROUVRIR));
        bBulletins.setEnabled(calculs && ctx.peut(Droit.EXPORTER));
        bEtats.setEnabled(calculs && ctx.peut(Droit.EXPORTER));
        bComparer.setEnabled(calculs);
    }

    private void nouvellePeriode() {
        LocalDate auj = LocalDate.now();
        JSpinner an = new JSpinner(new SpinnerNumberModel(auj.getYear(), 2017, 2100, 1));
        an.setEditor(new JSpinner.NumberEditor(an, "#"));
        JSpinner mois = new JSpinner(new SpinnerNumberModel(auj.getMonthValue(), 1, 12, 1));
        if (JOptionPane.showConfirmDialog(this, Ui.formulaire("Année", an, "Mois", mois), "Nouvelle période",
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE) != JOptionPane.OK_OPTION) return;
        Ui.essayer(this, () -> {
            ctx.service().creerPeriode(ctx.user(), (Integer) an.getValue(), (Integer) mois.getValue());
            rafraichir();
        });
    }

    private void simuler() {
        Periode p = periode();
        if (p == null) return;
        Ui.essayer(this, () -> {
            PaieService.Traitement t = ctx.service().simuler(ctx.user(), p.id);
            long bloq = t.calculs().stream().filter(k -> ResultatPaie.depuisJson(k.json).bloquant()).count();
            StringBuilder m = new StringBuilder(t.calculs().size() + " salarié(s) calculé(s) pour " + p.libelle() + ".");
            if (bloq > 0) m.append("\n").append(bloq).append(" calcul(s) avec erreur bloquante : corriger avant validation.");
            for (String a : t.anomalies()) m.append("\n• ").append(a);
            rafraichir();
            Ui.info(this, m.toString());
        });
    }

    private void valider() {
        Periode p = periode();
        if (p == null) return;
        Ui.essayer(this, () -> {
            List<String> avert = ctx.service().controlerAvantValidation(ctx.user(), p.id);
            String msg = "Valider la paie de " + p.libelle() + " (" + mCalc.getRowCount() + " bulletin(s)) ?";
            if (!avert.isEmpty()) msg += "\n\nATTENTION – " + avert.size() + " bulletin(s) NON CERTIFIÉ(S) : des paramètres réglementaires "
                    + "n'ont pas été validés par un professionnel. Ils porteront la mention « NON CERTIFIÉ ».\n\n" + String.join("\n", avert.subList(0, Math.min(8, avert.size())));
            if (!Ui.confirmer(this, msg)) return;
            ctx.service().valider(ctx.user(), p.id);
            rafraichir();
        });
    }

    private void comparer() {
        LigneCalcul l = Ui.selection(tCalc, mCalc);
        if (l == null) { Ui.info(this, "Sélectionnez un salarié."); return; }
        Ui.essayer(this, () -> {
            List<String[]> e = ctx.service().comparer(l.k().periodeId, l.s().id);
            if (e.isEmpty()) { Ui.info(this, "Aucun écart entre les deux dernières versions de calcul (ou une seule version)."); return; }
            StringBuilder b = new StringBuilder("<html><b>" + l.s().nomComplet() + " – écarts version précédente → version " + l.k().version
                    + "</b><table cellpadding=3><tr><th align=left>Élément</th><th>Avant</th><th>Après</th><th>Écart</th></tr>");
            for (String[] x : e) b.append("<tr><td>").append(x[0]).append("</td><td align=right>").append(BulletinPdf.m(x[1]))
                    .append("</td><td align=right>").append(BulletinPdf.m(x[2])).append("</td><td align=right>").append(x[3]).append("</td></tr>");
            JOptionPane.showMessageDialog(this, b.append("</table></html>").toString(), "Comparaison avant / après", JOptionPane.INFORMATION_MESSAGE);
        });
    }

    private List<LigneCalcul> cibles() {
        int[] rows = tCalc.getSelectedRows();
        if (rows.length == 0) return mCalc.lignes();
        List<LigneCalcul> l = new ArrayList<>();
        for (int r : rows) l.add(mCalc.ligne(tCalc.convertRowIndexToModel(r)));
        return l;
    }

    private Path dossier(Periode p) throws java.io.IOException {
        Path d = ctx.documents().resolve(p.libelle());
        Files.createDirectories(d);
        return d;
    }

    private void bulletins() {
        Periode p = periode();
        if (p == null) return;
        Ui.essayer(this, () -> {
            List<LigneCalcul> l = cibles();
            Entreprise ent = ctx.service().dao().entreprise();
            Path d = dossier(p);
            for (LigneCalcul x : l) {
                Path f = d.resolve("BULLETIN_" + x.s().matricule.replaceAll("[^A-Za-z0-9_-]", "_") + "_" + p.libelle() + "_v" + x.k().version + ".pdf");
                BulletinPdf.generer(f, ent, x.s(), p, x.k());
                ctx.service().dao().archiverDocument(p.id, x.s().id, "BULLETIN", x.k().id, f.toString(), Exports.sha256(f), ctx.user().login);
            }
            ctx.service().dao().audit(ctx.user().login, "EXPORT", "BULLETIN", p.id, l.size() + " bulletin(s) " + p.libelle());
            ouvrir(d, l.size() + " bulletin(s) généré(s) et archivé(s) dans :\n" + d.toAbsolutePath());
        });
    }

    private void ajouterEtat(JPopupMenu menu, String libelle, String type) {
        JMenuItem i = new JMenuItem(libelle);
        i.addActionListener(e -> Ui.essayer(this, () -> {
            Periode p = periode();
            List<Exports.Ligne> l = new ArrayList<>();
            for (LigneCalcul x : mCalc.lignes()) l.add(new Exports.Ligne(x.s(), x.k()));
            Path f = dossier(p).resolve(type + "_" + p.libelle() + ".csv");
            switch (type) {
                case "LIVRE_PAIE" -> Exports.livreDePaie(f, p.libelle(), l);
                case "ETAT_CNSS" -> Exports.etatCnss(f, p.libelle(), l);
                case "ETAT_RETENUES" -> Exports.etatRetenues(f, p.libelle(), l);
                default -> Exports.etatPaiement(f, p.libelle(), l);
            }
            ctx.service().dao().archiverDocument(p.id, null, type, null, f.toString(), Exports.sha256(f), ctx.user().login);
            ctx.service().dao().audit(ctx.user().login, "EXPORT", type, p.id, p.libelle() + " (" + l.size() + " lignes)");
            ouvrir(f.getParent(), libelle + " exporté :\n" + f.toAbsolutePath()
                    + (p.statut == StatutPeriode.VALIDEE || p.statut == StatutPeriode.CLOTUREE ? "" : "\n\n(Période non validée : état provisoire)"));
        }));
        menu.add(i);
    }

    private void ouvrir(Path dossier, String message) {
        Ui.info(this, message);
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.OPEN)) Desktop.getDesktop().open(dossier.toFile());
        } catch (Exception ignore) { /* ouverture du dossier facultative */ }
    }

    private static String resumeAlertes(ResultatPaie r) {
        long err = r.alertes().stream().filter(a -> "ERREUR".equals(a.get("niveau"))).count();
        long av = r.alertes().stream().filter(a -> "AVERTISSEMENT".equals(a.get("niveau")) && !"NON_CERTIFIE".equals(a.get("code"))).count();
        return (err > 0 ? err + " erreur(s) " : "") + (av > 0 ? av + " avert." : "");
    }

    private void afficherDetail() {
        LigneCalcul l = Ui.selection(tCalc, mCalc);
        if (l == null) { detail.setText(""); return; }
        detail.setText(Detail.html(l.s(), l.k(), l.r()));
        detail.setCaretPosition(0);
    }
}
