'use strict';
// Compare le moteur JS aux résultats Java d'un fichier de cas. Usage : node scripts/comparer-resultats.js cas.json resultats-java.json
const assert = require('assert');
const { Referentiel } = require('../src/engine/referentiel');
const { MoteurPaie } = require('../src/engine/moteur');
const cas = require(require('path').resolve(process.argv[2])).cas;
const java = new Map(require(require('path').resolve(process.argv[3])).resultats.map((r) => [r.id, r.resultat]));
const m = new MoteurPaie(Referentiel.charger());
let ok = 0; const ko = [];
for (const c of cas) {
  const { moteur: _a, ...js } = m.calculer(c.entree);
  const { moteur: _b, ...jv } = java.get(c.id);
  try { assert.deepStrictEqual(js, jv); ok++; } catch (e) { ko.push(c.id); if (ko.length <= 3) console.error(c.id, e.message.slice(0, 1500)); }
}
console.log(`${ok}/${cas.length} identiques` + (ko.length ? ` — écarts : ${ko.slice(0, 20).join(', ')}` : ''));
process.exit(ko.length ? 1 : 0);
