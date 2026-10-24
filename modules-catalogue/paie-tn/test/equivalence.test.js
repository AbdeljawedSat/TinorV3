'use strict';
/**
 * Équivalence Java / JS : chaque cas partagé (shared/tests/cas-equivalence.json) doit produire
 * EXACTEMENT le même résultat que le moteur Java (shared/tests/resultats-java.json), champ par champ,
 * au millime près — seul le champ "moteur" diffère.
 * Régénérer les résultats Java : java -cp paie-engine.jar tn.jas.paie.engine.CalculCas cas.json resultats-java.json
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { Referentiel } = require('../src/engine/referentiel');
const { MoteurPaie } = require('../src/engine/moteur');

const dossier = path.join(__dirname, '..', 'shared', 'tests');
const cas = require(path.join(dossier, 'cas-equivalence.json')).cas;
const java = new Map(require(path.join(dossier, 'resultats-java.json')).resultats.map((r) => [r.id, r.resultat]));
const moteur = new MoteurPaie(Referentiel.charger());

test('les résultats Java existent pour tous les cas', () => {
  assert.equal(java.size, cas.length);
});

for (const c of cas) {
  test(`${c.id} – ${c.description}`, () => {
    const js = moteur.calculer(c.entree);
    const attendu = java.get(c.id);
    assert.ok(attendu, 'résultat Java manquant');
    assert.equal(js.moteur, 'js-1.0.0');
    assert.equal(attendu.moteur, 'java-1.0.0');
    const { moteur: _a, ...a } = js;
    const { moteur: _b, ...b } = attendu;
    assert.deepStrictEqual(a, b);
  });
}
