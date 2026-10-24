package tn.jas.paie.app.ui;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.swing.BorderFactory;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JEditorPane;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextField;

import tn.jas.paie.app.model.Modeles.Periode;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.model.Modeles.VariableSaisie;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.app.ui.MainFrame.Ctx;
import tn.jas.paie.engine.Referentiel.Rubrique;
import tn.jas.paie.engine.ResultatPaie;

/** Saisie des éléments variables du mois, avec aperçu immédiat du calcul (sans enregistrement). */
final class VariablesPanel extends JPanel implements MainFrame.Rafraichissable {

    private final Ctx ctx;
    private final JComboBox<Periode> periode = new JComboBox<>();
    private final JComboBox<Salarie> salarie = new JComboBox<>();
    private final JComboBox<Rubrique> rubrique = new JComboBox<>();
    private final JTextField quantite = new JTextField(7), taux = new JTextField(7), montant = new JTextField(10), commentaire = new JTextField(16);
    private final JLabel aide = new JLabel(" ");
    private final Map<String, Rubrique> rubs;
    private final Ui.Modele<VariableSaisie> mVar;
    private final JTable tVar;
    private final JEditorPane apercu = new JEditorPane("text/html", "");
    private final JButton bAjouter = new JButton("Ajouter"), bSupprimer = new JButton("Supprimer la ligne"), bApercu = new JButton("Actualiser l'aperçu");
    private boolean chargement;

    VariablesPanel(Ctx ctx) {
        super(new BorderLayout(6, 6));
        this.ctx = ctx;
        this.rubs = ctx.service().referentiel().rubriques();
        setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        mVar = new Ui.Modele<>(new String[]{"Rubrique", "Libellé", "Quantité", "Taux", "Montant", "Commentaire", "Saisi par"},
                v -> v.rubrique, v -> rubs.containsKey(v.rubrique) ? rubs.get(v.rubrique).libelle() : "?", v -> v.quantite, v -> v.taux,
                v -> v.montant, v -> v.commentaire, v -> v.creePar);
        tVar = Ui.table(mVar);

        DefaultComboBoxModel<Rubrique> mr = new DefaultComboBoxModel<>();
        rubs.values().stream().filter(r -> !"SAL_BASE".equals(r.code())).forEach(mr::addElement);
        rubrique.setModel(mr);
        rubrique.setRenderer((list, value, index, sel, focus) -> new JLabel(value == null ? "" : value.code() + " – " + value.libelle()));
        rubrique.addActionListener(e -> majChamps());

        JPanel sel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        sel.add(new JLabel("Période :"));
        sel.add(periode);
        sel.add(new JLabel("Salarié :"));
        sel.add(salarie);
        periode.addActionListener(e -> { if (!chargement) charger(); });
        salarie.addActionListener(e -> { if (!chargement) charger(); });

        JPanel saisie = new JPanel(new FlowLayout(FlowLayout.LEFT));
        saisie.add(rubrique);
        saisie.add(new JLabel("Qté"));
        saisie.add(quantite);
        saisie.add(new JLabel("Taux"));
        saisie.add(taux);
        saisie.add(new JLabel("Montant"));
        saisie.add(montant);
        saisie.add(new JLabel("Commentaire"));
        saisie.add(commentaire);
        saisie.add(bAjouter);

        JPanel haut = new JPanel(new BorderLayout());
        haut.add(sel, BorderLayout.NORTH);
        haut.add(Ui.bordure(saisie, "Nouvel élément"), BorderLayout.CENTER);
        haut.add(aide, BorderLayout.SOUTH);
        add(haut, BorderLayout.NORTH);

        JPanel gauche = new JPanel(new BorderLayout());
        gauche.add(new JScrollPane(tVar), BorderLayout.CENTER);
        JPanel gb = new JPanel(new FlowLayout(FlowLayout.LEFT));
        gb.add(bSupprimer);
        gb.add(bApercu);
        gauche.add(gb, BorderLayout.SOUTH);
        apercu.setEditable(false);
        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, gauche, Ui.bordure(new JScrollPane(apercu), "Aperçu du calcul (non enregistré)"));
        split.setResizeWeight(0.45);
        add(split, BorderLayout.CENTER);

        bAjouter.addActionListener(e -> ajouter());
        bSupprimer.addActionListener(e -> supprimer());
        bApercu.addActionListener(e -> majApercu());
        majChamps();
    }

    @Override public void rafraichir() {
        Ui.essayer(this, () -> {
            chargement = true;
            Periode p = (Periode) periode.getSelectedItem();
            Salarie s = (Salarie) salarie.getSelectedItem();
            List<Periode> ps = ctx.service().dao().periodes();
            periode.setModel(new DefaultComboBoxModel<>(ps.toArray(new Periode[0])));
            for (Periode x : ps) if (p != null && x.id == p.id) periode.setSelectedItem(x);
            List<Salarie> ss = ctx.service().dao().salaries(null, true);
            salarie.setModel(new DefaultComboBoxModel<>(ss.toArray(new Salarie[0])));
            for (Salarie x : ss) if (s != null && x.id == s.id) salarie.setSelectedItem(x);
            chargement = false;
            charger();
        });
    }

    private void majChamps() {
        Rubrique r = (Rubrique) rubrique.getSelectedItem();
        if (r == null) return;
        boolean qte = !"MONTANT".equals(r.mode());
        quantite.setEnabled(qte);
        taux.setEnabled("QTE_TAUX".equals(r.mode()));
        montant.setEnabled(!qte);
        String unite = switch (r.mode()) {
            case "HEURES_SUP", "ABS_HEURES" -> "quantité en heures (montant calculé depuis le taux horaire du contrat)";
            case "ABS_JOURS" -> "quantité en jours (salaire de base / jours ouvrables du mois)";
            case "QTE_TAUX" -> "quantité × taux";
            default -> "montant en TND";
        };
        aide.setText("  " + r.libelle() + " : " + unite + ". Soumis CNSS : " + (r.cnss() ? "oui" : "non") + ", IRPP : " + (r.irpp() ? "oui" : "non")
                + ("RETENUE_NET".equals(r.type()) ? " — retenue sur le net." : "RETENUE_BRUT".equals(r.type()) ? " — diminue le brut." : ""));
    }

    private void charger() {
        Periode p = (Periode) periode.getSelectedItem();
        Salarie s = (Salarie) salarie.getSelectedItem();
        boolean modifiable = p != null && p.modifiable() && ctx.peut(Droit.SAISIR_VARIABLES);
        bAjouter.setEnabled(modifiable && s != null);
        bSupprimer.setEnabled(modifiable);
        Ui.essayer(this, () -> mVar.definir(p == null || s == null ? List.of() : ctx.service().dao().variables(p.id, s.id)));
        majApercu();
    }

    private void ajouter() {
        Periode p = (Periode) periode.getSelectedItem();
        Salarie s = (Salarie) salarie.getSelectedItem();
        Rubrique r = (Rubrique) rubrique.getSelectedItem();
        if (p == null || s == null || r == null) return;
        Ui.essayer(this, () -> {
            VariableSaisie v = new VariableSaisie();
            v.periodeId = p.id;
            v.salarieId = s.id;
            v.rubrique = r.code();
            v.quantite = quantite.isEnabled() ? Ui.dec(quantite.getText(), "Quantité") : null;
            v.taux = taux.isEnabled() ? Ui.dec(taux.getText(), "Taux") : null;
            v.montant = montant.isEnabled() ? Ui.dec(montant.getText(), "Montant") : null;
            v.commentaire = commentaire.getText().isBlank() ? null : commentaire.getText().trim();
            ctx.service().ajouterVariable(ctx.user(), v);
            quantite.setText("");
            taux.setText("");
            montant.setText("");
            commentaire.setText("");
            charger();
        });
    }

    private void supprimer() {
        VariableSaisie v = Ui.selection(tVar, mVar);
        if (v == null) { Ui.info(this, "Sélectionnez une ligne."); return; }
        if (!Ui.confirmer(this, "Supprimer l'élément " + v.rubrique + " ?")) return;
        Ui.essayer(this, () -> {
            ctx.service().supprimerVariable(ctx.user(), v);
            charger();
        });
    }

    private final Map<String, String> cacheVide = new HashMap<>();

    private void majApercu() {
        Periode p = (Periode) periode.getSelectedItem();
        Salarie s = (Salarie) salarie.getSelectedItem();
        if (p == null || s == null) {
            apercu.setText(cacheVide.computeIfAbsent("v", k -> "<html><i>Choisissez une période et un salarié.</i></html>"));
            return;
        }
        try {
            ResultatPaie r = ctx.service().apercu(ctx.user(), p.id, s);
            apercu.setText(Detail.html(s, null, r));
            apercu.setCaretPosition(0);
        } catch (Exception ex) {
            apercu.setText("<html><span style='color:#b00020'>" + ex.getMessage() + "</span></html>");
        }
    }
}
