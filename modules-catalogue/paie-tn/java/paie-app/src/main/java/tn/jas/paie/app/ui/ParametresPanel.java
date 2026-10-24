package tn.jas.paie.app.ui;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.table.DefaultTableModel;

import tn.jas.paie.app.model.Modeles.Validation;
import tn.jas.paie.app.model.Modeles.VersionParam;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.app.ui.MainFrame.Ctx;
import tn.jas.paie.engine.Dec;
import tn.jas.paie.engine.Referentiel;

/**
 * Paramètres réglementaires et barèmes : consultation, modification par versions datées (ADMIN)
 * et validation par un professionnel (VALIDEUR / ADMIN).
 * Modifier un taux ou un barème = ajouter une nouvelle version avec sa date d'effet : l'historique est conservé
 * et les périodes déjà validées ne changent jamais.
 */
final class ParametresPanel extends JPanel implements MainFrame.Rafraichissable {

    record Element(String code, String libelle, String type, String valeur, LocalDate debut, LocalDate fin,
                   String statut, String source, String note, List<Referentiel.Tranche> tranches) { }

    private final Ctx ctx;
    private final Map<String, Validation> validations = new HashMap<>();
    private final Map<String, VersionParam> saisies = new HashMap<>();
    private final Ui.Modele<Element> m;
    private final JTable t;
    private final JTextArea info = new JTextArea(6, 40);
    private final JComboBox<String> filtre = new JComboBox<>(new String[]{"En vigueur aujourd'hui", "Toutes les versions (historique)"});
    private final JLabel avert = new JLabel();

    ParametresPanel(Ctx ctx) {
        super(new BorderLayout(6, 6));
        this.ctx = ctx;
        setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        m = new Ui.Modele<>(new String[]{"Code", "Libellé", "Valeur", "Début", "Fin", "Origine", "Validation", "Validé par"},
                e -> e.code(), e -> e.libelle(), e -> affichage(e), e -> Ui.txt(e.debut()), e -> Ui.txt(e.fin()),
                e -> saisie(e) == null ? "Fichier" : "Saisie (" + saisie(e).creePar + ")",
                e -> validation(e) != null ? "VALIDÉ" : "À CONFIRMER",
                e -> validation(e) == null ? "" : validation(e).validePar + " (" + validation(e).valideLe.toLocalDate() + ")");
        t = Ui.table(m);
        t.getColumnModel().getColumn(1).setPreferredWidth(320);
        t.getColumnModel().getColumn(2).setPreferredWidth(220);
        t.getSelectionModel().addListSelectionListener(e -> { if (!e.getValueIsAdjusting()) majInfo(); });
        info.setEditable(false);
        info.setLineWrap(true);
        info.setWrapStyleWord(true);

        JPanel haut = new JPanel(new BorderLayout(6, 6));
        haut.add(avert, BorderLayout.CENTER);
        JPanel f = new JPanel(new FlowLayout(FlowLayout.LEFT));
        f.add(new JLabel("Afficher :"));
        f.add(filtre);
        haut.add(f, BorderLayout.SOUTH);
        filtre.addActionListener(e -> rafraichir());
        add(haut, BorderLayout.NORTH);

        JButton bModifier = new JButton("Nouvelle valeur / nouveau barème…"), bSupprimer = new JButton("Supprimer la version saisie"),
                bValider = new JButton("Valider l'élément…"), bRetirer = new JButton("Retirer la validation");
        bModifier.setToolTipText("Crée une nouvelle version datée : l'ancienne valeur reste appliquée aux périodes antérieures");
        bModifier.setEnabled(ctx.peut(Droit.MODIFIER_PARAMETRES));
        bSupprimer.setEnabled(ctx.peut(Droit.MODIFIER_PARAMETRES));
        bValider.setEnabled(ctx.peut(Droit.VALIDER_PARAMETRES));
        bRetirer.setEnabled(ctx.peut(Droit.VALIDER_PARAMETRES));
        bModifier.addActionListener(e -> nouvelleVersion());
        bSupprimer.addActionListener(e -> supprimer());
        bValider.addActionListener(e -> valider());
        bRetirer.addActionListener(e -> retirer());
        JPanel bas = new JPanel(new BorderLayout());
        JPanel bb = new JPanel(new FlowLayout(FlowLayout.LEFT));
        bb.add(bModifier);
        bb.add(bSupprimer);
        bb.add(new JLabel("   "));
        bb.add(bValider);
        bb.add(bRetirer);
        bas.add(bb, BorderLayout.NORTH);
        bas.add(new JScrollPane(info), BorderLayout.CENTER);
        JSplitPane split = new JSplitPane(JSplitPane.VERTICAL_SPLIT, new JScrollPane(t), bas);
        split.setResizeWeight(0.72);
        add(split, BorderLayout.CENTER);
        rafraichir();
    }

    // ---------- affichage ----------

    static String pct(BigDecimal v) { return v.movePointRight(2).stripTrailingZeros().toPlainString().replace('.', ',') + " %"; }

    private static String affichage(Element e) {
        if (e.tranches() != null) {
            StringBuilder b = new StringBuilder();
            for (Referentiel.Tranche x : e.tranches()) {
                if (b.length() > 0) b.append(" · ");
                b.append(pct(x.taux()));
            }
            return e.tranches().size() + " tranches : " + b;
        }
        if ("TAUX".equals(e.type())) return pct(new BigDecimal(e.valeur()));
        if ("MONTANT".equals(e.type())) return new BigDecimal(e.valeur()).toPlainString() + " TND";
        if ("COEF".equals(e.type())) return "× " + e.valeur().replace('.', ',');
        return e.valeur();
    }

    private static String cle(Element e) { return e.code() + "@" + e.debut(); }

    private VersionParam saisie(Element e) { return saisies.get(cle(e)); }

    private Validation validation(Element e) {
        Validation v = validations.get(cle(e));
        if (v == null) return null;
        return canon(v.valeur).equals(canon(e.valeur())) ? v : null;
    }

    private static String canon(String s) {
        try {
            return Dec.canon(new BigDecimal(s.trim()));
        } catch (NumberFormatException ex) {
            return s.trim();
        }
    }

    @Override public void rafraichir() {
        Ui.essayer(this, () -> {
            validations.clear();
            for (Validation v : ctx.service().dao().validations()) validations.put(v.code + "@" + v.debut, v);
            saisies.clear();
            for (VersionParam v : ctx.service().dao().versionsParametres()) saisies.put(v.code + "@" + v.debut, v);
            Referentiel ref = ctx.service().referentiel();
            boolean actuels = filtre.getSelectedIndex() == 0;
            LocalDate auj = LocalDate.now();
            List<Element> l = new ArrayList<>();
            for (Referentiel.Parametre p : ref.parametres())
                if (!actuels || p.enVigueur(auj))
                    l.add(new Element(p.code(), p.libelle(), p.type(), p.valeurCanonique(), p.debut(), p.fin(), p.statut(), p.source(), p.note(), null));
            for (Referentiel.Bareme b : ref.baremes())
                if (!actuels || b.enVigueur(auj))
                    l.add(new Element("BAREME:" + b.code(), b.libelle(), "BAREME", b.valeurCanonique(), b.debut(), b.fin(), b.statut(), b.source(), "", b.tranches()));
            if (!actuels)
                for (Referentiel.Rubrique r : ref.rubriques().values())
                    l.add(new Element("RUB:" + r.code(), "Rubrique : " + r.libelle(), "RUBRIQUE", r.valeurCanonique(), Referentiel.DEBUT_RUBRIQUE, null,
                            r.statut(), "Catalogue des rubriques (type|mode|soumis CNSS|soumis IRPP|coefficient)", "", null));
            l.sort((a, b) -> a.code().equals(b.code()) ? a.debut().compareTo(b.debut()) : a.code().compareTo(b.code()));
            m.definir(l);
            long nv = l.stream().filter(e -> validation(e) == null).count();
            avert.setText("<html><b>Modifier un taux ou un barème</b> = ajouter une nouvelle version avec sa date d'effet (rôle ADMIN). "
                    + "L'ancienne valeur reste appliquée aux mois précédents et les périodes validées ne changent jamais. "
                    + "Une nouvelle valeur est « À CONFIRMER » jusqu'à sa validation par un professionnel. "
                    + "<br>Référentiel " + ref.version() + " – " + nv + " élément(s) affiché(s) non validé(s).</html>");
            majInfo();
        });
    }

    private void majInfo() {
        Element e = Ui.selection(t, m);
        if (e == null) { info.setText("Sélectionnez un paramètre ou un barème."); return; }
        Validation v = validation(e);
        VersionParam s = saisie(e);
        StringBuilder b = new StringBuilder(e.code() + " – " + e.libelle() + "\n");
        if (e.tranches() != null) {
            b.append("Tranches :\n");
            for (Referentiel.Tranche x : e.tranches())
                b.append("   ").append(x.de().toPlainString()).append(" à ").append(x.a() == null ? "…" : x.a().toPlainString())
                        .append(" TND : ").append(pct(x.taux())).append('\n');
        } else b.append("Valeur : ").append(affichage(e)).append("   (valeur stockée : ").append(e.valeur()).append(")\n");
        b.append("Effet : du ").append(Ui.txt(e.debut())).append(e.fin() == null ? " (sans date de fin)" : " au " + Ui.txt(e.fin())).append('\n');
        b.append("Source : ").append(e.source()).append('\n');
        if (e.note() != null && !e.note().isBlank()) b.append("Note : ").append(e.note()).append('\n');
        if (s != null) b.append("Saisie par ").append(s.creePar).append(" le ").append(s.creeLe).append('\n');
        b.append(v == null ? "État : À CONFIRMER" : "État : VALIDÉ par " + v.validePar + " le " + v.valideLe + " – référence : " + v.reference);
        info.setText(b.toString());
        info.setCaretPosition(0);
    }

    // ---------- modification ----------

    private static LocalDate premierMoisSuivant() { return LocalDate.now().withDayOfMonth(1).plusMonths(1); }

    private void nouvelleVersion() {
        Element e = Ui.selection(t, m);
        if (e == null || "RUBRIQUE".equals(e.type())) { Ui.info(this, "Sélectionnez un paramètre ou un barème (les rubriques ne sont pas modifiables ici)."); return; }
        if (e.tranches() != null) nouveauBareme(e); else nouvelleValeur(e);
    }

    private void nouvelleValeur(Element e) {
        boolean taux = "TAUX".equals(e.type());
        JTextField valeur = new JTextField(taux ? pct(new BigDecimal(e.valeur())).replace(" %", "") : e.valeur(), 12);
        JTextField debut = new JTextField(Ui.txt(premierMoisSuivant()), 10), fin = new JTextField(10),
                source = new JTextField(34), note = new JTextField(34);
        JPanel f = Ui.formulaire(
                "Paramètre", new JLabel(e.code() + " – " + e.libelle()),
                "Valeur actuelle", new JLabel(affichage(e) + "  (depuis le " + Ui.txt(e.debut()) + ")"),
                taux ? "Nouveau taux (en %) *" : "Nouvelle valeur" + ("MONTANT".equals(e.type()) ? " (TND)" : "") + " *", valeur,
                "Date d'effet * (1er du mois)", debut,
                "Date de fin (facultatif)", fin,
                "Texte officiel de référence *", source,
                "Note", note);
        while (JOptionPane.showConfirmDialog(this, f, "Nouvelle valeur datée", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            try {
                String v = valeur.getText().trim();
                if (taux) {
                    BigDecimal p = Ui.dec(v.replace("%", ""), "Taux");
                    if (p == null) throw new IllegalArgumentException("Taux obligatoire");
                    v = p.movePointLeft(2).toPlainString();
                } else if (!"TEXTE".equals(e.type())) {
                    BigDecimal d = Ui.dec(v, "Valeur");
                    v = d == null ? "" : d.toPlainString();
                }
                LocalDate d = Ui.date(debut.getText(), "Date d'effet");
                if (!Ui.confirmer(this, "Appliquer " + e.code() + " = " + (taux ? valeur.getText().trim() + " %" : v) + " à partir du " + Ui.txt(d)
                        + " ?\nLa valeur actuelle reste appliquée avant cette date.")) continue;
                ctx.service().ajouterVersionParametre(ctx.user(), e.code(), d, Ui.date(fin.getText(), "Date de fin"), v, source.getText(), note.getText());
                rafraichir();
                Ui.info(this, "Nouvelle version enregistrée. Elle reste « À CONFIRMER » jusqu'à validation, et les simulations en cours doivent être relancées.");
                return;
            } catch (Exception ex) {
                Ui.erreur(this, ex);
            }
        }
    }

    private void nouveauBareme(Element e) {
        DefaultTableModel tm = new DefaultTableModel(new String[]{"De (TND)", "À (TND, vide = sans limite)", "Taux (%)"}, 0);
        for (Referentiel.Tranche x : e.tranches())
            tm.addRow(new Object[]{x.de().toPlainString(), x.a() == null ? "" : x.a().toPlainString(), pct(x.taux()).replace(" %", "")});
        JTable tt = new JTable(tm);
        tt.setRowHeight(22);
        tt.putClientProperty("terminateEditOnFocusLost", Boolean.TRUE);
        JScrollPane sp = new JScrollPane(tt);
        sp.setPreferredSize(new Dimension(520, 230));
        JButton ajout = new JButton("+ Tranche"), retrait = new JButton("− Dernière tranche");
        ajout.addActionListener(a -> {
            int n = tm.getRowCount();
            String de = n == 0 ? "0" : String.valueOf(tm.getValueAt(n - 1, 1));
            tm.addRow(new Object[]{de, "", ""});
        });
        retrait.addActionListener(a -> { if (tm.getRowCount() > 1) tm.removeRow(tm.getRowCount() - 1); });
        JTextField debut = new JTextField(Ui.txt(premierMoisSuivant()), 10), fin = new JTextField(10), source = new JTextField(34), note = new JTextField(34);
        JPanel boutons = new JPanel(new FlowLayout(FlowLayout.LEFT));
        boutons.add(ajout);
        boutons.add(retrait);
        boutons.add(new JLabel("La borne « De » de chaque tranche = borne « À » de la précédente."));
        JPanel p = new JPanel(new BorderLayout(4, 4));
        p.add(new JLabel("<html><b>" + e.code() + "</b> – nouveau barème annuel (version actuelle depuis le " + Ui.txt(e.debut()) + ")</html>"), BorderLayout.NORTH);
        JPanel centre = new JPanel(new BorderLayout());
        centre.add(sp, BorderLayout.CENTER);
        centre.add(boutons, BorderLayout.SOUTH);
        p.add(centre, BorderLayout.CENTER);
        p.add(Ui.formulaire("Date d'effet * (1er du mois)", debut, "Date de fin (facultatif)", fin, "Texte officiel de référence *", source, "Note", note), BorderLayout.SOUTH);
        while (JOptionPane.showConfirmDialog(this, p, "Nouveau barème", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            try {
                if (tt.isEditing()) tt.getCellEditor().stopCellEditing();
                List<Referentiel.Tranche> tr = new ArrayList<>();
                for (int i = 0; i < tm.getRowCount(); i++) {
                    BigDecimal de = Ui.dec(String.valueOf(tm.getValueAt(i, 0)), "De (tranche " + (i + 1) + ")");
                    BigDecimal a = Ui.dec(String.valueOf(tm.getValueAt(i, 1)), "À (tranche " + (i + 1) + ")");
                    BigDecimal tx = Ui.dec(String.valueOf(tm.getValueAt(i, 2)).replace("%", ""), "Taux (tranche " + (i + 1) + ")");
                    if (de == null || tx == null) throw new IllegalArgumentException("Tranche " + (i + 1) + " incomplète");
                    tr.add(new Referentiel.Tranche(de, a, tx.movePointLeft(2)));
                }
                LocalDate d = Ui.date(debut.getText(), "Date d'effet");
                if (!Ui.confirmer(this, "Appliquer ce barème (" + tr.size() + " tranches) à partir du " + Ui.txt(d) + " ?\nL'ancien barème reste appliqué avant cette date.")) continue;
                ctx.service().ajouterVersionBareme(ctx.user(), e.code(), d, Ui.date(fin.getText(), "Date de fin"), tr, source.getText(), note.getText());
                rafraichir();
                Ui.info(this, "Nouveau barème enregistré. Il reste « À CONFIRMER » jusqu'à validation.");
                return;
            } catch (Exception ex) {
                Ui.erreur(this, ex);
            }
        }
    }

    private void supprimer() {
        Element e = Ui.selection(t, m);
        VersionParam s = e == null ? null : saisie(e);
        if (s == null) { Ui.info(this, "Sélectionnez une version saisie dans l'application (les valeurs du fichier ne se suppriment pas)."); return; }
        if (!Ui.confirmer(this, "Supprimer la version " + e.code() + " du " + Ui.txt(e.debut()) + " ?\nLa version précédente redevient applicable.")) return;
        Ui.essayer(this, () -> {
            ctx.service().supprimerVersion(ctx.user(), s.id);
            rafraichir();
        });
    }

    // ---------- validation ----------

    private void valider() {
        Element e = Ui.selection(t, m);
        if (e == null) { Ui.info(this, "Sélectionnez un élément."); return; }
        JTextField par = new JTextField(24), ref = new JTextField(30);
        JPanel f = Ui.formulaire("Élément", new JLabel(e.code() + " = " + affichage(e) + " (depuis le " + Ui.txt(e.debut()) + ")"),
                "Validé par (nom du professionnel) *", par, "Référence officielle consultée *", ref);
        while (JOptionPane.showConfirmDialog(this, f, "Validation d'un paramètre réglementaire", JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            try {
                ctx.service().validerParametre(ctx.user(), e.code(), e.debut(), e.valeur(), par.getText(), ref.getText());
                rafraichir();
                return;
            } catch (Exception ex) {
                Ui.erreur(this, ex);
            }
        }
    }

    private void retirer() {
        Element e = Ui.selection(t, m);
        if (e == null || validation(e) == null) { Ui.info(this, "Sélectionnez un élément validé."); return; }
        if (!Ui.confirmer(this, "Retirer la validation de " + e.code() + " ?")) return;
        Ui.essayer(this, () -> {
            ctx.service().retirerValidation(ctx.user(), e.code(), e.debut());
            rafraichir();
        });
    }
}
