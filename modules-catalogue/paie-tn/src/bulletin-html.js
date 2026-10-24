'use strict';
/**
 * Bulletin de paie HTML imprimable (A4) — le navigateur produit le PDF (Imprimer > Enregistrer en PDF),
 * ce qui garantit un rendu correct de l'arabe (mode bilingue fr-ar).
 */
const T = {
  titre: ['BULLETIN DE PAIE', 'كشف الأجر'],
  matricule: ['Matricule', 'المعرّف'], cnss: ['N° CNSS', 'رقم الضمان الاجتماعي'], fonction: ['Fonction', 'الخطة'], categorie: ['Catégorie', 'الصنف'],
  entree: ["Date d'entrée", 'تاريخ الانتداب'], situation: ['Situation', 'الوضعية العائلية'], paiement: ['Paiement', 'طريقة الخلاص'],
  code: ['Code', 'الرمز'], libelle: ['Libellé', 'البيان'], quantite: ['Quantité', 'الكمية'], taux: ['Taux', 'النسبة'], gain: ['Gain', 'مستحقات'], retenue: ['Retenue', 'اقتطاع'],
  brut: ['SALAIRE BRUT', 'الأجر الخام'], cotisation: ['Cotisation', 'المساهمة'], base: ['Base', 'القاعدة'], partSal: ['Part salariale', 'حصة الأجير'],
  partPat: ['Part patronale', 'حصة المؤجر'], tauxSal: ['Taux sal.', 'نسبة الأجير'], tauxPat: ['Taux pat.', 'نسبة المؤجر'], total: ['TOTAL', 'المجموع'],
  fiscal: ['Retenues fiscales', 'الاقتطاعات الجبائية'], montant: ['Montant', 'المبلغ'], imposable: ['Salaire imposable mensuel', 'الأجر الخاضع للضريبة شهريا'],
  netImp: ['Revenu net imposable annualisé', 'الدخل الصافي الخاضع للضريبة سنويا'], irpp: ['IRPP du mois', 'الضريبة على الدخل للشهر'],
  css: ['Contribution sociale de solidarité', 'المساهمة الاجتماعية التضامنية'], net: ['NET À PAYER', 'الصافي للدفع'], cout: ['Coût employeur', 'الكلفة على المؤجر'],
  nonCertifie: ['NON CERTIFIÉ – paramètres à confirmer', 'غير مصادق – معايير للتأكيد'], simulation: ['SIMULATION – document provisoire', 'محاكاة – وثيقة وقتية'],
  chef: ['chef de famille', 'رئيس عائلة'], nonChef: ['non chef de famille', 'ليس رئيس عائلة'], enfants: ['enfant(s)', 'طفل'],
  version: ['Version de calcul', 'نسخة الاحتساب'],
};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_AR = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const esc = (s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
/** Montant au format tunisien/français : 1 234,567 */
function m(v) {
  if (v == null || v === '') return '';
  const [ent, dec = '000'] = String(v).split('.');
  const neg = ent.startsWith('-');
  const e = (neg ? ent.slice(1) : ent).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + e + ',' + dec.padEnd(3, '0');
}
const pct = (t) => (t == null ? '' : (Number(t) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 }) + ' %');
const fr = (s) => (s == null ? '' : String(s).replace('.', ','));
const dfr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function page({ entreprise, salarie, periode, calcul, resultat }, bilingue) {
  const L = (k) => (bilingue ? `${T[k][0]} <span class="ar">${T[k][1]}</span>` : T[k][0]);
  const r = resultat, s = salarie, f = r.fiscal, sy = r.synthese;
  const certifie = calcul.certifiable === true || calcul.certifiable === 1;
  const filigrane = !certifie ? L('nonCertifie') : calcul.statut !== 'VALIDE' ? L('simulation') : '';
  const lignes = r.lignes.map((l) => {
    const ret = l.type === 'RETENUE_BRUT';
    return `<tr><td>${esc(l.code)}</td><td>${esc(l.libelle)}</td><td class="n">${fr(l.quantite)}</td><td class="n">${fr(l.taux)}</td>
      <td class="n">${ret ? '' : m(l.montant)}</td><td class="n">${ret ? m(l.montant) : ''}</td></tr>`;
  }).join('');
  const cot = r.cotisations.map((c) => `<tr><td>${esc(c.libelle)}</td><td class="n">${m(c.base)}</td><td class="n">${pct(c.tauxSalarial)}</td>
    <td class="n">${m(c.montantSalarial)}</td><td class="n">${pct(c.tauxPatronal)}</td><td class="n">${m(c.montantPatronal)}</td></tr>`).join('');
  const ret = r.retenuesNet.map((x) => `<tr><td>${esc(x.libelle)}</td><td class="n">${m(x.montant)}</td></tr>`).join('');
  const alertes = r.alertes.map((a) => `<li class="${a.niveau === 'ERREUR' ? 'err' : ''}">${esc(a.niveau)} : ${esc(a.message)}</li>`).join('');
  return `<section class="page">
  ${filigrane ? `<div class="filigrane">${filigrane}</div>` : ''}
  <header><div><h1>${esc(entreprise.raisonSociale || '(Entreprise non renseignée)')}</h1>
    <p class="gris">MF : ${esc(entreprise.matriculeFiscal)} &nbsp; N° employeur CNSS : ${esc(entreprise.numEmployeurCnss)}<br>${esc(entreprise.adresse)}</p></div>
    <div class="droite"><h2>${L('titre')}</h2><p>${MOIS[periode.mois - 1]} ${periode.annee}${bilingue ? ` <span class="ar">${MOIS_AR[periode.mois - 1]} ${periode.annee}</span>` : ''}</p>
    <p class="gris petit">${L('version')} ${calcul.version} – ${esc(calcul.statut)}</p></div></header>
  <div class="bloc"><div><b>${esc(s.nom)} ${esc(s.prenom)}</b><br>${L('matricule')} : ${esc(s.matricule)} &nbsp; ${L('cnss')} : ${esc(s.numCnss)}<br>
    ${L('fonction')} : ${esc(s.fonction)} &nbsp; ${L('categorie')} : ${esc(s.categorie)}</div>
    <div>${L('entree')} : ${dfr(s.dateEntree)}<br>${L('situation')} : ${s.chefFamille ? L('chef') + `, ${s.nbEnfants} ` + L('enfants') : L('nonChef')}<br>
    ${L('paiement')} : ${esc(s.modePaiement)}</div></div>
  <table><thead><tr><th>${L('code')}</th><th>${L('libelle')}</th><th class="n">${L('quantite')}</th><th class="n">${L('taux')}</th><th class="n">${L('gain')}</th><th class="n">${L('retenue')}</th></tr></thead>
    <tbody>${lignes}<tr class="tot"><td></td><td>${L('brut')}</td><td></td><td></td><td class="n">${m(sy.brut)}</td><td></td></tr></tbody></table>
  <table><thead><tr><th>${L('cotisation')}</th><th class="n">${L('base')}</th><th class="n">${L('tauxSal')}</th><th class="n">${L('partSal')}</th><th class="n">${L('tauxPat')}</th><th class="n">${L('partPat')}</th></tr></thead>
    <tbody>${cot}<tr class="tot"><td>${L('total')}</td><td></td><td></td><td class="n">${m(sy.cnssSalarial)}</td><td></td><td class="n">${m(sy.chargesPatronales)}</td></tr></tbody></table>
  <table><thead><tr><th>${L('fiscal')}</th><th class="n">${L('montant')}</th></tr></thead><tbody>
    <tr><td>${L('imposable')}</td><td class="n">${m(f.imposableMensuel)}</td></tr>
    <tr><td>${L('netImp')} <span class="gris">(frais pro. ${m(f.fraisProAnnuel)} ; déductions ${m(f.deductionsFamille)})</span></td><td class="n">${m(f.netImposableAnnuel)}</td></tr>
    <tr><td>${L('irpp')} <span class="gris">(annuel ${m(f.irppAnnuel)} / 12)</span></td><td class="n">${m(sy.irpp)}</td></tr>
    <tr><td>${L('css')}</td><td class="n">${m(sy.css)}</td></tr>${ret}</tbody></table>
  <div class="pied-net"><span class="gris">${L('cout')} : ${m(sy.coutEmployeur)} TND</span>
    <div class="net"><span>${L('net')}</span><b>${m(sy.netAPayer)} TND</b></div></div>
  <ul class="alertes">${alertes}</ul>
  <footer>Moteur ${esc(calcul.moteur)} – paramètres ${esc(calcul.paramsVersion)} – calculé par ${esc(calcul.calculePar)} le ${esc(String(calcul.calculeLe || '').slice(0, 10))}. Document à conserver sans limitation de durée.</footer>
</section>`;
}

/** @param {Array} bulletins [{entreprise, salarie, periode, calcul, resultat}] */
function bulletinsHtml(bulletins, { bilingue = false, impressionAuto = false } = {}) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bulletins de paie</title>
${bilingue ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">' : ''}
<style>
  :root { --accent:#2e5e3e; --fond:#f1f3f5; --gris:#6c757d; --rouge:#b00020; }
  * { box-sizing:border-box; }
  body { margin:0; background:#e9ecef; font:11px/1.4 "Helvetica Neue", Arial, sans-serif; color:#212529; }
  .page { position:relative; width:210mm; min-height:297mm; margin:12px auto; padding:14mm 13mm; background:#fff; overflow:hidden; page-break-after:always; }
  header { display:flex; justify-content:space-between; gap:16px; }
  h1 { font-size:16px; margin:0 0 4px; } h2 { color:var(--accent); font-size:18px; margin:0; }
  .droite { text-align:right; } .gris { color:var(--gris); } .petit { font-size:9px; } p { margin:2px 0; }
  .ar { font-family:Cairo, "Noto Naskh Arabic", "Segoe UI", sans-serif; direction:rtl; unicode-bidi:isolate; font-size:.92em; color:#495057; margin-inline-start:4px; }
  .bloc { display:flex; justify-content:space-between; gap:16px; background:var(--fond); padding:8px 10px; margin:14px 0 10px; }
  .bloc > div { flex:1; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  th { background:var(--accent); color:#fff; text-align:left; padding:4px 6px; font-weight:600; }
  td { padding:3px 6px; border-bottom:1px solid #dee2e6; }
  .n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  tr.tot td { background:var(--fond); font-weight:700; }
  .pied-net { display:flex; justify-content:space-between; align-items:flex-start; margin-top:10px; }
  .net { background:var(--accent); color:#fff; padding:8px 12px; min-width:240px; display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .net b { font-size:18px; } .net .ar, th .ar { color:#e3efe7; }
  .alertes { color:var(--gris); font-size:9px; padding-left:16px; } .alertes .err { color:var(--rouge); }
  footer { position:absolute; bottom:10mm; left:13mm; right:13mm; color:var(--gris); font-size:8px; }
  .filigrane { position:absolute; top:45%; left:-10%; width:120%; text-align:center; transform:rotate(-32deg); font-size:34px; font-weight:700;
    color:var(--rouge); opacity:.12; pointer-events:none; white-space:nowrap; }
  @media print { body { background:#fff; } .page { margin:0; box-shadow:none; } @page { size:A4; margin:0; } }
  @media screen and (max-width:820px) { .page { width:auto; min-height:0; margin:0; padding:16px; } header, .bloc, .pied-net { flex-direction:column; } footer { position:static; margin-top:12px; } }
</style></head><body>
${bulletins.map((b) => page(b, bilingue)).join('\n')}
${impressionAuto ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script>' : ''}
</body></html>`;
}

module.exports = { bulletinsHtml, montantFr: m };
