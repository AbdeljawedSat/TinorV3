package tn.jas.paie.app.service;

import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;
import java.util.EnumSet;
import java.util.Set;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import tn.jas.paie.app.model.Modeles.Role;
import tn.jas.paie.app.model.Modeles.Utilisateur;

/** Hachage des mots de passe (PBKDF2-HMAC-SHA256, sel aléatoire) et contrôle des droits par rôle. */
public final class Securite {
    private Securite() { }

    private static final int ITERATIONS = 210_000;
    private static final SecureRandom RNG = new SecureRandom();

    public enum Droit {
        CONSULTER, GERER_SALARIES, SAISIR_VARIABLES, SIMULER, VALIDER_PAIE, VALIDER_PARAMETRES,
        CLOTURER, ROUVRIR, EXPORTER, ADMINISTRER, MODIFIER_PARAMETRES
    }

    public static Set<Droit> droits(Role r) {
        return switch (r) {
            case ADMIN -> EnumSet.allOf(Droit.class);
            case GESTIONNAIRE -> EnumSet.of(Droit.CONSULTER, Droit.GERER_SALARIES, Droit.SAISIR_VARIABLES, Droit.SIMULER, Droit.EXPORTER);
            case VALIDEUR -> EnumSet.of(Droit.CONSULTER, Droit.VALIDER_PAIE, Droit.VALIDER_PARAMETRES, Droit.EXPORTER);
            case CONSULTATION -> EnumSet.of(Droit.CONSULTER);
        };
    }

    public static void exiger(Utilisateur u, Droit d) {
        if (u == null || !u.actif || !droits(u.role).contains(d))
            throw new AccesRefuse("Action non autorisée pour votre rôle (" + (u == null ? "?" : u.role) + ") : " + d);
    }

    public static boolean peut(Utilisateur u, Droit d) {
        return u != null && u.actif && droits(u.role).contains(d);
    }

    public static String hacher(char[] motDePasse) {
        byte[] sel = new byte[16];
        RNG.nextBytes(sel);
        return "pbkdf2$" + ITERATIONS + "$" + Base64.getEncoder().encodeToString(sel) + "$"
                + Base64.getEncoder().encodeToString(derive(motDePasse, sel, ITERATIONS));
    }

    public static boolean verifier(char[] motDePasse, String stocke) {
        String[] p = stocke.split("\\$");
        if (p.length != 4 || !"pbkdf2".equals(p[0])) return false;
        byte[] attendu = Base64.getDecoder().decode(p[3]);
        byte[] calcule = derive(motDePasse, Base64.getDecoder().decode(p[2]), Integer.parseInt(p[1]));
        return java.security.MessageDigest.isEqual(attendu, calcule);
    }

    public static void controlerRobustesse(char[] mdp) {
        if (mdp.length < 10) throw new IllegalArgumentException("Le mot de passe doit contenir au moins 10 caractères");
        boolean lettre = false, chiffre = false;
        for (char c : mdp) {
            if (Character.isLetter(c)) lettre = true;
            if (Character.isDigit(c)) chiffre = true;
        }
        if (!lettre || !chiffre) throw new IllegalArgumentException("Le mot de passe doit contenir des lettres et des chiffres");
    }

    private static byte[] derive(char[] mdp, byte[] sel, int it) {
        try {
            KeySpec spec = new PBEKeySpec(mdp, sel, it, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static final class AccesRefuse extends RuntimeException {
        public AccesRefuse(String m) { super(m); }
    }
}
