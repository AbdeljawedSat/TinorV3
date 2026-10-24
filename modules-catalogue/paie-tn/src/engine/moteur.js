'use strict';
/**
 * Moteur de paie tunisien — portage ligne à ligne de tn.jas.paie.engine.MoteurPaie (Java).
 * Toute modification doit être reportée dans les deux moteurs, puis vérifiée par test/equivalence.test.js.
 */
const { Decimal, ZERO, DOUZE, d, r3, div3, min, max, f, canon } = require('./dec');
const { DEBUT_RUBRIQUE } = require('./referentiel');

const VERSION = '1.0.0';
const MOTEUR = 'js-' + VERSION;

function finDeMois(periode) {
  const [a, m] = periode.split('-').map(Number);
  const j = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${periode}-${String(j).padStart(2, '0')}`;
}

function canonValidation(v) {
  try {
    const x = new Decimal(String(v).trim());
    if (x.isFinite()) return canon(x);
  } catch (e) { /* valeur texte */ }
  return String(v).trim();
}

function entier(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error('Nombre entier attendu : ' + v);
  return n;
}

/** Normalise l'entrée (même structure JSON que EntreePaie.depuisMap côté Java). */
function normaliserEntree(e) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.periode || '')) throw new Error('Période invalide (AAAA-MM attendu) : ' + e.periode);
  const ent = e.entreprise || {};
  const sal = e.salarie || {};
  const ctr = e.contrat || {};
  return {
    periode: e.periode,
    tauxAT: d(ent.tauxAT), tauxTFP: d(ent.tauxTFP),
    matricule: sal.matricule ?? null, regime: sal.regime ?? 'CNSS_RSNA',
    dateEntree: sal.dateEntree ?? null, dateSortie: sal.dateSortie ?? null,
    chefFamille: sal.chefFamille === true || sal.chefFamille === 1,
    nbEnfants: entier(sal.nbEnfants), nbEnfantsEtudiants: entier(sal.nbEnfantsEtudiants), nbEnfantsHandicapes: entier(sal.nbEnfantsHandicapes),
    salaireBase: d(ctr.salaireBase),
    horaireMensuel: ctr.horaireMensuel == null || ctr.horaireMensuel === '' ? d('208') : d(ctr.horaireMensuel),
    tauxHoraire: d(ctr.tauxHoraire),
    variables: (e.variables || []).map((v) => ({
      rubrique: v.rubrique ?? null, quantite: d(v.quantite), taux: d(v.taux), montant: d(v.montant), commentaire: v.commentaire ?? null,
    })),
    validations: (e.validations || []).map((v) => ({ code: v.code, debut: String(v.debut).slice(0, 10), valeur: v.valeur == null ? null : String(v.valeur) })),
  };
}

/** Barème progressif ; si majoration ≠ 0, chaque taux est majoré (sauf tranche à 0 % si horsTrancheZero). Résultat exact. */
function appliquerBareme(tranches, revenu, majoration, horsTrancheZero) {
  let total = ZERO;
  for (const t of tranches) {
    if (revenu.lte(t.de)) break;
    const haut = t.a == null ? revenu : min(revenu, t.a);
    let taux = t.taux;
    if (!majoration.isZero() && !(horsTrancheZero && taux.isZero())) taux = taux.plus(majoration);
    total = total.plus(haut.minus(t.de).times(taux));
  }
  return total;
}

class MoteurPaie {
  constructor(referentiel) { this.ref = referentiel; }

  calculer(entreeBrute) {
    const ref = this.ref;
    const e = normaliserEntree(entreeBrute);
    const date = finDeMois(e.periode);
    const debutMois = e.periode + '-01';
    const utilises = new Map();
    const alertes = [];
    const alerte = (niveau, code, message) => alertes.push({ niveau, code, message });
    const estValide = (code, debut, valeur) =>
      e.validations.some((v) => v.code === code && v.debut === debut && v.valeur != null && canonValidation(v.valeur) === valeur);
    const utilise = (code, debut, valeur, statut, source) =>
      utilises.set(code, { code, debut, valeur, statut, source, valide: estValide(code, debut, valeur) });
    const param = (code) => {
      const p = ref.parametre(code, date);
      if (!p) { alerte('ERREUR', 'PARAM_MANQUANT', `Paramètre ${code} absent pour la période ${e.periode}`); return null; }
      utilise(p.code, p.debut, p.valeurCanonique, p.statut, p.source);
      return d(p.valeur);
    };
    const paramFacultatif = (code) => {
      const p = ref.parametre(code, date);
      if (!p) return ZERO;
      utilise(p.code, p.debut, p.valeurCanonique, p.statut, p.source);
      return d(p.valeur);
    };
    const paramTexte = (code, defaut) => {
      const p = ref.parametre(code, date);
      if (!p) return defaut;
      utilise(p.code, p.debut, p.valeurCanonique, p.statut, p.source);
      return p.valeur;
    };
    const nz = (v) => (v == null ? ZERO : v);
    const manque = (r, quoi) => alerte('ERREUR', 'VARIABLE_INCOMPLETE', `Rubrique ${r.code} : ${quoi} manquant(e)`);

    // ---- 1. Contrôles d'entrée ----
    if (e.regime !== 'CNSS_RSNA')
      alerte('ERREUR', 'REGIME_NON_GERE', `Régime ${e.regime} non pris en charge en V1 (seul CNSS_RSNA est calculé)`);
    if (e.salaireBase == null || e.salaireBase.lte(0)) alerte('ERREUR', 'SALAIRE_BASE', 'Salaire de base absent ou nul');
    if (e.horaireMensuel == null || e.horaireMensuel.lte(0)) alerte('ERREUR', 'HORAIRE', 'Horaire mensuel absent ou nul');
    if (e.dateEntree != null && e.dateEntree > date) alerte('ERREUR', 'SALARIE_NON_ENTRE', "Date d'entrée postérieure à la période");
    if (e.dateSortie != null && e.dateSortie < debutMois) alerte('ERREUR', 'SALARIE_SORTI', 'Salarié sorti avant la période');
    if ((e.dateEntree != null && e.dateEntree > debutMois) || (e.dateSortie != null && e.dateSortie < date))
      alerte('AVERTISSEMENT', 'MOIS_INCOMPLET', "Entrée ou sortie en cours de mois : saisir l'absence correspondante (pas de prorata automatique)");
    if (e.nbEnfants < 0 || e.nbEnfantsEtudiants < 0 || e.nbEnfantsHandicapes < 0) alerte('ERREUR', 'ENFANTS', "Nombre d'enfants négatif");

    const base = e.salaireBase == null ? ZERO : e.salaireBase;
    const horaire = e.horaireMensuel == null || e.horaireMensuel.lte(0) ? null : e.horaireMensuel;

    // ---- 2. Lignes ----
    const lignes = [];
    const retenuesNet = [];
    let brut = ZERO, baseCnss = ZERO, baseIrpp = ZERO, baseCnssIrpp = ZERO, totalRetNet = ZERO;

    const elements = [{ r: ref.rubriques.get('SAL_BASE'), v: null }];
    for (const v of e.variables) {
      const r = ref.rubriques.get(v.rubrique);
      if (!r) { alerte('ERREUR', 'RUBRIQUE_INCONNUE', 'Rubrique inconnue : ' + v.rubrique); continue; }
      if (r.code === 'SAL_BASE') { alerte('ERREUR', 'VAR_SAL_BASE', 'Le salaire de base provient du contrat : ne pas le saisir en variable'); continue; }
      elements.push({ r, v });
    }
    elements.sort((a, b) => a.r.ordre - b.r.ordre); // tri stable

    for (const { r, v } of elements) {
      let quantite = null, taux = null, montant;
      let lib = r.libelle;
      if (v == null) {
        montant = r3(base);
      } else {
        let ok = true;
        switch (r.mode) {
          case 'MONTANT':
            if (v.montant == null) { manque(r, 'montant'); ok = false; break; }
            montant = r3(v.montant);
            break;
          case 'QTE_TAUX':
            if (v.quantite == null || v.taux == null) { manque(r, 'quantité et taux'); ok = false; break; }
            quantite = v.quantite; taux = v.taux;
            montant = r3(quantite.times(taux));
            break;
          case 'HEURES_SUP': {
            if (v.quantite == null) { manque(r, 'quantité (heures)'); ok = false; break; }
            const coef = param(r.coefParam);
            if (coef == null) { ok = false; break; }
            quantite = v.quantite; taux = coef;
            if (e.tauxHoraire != null) montant = r3(quantite.times(e.tauxHoraire).times(coef));
            else if (horaire != null) montant = div3(quantite.times(base).times(coef), horaire);
            else ok = false;
            break;
          }
          case 'ABS_JOURS': {
            if (v.quantite == null) { manque(r, 'quantité (jours)'); ok = false; break; }
            const jours = param('JOURS_OUVRABLES_MOIS');
            if (jours == null) { ok = false; break; }
            quantite = v.quantite;
            if (quantite.gt(jours))
              alerte('AVERTISSEMENT', 'ABSENCE_ELEVEE', `Absence de ${canon(quantite)} jours supérieure aux jours ouvrables du mois`);
            montant = div3(quantite.times(base), jours);
            break;
          }
          case 'ABS_HEURES':
            if (v.quantite == null) { manque(r, 'quantité (heures)'); ok = false; break; }
            quantite = v.quantite;
            if (e.tauxHoraire != null) montant = r3(quantite.times(e.tauxHoraire));
            else if (horaire != null) montant = div3(quantite.times(base), horaire);
            else ok = false;
            break;
          default:
            alerte('ERREUR', 'MODE_INCONNU', 'Mode de calcul inconnu pour ' + r.code);
            ok = false;
        }
        if (!ok) continue;
        if (montant.isNeg() && !montant.isZero()) {
          alerte('ERREUR', 'MONTANT_NEGATIF', `Montant négatif pour ${r.code} : saisir une rubrique de retenue`);
          continue;
        }
        if (v.commentaire != null && String(v.commentaire).trim() !== '') lib = lib + ' – ' + v.commentaire;
      }
      utilise('RUB:' + r.code, DEBUT_RUBRIQUE, r.valeurCanonique, r.statut, 'Catalogue des rubriques');

      if (r.type === 'RETENUE_NET') {
        retenuesNet.push({ code: r.code, libelle: lib, montant: f(montant) });
        totalRetNet = totalRetNet.plus(montant);
        continue;
      }
      const signe = r.type === 'RETENUE_BRUT' ? montant.neg() : montant;
      brut = brut.plus(signe);
      if (r.cnss) baseCnss = baseCnss.plus(signe);
      if (r.irpp) baseIrpp = baseIrpp.plus(signe);
      if (r.cnss && r.irpp) baseCnssIrpp = baseCnssIrpp.plus(signe);
      lignes.push({
        code: r.code, libelle: lib, type: r.type,
        quantite: quantite == null ? null : canon(quantite), taux: taux == null ? null : canon(taux),
        montant: f(montant), cnss: r.cnss, irpp: r.irpp,
      });
    }
    if (brut.isNeg() && !brut.isZero()) alerte('ERREUR', 'BRUT_NEGATIF', 'Salaire brut négatif');
    baseCnss = max(baseCnss, ZERO);
    baseIrpp = max(baseIrpp, ZERO);
    baseCnssIrpp = max(baseCnssIrpp, ZERO);

    // ---- 3. Cotisations ----
    const tSal = nz(param('CNSS_SAL_TAUX'));
    const tPat = nz(param('CNSS_PAT_TAUX'));
    const peSal = paramFacultatif('CNSS_PE_SAL');
    const pePat = paramFacultatif('CNSS_PE_PAT');
    const tAT = e.tauxAT != null ? e.tauxAT : nz(param('AT_TAUX_DEFAUT'));
    const tTFP = e.tauxTFP != null ? e.tauxTFP : nz(param('TFP_TAUX_DEFAUT'));
    const tFop = nz(param('FOPROLOS_TAUX'));

    const cnssS = r3(baseCnss.times(tSal)), cnssP = r3(baseCnss.times(tPat));
    const peS = r3(baseCnss.times(peSal)), peP = r3(baseCnss.times(pePat));
    const at = r3(baseCnss.times(tAT)), tfp = r3(baseCnss.times(tTFP)), fop = r3(baseCnss.times(tFop));
    const cot = (code, libelle, tauxSal, montSal, tauxPat, montPat) => ({
      code, libelle, base: f(baseCnss),
      tauxSalarial: tauxSal == null ? null : canon(tauxSal), montantSalarial: montSal == null ? null : f(montSal),
      tauxPatronal: tauxPat == null ? null : canon(tauxPat), montantPatronal: montPat == null ? null : f(montPat),
    });
    const cotisations = [cot('CNSS', 'CNSS régime général', tSal, cnssS, tPat, cnssP)];
    if (!peSal.isZero() || !pePat.isZero()) cotisations.push(cot('PERTE_EMPLOI', "Fonds perte d'emploi", peSal, peS, pePat, peP));
    cotisations.push(cot('AT', 'Accident du travail', null, null, tAT, at));
    cotisations.push(cot('TFP', 'Taxe formation professionnelle', null, null, tTFP, tfp));
    cotisations.push(cot('FOPROLOS', 'FOPROLOS', null, null, tFop, fop));
    const cnssSalarial = cnssS.plus(peS);
    const chargesPat = cnssP.plus(peP).plus(at).plus(tfp).plus(fop);

    // ---- 4. Fiscalité ----
    const cnssDeductible = r3(baseCnssIrpp.times(tSal)).plus(r3(baseCnssIrpp.times(peSal)));
    const imposableMensuel = max(baseIrpp.minus(cnssDeductible), ZERO);
    const imposableAnnuel = imposableMensuel.times(DOUZE);
    const fpTaux = nz(param('FRAIS_PRO_TAUX'));
    const fpPlafond = nz(param('FRAIS_PRO_PLAFOND'));
    const fraisPro = r3(min(imposableAnnuel.times(fpTaux), fpPlafond));

    let deductions = ZERO;
    if (e.chefFamille) {
      deductions = deductions.plus(nz(param('DED_CHEF_FAMILLE')));
      if (e.nbEnfants > 0) {
        const maxEnf = nz(param('DED_ENFANT_MAX'));
        const n = Math.min(e.nbEnfants, Math.trunc(maxEnf.toNumber()));
        deductions = deductions.plus(nz(param('DED_ENFANT')).times(n));
      }
      if (e.nbEnfantsEtudiants > 0) deductions = deductions.plus(nz(param('DED_ENFANT_ETUDIANT')).times(e.nbEnfantsEtudiants));
      if (e.nbEnfantsHandicapes > 0) deductions = deductions.plus(nz(param('DED_ENFANT_HANDICAPE')).times(e.nbEnfantsHandicapes));
    } else if (e.nbEnfants + e.nbEnfantsEtudiants + e.nbEnfantsHandicapes > 0) {
      alerte('AVERTISSEMENT', 'ENFANTS_SANS_CHEF', 'Enfants déclarés mais salarié non chef de famille : déductions pour enfants non appliquées');
    }
    const netImposableAnnuel = max(imposableAnnuel.minus(fraisPro).minus(deductions), ZERO);

    const bIrpp = ref.bareme('IRPP', date);
    let irppAnnuel = ZERO, irppMensuel = ZERO, cssAnnuel = ZERO, cssMensuel = ZERO;
    if (!bIrpp) {
      alerte('ERREUR', 'BAREME_MANQUANT', `Barème IRPP absent pour la période ${e.periode}`);
    } else {
      utilise('BAREME:IRPP', bIrpp.debut, bIrpp.valeurCanonique, bIrpp.statut, bIrpp.source);
      irppAnnuel = r3(appliquerBareme(bIrpp.tranches, netImposableAnnuel, ZERO, false));
      irppMensuel = div3(irppAnnuel, DOUZE);
      if (!ref.parametre('CSS_MAJORATION', date)) {
        alerte('ERREUR', 'PARAM_MANQUANT', `Paramètre CSS_MAJORATION absent pour la période ${e.periode}`);
      } else {
        const maj = param('CSS_MAJORATION');
        const seuil = nz(param('CSS_SEUIL_EXONERATION'));
        const horsZero = paramTexte('CSS_MODE', 'TOUTES') === 'HORS_TRANCHE_ZERO';
        if (netImposableAnnuel.gt(seuil)) {
          const majore = appliquerBareme(bIrpp.tranches, netImposableAnnuel, maj, horsZero);
          const normal = appliquerBareme(bIrpp.tranches, netImposableAnnuel, ZERO, false);
          cssAnnuel = r3(majore.minus(normal));
          cssMensuel = div3(cssAnnuel, DOUZE);
        }
      }
    }

    // ---- 5. Net ----
    const net = brut.minus(cnssSalarial).minus(irppMensuel).minus(cssMensuel).minus(totalRetNet);
    if (net.isNeg() && !net.isZero()) alerte('ERREUR', 'NET_NEGATIF', 'Net à payer négatif : vérifier les retenues');

    // ---- 6. Certification ----
    const parametres = [...utilises.keys()].sort().map((k) => utilises.get(k));
    const nonValides = parametres.filter((p) => p.valide !== true).length;
    if (nonValides > 0)
      alerte('AVERTISSEMENT', 'NON_CERTIFIE', `${nonValides} élément(s) réglementaire(s) non validé(s) : bulletin NON CERTIFIÉ`);
    const bloquant = alertes.some((a) => a.niveau === 'ERREUR');

    return {
      moteur: MOTEUR,
      paramsVersion: ref.version,
      periode: e.periode,
      matricule: e.matricule,
      lignes,
      totaux: { brut: f(brut), baseCnss: f(baseCnss), baseIrpp: f(baseIrpp) },
      cotisations,
      fiscal: {
        cnssDeductible: f(cnssDeductible), imposableMensuel: f(imposableMensuel), imposableAnnuel: f(imposableAnnuel),
        fraisProAnnuel: f(fraisPro), deductionsFamille: f(deductions), netImposableAnnuel: f(netImposableAnnuel),
        irppAnnuel: f(irppAnnuel), irppMensuel: f(irppMensuel), cssAnnuel: f(cssAnnuel), cssMensuel: f(cssMensuel),
      },
      retenuesNet,
      synthese: {
        brut: f(brut), cnssSalarial: f(cnssSalarial), irpp: f(irppMensuel), css: f(cssMensuel),
        totalRetenuesNet: f(totalRetNet), netAPayer: f(net), chargesPatronales: f(chargesPat), coutEmployeur: f(brut.plus(chargesPat)),
      },
      parametres,
      certifiable: !bloquant && nonValides === 0,
      bloquant,
      alertes,
    };
  }
}

module.exports = { MoteurPaie, appliquerBareme, finDeMois, VERSION, MOTEUR };
