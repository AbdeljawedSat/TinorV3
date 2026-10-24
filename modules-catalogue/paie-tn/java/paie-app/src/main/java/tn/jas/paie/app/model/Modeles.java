package tn.jas.paie.app.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Objets métier de l'application (simples porteurs de données). */
public final class Modeles {
    private Modeles() { }

    public static class Entreprise {
        public int id;
        public String raisonSociale = "", matriculeFiscal, numEmployeurCnss, adresse;
        public BigDecimal tauxAT, tauxTFP;
    }

    public static class Salarie {
        public int id;
        public String matricule, nom, prenom, fonction, categorie, numCnss;
        public LocalDate dateEntree, dateSortie;
        public String regime = "CNSS_RSNA";
        public boolean chefFamille;
        public int nbEnfants, nbEnfantsEtudiants, nbEnfantsHandicapes;
        public String modePaiement = "VIREMENT", rib;
        public boolean actif = true;

        public String nomComplet() { return nom + " " + prenom; }

        @Override public String toString() { return matricule + " – " + nomComplet(); }
    }

    public static class Contrat {
        public int id, salarieId;
        public String typeContrat = "CDI";
        public LocalDate dateDebut, dateFin;
        public BigDecimal salaireBase, horaireMensuel = new BigDecimal("208"), tauxHoraire;
    }

    public enum StatutPeriode { OUVERTE, CALCULEE, VALIDEE, CLOTUREE }

    public static class Periode {
        public int id, annee, mois;
        public StatutPeriode statut = StatutPeriode.OUVERTE;
        public String calculePar, valideePar, clotureePar;
        public LocalDateTime calculeLe, valideeLe, clotureeLe;

        public String libelle() { return String.format("%04d-%02d", annee, mois); }

        public boolean modifiable() { return statut == StatutPeriode.OUVERTE || statut == StatutPeriode.CALCULEE; }

        @Override public String toString() { return libelle() + " (" + statut + ")"; }
    }

    public static class VariableSaisie {
        public int id, periodeId, salarieId;
        public String rubrique, commentaire, creePar;
        public BigDecimal quantite, taux, montant;
    }

    public static class Calcul {
        public int id, periodeId, salarieId, version;
        public String statut, moteur, paramsVersion, calculePar, json;
        public BigDecimal brut, cnssSal, irpp, css, net, chargesPat, coutEmployeur;
        public boolean certifiable;
        public LocalDateTime calculeLe;
    }

    public static class Validation {
        public String code, valeur, validePar, reference;
        public LocalDate debut;
        public LocalDateTime valideLe;
    }

    /** Version d'un paramètre ou d'un barème saisie dans l'application (table paie_parametres_versions). */
    public static class VersionParam {
        public int id;
        public String code, valeur, tranchesJson, source, note, creePar;
        public LocalDate debut, fin;
        public LocalDateTime creeLe;
    }

    public enum Role { ADMIN, GESTIONNAIRE, VALIDEUR, CONSULTATION }

    public static class Utilisateur {
        public int id;
        public String login, hash;
        public Role role;
        public boolean actif = true;
    }

    public static class Audit {
        public long id;
        public LocalDateTime horodatage;
        public String utilisateur, action, entite, entiteId, details;
    }
}
