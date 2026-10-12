// Lecture des registres Excel des Jardins de Jerba (presse, filtration, mélange,
// stock produit fini, mouvement) et préparation de l'import dans TinOR.
// Aucune écriture ici : renvoie le plan d'import, le stock calculé et la liste
// des anomalies (avec la correction appliquée), pour vérification avant import.
//
// Corrections automatiques (toutes listées dans les anomalies) :
//   • JG01 → GJ01, minuscules → majuscules, 0 de tête perdu par Excel (11823 → 011823) ;
//   • lot presse inconnu → même compteur XX et même date, ou même XX et même lot MP ;
//   • n° de lot filtré = préfixe du lot presse + date de filtration ;
//   • source d'un mélange écrite autrement → lot filtré de même compteur XX et même
//     lot MP qui a encore la quantité (le plus proche en quantité) ;
//   • bouteilles de reste (55 ml, 1000 ml) dans le registre produit fini : ce sont
//     des restes du mélange, pas des flacons ;
//   • corrections au cas par cas : fichier scripts/registres/corrections.json.
const ExcelJS = require('exceljs');

const FORMATS_FLACON = [10, 30, 50, 100];
const val = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.text !== undefined) return v.text;
    return null;
  }
  return v;
};
const jour = (x) => (x instanceof Date ? x.toISOString().slice(0, 10) : (x ? String(x).slice(0, 10) : null));
const norm = (s) => String(s ?? '').trim().toUpperCase().replace(/\bJG01\b/g, 'GJ01').replace(/\s+/g, '');
const lotFini = (s) => { const t = String(s ?? '').trim(); return /^\d+$/.test(t) ? t.padStart(6, '0') : t; };
const arr = (n, d = 3) => Math.round(Number(n) * 10 ** d) / 10 ** d;

function feuille(wb, motif) {
  const s = wb.worksheets.find(w => motif.test(w.name));
  if (!s) throw new Error(`Feuille introuvable : ${motif}`);
  const lignes = [];
  s.eachRow((row, i) => lignes.push({ i, v: row.values.slice(1).map(val) }));
  return lignes;
}

async function analyserRegistres(chemin, corrections = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(chemin);
  const anomalies = [];
  const ano = (registre, ou, texte) => anomalies.push({ registre, ou, texte });

  // ---- 1. Presse
  const presse = feuille(wb, /press/i).filter(l => l.v[6] && l.v[1] instanceof Date).map(l => ({
    ligne: l.i, n: l.v[0], date: jour(l.v[1]), lot_mp: String(l.v[2]).trim().replace(/\bJG01\b/i, 'GJ01'), kg: Number(l.v[3]) || 0,
    outil: l.v[4], litres: Number(l.v[5]) || 0, numero: norm(l.v[6]),
  }));
  for (const p of presse) {
    const m = /^(\d+)-(.+)-(\d{8})H$/.exec(p.numero);
    if (!m) { ano('Presse', `ligne ${p.n}`, `n° de lot ${p.numero} illisible`); continue; }
    const dn = `${m[3].slice(0, 4)}-${m[3].slice(4, 6)}-${m[3].slice(6)}`;
    if (dn !== p.date) ano('Presse', `ligne ${p.n}`, `${p.numero} : la date du n° (${dn}) diffère de la date saisie (${p.date}) — n° gardé tel quel, date du n° retenue`), p.date = dn;
  }
  const xx = presse.map(p => p.numero.split('-')[0]);
  xx.forEach((x, i) => { const j = xx.indexOf(x); if (j !== i) ano('Presse', `ligne ${presse[i].n}`, `compteur ${x} utilisé deux fois (${presse[j].numero} et ${presse[i].numero}) — les deux lots sont gardés`); });
  const parPresse = new Map(presse.map(p => [p.numero, p]));

  // ---- 2. Filtration
  const filtration = feuille(wb, /filtr/i).filter(l => typeof l.v[0] === 'number' && l.v[2] && l.v[1] instanceof Date).map(l => ({
    ligne: l.i, n: l.v[0], date: jour(l.v[1]), presse: norm(l.v[2]), litres: Number(l.v[3]) || 0, filtre: l.v[4] ? String(l.v[4]) : null,
    obtenu: Number(l.v[5]) || 0, numero: norm(l.v[6]),
  }));
  for (const f of filtration) {
    if (!parPresse.has(f.presse)) {
      const [x, ...reste] = f.presse.split('-'); const date = reste.pop(); const mp = reste.join('-');
      const memeMP = presse.filter(p => p.numero.startsWith(`${x}-${mp}-`));
      const memeDate = presse.filter(p => p.numero.startsWith(`${x}-`) && p.numero.endsWith(`-${date}`));
      const c = memeMP.length === 1 ? memeMP : memeDate;
      const choix = corrections.presse?.[f.presse] || (c.length === 1 ? c[0].numero : null);
      ano('Filtration', `n° ${f.n}`, `lot presse ${f.presse} absent du registre de presse → ${choix || 'AUCUN (à corriger)'}`);
      f.presse = choix;
    }
    if (!f.presse) continue;
    const attendu = f.presse.replace(/H$/, '').replace(/\d{8}$/, f.date.replace(/-/g, ''));
    if (attendu !== f.numero) { ano('Filtration', `n° ${f.n}`, `lot filtré ${f.numero} → ${attendu} (préfixe du lot presse + date de filtration)`); f.numero_ecrit = f.numero; f.numero = attendu; }
    if (f.obtenu > f.litres + 1e-9) ano('Filtration', `n° ${f.n}`, `obtenu ${f.obtenu} L > huile filtrée ${f.litres} L`);
  }
  // Huile pressée utilisée par les filtrations
  const utilisePresse = new Map();
  for (const f of filtration) if (f.presse) utilisePresse.set(f.presse, arr((utilisePresse.get(f.presse) || 0) + f.litres));
  for (const [n, q] of utilisePresse) if (q > parPresse.get(n).litres + 1e-9) ano('Filtration', n, `${q} L filtrés pour ${parPresse.get(n).litres} L pressés`);
  const parFiltre = new Map(filtration.filter(f => f.presse).map(f => [f.numero, f]));
  const anciens = new Map(filtration.filter(f => f.numero_ecrit).map(f => [f.numero_ecrit, f.numero]));

  // ---- 3. Mélanges (= lots finis yy x1x1 x2x2)
  const melanges = feuille(wb, /lange/i).filter(l => typeof l.v[0] === 'number' && l.v[2] && l.v[1] instanceof Date).map(l => ({
    ligne: l.i, n: l.v[0], date: jour(l.v[1]), numero: lotFini(l.v[2]), ml: Number(l.v[3]) || 0,
    sources: [{ ecrit: norm(l.v[4]), ml: Number(l.v[5]) || 0 }, { ecrit: norm(l.v[7]), ml: Number(l.v[8]) || 0 }].filter(s => s.ecrit && s.ml),
  }));
  const resteFiltre = new Map([...parFiltre].map(([n, f]) => [n, Math.round(f.obtenu * 1000)]));
  for (const m of melanges) {
    for (const [k, s] of m.sources.entries()) {
      const brut = s.ecrit.replace(/H$/, '');
      let lot = corrections.melange?.[`${m.numero}#${k + 1}`] || (parFiltre.has(brut) ? brut : anciens.get(brut));
      if (!lot) {
        const x = (/^(\d+)-/.exec(s.ecrit) || [])[1];
        const four = /GJ01/.test(s.ecrit) ? 'GJ01/2023' : (/-(\d{4})(?:-|\d{8})/.exec(s.ecrit) || [])[1];
        const c = [...parFiltre.values()].filter(f => f.numero.startsWith(`${x}-${four}-`) && resteFiltre.get(f.numero) >= s.ml);
        const avant = c.filter(f => f.date <= m.date);
        const choix = (avant.length ? avant : c).sort((a, b) => Math.abs(resteFiltre.get(a.numero) - s.ml) - Math.abs(resteFiltre.get(b.numero) - s.ml))[0];
        lot = choix?.numero;
        ano('Mélange', `lot ${m.numero}`, `huile ${k + 1} « ${s.ecrit} » n'est pas un n° de lot filtré → ${lot || 'AUCUN (à corriger)'}${choix && !avant.length ? ` — attention : filtré le ${choix.date}, après le mélange du ${m.date}` : ''}`);
      }
      s.lot = lot;
      if (lot) {
        const reste = resteFiltre.get(lot) - s.ml;
        if (reste < -0.5) ano('Mélange', `lot ${m.numero}`, `${s.ml} ml pris sur ${lot} qui n'a plus que ${resteFiltre.get(lot)} ml`);
        resteFiltre.set(lot, reste);
      }
    }
    const somme = m.sources.reduce((t, s) => t + s.ml, 0);
    if (Math.abs(somme - m.ml) > 0.5) ano('Mélange', `lot ${m.numero}`, `${m.sources.map(s => s.ml).join(' + ')} = ${somme} ml ≠ ${m.ml} ml`);
  }
  const parMelange = new Map(melanges.map(m => [m.numero, m]));

  // ---- 4. Conditionnements (registre de stock produit fini)
  const conditionnements = [];
  const pertes = [];
  for (const l of feuille(wb, /produit fini/i)) {
    if (!(l.v[0] instanceof Date) || !l.v[2]) continue;
    const c = { ligne: l.i, date: jour(l.v[0]), lot: lotFini(l.v[2]), ml: Number(l.v[4]) || 0, unites: Number(l.v[5]) || 0, remarque: String(l.v[9] ?? '').trim(), duree_ans: Number(l.v[3]) || null };
    if (!parMelange.has(c.lot)) { ano('Conditionnement', `ligne ${l.i}`, `lot fini ${c.lot} absent du registre de mélange — ligne ignorée`); continue; }
    const perte = /(\d+)\s*pert/i.exec(c.remarque);
    if (perte) pertes.push({ lot: c.lot, date: c.date, ml: Number(perte[1]), remarque: c.remarque });
    if (!FORMATS_FLACON.includes(c.ml)) { ano('Conditionnement', `lot ${c.lot}`, `« ${c.unites} × ${c.ml} ml » du ${c.date} = reste du mélange en bouteille, pas des flacons — non compté`); continue; }
    if (!(c.unites > 0)) continue;
    conditionnements.push(c);
  }
  for (const m of melanges) {
    const mis = conditionnements.filter(c => c.lot === m.numero).reduce((t, c) => t + c.unites * c.ml, 0);
    const perdu = pertes.filter(p => p.lot === m.numero).reduce((t, p) => t + p.ml, 0);
    const ecart = m.ml - mis - perdu;
    if (Math.abs(ecart) > 0.5) ano('Conditionnement', `lot ${m.numero}`, `${mis} ml en flacons + ${perdu} ml de perte pour ${m.ml} ml mélangés : ${ecart > 0 ? `${ecart} ml restent en bouteille` : `${-ecart} ml de trop`}`);
    else if (perdu) ano('Conditionnement', `lot ${m.numero}`, `${mis} ml en flacons + ${perdu} ml de perte (« ${pertes.find(p => p.lot === m.numero).remarque} ») = ${m.ml} ml — perte enregistrée`);
  }

  // ---- 5. Ventes (feuille mouvement)
  let ventes = [];
  for (const l of feuille(wb, /mouvement/i)) {
    if (typeof l.v[0] !== 'number' || !(l.v[1] instanceof Date)) continue;
    const lots = String(l.v[3] ?? '').split(/[\s,;/]+/).filter(Boolean).map(lotFini);
    const details = String(l.v[4] ?? '').split(/\n/).map(t => [/(\d+)\s*[*x×]\s*(\d+)/i.exec(t), /=/.test(t)]).filter(d => d[0]);
    details.forEach(([m, egal], k) => {
      const a = Number(m[1]), b = Number(m[2]);
      const [unites, ml] = egal ? [a, b] : [b, a]; // « 19*30=570 » : unités × format ; « 30*26 » : format × unités
      ventes.push({ ligne: l.i, n: l.v[0], date: jour(l.v[1]), client: String(l.v[6] ?? '').trim(), paiement: l.v[7] || null, lot: lots[k] || lots[lots.length - 1], ml, unites });
    });
  }
  for (const c of corrections.ventes || []) {
    const lotsConnus = new Set(melanges.map(m => m.numero));
    if (c.remplacer) {
      const avant = ventes.filter(v => v.ligne === c.remplacer.ligne && (!c.remplacer.lot || v.lot === c.remplacer.lot));
      if (!avant.length) continue; // correction prévue pour un autre fichier
      ventes = ventes.filter(v => v.ligne !== c.remplacer.ligne);
      ventes.push(...c.remplacer.par.map(p => ({ ...avant[0], ...p })));
      ano('Ventes', `vente n°${avant[0]?.n} du ${avant[0]?.date}`, c.motif);
    }
    if (c.ajouter && c.ajouter.every(x => lotsConnus.has(x.lot))) { ventes.push(...c.ajouter.map(p => ({ ligne: null, n: null, paiement: 'Espèces', ...p }))); ano('Ventes', c.ajouter.map(a => `${a.lot} le ${a.date}`).join(', '), c.motif); }
  }
  ventes.sort((a, b) => a.date.localeCompare(b.date));

  // ---- Stock par lot fini et par format, à la date de chaque vente
  const flacons = new Map();
  const cle = (lot, ml) => `${lot}|${ml}`;
  const evts = [...conditionnements.map(c => ({ d: c.date, k: cle(c.lot, c.ml), q: c.unites })), ...ventes.map(v => ({ d: v.date, k: cle(v.lot, v.ml), q: -v.unites, v }))]
    .sort((a, b) => a.d.localeCompare(b.d) || b.q - a.q);
  for (const e of evts) {
    flacons.set(e.k, (flacons.get(e.k) || 0) + e.q);
    if (flacons.get(e.k) < 0 && e.v) ano('Ventes', `lot ${e.v.lot} · ${e.v.ml} ml`, `vente du ${e.v.date} (${e.v.client}) : ${-flacons.get(e.k)} flacon(s) de plus que le stock à cette date`), e.v.date_avant_stock = true;
  }

  // ---- Stock calculé
  const stock = {
    vrac: presse.map(p => ({ numero: p.numero, litres: arr(p.litres - (utilisePresse.get(p.numero) || 0)) })).filter(x => x.litres > 0.0005),
    filtre: [...resteFiltre].map(([numero, ml]) => ({ numero, litres: arr(ml / 1000) })).filter(x => x.litres > 0.0005),
    flacons: [...flacons].map(([k, u]) => ({ lot: k.split('|')[0], ml: Number(k.split('|')[1]), unites: u })).filter(x => x.unites),
  };
  const lotsMP = [...new Set(presse.map(p => p.lot_mp))].map(numero => ({
    numero, kg: arr(presse.filter(p => p.lot_mp === numero).reduce((t, p) => t + p.kg, 0)),
    date: presse.filter(p => p.lot_mp === numero).map(p => p.date).sort()[0],
  }));
  return { lotsMP, presse, filtration: filtration.filter(f => f.presse), melanges, conditionnements, pertes, ventes, stock, anomalies };
}

module.exports = { analyserRegistres, FORMATS_FLACON };
