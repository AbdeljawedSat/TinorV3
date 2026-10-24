'use strict';
/** Tests unitaires du moteur JS — mêmes contrôles arithmétiques que MoteurPaieTest (Java). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { Referentiel } = require('../src/engine/referentiel');
const { MoteurPaie, appliquerBareme, finDeMois } = require('../src/engine/moteur');
const { d, f, div3, ZERO } = require('../src/engine/dec');

const ref = Referentiel.charger();
const moteur = new MoteurPaie(ref);
const entree = (periode, base, extra = {}) => ({
  periode, entreprise: {}, salarie: { matricule: 'U1', ...(extra.salarie || {}) },
  contrat: { salaireBase: base, horaireMensuel: '208' }, variables: extra.variables || [], validations: extra.validations || [],
});
const codes = (r) => r.alertes.map((a) => a.code);

test('barème 2025 par tranches', () => {
  const t = ref.bareme('IRPP', '2026-01-31').tranches;
  assert.equal(f(appliquerBareme(t, d('10000'), ZERO, false)), '750.000');
  assert.equal(f(appliquerBareme(t, d('11705.472'), ZERO, false)), '1176.368');
  assert.equal(f(appliquerBareme(t, d('100000'), ZERO, false)), '32750.000');
  assert.equal(ref.bareme('IRPP', '2024-12-31').debut, '2017-01-01');
});

test('CSS : majoration toutes tranches / hors tranche zéro', () => {
  const t = ref.bareme('IRPP', '2026-01-31').tranches;
  const n = appliquerBareme(t, d('12000'), ZERO, false);
  assert.equal(f(appliquerBareme(t, d('12000'), d('0.005'), false).minus(n)), '60.000');
  assert.equal(f(appliquerBareme(t, d('12000'), d('0.005'), true).minus(n)), '35.000');
});

test('célibataire 1 200 TND – contrôle arithmétique complet', () => {
  const r = moteur.calculer(entree('2026-10', '1200'));
  assert.equal(r.synthese.cnssSalarial, '113.160');
  assert.equal(r.fiscal.netImposableAnnuel, '11737.872');
  assert.equal(r.fiscal.irppAnnuel, '1184.468');
  assert.equal(r.synthese.irpp, '98.706');
  assert.equal(r.synthese.css, '4.891');
  assert.equal(r.synthese.netAPayer, '983.243');
  assert.equal(r.synthese.chargesPatronales, '230.640');
  assert.equal(r.certifiable, false);
  assert.equal(r.bloquant, false);
});

test('frais professionnels plafonnés et déductions famille', () => {
  assert.equal(moteur.calculer(entree('2026-10', '5000')).fiscal.fraisProAnnuel, '2000.000');
  const r = moteur.calculer(entree('2026-10', '3000', { salarie: { chefFamille: true, nbEnfants: 6, nbEnfantsEtudiants: 1, nbEnfantsHandicapes: 1 } }));
  assert.equal(r.fiscal.deductionsFamille, '3700.000');
});

test('heures supplémentaires, absence, retenue nette', () => {
  const hs = moteur.calculer(entree('2026-10', '1500', { variables: [{ rubrique: 'HS_1', quantite: '10' }] }));
  assert.equal(hs.lignes.find((l) => l.code === 'HS_1').montant, '90.144');
  const abs = moteur.calculer(entree('2026-10', '1300', { variables: [{ rubrique: 'ABS_JOURS', quantite: '2' }, { rubrique: 'AVANCE', montant: '200' }] }));
  assert.equal(abs.synthese.brut, '1200.000');
  assert.equal(abs.synthese.netAPayer, '783.243');
});

test('erreurs de saisie bloquantes', () => {
  const r = moteur.calculer(entree('2026-10', '1000', { variables: [
    { rubrique: 'XXX', montant: '10' }, { rubrique: 'SAL_BASE', montant: '1' }, { rubrique: 'PRIME_PRESENCE' }, { rubrique: 'PRIME_RENDEMENT', montant: '-5' }] }));
  for (const c of ['RUBRIQUE_INCONNUE', 'VAR_SAL_BASE', 'VARIABLE_INCOMPLETE', 'MONTANT_NEGATIF']) assert.ok(codes(r).includes(c), c);
  assert.equal(r.bloquant, true);
  assert.equal(moteur.calculer(entree('2027-01', '1200')).bloquant, true);
});

test('certification : uniquement pour la valeur validée', () => {
  const e = entree('2026-10', '1200');
  e.entreprise = { tauxAT: '0.004', tauxTFP: '0.01' };
  e.validations = moteur.calculer(e).parametres.map((p) => ({ code: p.code, debut: p.debut, valeur: p.valeur }));
  assert.equal(moteur.calculer(e).certifiable, true);
  e.validations = e.validations.map((v) => (v.code === 'CNSS_SAL_TAUX' ? { ...v, valeur: '0.0968' } : v));
  assert.equal(moteur.calculer(e).certifiable, false);
});

test('arrondi HALF_UP et utilitaires', () => {
  assert.equal(f(d('0.0015')), '0.002');
  assert.equal(f(d('-0.0015')), '-0.002');
  assert.equal(div3(d('2'), d('3')).toFixed(3), '0.667');
  assert.equal(finDeMois('2028-02'), '2028-02-29');
  assert.equal(finDeMois('2026-12'), '2026-12-31');
});

test('référentiel : chevauchements et tranches non contiguës refusés', () => {
  assert.throws(() => new Referentiel({ version: 'x', parametres: [
    { code: 'A', type: 'TAUX', valeur: '1', debut: '2020-01-01', fin: null },
    { code: 'A', type: 'TAUX', valeur: '2', debut: '2021-01-01', fin: null }], baremes: [] }, { rubriques: [] }));
  assert.throws(() => new Referentiel({ version: 'x', parametres: [], baremes: [{ code: 'IRPP', debut: '2020-01-01',
    tranches: [{ de: '0', a: '5000', taux: '0' }, { de: '6000', a: null, taux: '0.2' }] }] }, { rubriques: [] }));
});

test('versions saisies : taux CSS 2027, nouveau barème, taux CNSS (mêmes chiffres que le moteur Java)', () => {
  const r1 = ref.avecAjouts([{ code: 'CSS_MAJORATION', debut: '2027-01-01', valeur: '0.01', source: 'test' }], '+t1');
  assert.equal(r1.version, '2026.10-1+t1');
  const c1 = new MoteurPaie(r1).calculer(entree('2027-01', '1200'));
  assert.equal(c1.bloquant, false);
  assert.equal(c1.fiscal.cssAnnuel, '117.379');
  assert.equal(c1.synthese.netAPayer, '978.352');
  assert.equal(new MoteurPaie(r1).calculer(entree('2026-10', '1200')).synthese.netAPayer, '983.243');

  const r2 = ref.avecAjouts([{ code: 'BAREME:IRPP', debut: '2026-01-01', tranches: [{ de: '0', a: '6000', taux: '0' }, { de: '6000', a: null, taux: '0.2' }] }], '+t2');
  assert.equal(r2.bareme('IRPP', '2025-06-30').fin, '2025-12-31');
  const c2 = new MoteurPaie(r2).calculer(entree('2026-10', '1200'));
  assert.equal(c2.fiscal.irppAnnuel, '1147.574');
  assert.equal(c2.synthese.netAPayer, '986.318');
  assert.equal(new MoteurPaie(r2).calculer(entree('2025-06', '1200')).synthese.netAPayer, '983.243');

  const r3 = ref.avecAjouts([{ code: 'CNSS_SAL_TAUX', debut: '2026-07-01', valeur: '0.0968' }], '+t3');
  assert.equal(r3.parametre('CNSS_SAL_TAUX', '2026-06-30').fin, '2026-06-30');
  assert.equal(new MoteurPaie(r3).calculer(entree('2026-10', '1200')).synthese.cnssSalarial, '119.160');
  assert.equal(new MoteurPaie(r3).calculer(entree('2026-06', '1200')).synthese.cnssSalarial, '113.160');

  assert.throws(() => ref.avecAjouts([{ code: 'BAREME:IRPP', debut: '2026-01-01', tranches: [{ de: '0', a: '5000', taux: '0' }, { de: '6000', a: null, taux: '0.2' }] }], '+x'));
  assert.throws(() => ref.avecAjouts([{ code: 'INCONNU', debut: '2026-01-01', valeur: '1' }], '+x'));
});
