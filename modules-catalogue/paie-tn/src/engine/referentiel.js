'use strict';
const fs = require('fs');
const path = require('path');
const { d, canon } = require('./dec');

/** Date de référence utilisée pour valider une rubrique (les rubriques ne sont pas datées en V1). */
const DEBUT_RUBRIQUE = '1900-01-01';

const enVigueur = (x, date) => date >= x.debut && (x.fin == null || date <= x.fin);
const chevauche = (a, b) => (b.fin == null || a.debut <= b.fin) && (a.fin == null || b.debut <= a.fin);

/**
 * Référentiel réglementaire : paramètres datés, barèmes datés, catalogue des rubriques.
 * Mêmes fichiers JSON que le moteur Java (dossier shared/).
 */
class Referentiel {
  constructor(jsonParametres, jsonRubriques) {
    const jp = typeof jsonParametres === 'string' ? JSON.parse(jsonParametres) : jsonParametres;
    const jr = typeof jsonRubriques === 'string' ? JSON.parse(jsonRubriques) : jsonRubriques;
    // sources conservées pour dériver un référentiel enrichi des versions saisies (avecAjouts)
    Object.defineProperty(this, '_src', { value: { p: JSON.stringify(jp), r: JSON.stringify(jr) } });
    this.version = jp.version;
    this.parametres = (jp.parametres || []).map((p) => Object.freeze({
      code: p.code, libelle: p.libelle ?? null, type: p.type, valeur: String(p.valeur),
      debut: p.debut, fin: p.fin ?? null, statut: p.statut ?? null, source: p.source ?? null, note: p.note ?? null,
      valeurCanonique: p.type === 'TEXTE' ? String(p.valeur) : canon(d(p.valeur)),
    }));
    this.baremes = (jp.baremes || []).map((b) => {
      const tranches = b.tranches.map((t) => ({ de: d(t.de), a: t.a == null ? null : d(t.a), taux: d(t.taux) }));
      Referentiel.verifierTranches(b.code, tranches);
      return Object.freeze({
        code: b.code, libelle: b.libelle ?? null, debut: b.debut, fin: b.fin ?? null, statut: b.statut ?? null,
        source: b.source ?? null, tranches,
        valeurCanonique: tranches.map((t) => canon(t.de) + '|' + (t.a == null ? '' : canon(t.a)) + '|' + canon(t.taux)).join(';'),
      });
    });
    this.rubriques = new Map();
    for (const r of jr.rubriques || []) {
      if (this.rubriques.has(r.code)) throw new Error('Rubrique en double : ' + r.code);
      const rub = {
        code: r.code, libelle: r.libelle, type: r.type, mode: r.mode, coefParam: r.coefParam ?? null,
        cnss: r.cnss === true, irpp: r.irpp === true, ordre: Number(r.ordre), statut: r.statut ?? null,
      };
      rub.valeurCanonique = `${rub.type}|${rub.mode}|${rub.cnss}|${rub.irpp}|${rub.coefParam ?? ''}`;
      this.rubriques.set(r.code, Object.freeze(rub));
    }
    for (const [liste, nom] of [[this.parametres, ''], [this.baremes, 'le barème ']])
      for (const a of liste) for (const b of liste)
        if (a !== b && a.code === b.code && chevauche(a, b)) throw new Error(`Périodes d'effet qui se chevauchent pour ${nom}${a.code}`);
  }

  static verifierTranches(code, ts) {
    let attendu = d('0');
    ts.forEach((t, k) => {
      if (attendu === null || !t.de.eq(attendu)) throw new Error(`Barème ${code} : tranches non contiguës à ${t.de.toFixed()}`);
      if (t.a == null && k !== ts.length - 1) throw new Error(`Barème ${code} : seule la dernière tranche peut être ouverte`);
      attendu = t.a;
    });
    if (attendu !== null) throw new Error(`Barème ${code} : la dernière tranche doit être ouverte`);
  }

  /** Paramètre en vigueur à la date (AAAA-MM-JJ), ou null. */
  parametre(code, date) {
    const l = this.parametres.filter((p) => p.code === code && enVigueur(p, date));
    if (l.length > 1) throw new Error('Chevauchement de dates pour le paramètre ' + code);
    return l[0] || null;
  }

  bareme(code, date) {
    const l = this.baremes.filter((b) => b.code === code && enVigueur(b, date));
    if (l.length > 1) throw new Error('Chevauchement de dates pour le barème ' + code);
    return l[0] || null;
  }

  /**
   * Référentiel = fichier de base + versions saisies dans l'application (même règle que le moteur Java) :
   * pour chaque code, versions triées par début, la fin de chacune ramenée à la veille de la suivante.
   * @param {Array<{code:string, debut:string, fin?:string|null, valeur?:string, tranches?:Array<{de,a,taux}>, source?:string, note?:string}>} ajouts
   *        code = code du paramètre, ou « BAREME:IRPP » pour un barème
   */
  avecAjouts(ajouts, suffixeVersion) {
    if (!ajouts || !ajouts.length) return this;
    const jp = JSON.parse(this._src.p);
    const dernier = (l, code) => l.filter((x) => x.code === code).sort((a, b) => (a.debut < b.debut ? 1 : -1))[0];
    for (const a of ajouts) {
      if (a.code.startsWith('BAREME:')) {
        const code = a.code.slice(7);
        const modele = dernier(jp.baremes, code);
        if (!modele) throw new Error('Barème inconnu : ' + code);
        jp.baremes.push({ code, libelle: modele.libelle ?? null, debut: a.debut, fin: a.fin ?? null, statut: 'A_CONFIRMER', source: a.source ?? null,
          tranches: a.tranches.map((t) => ({ de: String(t.de), a: t.a == null ? null : String(t.a), taux: String(t.taux) })) });
      } else {
        const modele = dernier(jp.parametres, a.code);
        if (!modele) throw new Error('Paramètre inconnu : ' + a.code);
        jp.parametres.push({ code: a.code, libelle: modele.libelle ?? null, type: modele.type, valeur: String(a.valeur), debut: a.debut, fin: a.fin ?? null,
          statut: 'A_CONFIRMER', source: a.source ?? null, note: a.note ?? null });
      }
    }
    const veille = (iso) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
    for (const l of [jp.parametres, jp.baremes]) {
      const parCode = new Map();
      for (const x of l) { if (!parCode.has(x.code)) parCode.set(x.code, []); parCode.get(x.code).push(x); }
      for (const v of parCode.values()) {
        v.sort((x, y) => (x.debut < y.debut ? -1 : x.debut > y.debut ? 1 : 0));
        for (let i = 0; i + 1 < v.length; i++) {
          const f = veille(v[i + 1].debut);
          if (v[i].fin == null || v[i].fin > f) v[i].fin = f;
        }
      }
    }
    jp.version = this.version + (suffixeVersion || '');
    return new Referentiel(jp, this._src.r);
  }

  /** Charge les fichiers par défaut (dossier shared/ du module) ou des fichiers indiqués. */
  static charger(fichierParametres, fichierRubriques) {
    const base = path.join(__dirname, '..', '..', 'shared');
    return new Referentiel(
      fs.readFileSync(fichierParametres || path.join(base, 'parametres-tn.json'), 'utf8'),
      fs.readFileSync(fichierRubriques || path.join(base, 'rubriques-tn.json'), 'utf8'),
    );
  }
}

module.exports = { Referentiel, DEBUT_RUBRIQUE };
