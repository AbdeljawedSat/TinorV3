package tn.jas.paie.app.ui;

import java.awt.BorderLayout;
import java.awt.FlowLayout;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTable;
import javax.swing.JTextField;

import tn.jas.paie.app.App;
import tn.jas.paie.app.model.Modeles.Audit;
import tn.jas.paie.app.model.Modeles.Entreprise;
import tn.jas.paie.app.model.Modeles.Role;
import tn.jas.paie.app.model.Modeles.Utilisateur;
import tn.jas.paie.app.service.Securite;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.app.ui.MainFrame.Ctx;

/** Administration : fiche entreprise, utilisateurs et rôles, journal d'audit. */
final class AdminPanel extends JTabbedPane implements MainFrame.Rafraichissable {

    private final Ctx ctx;
    private final JTextField rs = new JTextField(30), mf = new JTextField(18), cnss = new JTextField(18), adr = new JTextField(40),
            at = new JTextField(8), tfp = new JTextField(8);
    private final Ui.Modele<Utilisateur> mUsers = new Ui.Modele<>(new String[]{"Identifiant", "Rôle", "Actif"},
            u -> u.login, u -> u.role.name(), u -> u.actif ? "oui" : "non");
    private final JTable tUsers = Ui.table(mUsers);
    private final Ui.Modele<Audit> mAudit = new Ui.Modele<>(new String[]{"Date", "Utilisateur", "Action", "Objet", "Id", "Détails"},
            a -> a.horodatage.toString().replace('T', ' '), a -> a.utilisateur, a -> a.action, a -> a.entite, a -> a.entiteId, a -> a.details);
    private final JTable tAudit = Ui.table(mAudit);
    private final JTextField filtre = new JTextField(20);

    AdminPanel(Ctx ctx) {
        this.ctx = ctx;
        Securite.exiger(ctx.user(), Droit.ADMINISTRER);

        // Entreprise
        JPanel ent = new JPanel(new BorderLayout());
        ent.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JButton bEnt = new JButton("Enregistrer");
        ent.add(Ui.formulaire("Raison sociale *", rs, "Matricule fiscal", mf, "N° employeur CNSS", cnss, "Adresse", adr,
                "Taux accident du travail notifié (ex. 0,004 ; vide = défaut)", at, "Taux TFP (0,01 ou 0,02 ; vide = défaut)", tfp, "", bEnt), BorderLayout.NORTH);
        bEnt.addActionListener(e -> Ui.essayer(this, () -> {
            Entreprise x = ctx.service().dao().entreprise();
            if (rs.getText().isBlank()) throw new IllegalArgumentException("La raison sociale est obligatoire");
            x.raisonSociale = rs.getText().trim();
            x.matriculeFiscal = rs(mf);
            x.numEmployeurCnss = rs(cnss);
            x.adresse = rs(adr);
            x.tauxAT = Ui.dec(at.getText(), "Taux AT");
            x.tauxTFP = Ui.dec(tfp.getText(), "Taux TFP");
            if (x.tauxAT != null && (x.tauxAT.signum() < 0 || x.tauxAT.compareTo(new java.math.BigDecimal("0.1")) > 0))
                throw new IllegalArgumentException("Taux AT attendu sous forme décimale (ex. 0,004 pour 0,4 %)");
            if (x.tauxTFP != null && (x.tauxTFP.signum() < 0 || x.tauxTFP.compareTo(new java.math.BigDecimal("0.05")) > 0))
                throw new IllegalArgumentException("Taux TFP attendu sous forme décimale (ex. 0,01 pour 1 %)");
            ctx.service().dao().enregistrerEntreprise(x);
            ctx.service().dao().audit(ctx.user().login, "MODIFICATION", "ENTREPRISE", x.id, "AT=" + x.tauxAT + " TFP=" + x.tauxTFP);
            Ui.info(this, "Fiche entreprise enregistrée.");
        }));
        addTab("Entreprise", ent);

        // Utilisateurs
        JPanel us = new JPanel(new BorderLayout(4, 4));
        us.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JButton bAdd = new JButton("Nouvel utilisateur"), bEdit = new JButton("Modifier rôle / mot de passe / statut");
        JPanel ub = new JPanel(new FlowLayout(FlowLayout.LEFT));
        ub.add(bAdd);
        ub.add(bEdit);
        us.add(new JLabel("<html>Rôles : ADMIN (tout), GESTIONNAIRE (salariés, variables, simulation, exports), "
                + "VALIDEUR (validation paie et paramètres), CONSULTATION (lecture).</html>"), BorderLayout.NORTH);
        us.add(new JScrollPane(tUsers), BorderLayout.CENTER);
        us.add(ub, BorderLayout.SOUTH);
        bAdd.addActionListener(e -> editerUtilisateur(null));
        bEdit.addActionListener(e -> {
            Utilisateur u = Ui.selection(tUsers, mUsers);
            if (u == null) Ui.info(this, "Sélectionnez un utilisateur."); else editerUtilisateur(u);
        });
        addTab("Utilisateurs", us);

        // Journal
        JPanel jr = new JPanel(new BorderLayout(4, 4));
        jr.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JPanel jf = new JPanel(new FlowLayout(FlowLayout.LEFT));
        JButton bFiltre = new JButton("Filtrer");
        jf.add(new JLabel("Filtre :"));
        jf.add(filtre);
        jf.add(bFiltre);
        jf.add(new JLabel("(500 dernières entrées)"));
        bFiltre.addActionListener(e -> chargerJournal());
        filtre.addActionListener(e -> chargerJournal());
        jr.add(jf, BorderLayout.NORTH);
        jr.add(new JScrollPane(tAudit), BorderLayout.CENTER);
        addTab("Journal d'audit", jr);

        addChangeListener(e -> rafraichir());
        rafraichir();
    }

    private static String rs(JTextField f) { return f.getText().isBlank() ? null : f.getText().trim(); }

    @Override public void rafraichir() {
        Ui.essayer(this, () -> {
            Entreprise x = ctx.service().dao().entreprise();
            rs.setText(x.raisonSociale);
            mf.setText(x.matriculeFiscal);
            cnss.setText(x.numEmployeurCnss);
            adr.setText(x.adresse);
            at.setText(x.tauxAT == null ? "" : x.tauxAT.stripTrailingZeros().toPlainString());
            tfp.setText(x.tauxTFP == null ? "" : x.tauxTFP.stripTrailingZeros().toPlainString());
            mUsers.definir(ctx.service().dao().utilisateurs());
            chargerJournal();
        });
    }

    private void chargerJournal() {
        Ui.essayer(this, () -> mAudit.definir(ctx.service().dao().journal(filtre.getText(), 500)));
    }

    private void editerUtilisateur(Utilisateur existant) {
        JTextField login = new JTextField(existant == null ? "" : existant.login, 16);
        login.setEditable(existant == null);
        JComboBox<Role> role = App.comboRoles();
        if (existant != null) role.setSelectedItem(existant.role);
        JPasswordField mdp = new JPasswordField(16);
        JCheckBox actif = new JCheckBox("Actif", existant == null || existant.actif);
        JPanel f = Ui.formulaire("Identifiant", login, "Rôle", role,
                existant == null ? "Mot de passe *" : "Nouveau mot de passe (vide = inchangé)", mdp, "", actif);
        while (JOptionPane.showConfirmDialog(this, f, existant == null ? "Nouvel utilisateur" : "Modifier " + existant.login,
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE) == JOptionPane.OK_OPTION) {
            try {
                Utilisateur u = existant == null ? new Utilisateur() : existant;
                if (existant == null) {
                    if (login.getText().isBlank()) throw new IllegalArgumentException("Identifiant obligatoire");
                    u.login = login.getText().trim();
                }
                if (existant != null && existant.login.equals(ctx.user().login) && (role.getSelectedItem() != Role.ADMIN || !actif.isSelected()))
                    throw new IllegalArgumentException("Vous ne pouvez pas retirer vos propres droits d'administrateur");
                if (existant == null || mdp.getPassword().length > 0) {
                    Securite.controlerRobustesse(mdp.getPassword());
                    u.hash = Securite.hacher(mdp.getPassword());
                }
                u.role = (Role) role.getSelectedItem();
                u.actif = actif.isSelected();
                ctx.service().dao().enregistrerUtilisateur(u);
                ctx.service().dao().audit(ctx.user().login, existant == null ? "CREATION" : "MODIFICATION", "UTILISATEUR", u.id,
                        u.login + " role=" + u.role + " actif=" + u.actif + (mdp.getPassword().length > 0 ? " (mot de passe changé)" : ""));
                rafraichir();
                return;
            } catch (Exception ex) {
                if (ex.getMessage() != null && ex.getMessage().contains("uk_paie_user")) Ui.erreur(this, new IllegalArgumentException("Identifiant déjà utilisé"));
                else Ui.erreur(this, ex);
            }
        }
    }
}
