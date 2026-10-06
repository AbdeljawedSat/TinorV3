// Règles du pressage : la matière consommée est un lot de GRAINES, le produit
// obtenu est l'HUILE EN VRAC de la même graine. Le lien graine ↔ huile se fait
// par le nom (la base n'a pas de colonne dédiée) :
//   « Graines de Sésame »  ↔  « Huile de Sésame — Vrac »   (clé : « sesame »)
// Accents, majuscules et espaces ne comptent pas.
// La même logique existe côté console (admin/tinor_admin.html, cleGraine /
// cleHuileVrac) : garder les deux identiques.

function normaliser(nom) {
  return String(nom || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
}

// « Graines de Sésame » / « Graine d'Amande » → « sesame » / « amande »
function cleGraine(nom) {
  const m = normaliser(nom).match(/^graines?\s*(?:de\s+|d')(.+)$/);
  return m ? m[1].split(/\s+[-–—]\s+|\s*\(/)[0].trim() : null;
}

// « Huile de Sésame — Vrac » / « Huile d'Argan (vrac) » → « sesame » / « argan »
function cleHuileVrac(nom) {
  const m = normaliser(nom).match(/^huiles?\s*(?:de\s+|d')(.+)$/);
  return m ? m[1].split(/\s+[-–—]\s+|\s*\(/)[0].trim() : null;
}

function estGraine(produit) {
  return !!produit && produit.type_article === 'MATIERE_PREMIERE' && !!cleGraine(produit.nom);
}

// Les trois étapes de l'huile, chacune son produit :
//   presse          → « Huile de Sésame — Vrac »      (huile sans format)
//   filtration      → « Huile de Sésame — Filtrée »   (huile sans format, nom « filtrée »)
//   conditionnement → « Huile de Sésame — Flacon 30ml » (huile avec un format)
const nomFiltre = (nom) => /\bfiltre(e|es|s)?\b/.test(normaliser(nom));
const huileSansFormat = (p) => !!p && p.type_article !== 'MATIERE_PREMIERE' && !p.format_id && !!cleHuileVrac(p.nom);

function estHuileVrac(produit) {
  return huileSansFormat(produit) && !nomFiltre(produit.nom);
}
function estHuileFiltree(produit) {
  return huileSansFormat(produit) && nomFiltre(produit.nom);
}

module.exports = { normaliser, cleGraine, cleHuileVrac, estGraine, estHuileVrac, estHuileFiltree };
