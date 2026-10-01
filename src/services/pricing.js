// Port fidèle de services/pricing.js (V2) — même formule, mêmes constantes,
// pour garantir des prix identiques entre les deux générations de l'app.
const AMORT = 5;
const FORMATS = {
  '10ml':   { frac: 0.01, emb: 1.5 },
  '30ml':   { frac: 0.03, emb: 2.0 },
  '100ml':  { frac: 0.10, emb: 1.8 },
  '250ml':  { frac: 0.25, emb: 2.5 },
  '1000ml': { frac: 1.00, emb: 4.0 },
};

// costEntry = { cout_matiere, rendement_jour } — généralement la dernière
// ligne de grille_historique dont date_effet <= date de référence.
// costEntry = { cout_matiere, rendement_jour } — généralement la dernière
// ligne de grille_historique dont date_effet <= date de référence.
// oil (= la ligne grille_huiles) porte désormais amortissement et
// electricite_par_litre, configurables par huile plutôt qu'une constante
// fixe pour toutes — reste rétrocompatible (valeurs par défaut si absentes).
function computeCoutRevient(oil, costEntry, settings) {
  const matiere = costEntry.cout_matiere * (1 + settings.matiere_pct / 100);
  const salaire = settings.salaire;
  const prod = Math.max(0.1, costEntry.rendement_jour * (1 + settings.rend_pct / 100));
  const amortissement = oil && oil.amortissement != null ? Number(oil.amortissement) : AMORT;
  const electricite = oil && oil.electricite_par_litre != null ? Number(oil.electricite_par_litre) : 0;
  return matiere + salaire / prod + amortissement + electricite;
}

// oil = la ligne grille_huiles (porte les prix de référence stockés
// detail30_marche/detail30_tableau/t100/t250/t1000).
function getDetailPrice(oil, formatKey, coutRevient, settings) {
  const f = FORMATS[formatKey];
  const baseHT = coutRevient * f.frac + f.emb;
  const margeF = 1 + settings.marge / 100;
  const tvaF = 1 + settings.tva / 100;
  if (formatKey === '30ml') {
    return settings.ref_source === 'marche' ? Number(oil.detail30_marche) : Number(oil.detail30_tableau);
  }
  if (settings.ref_source === 'tableau') {
    if (formatKey === '100ml') return Number(oil.t100);
    if (formatKey === '250ml') return Number(oil.t250);
    if (formatKey === '1000ml') return Number(oil.t1000);
  }
  return baseHT * margeF * tvaF;
}

// remise: { type: 'pourcentage'|'lot', pourcentage, achete, gratuit }
// offre: { achete, gratuit } — offre spéciale globale cumulable, optionnelle
// (ex: achete=9, gratuit=1 -> "9 achetées, la 10ème offerte").
function computeLineTotal(prixDetail, remise, qty, cumulOffre, offre) {
  if (remise && remise.type === 'lot') {
    const bundle = remise.achete + remise.gratuit;
    const fullBundles = Math.floor(qty / bundle);
    const freeUnits = fullBundles * remise.gratuit;
    const payableUnits = qty - freeUnits;
    const total = payableUnits * prixDetail;
    return { prixDetail, total, unitPrice: qty > 0 ? total / qty : prixDetail, freeUnits, cumule: false };
  }
  const pourcentage = remise ? remise.pourcentage : 0;
  const prixApresRemise = prixDetail * (1 - (pourcentage || 0) / 100);
  if (cumulOffre && offre) {
    const bundle = offre.achete + offre.gratuit;
    const fullBundles = Math.floor(qty / bundle);
    const freeUnits = fullBundles * offre.gratuit;
    const payableUnits = qty - freeUnits;
    const total = payableUnits * prixApresRemise;
    return { prixDetail, total, unitPrice: qty > 0 ? total / qty : prixApresRemise, freeUnits, cumule: true };
  }
  const total = prixApresRemise * qty;
  return { prixDetail, total, unitPrice: total / (qty || 1), freeUnits: 0, cumule: false };
}

// Méthode conforme au modèle Excel de référence de l'utilisateur — HT extrait
// PAR LIGNE (PU HT = Prix TTC facturé / (1+taux TVA)), puis FODEC/TVA/Timbre
// ajoutés UNE SEULE FOIS sur le total HT résultant :
//   Total HT = Σ (Prix TTC facturé_i / (1+taux)) × qté_i
//   FODEC = Total HT × 1%
//   Base TVA = Total HT + FODEC
//   TVA = Base TVA × taux
//   Total TTC = Total HT + FODEC + TVA + Timbre
// Important : contrairement à l'ancienne méthode, ce Total TTC final peut être
// LÉGÈREMENT SUPÉRIEUR à la somme des lignes facturées (le FODEC s'ajoute en
// plus du prix catalogue) — c'est le choix explicitement demandé, conforme au
// fichier Excel fourni.
function computeFactureTotalsDepuisLignes(lignes, tvaRate, fodecRate = 1, droitTimbre = 0, timbreSeuil = 1000) {
  const tvaF = tvaRate / 100;
  const fodecF = fodecRate / 100;
  const totalHT = lignes.reduce((s, l) => s + (Number(l.unitPrice) / (1 + tvaF)) * Number(l.qty), 0);
  const fodecMontant = totalHT * fodecF;
  const baseTVA = totalHT + fodecMontant;
  const montantTVA = baseTVA * tvaF;
  const totalTtcAvantTimbre = totalHT + fodecMontant + montantTVA;
  const timbreApplicable = totalTtcAvantTimbre >= timbreSeuil ? droitTimbre : 0;
  const totalTTC = totalTtcAvantTimbre + timbreApplicable;
  return { totalHT, fodecMontant, montantTVA, droitTimbre: timbreApplicable, totalTTC };
}

// Décompose un Total TTC (= ce que le client paie, déjà calculé via la
// grille de prix/remises — inchangé) en HT / FODEC / TVA / Timbre selon la
// chaîne réglementaire tunisienne :
//   FODEC = HT × 1%
//   Base TVA = HT + FODEC
//   TVA = Base TVA × taux
//   TTC = HT + FODEC + TVA + Timbre
// On résout HT par remontée algébrique (le timbre est un montant fixe, pas
// un %, donc on le retire d'abord) :
//   HT = (TTC − Timbre) / [(1 + fodecRate) × (1 + tvaRate)]
function computeFactureTotals(totalTTC, tvaRate, fodecRate = 1, droitTimbre = 0) {
  const fodecF = fodecRate / 100;
  const tvaF = tvaRate / 100;
  const totalHT = tvaRate > 0 || fodecRate > 0
    ? (totalTTC - droitTimbre) / ((1 + fodecF) * (1 + tvaF))
    : totalTTC - droitTimbre;
  const fodecMontant = totalHT * fodecF;
  const baseTVA = totalHT + fodecMontant;
  const montantTVA = baseTVA * tvaF;
  return { totalHT, fodecMontant, montantTVA, droitTimbre, totalTTC };
}

module.exports = { AMORT, FORMATS, computeCoutRevient, getDetailPrice, computeLineTotal, computeFactureTotals, computeFactureTotalsDepuisLignes };
