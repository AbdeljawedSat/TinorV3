package tn.jas.paie.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Règles d'arrondi du moteur (identiques dans le module JavaScript) :
 *  - tous les calculs intermédiaires sont exacts (multiplications/additions BigDecimal) ;
 *  - chaque division est faite directement à 3 décimales, arrondi HALF_UP (demi au supérieur, en valeur absolue) ;
 *  - chaque montant publié (ligne, cotisation, impôt) est arrondi au millime, HALF_UP.
 */
public final class Dec {
    private Dec() { }

    public static final int ECHELLE = 3;
    public static final BigDecimal ZERO = BigDecimal.ZERO;
    public static final BigDecimal DOUZE = BigDecimal.valueOf(12);

    public static BigDecimal d(String s) { return new BigDecimal(s); }

    /** Arrondi au millime. */
    public static BigDecimal r3(BigDecimal v) { return v.setScale(ECHELLE, RoundingMode.HALF_UP); }

    /** Division arrondie au millime. */
    public static BigDecimal div3(BigDecimal a, BigDecimal b) { return a.divide(b, ECHELLE, RoundingMode.HALF_UP); }

    public static BigDecimal min(BigDecimal a, BigDecimal b) { return a.compareTo(b) <= 0 ? a : b; }

    public static BigDecimal max(BigDecimal a, BigDecimal b) { return a.compareTo(b) >= 0 ? a : b; }

    /** Format publié : toujours 3 décimales, notation simple. */
    public static String f(BigDecimal v) { return r3(v).toPlainString(); }

    /** Forme canonique d'une valeur (sans zéros finaux) pour comparer une valeur validée. */
    public static String canon(BigDecimal v) {
        if (v.signum() == 0) return "0";
        return v.stripTrailingZeros().toPlainString();
    }
}
