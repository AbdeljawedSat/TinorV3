package tn.jas.paie.app.ui;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.time.LocalDate;
import java.util.List;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

import tn.jas.paie.app.model.Modeles.Contrat;
import tn.jas.paie.app.model.Modeles.Salarie;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.app.ui.MainFrame.Ctx;

/** Fiches salariés (recherche, création, modification) et historique des contrats/avenants. */
final class SalariesPanel extends JPanel implements MainFrame.Rafraichissable {

    private final Ctx ctx;
    private final JTextField recherche = new JTextField(22);
    private final JCheckBox inactifs = new JCheckBox("Afficher les inactifs");
    private final Ui.Modele<Salarie> mSal = new Ui.Modele<>(
            new String[]{"Matricule", "Nom", "Prénom", "Fonction", "Entrée", "Sortie", "Chef famille", "Enfants", "Actif"},
            s -> s.matricule, s -> s.nom, s -> s.prenom, s -> s.fonction, s -> Ui.txt(s.dateEntree), s -> Ui.txt(s.dateSortie),
            s -> s.chefFamille ? "oui" : "non", s -> s.nbEnfants + s.nbEnfantsEtudiants + s.nbEnfantsHandicapes, s -> s.actif ? "oui" : "non");
    private final JTable tSal = Ui.table(mSal);
    private final Ui.Modele<Contrat> mCtr = new Ui.Modele<>(
            new String[]{"Type", "Début", "Fin", "Salaire de base", "Horaire mensuel", "Taux horaire"},
            k -> k.typeContrat, k -> Ui.txt(k.dateDebut), k -> Ui.txt(k.dateFin), k -> k.salaireBase, k -> k.horaireMensuel, k -> k.tauxHoraire);
    private final JTable tCtr = Ui.table(mCtr);
    private final JButton bNouveau = new JButton("Nouveau salarié"), bModifier = new JButton("Modifier"), bContrat = new JButton("Ajouter un contrat / avenant");

    SalariesPanel(Ctx ctx) {
        super(new BorderLayout(6, 6));
        this.ctx = ctx;
        setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JPanel haut = new JPanel(new FlowLayout(FlowLayout.LEFT));
        haut.add(new JLabel("Rechercher :"));
        haut.add(recherche);
        haut.add(inactifs);
        haut.add(bNouveau);
        haut.add(bModifier);
        add(haut, BorderLayout.NORTH);

        JPanel bas = new JPanel(new BorderLayout(4, 4));
        bas.add(Ui.titre("Contrats et avenants (le plus récent applicable est utilisé pour la paie)"), BorderLayout.NORTH);
        bas.add(new JScrollPane(tCtr), BorderLayout.CENTER);
        JPanel bb = new JPanel(new FlowLayout(FlowLayout.LEFT));
        bb.add(bContrat);
        bas.add(bb, BorderLayout.SOUTH);
        JSplitPane split = new JSplitPane(JSplitPane.VERTICAL_SPLIT, new JScrollPane(tSal), bas);
        split.setResizeWeight(0.6);
        add(split, BorderLayout.CENTER);

        boolean gerer = ctx.peut(Droit.GERER_SALARIES);
        bNouveau.setEnabled(gerer);
        bModifier.setEnabled(gerer);
        bContrat.setEnabled(gerer);
        recherche.getDocument().addDocumentListener(new DocumentListener() {
            public void insertUpdate(DocumentEvent e) { rafraichir(); }
            public void removeUpdate(DocumentEvent e) { rafraichir(); }
            public void changedUpdate(DocumentEvent e) { rafraichir(); }
        });
        inactifs.addActionListener(e -> rafraichir());
        tSal.getSelectionModel().addListSelectionListener(e -> { if (!e.getValueIsAdjusting()) chargerContrats(); });
        tSal.addMouseListener(new MouseAdapter() {
            @Override public void mouseClicked(MouseEvent e) { if (e.getClickCount() == 2 && gerer) editer(Ui.selection(tSal, mSal)); }
        });
        bNouveau.addActionListener(e -> editer(null));
        bModifier.addActionListener(e -> {
            Salarie s = Ui.selection(tSal, mSal);
            if (s == null) Ui.info(this, "Sélectionnez un salarié."); else editer(s);
        });
        bContrat.addActionListener(e -> nouveauContrat());
        rafraichir();
    }

    @Override public void rafraichir() {
        Ui.essayer(this, () -> {
            mSal.definir(ctx.service().dao().salaries(recherche.getText(), !inactifs.isSelected()));
            chargerContrats();
        });
    }

    private void chargerContrats() {
        Salarie s = Ui.selection(tSal, mSal);
        Ui.essayer(this, () -> mCtr.definir(s == null ? List.of() : ctx.service().dao().contrats(s.id)));
    }

    private void editer(Salarie existant) {
        Salarie s = existant == null ? new Salarie() : existant;
        JTextField mat = new JTextField(s.matricule, 14), nom = new JTextField(s.nom, 20), prenom = new JTextField(s.prenom, 20),
                fonction = new JTextField(s.fonction, 20), categorie = new JTextField(s.categorie, 12), cnss = new JTextField(s.numCnss, 14),
                entree = new JTextField(existant == null ? Ui.txt(LocalDate.now()) : Ui.txt(s.dateEntree), 10),
                sortie = new JTextField(Ui.txt(s.dateSortie), 10),
                enf = new JTextField(String.valueOf(s.nbEnfants), 4), etu = new JTextField(String.valueOf(s.nbEnfantsEtudiants), 4),
                hand = new JTextField(String.valueOf(s.nbEnfantsHandicapes), 4), rib = new JTextField(s.rib, 22);
        JCheckBox chef = new JCheckBox("Chef de famille (ouvre droit aux déductions)", s.chefFamille), actif = new JCheckBox("Actif", s.actif);
        JComboBox<String> mode = new JComboBox<>(new String[]{"VIREMENT", "CHEQUE", "ESPECES"});
        mode.setSelectedItem(s.modePaiement);
        JComboBox<String> regime = new JComboBox<>(new String[]{"CNSS_RSNA"});
        JPanel f = Ui.formulaire("Matricule *", mat, "Nom *", nom, "Prénom *", prenom, "Fonction", fonction, "Catégorie", categorie,
                "N° CNSS", cnss, "Date d'entrée * (JJ/MM/AAAA)", entree, "Date de sortie", sortie, "Régime", regime,
                "", chef, "Enfants à charge (< 20 ans)", enf, "Enfants étudiants non boursiers", etu, "Enfants handicapés", hand,
                "Mode de paiement", mode, "RIB", rib, "", actif);
        while (JOptionPane.showConfirmDialog(this, f, existant == null ? "Nouveau salarié" : "Modifier " + s.nomComplet(),
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            try {
                Salarie n = existant == null ? new Salarie() : s;
                n.matricule = mat.getText().trim();
                n.nom = nom.getText().trim().toUpperCase();
                n.prenom = prenom.getText().trim();
                n.fonction = vide(fonction.getText());
                n.categorie = vide(categorie.getText());
                n.numCnss = vide(cnss.getText());
                n.dateEntree = Ui.date(entree.getText(), "Date d'entrée");
                n.dateSortie = Ui.date(sortie.getText(), "Date de sortie");
                n.regime = (String) regime.getSelectedItem();
                n.chefFamille = chef.isSelected();
                n.nbEnfants = Ui.entier(enf.getText(), "Enfants");
                n.nbEnfantsEtudiants = Ui.entier(etu.getText(), "Enfants étudiants");
                n.nbEnfantsHandicapes = Ui.entier(hand.getText(), "Enfants handicapés");
                n.modePaiement = (String) mode.getSelectedItem();
                n.rib = vide(rib.getText());
                n.actif = actif.isSelected();
                ctx.service().enregistrerSalarie(ctx.user(), n);
                boolean nouveau = existant == null;
                rafraichir();
                if (nouveau) {
                    Ui.info(this, "Salarié créé. Ajoutez maintenant son contrat (salaire de base) pour pouvoir le payer.");
                    selectionner(n.id);
                    nouveauContrat();
                }
                return;
            } catch (Exception ex) {
                Ui.erreur(this, ex);
            }
        }
    }

    private void selectionner(int id) {
        for (int i = 0; i < mSal.getRowCount(); i++)
            if (mSal.ligne(i).id == id) {
                int v = tSal.convertRowIndexToView(i);
                tSal.setRowSelectionInterval(v, v);
            }
    }

    private void nouveauContrat() {
        Salarie s = Ui.selection(tSal, mSal);
        if (s == null) { Ui.info(this, "Sélectionnez un salarié."); return; }
        JComboBox<String> type = new JComboBox<>(new String[]{"CDI", "CDD", "SIVP", "KARAMA", "AUTRE"});
        JTextField debut = new JTextField(Ui.txt(s.dateEntree), 10), fin = new JTextField(10), base = new JTextField(12),
                horaire = new JTextField("208", 8), th = new JTextField(10);
        JPanel f = Ui.formulaire("Type de contrat", type, "Début * (JJ/MM/AAAA)", debut, "Fin", fin, "Salaire de base mensuel (TND) *", base,
                "Horaire mensuel (208 = 48 h/sem., 173,33 = 40 h/sem.) *", horaire,
                "Taux horaire (vide = salaire / horaire)", th);
        while (JOptionPane.showConfirmDialog(this, f, "Contrat / avenant – " + s.nomComplet(), JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            try {
                Contrat k = new Contrat();
                k.salarieId = s.id;
                k.typeContrat = (String) type.getSelectedItem();
                k.dateDebut = Ui.date(debut.getText(), "Début");
                k.dateFin = Ui.date(fin.getText(), "Fin");
                k.salaireBase = Ui.dec(base.getText(), "Salaire de base");
                k.horaireMensuel = Ui.dec(horaire.getText(), "Horaire mensuel");
                k.tauxHoraire = Ui.dec(th.getText(), "Taux horaire");
                ctx.service().ajouterContrat(ctx.user(), k);
                chargerContrats();
                return;
            } catch (Exception ex) {
                Ui.erreur(this, ex);
            }
        }
    }

    private static String vide(String s) { return s == null || s.isBlank() ? null : s.trim(); }
}
