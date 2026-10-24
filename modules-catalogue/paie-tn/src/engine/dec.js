'use strict';
/**
 * Règles d'arrondi — strictement identiques au moteur Java (tn.jas.paie.engine.Dec) :
 *  - calculs intermédiaires exacts (Decimal, précision 50 chiffres significatifs) ;
 *  - chaque division est arrondie directement au millime, HALF_UP (demi au supérieur en valeur absolue) ;
 *  - chaque montant publié est arrondi au millime, HALF_UP.
 * Jamais de Number (flottant binaire) pour un montant.
 */
const Decimal = require('decimal.js').clone({ precision: 50, rounding: 4 /* ROUND_HALF_UP */, toExpNeg: -30, toExpPos: 40 });

const HALF_UP = Decimal.ROUND_HALF_UP;
const ZERO = new Decimal(0);
const DOUZE = new Decimal(12);

/** Convertit une valeur d'entrée (texte, nombre, Decimal) ; vide => null. */
function d(v) {
  if (v === null || v === undefined) return null;
  if (Decimal.isDecimal(v)) return v;
  const s = String(v).trim();
  if (s === '') return null;
  const n = new Decimal(s);
  if (!n.isFinite()) throw new Error('Nombre invalide : ' + s);
  return n;
}

const r3 = (v) => v.toDecimalPlaces(3, HALF_UP);
const div3 = (a, b) => a.div(b).toDecimalPlaces(3, HALF_UP);
const min = (a, b) => (a.lte(b) ? a : b);
const max = (a, b) => (a.gte(b) ? a : b);
/** Format publié : 3 décimales, notation simple. */
const f = (v) => r3(v).toFixed(3);
/** Forme canonique sans zéros finaux (identique à BigDecimal.stripTrailingZeros().toPlainString()). */
const canon = (v) => (v.isZero() ? '0' : v.toFixed());

module.exports = { Decimal, ZERO, DOUZE, d, r3, div3, min, max, f, canon };
