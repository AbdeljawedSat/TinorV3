// Règles de cohérence communes à toutes les opérations (quantités, montants,
// bilans matière). Une règle non respectée lève `Invalide`, renvoyé en 400 par
// le gestionnaire d'erreurs d'Express ; dans une route enTransaction, tout ce
// qui a déjà été écrit est annulé.

class Invalide extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const arrondi = (x) => Math.round(Number(x) * 1000) / 1000;
// Accord de l'adjectif avec le libellé : « La quantité … supérieure », « Le prix … supérieur ».
const feminin = (libelle) => /^(la|une)\s/i.test(libelle);
const accord = (libelle, masc, fem) => (feminin(libelle) ? fem : masc);
const vide = (v) => v === undefined || v === null || v === '';

// Quantité strictement positive (une quantité négative ferait ENTRER du stock
// là où l'opération est censée en consommer).
function positif(valeur, libelle) {
  const n = Number(valeur);
  if (vide(valeur) || !Number.isFinite(n) || n <= 0) throw new Invalide(`${libelle} doit être ${accord(libelle, 'supérieur', 'supérieure')} à 0.`);
  return n;
}

function positifOuZero(valeur, libelle, parDefaut = 0) {
  if (vide(valeur)) return parDefaut;
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < 0) throw new Invalide(`${libelle} ne peut pas être ${accord(libelle, 'négatif', 'négative')}.`);
  return n;
}

function entreBornes(valeur, min, max, libelle) {
  if (vide(valeur)) return valeur;
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < min || n > max) throw new Invalide(`${libelle} doit être ${accord(libelle, 'compris', 'comprise')} entre ${min} et ${max}.`);
  return n;
}

// Produits vendus ou conditionnés à l'unité : pas de quantité fractionnaire.
function entierSiUnite(valeur, uniteCode, libelle) {
  if (uniteCode === 'unite' && !Number.isInteger(Number(valeur))) {
    throw new Invalide(`${libelle} doit être un nombre entier (produit compté à l'unité).`);
  }
}

// Date B ne peut pas précéder date A (ex. expiration avant production).
function datesOrdonnees(dateA, dateB, message) {
  if (vide(dateA) || vide(dateB)) return;
  if (String(dateB).slice(0, 10) < String(dateA).slice(0, 10)) throw new Invalide(message);
}

// Facteur pour exprimer un volume de format (ml, g) dans l'unité du vrac (L, kg).
// null si les unités ne se convertissent pas (le contrôle est alors ignoré).
function facteurConversion(uniteFormat, uniteVrac) {
  if (!uniteFormat || !uniteVrac) return null;
  if (uniteFormat === uniteVrac) return 1;
  const table = { 'ml>litre': 0.001, 'litre>ml': 1000, 'g>kg': 0.001, 'kg>g': 1000 };
  return table[`${uniteFormat}>${uniteVrac}`] ?? null;
}

module.exports = { Invalide, arrondi, positif, positifOuZero, entreBornes, entierSiUnite, datesOrdonnees, facteurConversion };
