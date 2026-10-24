package tn.jas.paie.app.ui;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.nio.file.Path;

import javax.swing.BorderFactory;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTabbedPane;
import javax.swing.WindowConstants;

import tn.jas.paie.app.model.Modeles.Utilisateur;
import tn.jas.paie.app.service.PaieService;
import tn.jas.paie.app.service.Securite;
import tn.jas.paie.app.service.Securite.Droit;
import tn.jas.paie.engine.MoteurPaie;

/** Fenêtre principale : un onglet par domaine fonctionnel. */
public final class MainFrame extends JFrame {

    /** Contexte partagé entre les écrans. */
    public record Ctx(PaieService service, Utilisateur user, Path documents, JFrame fenetre) {
        public boolean peut(Droit d) { return Securite.peut(user, d); }
    }

    public MainFrame(PaieService service, Utilisateur user, Path documents, String dbUrl) {
        super("Paie Tunisie – application de test");
        setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1100, 700));
        Ctx ctx = new Ctx(service, user, documents, this);

        JTabbedPane onglets = new JTabbedPane();
        PaiePanel paie = new PaiePanel(ctx);
        SalariesPanel salaries = new SalariesPanel(ctx);
        VariablesPanel variables = new VariablesPanel(ctx);
        ParametresPanel parametres = new ParametresPanel(ctx);
        onglets.addTab("Paie du mois", paie);
        onglets.addTab("Salariés & contrats", salaries);
        onglets.addTab("Éléments variables", variables);
        onglets.addTab("Paramètres réglementaires", parametres);
        if (ctx.peut(Droit.ADMINISTRER)) onglets.addTab("Administration", new AdminPanel(ctx));
        onglets.addChangeListener(e -> {
            Object c = onglets.getSelectedComponent();
            if (c instanceof Rafraichissable r) r.rafraichir();
        });

        JLabel etat = new JLabel("Connecté : " + user.login + " (" + user.role + ")   •   Base : " + dbUrl
                + "   •   Moteur " + MoteurPaie.MOTEUR + "   •   Paramètres " + service.referentiel().version()
                + (service.controleDeuxNiveaux() ? "   •   Contrôle à deux niveaux actif" : ""));
        etat.setBorder(BorderFactory.createEmptyBorder(4, 8, 4, 8));

        JPanel racine = new JPanel(new BorderLayout());
        racine.add(onglets, BorderLayout.CENTER);
        racine.add(etat, BorderLayout.SOUTH);
        setContentPane(racine);
        pack();
        setSize(1280, 800);
        setLocationRelativeTo(null);
        paie.rafraichir();
    }

    /** Écran rechargeable à l'affichage. */
    public interface Rafraichissable { void rafraichir(); }
}
