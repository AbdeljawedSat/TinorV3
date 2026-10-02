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

// Huile en vrac : une huile fabriquée, sans format de conditionnement.
function estHuileVrac(produit) {
  return !!produit && produit.type_article !== 'MATIERE_PREMIERE' && !produit.format_id && !!cleHuileVrac(produit.nom);
}

module.exports = { normaliser, cleGraine, cleHuileVrac, estGraine, estHuileVrac };
