/*!
 * TinOR – module Paie (interface). JavaScript vanilla, sans dépendance.
 * Intégration dans tinor_admin.html :
 *   <div id="paie"></div>
 *   <script src="/paie/tinor-paie-ui.js"></script>
 *   <script>TinorPaie.monter(document.getElementById('paie'), { api: '/api/paie' });</script>
 * Options : api (préfixe des routes), entetes() (en-têtes d'authentification éventuels), credentials ('include' par défaut).
 * Les montants affichés viennent toujours du serveur : le navigateur ne calcule rien.
 */
(function (global) {
  'use strict';

  var CSS = '\
.tp{--tp-accent:#C8963A;--tp-accent-fonce:#9a7128;--tp-fond:#faf7ef;--tp-carte:#fff;--tp-texte:#1f1f1f;--tp-gris:#6b6b6b;--tp-bord:#e7dfcc;--tp-ok:#2e7d4f;--tp-err:#b3261e;--tp-warn:#9a6700;\
font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--tp-texte);background:var(--tp-fond);padding:12px;border-radius:10px}\
.tp *{box-sizing:border-box}.tp h3{margin:0 0 10px;font-size:16px}.tp .tp-onglets{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;border-bottom:2px solid var(--tp-bord);margin-bottom:12px}\
.tp .tp-onglets button{white-space:nowrap;border:0;background:none;padding:8px 12px;cursor:pointer;color:var(--tp-gris);font:inherit;border-bottom:3px solid transparent;margin-bottom:-2px}\
.tp .tp-onglets button.actif{color:var(--tp-texte);border-bottom-color:var(--tp-accent);font-weight:600}\
.tp .tp-carte{background:var(--tp-carte);border:1px solid var(--tp-bord);border-radius:8px;padding:12px;margin-bottom:12px}\
.tp .tp-grille{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px}.tp .tp-grille>*,.tp .tp-detail>*{min-width:0}.tp .tp-detail>div,.tp details{overflow-x:auto}\
@media(max-width:820px){.tp .tp-grille{grid-template-columns:1fr!important}.tp{padding:8px}.tp .tp-carte{padding:10px}}\
.tp .tp-barre{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}\
.tp button.tp-btn{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid var(--tp-bord);background:#fff;cursor:pointer}\
.tp button.tp-btn:hover:not(:disabled){border-color:var(--tp-accent)}.tp button.tp-btn:disabled{opacity:.45;cursor:not-allowed}\
.tp button.tp-prim{background:var(--tp-accent);border-color:var(--tp-accent);color:#fff}.tp button.tp-prim:hover:not(:disabled){background:var(--tp-accent-fonce)}\
.tp button.tp-danger{color:var(--tp-err)}\
.tp input,.tp select,.tp textarea{font:inherit;padding:6px 8px;border:1px solid var(--tp-bord);border-radius:6px;background:#fff;min-width:0}\
.tp label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--tp-gris)}.tp label.tp-case{flex-direction:row;align-items:center;gap:6px;color:var(--tp-texte);font-size:14px}\
.tp .tp-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end}\
.tp .tp-table{overflow-x:auto}.tp table{width:100%;border-collapse:collapse;font-size:13px}\
.tp th{text-align:left;font-weight:600;color:var(--tp-gris);border-bottom:2px solid var(--tp-bord);padding:6px 8px;white-space:nowrap}\
.tp td{border-bottom:1px solid var(--tp-bord);padding:6px 8px}.tp td.n,.tp th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}\
.tp tr.sel td{background:#fbf3df}.tp tbody tr.cliquable{cursor:pointer}.tp tbody tr.cliquable:hover td{background:#fdf8ec}\
.tp .tp-badge{display:inline-block;white-space:nowrap;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#eee;color:#444}\
.tp .b-OUVERTE{background:#e8f0fe;color:#1a56b0}.tp .b-CALCULEE{background:#fff4d6;color:#8a5a00}.tp .b-VALIDEE{background:#e3f4ea;color:var(--tp-ok)}.tp .b-CLOTUREE{background:#e9e9e9;color:#333}\
.tp .b-ok{background:#e3f4ea;color:var(--tp-ok)}.tp .b-non{background:#fde8e7;color:var(--tp-err)}\
.tp .tp-liste{list-style:none;margin:0;padding:0}.tp .tp-liste li{padding:8px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;gap:6px}\
.tp .tp-liste li:hover{background:#fdf8ec}.tp .tp-liste li.sel{background:#fbf3df;font-weight:600}\
.tp .tp-msg{padding:8px 12px;border-radius:6px;margin-bottom:10px}.tp .tp-msg.err{background:#fde8e7;color:var(--tp-err)}.tp .tp-msg.ok{background:#e3f4ea;color:var(--tp-ok)}.tp .tp-msg.warn{background:#fff4d6;color:var(--tp-warn)}\
.tp .tp-gris{color:var(--tp-gris)}.tp .tp-total{font-weight:600;margin-top:8px}.tp .tp-detail{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:820px){.tp .tp-detail{grid-template-columns:1fr}}\
.tp .tp-alertes{margin:6px 0 10px;padding-left:18px}.tp .tp-alertes .ERREUR{color:var(--tp-err)}.tp .tp-alertes .AVERTISSEMENT{color:var(--tp-warn)}\
.tp dialog{border:1px solid var(--tp-bord);border-radius:10px;padding:16px;max-width:min(720px,94vw);width:100%}.tp dialog::backdrop{background:rgba(0,0,0,.35)}\
.tp .tp-net{font-size:18px;font-weight:700;color:var(--tp-accent-fonce)}';

  function esc(v) {
    return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function m(v) {
    if (v == null || v === '') return '';
    var p = String(v).split('.'), ent = p[0], dec = (p[1] || '').padEnd(3, '0').slice(0, 3), neg = ent.charAt(0) === '-';
    if (neg) ent = ent.slice(1);
    return (neg ? '−' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
  }
  function dfr(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''; }
  function pct(t) { return t == null ? '' : (Number(t) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 }) + ' %'; }
  /** Somme exacte de deux montants à 3 décimales (texte), en millimes entiers : aucun flottant. */
  function somme(a, b) {
    var mil = function (v) { var s = String(v), neg = s.charAt(0) === '-', p = (neg ? s.slice(1) : s).split('.'); var x = BigInt(p[0] + (p[1] || '').padEnd(3, '0').slice(0, 3)); return neg ? -x : x; };
    var t = mil(a) + mil(b), neg = t < 0n, s = (neg ? -t : t).toString().padStart(4, '0');
    return (neg ? '-' : '') + s.slice(0, -3) + '.' + s.slice(-3);
  }
  function per(p) { return p.annee + '-' + String(p.mois).padStart(2, '0'); }

  function monter(racine, options) {
    options = options || {};
    var API = (options.api || '/api/paie').replace(/\/$/, '');
    var etat = { onglet: 'paie', meta: null, periodes: [], periodeId: null, calculs: [], calculSel: null, salaries: [], salarieSel: null, inactifs: false, q: '',
      varPeriodeId: null, varSalarieId: null, parametres: null, paramSel: null };

    if (!document.getElementById('tp-style')) {
      var st = document.createElement('style');
      st.id = 'tp-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    racine.classList.add('tp');

    function requete(methode, chemin, corps, brut) {
      var h = Object.assign({ Accept: brut ? '*/*' : 'application/json' }, options.entetes ? options.entetes() : {});
      if (corps !== undefined) h['Content-Type'] = 'application/json';
      return fetch(API + chemin, { method: methode, headers: h, credentials: options.credentials || 'include', body: corps !== undefined ? JSON.stringify(corps) : undefined })
        .then(function (r) {
          if (brut && r.ok) return r;
          return r.text().then(function (t) {
            var j = null;
            try { j = t ? JSON.parse(t) : null; } catch (e) { /* non JSON */ }
            if (!r.ok) throw new Error((j && j.erreur) || ('Erreur ' + r.status));
            return j;
          });
        });
    }
    var get = function (c) { return requete('GET', c); }, post = function (c, b) { return requete('POST', c, b || {}); };
    var peut = function (d) { return etat.meta && etat.meta.droits.indexOf(d) >= 0; };

    function message(texte, type) {
      var z = racine.querySelector('.tp-zone-msg');
      if (!z) return;
      z.innerHTML = texte ? '<div class="tp-msg ' + (type || 'ok') + '">' + esc(texte) + '</div>' : '';
      if (texte && type !== 'err') setTimeout(function () { if (z.textContent.indexOf(texte.slice(0, 20)) >= 0) z.innerHTML = ''; }, 6000);
    }
    function erreur(e) { message(e.message || String(e), 'err'); }
    function action(fn) { return function () { message(''); try { var p = fn.apply(this, arguments); if (p && p.catch) p.catch(erreur); } catch (e) { erreur(e); } }; }

    function telecharger(chemin, nom) {
      return requete('GET', chemin, undefined, true).then(function (r) { return r.blob(); }).then(function (b) {
        var u = URL.createObjectURL(b), a = document.createElement('a');
        a.href = u; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
      });
    }
    function ouvrirHtml(chemin) {
      var w = window.open('', '_blank');
      return requete('GET', chemin, undefined, true).then(function (r) { return r.text(); }).then(function (html) {
        if (!w) throw new Error("Fenêtre bloquée par le navigateur : autorisez les fenêtres surgissantes");
        w.document.open(); w.document.write(html); w.document.close();
      }, function (e) { if (w) w.close(); throw e; });
    }

    // ------------------------------------------------------------------ squelette
    function rendre() {
      var onglets = [['paie', 'Paie du mois'], ['salaries', 'Salariés & contrats'], ['variables', 'Éléments variables'], ['parametres', 'Paramètres réglementaires']];
      if (peut('ADMINISTRER')) onglets.push(['entreprise', 'Entreprise'], ['journal', "Journal d'audit"]);
      racine.innerHTML = '<div class="tp-onglets">' + onglets.map(function (o) {
        return '<button data-onglet="' + o[0] + '" class="' + (etat.onglet === o[0] ? 'actif' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div><div class="tp-zone-msg"></div><div class="tp-contenu"></div>' +
        '<p class="tp-gris" style="font-size:12px;margin:8px 0 0">' + esc(etat.meta.utilisateur.login) + ' (' + esc(etat.meta.utilisateur.role) + ') · moteur ' +
        esc(etat.meta.moteur) + ' · paramètres ' + esc(etat.meta.paramsVersion) + (etat.meta.controleDeuxNiveaux ? ' · contrôle à deux niveaux actif' : '') + '</p>';
      racine.querySelectorAll('[data-onglet]').forEach(function (b) {
        b.onclick = function () { etat.onglet = b.getAttribute('data-onglet'); rendre(); };
      });
      ({ paie: ecranPaie, salaries: ecranSalaries, variables: ecranVariables, parametres: ecranParametres, entreprise: ecranEntreprise, journal: ecranJournal })[etat.onglet]();
    }
    var contenu = function () { return racine.querySelector('.tp-contenu'); };

    // ------------------------------------------------------------------ Paie du mois
    function ecranPaie() {
      get('/periodes').then(function (ps) {
        etat.periodes = ps;
        if (!etat.periodeId && ps.length) etat.periodeId = ps[0].id;
        return etat.periodeId ? get('/periodes/' + etat.periodeId + '/calculs') : [];
      }).then(function (cs) {
        etat.calculs = cs;
        dessinerPaie();
      }).catch(erreur);
    }

    function dessinerPaie() {
      var p = etat.periodes.filter(function (x) { return x.id === etat.periodeId; })[0];
      var s = p ? p.statut : null, modif = s === 'OUVERTE' || s === 'CALCULEE', aCalculs = etat.calculs.length > 0;
      var tot = { brut: '0.000', net: '0.000', cout: '0.000', nc: 0 };
      etat.calculs.forEach(function (k) { tot.brut = somme(tot.brut, k.brut); tot.net = somme(tot.net, k.net); tot.cout = somme(tot.cout, k.coutEmployeur); if (!k.certifiable) tot.nc++; });
      var html = '<div class="tp-grille"><div class="tp-carte"><h3>Périodes</h3><ul class="tp-liste">' +
        etat.periodes.map(function (x) {
          return '<li data-periode="' + x.id + '" class="' + (x.id === etat.periodeId ? 'sel' : '') + '"><span>' + per(x) + '</span><span class="tp-badge b-' + x.statut + '">' + x.statut + '</span></li>';
        }).join('') + '</ul>' + (etat.periodes.length ? '' : '<p class="tp-gris">Aucune période.</p>') +
        (peut('SIMULER') ? '<div class="tp-form" style="margin-top:10px"><label>Année<input type="number" class="tp-annee" value="' + new Date().getFullYear() + '" min="2017" max="2100"></label>' +
          '<label>Mois<select class="tp-mois">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (i) {
            return '<option value="' + i + '"' + (i === new Date().getMonth() + 1 ? ' selected' : '') + '>' + String(i).padStart(2, '0') + '</option>';
          }).join('') + '</select></label><button class="tp-btn tp-nouvelle">+ Nouvelle période</button></div>' : '') + '</div>' +
        '<div><div class="tp-carte"><div class="tp-barre">' +
        '<button class="tp-btn tp-prim tp-simuler"' + (p && modif && peut('SIMULER') ? '' : ' disabled') + '>Lancer la simulation</button>' +
        '<button class="tp-btn tp-valider"' + (s === 'CALCULEE' && peut('VALIDER_PAIE') ? '' : ' disabled') + '>Valider la paie</button>' +
        '<button class="tp-btn tp-cloturer"' + (s === 'VALIDEE' && peut('CLOTURER') ? '' : ' disabled') + '>Clôturer</button>' +
        '<button class="tp-btn tp-danger tp-rouvrir"' + ((s === 'VALIDEE' || s === 'CLOTUREE') && peut('ROUVRIR') ? '' : ' disabled') + '>Rouvrir…</button>' +
        '<button class="tp-btn tp-bulletins"' + (aCalculs && peut('EXPORTER') ? '' : ' disabled') + '>Bulletins FR</button>' +
        '<button class="tp-btn tp-bulletins-ar"' + (aCalculs && peut('EXPORTER') ? '' : ' disabled') + '>Bulletins FR / AR</button>' +
        '<select class="tp-etat"' + (aCalculs && peut('EXPORTER') ? '' : ' disabled') + '><option value="">États…</option>' +
        '<option value="livre-paie.xlsx">Livre de paie (Excel)</option><option value="livre-paie.csv">Livre de paie (CSV)</option>' +
        '<option value="etat-cnss.xlsx">État CNSS (Excel)</option><option value="etat-retenues.xlsx">Retenues IRPP/CSS (Excel)</option>' +
        '<option value="etat-paiement.xlsx">État de paiement (Excel)</option></select></div>' +
        (p ? '' : '<p class="tp-gris">Créez une période pour commencer.</p>') +
        (p && !aCalculs ? '<p class="tp-gris">Aucun calcul pour ' + per(p) + ' : saisissez les éléments variables puis lancez la simulation.</p>' : '') +
        (aCalculs ? '<div class="tp-table"><table><thead><tr><th>Matricule</th><th>Nom</th><th class="n">V.</th><th>Statut</th><th class="n">Brut</th>' +
          '<th class="n">CNSS</th><th class="n">IRPP</th><th class="n">CSS</th><th class="n">Net à payer</th><th class="n">Coût employeur</th><th>Certifié</th><th>Alertes</th></tr></thead><tbody>' +
          etat.calculs.map(function (k) {
            var err = k.resultat.alertes.filter(function (a) { return a.niveau === 'ERREUR'; }).length;
            var av = k.resultat.alertes.filter(function (a) { return a.niveau === 'AVERTISSEMENT' && a.code !== 'NON_CERTIFIE'; }).length;
            return '<tr class="cliquable' + (etat.calculSel === k.id ? ' sel' : '') + '" data-calcul="' + k.id + '"><td>' + esc(k.salarie.matricule) + '</td><td>' +
              esc(k.salarie.nom + ' ' + k.salarie.prenom) + '</td><td class="n">' + k.version + '</td><td>' + esc(k.statut) + '</td><td class="n">' + m(k.brut) +
              '</td><td class="n">' + m(k.cnssSal) + '</td><td class="n">' + m(k.irpp) + '</td><td class="n">' + m(k.css) + '</td><td class="n"><b>' + m(k.net) +
              '</b></td><td class="n">' + m(k.coutEmployeur) + '</td><td><span class="tp-badge ' + (k.certifiable ? 'b-ok">oui' : 'b-non">NON') + '</span></td><td>' +
              (err ? '<span style="color:var(--tp-err)">' + err + ' erreur(s)</span> ' : '') + (av ? av + ' avert.' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div><div class="tp-total">' + etat.calculs.length + ' salarié(s) · Brut ' + m(tot.brut) + ' · Net ' +
          m(tot.net) + ' · Coût employeur ' + m(tot.cout) + (tot.nc ? ' · <span style="color:var(--tp-err)">' + tot.nc + ' NON CERTIFIÉ(S)</span>' : '') +
          '</div>' : '') +
        '</div><div class="tp-detail-zone"></div></div></div>';
      contenu().innerHTML = html;
      var c = contenu();
      c.querySelectorAll('[data-periode]').forEach(function (li) {
        li.onclick = function () { etat.periodeId = Number(li.getAttribute('data-periode')); etat.calculSel = null; ecranPaie(); };
      });
      c.querySelectorAll('[data-calcul]').forEach(function (tr) {
        tr.onclick = function () { etat.calculSel = Number(tr.getAttribute('data-calcul')); dessinerPaie(); };
      });
      var b = function (sel, fn) { var x = c.querySelector(sel); if (x) x.onclick = action(fn); };
      b('.tp-nouvelle', function () {
        return post('/periodes', { annee: Number(c.querySelector('.tp-annee').value), mois: Number(c.querySelector('.tp-mois').value) })
          .then(function (np) { etat.periodeId = np.id; message('Période ' + per(np) + ' créée.'); ecranPaie(); });
      });
      b('.tp-simuler', function () {
        return post('/periodes/' + p.id + '/simuler').then(function (r) {
          var bl = r.calculs.filter(function (k) { return k.bloquant; }).length;
          message(r.calculs.length + ' salarié(s) calculé(s).' + (bl ? ' ' + bl + ' calcul(s) avec erreur bloquante.' : '') +
            (r.anomalies.length ? ' Anomalies : ' + r.anomalies.join(' ; ') : ''), bl || r.anomalies.length ? 'warn' : 'ok');
          ecranPaie();
        });
      });
      b('.tp-valider', function () {
        return get('/periodes/' + p.id + '/controle-validation').then(function (r) {
          var txt = 'Valider la paie de ' + per(p) + ' (' + etat.calculs.length + ' bulletin(s)) ?';
          if (r.avertissements.length) txt += '\n\nATTENTION – ' + r.avertissements.length + ' bulletin(s) NON CERTIFIÉ(S) : paramètres réglementaires non validés par un professionnel.\n' + r.avertissements.slice(0, 8).join('\n');
          if (!confirm(txt)) return;
          return post('/periodes/' + p.id + '/valider').then(function () { message('Paie ' + per(p) + ' validée.'); ecranPaie(); });
        });
      });
      b('.tp-cloturer', function () {
        if (!confirm('Clôturer ' + per(p) + ' ? Aucune modification ne sera possible sans réouverture journalisée.')) return;
        return post('/periodes/' + p.id + '/cloturer').then(function () { message('Période clôturée.'); ecranPaie(); });
      });
      b('.tp-rouvrir', function () {
        var motif = prompt('Motif de la réouverture de ' + per(p) + ' (obligatoire, journalisé) :');
        if (motif === null) return;
        return post('/periodes/' + p.id + '/rouvrir', { motif: motif }).then(function () { message('Période rouverte.', 'warn'); ecranPaie(); });
      });
      var cibles = function () { return etat.calculSel ? '&salarieId=' + etat.calculs.filter(function (k) { return k.id === etat.calculSel; })[0].salarieId : ''; };
      b('.tp-bulletins', function () { return ouvrirHtml('/periodes/' + p.id + '/bulletins?langue=fr' + cibles()); });
      b('.tp-bulletins-ar', function () { return ouvrirHtml('/periodes/' + p.id + '/bulletins?langue=fr-ar' + cibles()); });
      var se = c.querySelector('.tp-etat');
      if (se) se.onchange = action(function () {
        var f = se.value; se.value = '';
        if (f) return telecharger('/periodes/' + p.id + '/etats/' + f, f.replace('.', '_' + per(p) + '.'));
      });
      var k = etat.calculs.filter(function (x) { return x.id === etat.calculSel; })[0];
      if (k) c.querySelector('.tp-detail-zone').innerHTML = '<div class="tp-carte">' + detailHtml(k.salarie, k, k.resultat) +
        '<div class="tp-barre" style="margin-top:10px"><button class="tp-btn tp-comparer">Comparer avec la version précédente</button></div><div class="tp-comparaison"></div></div>';
      b('.tp-comparer', function () {
        return get('/periodes/' + p.id + '/comparer/' + k.salarieId).then(function (e) {
          c.querySelector('.tp-comparaison').innerHTML = e.length ? '<table><thead><tr><th>Élément</th><th class="n">Avant</th><th class="n">Après</th><th class="n">Écart</th></tr></thead><tbody>' +
            e.map(function (x) { return '<tr><td>' + esc(x.element) + '</td><td class="n">' + m(x.avant) + '</td><td class="n">' + m(x.apres) + '</td><td class="n">' + esc(x.ecart) + '</td></tr>'; }).join('') +
            '</tbody></table>' : '<p class="tp-gris">Aucun écart avec la version précédente (ou version unique).</p>';
        });
      });
    }

    function detailHtml(s, k, r) {
      var f = r.fiscal, sy = r.synthese;
      return '<h3>' + esc(s ? s.nom + ' ' + s.prenom : r.matricule) + (k ? ' — version ' + k.version + ' (' + esc(k.statut) + ')' : '') + ' ' +
        '<span class="tp-badge ' + (r.certifiable ? 'b-ok">certifiable' : 'b-non">NON CERTIFIÉ') + '</span></h3>' +
        (r.alertes.length ? '<ul class="tp-alertes">' + r.alertes.map(function (a) { return '<li class="' + a.niveau + '">' + esc(a.message) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="tp-detail"><div><table><thead><tr><th>Rémunération</th><th class="n">Montant</th></tr></thead><tbody>' +
        r.lignes.map(function (l) {
          return '<tr><td>' + esc(l.libelle) + (l.quantite ? ' <span class="tp-gris">(' + esc(l.quantite) + (l.taux ? ' × ' + esc(l.taux) : '') + ')</span>' : '') +
            '</td><td class="n">' + (l.type === 'RETENUE_BRUT' ? '−' : '') + m(l.montant) + '</td></tr>';
        }).join('') + '<tr><td><b>Brut</b></td><td class="n"><b>' + m(sy.brut) + '</b></td></tr></tbody></table>' +
        '<table style="margin-top:10px"><thead><tr><th>Cotisation</th><th class="n">Base</th><th class="n">Salarié</th><th class="n">Employeur</th></tr></thead><tbody>' +
        r.cotisations.map(function (c) {
          return '<tr><td>' + esc(c.libelle) + '</td><td class="n">' + m(c.base) + '</td><td class="n">' + (c.tauxSalarial ? pct(c.tauxSalarial) + ' · ' + m(c.montantSalarial) : '') +
            '</td><td class="n">' + pct(c.tauxPatronal) + ' · ' + m(c.montantPatronal) + '</td></tr>';
        }).join('') + '</tbody></table></div><div><table><thead><tr><th>Fiscalité (annualisation)</th><th class="n"></th></tr></thead><tbody>' +
        [['CNSS déductible', f.cnssDeductible], ['Imposable mensuel', f.imposableMensuel], ['Imposable annualisé', f.imposableAnnuel], ['Frais professionnels', f.fraisProAnnuel],
          ['Déductions famille', f.deductionsFamille], ['Net imposable annuel', f.netImposableAnnuel], ['IRPP annuel', f.irppAnnuel], ['IRPP du mois', f.irppMensuel],
          ['CSS annuelle', f.cssAnnuel], ['CSS du mois', f.cssMensuel]].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + m(x[1]) + '</td></tr>'; }).join('') +
        '</tbody></table><table style="margin-top:10px"><tbody>' +
        r.retenuesNet.map(function (x) { return '<tr><td>' + esc(x.libelle) + '</td><td class="n">−' + m(x.montant) + '</td></tr>'; }).join('') +
        '<tr><td><b>Net à payer</b></td><td class="n tp-net">' + m(sy.netAPayer) + '</td></tr><tr><td>Charges patronales</td><td class="n">' + m(sy.chargesPatronales) +
        '</td></tr><tr><td>Coût employeur</td><td class="n">' + m(sy.coutEmployeur) + '</td></tr></tbody></table></div></div>' +
        '<details style="margin-top:10px"><summary class="tp-gris">Éléments réglementaires utilisés (' + r.parametres.length + ')</summary><table><tbody>' +
        r.parametres.map(function (x) {
          return '<tr><td>' + esc(x.code) + '</td><td>' + esc(String(x.valeur).length > 60 ? String(x.valeur).slice(0, 60) + '…' : x.valeur) + '</td><td><span class="tp-badge ' +
            (x.valide ? 'b-ok">validé' : 'b-non">à confirmer') + '</span></td></tr>';
        }).join('') + '</tbody></table></details>';
    }

    // ------------------------------------------------------------------ Salariés
    function ecranSalaries() {
      get('/salaries?q=' + encodeURIComponent(etat.q) + (etat.inactifs ? '&inactifs=1' : '')).then(function (l) {
        etat.salaries = l;
        var sel = l.filter(function (s) { return s.id === etat.salarieSel; })[0];
        return (sel ? get('/salaries/' + sel.id + '/contrats') : Promise.resolve([])).then(function (ctr) { dessinerSalaries(sel, ctr); });
      }).catch(erreur);
    }

    function dessinerSalaries(sel, contrats) {
      var gerer = peut('GERER_SALARIES');
      contenu().innerHTML = '<div class="tp-carte"><div class="tp-barre"><input class="tp-q" placeholder="Rechercher (matricule, nom, fonction)" value="' + esc(etat.q) + '" style="flex:1;min-width:200px">' +
        '<label class="tp-case"><input type="checkbox" class="tp-inactifs"' + (etat.inactifs ? ' checked' : '') + '> inactifs</label>' +
        (gerer ? '<button class="tp-btn tp-importer" title="Créer des salariés à partir des employés de TinOR">⇩ Importer depuis TinOR</button><button class="tp-btn tp-prim tp-nouveau">+ Nouveau salarié</button>' : '') + '</div><div class="tp-table"><table><thead><tr><th>Matricule</th><th>Nom</th><th>Prénom</th>' +
        '<th>Fonction</th><th>Entrée</th><th>Sortie</th><th>Chef famille</th><th class="n">Enfants</th><th>Actif</th></tr></thead><tbody>' +
        etat.salaries.map(function (s) {
          return '<tr class="cliquable' + (sel && sel.id === s.id ? ' sel' : '') + '" data-sal="' + s.id + '"><td>' + esc(s.matricule) + '</td><td>' + esc(s.nom) + '</td><td>' + esc(s.prenom) +
            '</td><td>' + esc(s.fonction) + '</td><td>' + dfr(s.dateEntree) + '</td><td>' + dfr(s.dateSortie) + '</td><td>' + (s.chefFamille ? 'oui' : 'non') + '</td><td class="n">' +
            (s.nbEnfants + s.nbEnfantsEtudiants + s.nbEnfantsHandicapes) + '</td><td>' + (s.actif ? 'oui' : 'non') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (etat.salaries.length ? '' : '<p class="tp-gris">Aucun salarié.</p>') + '</div>' +
        (sel ? '<div class="tp-carte"><div class="tp-barre"><h3 style="margin:0;flex:1">' + esc(sel.matricule + ' – ' + sel.nom + ' ' + sel.prenom) + '</h3>' +
          (gerer ? '<button class="tp-btn tp-modifier">Modifier la fiche</button>' : '') + '</div><h3>Contrats et avenants</h3>' +
          '<p class="tp-gris" style="margin-top:-6px">Le contrat le plus récent applicable sur la période est utilisé pour la paie.</p>' +
          '<div class="tp-table"><table><thead><tr><th>Type</th><th>Début</th><th>Fin</th><th class="n">Salaire de base</th><th class="n">Horaire mensuel</th><th class="n">Taux horaire</th></tr></thead><tbody>' +
          contrats.map(function (k) {
            return '<tr><td>' + esc(k.typeContrat) + '</td><td>' + dfr(k.dateDebut) + '</td><td>' + dfr(k.dateFin) + '</td><td class="n">' + m(k.salaireBase) + '</td><td class="n">' +
              esc(k.horaireMensuel) + '</td><td class="n">' + (k.tauxHoraire ? m(k.tauxHoraire) : '<span class="tp-gris">calculé</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (contrats.length ? '' : '<p class="tp-msg warn">Aucun contrat : ce salarié ne peut pas être payé.</p>') +
          (gerer ? '<h3 style="margin-top:12px">Ajouter un contrat / avenant</h3><div class="tp-form tp-ctr">' +
            '<label>Type<select name="typeContrat"><option>CDI</option><option>CDD</option><option>SIVP</option><option>KARAMA</option><option>AUTRE</option></select></label>' +
            '<label>Début *<input type="date" name="dateDebut" value="' + esc(sel.dateEntree) + '"></label><label>Fin<input type="date" name="dateFin"></label>' +
            '<label>Salaire de base mensuel (TND) *<input name="salaireBase" inputmode="decimal"></label>' +
            '<label>Horaire mensuel *<select name="horaireMensuel"><option value="208">208 h (48 h/sem.)</option><option value="173.33">173,33 h (40 h/sem.)</option></select></label>' +
            '<label>Taux horaire (vide = calculé)<input name="tauxHoraire" inputmode="decimal"></label><button class="tp-btn tp-prim tp-ajout-ctr">Ajouter</button></div>' : '') + '</div>' : '') +
        '<dialog class="tp-dlg"></dialog>';
      var c = contenu();
      var q = c.querySelector('.tp-q'), t;
      q.oninput = function () { clearTimeout(t); t = setTimeout(function () { etat.q = q.value; ecranSalaries(); }, 300); };
      c.querySelector('.tp-inactifs').onchange = function (e) { etat.inactifs = e.target.checked; ecranSalaries(); };
      c.querySelectorAll('[data-sal]').forEach(function (tr) { tr.onclick = function () { etat.salarieSel = Number(tr.getAttribute('data-sal')); ecranSalaries(); }; });
      var nv = c.querySelector('.tp-nouveau'); if (nv) nv.onclick = function () { formSalarie(null); };
      var im = c.querySelector('.tp-importer'); if (im) im.onclick = action(function () { return dialogueImport(); });
      var md = c.querySelector('.tp-modifier'); if (md) md.onclick = function () { formSalarie(sel); };
      var ac = c.querySelector('.tp-ajout-ctr');
      if (ac) ac.onclick = action(function () {
        var o = {}; c.querySelectorAll('.tp-ctr [name]').forEach(function (i) { o[i.name] = i.value.replace(',', '.').trim(); });
        return post('/salaries/' + sel.id + '/contrats', o).then(function () { message('Contrat ajouté.'); ecranSalaries(); });
      });
    }

    // Import des employés de TinOR : l'identité vient de TinOR, le reste (CNSS, famille, RIB, contrat) se complète ensuite dans la fiche.
    function dialogueImport() {
      var dlg = contenu().querySelector('.tp-dlg');
      return get('/tinor/employes').then(function (liste) {
        var aImporter = liste.filter(function (e) { return !e.dejaImporte; });
        dlg.innerHTML = '<h3>Importer depuis les employés de TinOR</h3><div class="tp-zone-dlg"></div>' +
          (aImporter.length ? '<p class="tp-gris">Cochez les personnes à créer comme salariés de paie. Elles seront créées avec leur matricule, nom, prénom et fonction ; ' +
            'ajoutez ensuite leur contrat, leur N° CNSS et leur situation familiale dans leur fiche.</p>' +
            '<div class="tp-barre"><label class="tp-case"><input type="checkbox" class="tp-tout" checked> Tout cocher</label>' +
            '<label>Date d\'entrée pour celles qui n\'en ont pas dans TinOR *<input type="date" class="tp-date-defaut"></label></div>' +
            '<div class="tp-table"><table><thead><tr><th></th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Fonction</th><th>Date d\'entrée</th></tr></thead><tbody>' +
            liste.map(function (e) {
              return '<tr' + (e.dejaImporte ? ' class="tp-gris"' : '') + '><td><input type="checkbox" class="tp-ck" data-id="' + e.id + '"' + (e.dejaImporte ? ' disabled' : ' checked') + '></td><td>' + esc(e.matricule) +
                '</td><td>' + esc(e.nom) + '</td><td>' + esc(e.prenom) + '</td><td>' + esc(e.fonction) + '</td><td>' +
                (e.dejaImporte ? 'déjà importé' : e.dateEntree ? dfr(e.dateEntree) : '<input type="date" class="tp-date-ind" data-id="' + e.id + '">') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
            : '<p class="tp-msg warn">' + (liste.length ? 'Tous les employés de TinOR sont déjà dans la paie.' : 'Aucun employé dans TinOR (Réglages › Employés).') + '</p>') +
          '<div class="tp-barre" style="justify-content:flex-end"><button class="tp-btn tp-fermer">Fermer</button>' + (aImporter.length ? '<button class="tp-btn tp-prim tp-go">Importer</button>' : '') + '</div>';
        dlg.querySelector('.tp-fermer').onclick = function () { dlg.close(); };
        var tout = dlg.querySelector('.tp-tout');
        if (tout) tout.onchange = function () { dlg.querySelectorAll('.tp-ck:not([disabled])').forEach(function (c) { c.checked = tout.checked; }); };
        var go = dlg.querySelector('.tp-go');
        if (go) go.onclick = function () {
          var defaut = dlg.querySelector('.tp-date-defaut').value;
          var choix = [].slice.call(dlg.querySelectorAll('.tp-ck:checked')).map(function (c) {
            var ind = dlg.querySelector('.tp-date-ind[data-id="' + c.getAttribute('data-id') + '"]');
            return { id: Number(c.getAttribute('data-id')), dateEntree: (ind && ind.value) || defaut || undefined };
          });
          post('/tinor/importer', { employes: choix }).then(function (r) {
            dlg.close();
            message(r.importes.length + ' salarié(s) importé(s)' + (r.ignores.length ? ' — ' + r.ignores.length + ' ignoré(s) : ' + r.ignores.map(function (x) { return (x.matricule || x.id) + ' (' + x.raison + ')'; }).join(', ') : '') +
              '. Ajoutez maintenant leur contrat.', r.ignores.length ? 'warn' : 'ok');
            ecranSalaries();
          }).catch(function (e) { dlg.querySelector('.tp-zone-dlg').innerHTML = '<div class="tp-msg err">' + esc(e.message) + '</div>'; });
        };
        dlg.showModal();
      }, function (e) { throw new Error(/404|introuvable/.test(e.message) ? "Import indisponible : ce module n'est pas utilisé dans TinOR." : e.message); });
    }

    function formSalarie(s) {
      var dlg = contenu().querySelector('.tp-dlg');
      s = s || { actif: true, regime: 'CNSS_RSNA', modePaiement: 'VIREMENT', nbEnfants: 0, nbEnfantsEtudiants: 0, nbEnfantsHandicapes: 0 };
      var champ = function (n, l, type) { return '<label>' + l + '<input name="' + n + '" type="' + (type || 'text') + '" value="' + esc(s[n]) + '"></label>'; };
      dlg.innerHTML = '<h3>' + (s.id ? 'Modifier ' + esc(s.nom + ' ' + s.prenom) : 'Nouveau salarié') + '</h3><div class="tp-zone-dlg"></div><form class="tp-form" method="dialog">' +
        champ('matricule', 'Matricule *') + champ('nom', 'Nom *') + champ('prenom', 'Prénom *') + champ('fonction', 'Fonction') + champ('categorie', 'Catégorie') +
        champ('numCnss', 'N° CNSS') + champ('dateEntree', "Date d'entrée *", 'date') + champ('dateSortie', 'Date de sortie', 'date') +
        '<label class="tp-case"><input type="checkbox" name="chefFamille"' + (s.chefFamille ? ' checked' : '') + '> Chef de famille</label>' +
        champ('nbEnfants', 'Enfants à charge (< 20 ans)', 'number') + champ('nbEnfantsEtudiants', 'Enfants étudiants non boursiers', 'number') +
        champ('nbEnfantsHandicapes', 'Enfants handicapés', 'number') +
        '<label>Mode de paiement<select name="modePaiement">' + ['VIREMENT', 'CHEQUE', 'ESPECES'].map(function (x) { return '<option' + (s.modePaiement === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
        champ('rib', 'RIB') + '<label class="tp-case"><input type="checkbox" name="actif"' + (s.actif ? ' checked' : '') + '> Actif</label>' +
        '<div class="tp-barre" style="grid-column:1/-1;justify-content:flex-end"><button class="tp-btn" value="annuler">Annuler</button><button class="tp-btn tp-prim tp-ok" type="button">Enregistrer</button></div></form>';
      dlg.querySelector('.tp-ok').onclick = function () {
        var o = {};
        dlg.querySelectorAll('[name]').forEach(function (i) { o[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
        (s.id ? requete('PUT', '/salaries/' + s.id, o) : post('/salaries', o)).then(function (r) {
          dlg.close(); etat.salarieSel = r.id;
          message(s.id ? 'Fiche enregistrée.' : 'Salarié créé : ajoutez maintenant son contrat.', s.id ? 'ok' : 'warn');
          ecranSalaries();
        }).catch(function (e) { dlg.querySelector('.tp-zone-dlg').innerHTML = '<div class="tp-msg err">' + esc(e.message) + '</div>'; });
      };
      dlg.showModal();
    }

    // ------------------------------------------------------------------ Éléments variables
    function ecranVariables() {
      Promise.all([get('/periodes'), get('/salaries')]).then(function (r) {
        etat.periodes = r[0]; etat.salaries = r[1];
        if (!etat.varPeriodeId && r[0].length) etat.varPeriodeId = r[0][0].id;
        if (!etat.varSalarieId && r[1].length) etat.varSalarieId = r[1][0].id;
        var p = etat.varPeriodeId, s = etat.varSalarieId;
        if (!p || !s) return dessinerVariables([], null);
        return Promise.all([get('/periodes/' + p + '/variables?salarieId=' + s), post('/periodes/' + p + '/apercu', { salarieId: s }).catch(function (e) { return { erreur: e.message }; })])
          .then(function (x) { dessinerVariables(x[0], x[1]); });
      }).catch(erreur);
    }

    function dessinerVariables(vars, apercu) {
      var p = etat.periodes.filter(function (x) { return x.id === etat.varPeriodeId; })[0];
      var modif = p && (p.statut === 'OUVERTE' || p.statut === 'CALCULEE') && peut('SAISIR_VARIABLES');
      var rubs = etat.meta.rubriques.filter(function (r) { return r.code !== 'SAL_BASE'; });
      var lib = {}; etat.meta.rubriques.forEach(function (r) { lib[r.code] = r.libelle; });
      contenu().innerHTML = '<div class="tp-carte"><div class="tp-form"><label>Période<select class="tp-vp">' + etat.periodes.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === etat.varPeriodeId ? ' selected' : '') + '>' + per(x) + ' (' + x.statut + ')</option>';
      }).join('') + '</select></label><label>Salarié<select class="tp-vs">' + etat.salaries.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === etat.varSalarieId ? ' selected' : '') + '>' + esc(x.matricule + ' – ' + x.nom + ' ' + x.prenom) + '</option>';
      }).join('') + '</select></label></div>' +
        (modif ? '<div class="tp-form tp-var" style="margin-top:10px"><label>Rubrique<select name="rubrique">' + rubs.map(function (r) {
          return '<option value="' + r.code + '" data-mode="' + r.mode + '">' + esc(r.code + ' – ' + r.libelle) + '</option>';
        }).join('') + '</select></label><label class="tp-l-q">Quantité<input name="quantite" inputmode="decimal"></label><label class="tp-l-t">Taux<input name="taux" inputmode="decimal"></label>' +
          '<label class="tp-l-m">Montant (TND)<input name="montant" inputmode="decimal"></label><label>Commentaire<input name="commentaire"></label>' +
          '<button class="tp-btn tp-prim tp-ajout-var">Ajouter</button></div><p class="tp-gris tp-aide" style="margin:6px 0 0"></p>' :
          (p ? '<p class="tp-gris" style="margin-top:10px">Période ' + p.statut + ' : saisie fermée.</p>' : '')) + '</div>' +
        '<div class="tp-grille" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)"><div class="tp-carte"><h3>Éléments saisis</h3><div class="tp-table"><table><thead><tr><th>Rubrique</th>' +
        '<th class="n">Qté</th><th class="n">Taux</th><th class="n">Montant</th><th>Commentaire</th><th></th></tr></thead><tbody>' + vars.map(function (v) {
          return '<tr><td>' + esc(lib[v.rubrique] || v.rubrique) + '</td><td class="n">' + esc(v.quantite) + '</td><td class="n">' + esc(v.taux) + '</td><td class="n">' + m(v.montant) +
            '</td><td>' + esc(v.commentaire) + '</td><td>' + (modif ? '<button class="tp-btn tp-danger" data-suppr="' + v.id + '">✕</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (vars.length ? '' : '<p class="tp-gris">Aucun élément variable : seul le salaire de base sera payé.</p>') + '</div>' +
        '<div class="tp-carte"><h3>Aperçu du calcul <span class="tp-gris" style="font-weight:400">(non enregistré)</span></h3>' +
        (apercu ? (apercu.erreur ? '<p class="tp-msg err">' + esc(apercu.erreur) + '</p>' : detailHtml(etat.salaries.filter(function (x) { return x.id === etat.varSalarieId; })[0], null, apercu)) :
          '<p class="tp-gris">Choisissez une période et un salarié.</p>') + '</div></div>';
      var c = contenu();
      c.querySelector('.tp-vp').onchange = function (e) { etat.varPeriodeId = Number(e.target.value); ecranVariables(); };
      c.querySelector('.tp-vs').onchange = function (e) { etat.varSalarieId = Number(e.target.value); ecranVariables(); };
      var sr = c.querySelector('.tp-var [name=rubrique]');
      var majChamps = function () {
        var o = sr.options[sr.selectedIndex], mode = o.getAttribute('data-mode'), r = rubs[sr.selectedIndex];
        c.querySelector('.tp-l-q').style.display = mode === 'MONTANT' ? 'none' : '';
        c.querySelector('.tp-l-t').style.display = mode === 'QTE_TAUX' ? '' : 'none';
        c.querySelector('.tp-l-m').style.display = mode === 'MONTANT' ? '' : 'none';
        c.querySelector('.tp-aide').textContent = ({ HEURES_SUP: 'Quantité en heures : montant calculé avec le taux horaire du contrat et le coefficient.',
          ABS_HEURES: 'Quantité en heures d\'absence non payée.', ABS_JOURS: 'Quantité en jours : salaire de base / jours ouvrables du mois.',
          QTE_TAUX: 'Quantité × taux.', MONTANT: 'Montant en TND.' })[mode] + ' Soumis CNSS : ' + (r.cnss ? 'oui' : 'non') + ', IRPP : ' + (r.irpp ? 'oui' : 'non') +
          (r.type === 'RETENUE_NET' ? ' — retenue sur le net.' : r.type === 'RETENUE_BRUT' ? ' — diminue le brut.' : '');
      };
      if (sr) { sr.onchange = majChamps; majChamps(); }
      var aj = c.querySelector('.tp-ajout-var');
      if (aj) aj.onclick = action(function () {
        var o = { salarieId: etat.varSalarieId };
        c.querySelectorAll('.tp-var [name]').forEach(function (i) { if (i.closest('label').style.display !== 'none') o[i.name] = i.value.replace(',', '.').trim(); });
        return post('/periodes/' + etat.varPeriodeId + '/variables', o).then(function () { message('Élément ajouté.'); ecranVariables(); });
      });
      c.querySelectorAll('[data-suppr]').forEach(function (bt) {
        bt.onclick = action(function () {
          if (!confirm('Supprimer cet élément ?')) return;
          return requete('DELETE', '/variables/' + bt.getAttribute('data-suppr')).then(ecranVariables);
        });
      });
    }

    // ------------------------------------------------------------------ Paramètres
    function ecranParametres() {
      get('/parametres').then(function (r) { etat.parametres = r; dessinerParametres(); }).catch(erreur);
    }
    function valeurAff(e) {
      if (e.tranches) return e.tranches.length + ' tranches : ' + e.tranches.map(function (t) { return pct(t.taux); }).join(' · ');
      if (e.type === 'TAUX') return pct(e.valeur);
      if (e.type === 'MONTANT') return m(Number(e.valeur).toFixed(3)).replace(/,000$/, '') + ' TND';
      if (e.type === 'COEF') return '× ' + String(e.valeur).replace('.', ',');
      return e.valeur;
    }
    function dessinerParametres() {
      var r = etat.parametres, toutes = !!etat.paramHisto, auj = new Date().toISOString().slice(0, 10);
      var visibles = r.elements.filter(function (e) {
        if (toutes) return true;
        return e.type !== 'RUBRIQUE' && e.debut <= auj && (!e.fin || e.fin >= auj);
      });
      var sel = r.elements.filter(function (e) { return e.code + '@' + e.debut === etat.paramSel; })[0];
      var nv = visibles.filter(function (e) { return !e.validation; }).length;
      var modif = peut('MODIFIER_PARAMETRES');
      var html = '<div class="tp-msg warn"><b>Modifier un taux ou un barème</b> = ajouter une nouvelle version avec sa date d\'effet (rôle ADMIN). ' +
        'L\'ancienne valeur reste appliquée aux mois précédents et les périodes validées ne changent jamais. Toute nouvelle valeur est « À CONFIRMER » jusqu\'à ' +
        'sa validation par un professionnel. Référentiel ' + esc(r.version) + ' · ' + nv + ' élément(s) affiché(s) non validé(s).</div>' +
        '<div class="tp-barre"><label class="tp-case"><input type="checkbox" class="tp-histo"' + (toutes ? ' checked' : '') + '> Afficher tout l\'historique et les rubriques</label></div>' +
        '<div class="tp-carte tp-table"><table><thead><tr><th>Code</th><th>Libellé</th><th>Valeur</th><th>Début</th><th>Fin</th><th>Origine</th><th>État</th></tr></thead><tbody>' +
        visibles.map(function (e) {
          var k = e.code + '@' + e.debut;
          return '<tr class="cliquable' + (k === etat.paramSel ? ' sel' : '') + '" data-param="' + esc(k) + '"><td>' + esc(e.code) + '</td><td>' + esc(e.libelle) + '</td><td class="n">' +
            esc(valeurAff(e)) + '</td><td>' + dfr(e.debut) + '</td><td>' + dfr(e.fin) + '</td><td>' + (e.saisie ? 'Saisie (' + esc(e.saisie.creePar) + ')' : '<span class="tp-gris">Fichier</span>') +
            '</td><td><span class="tp-badge ' + (e.validation ? 'b-ok">VALIDÉ' : 'b-non">À CONFIRMER') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
      if (sel) {
        html += '<div class="tp-carte"><h3>' + esc(sel.code) + ' — ' + esc(sel.libelle) + '</h3>' +
          (sel.tranches ? '<table style="max-width:460px"><thead><tr><th class="n">De (TND)</th><th class="n">À (TND)</th><th class="n">Taux</th></tr></thead><tbody>' +
            sel.tranches.map(function (t) { return '<tr><td class="n">' + m(Number(t.de).toFixed(3)) + '</td><td class="n">' + (t.a == null ? '…' : m(Number(t.a).toFixed(3))) + '</td><td class="n">' + pct(t.taux) + '</td></tr>'; }).join('') +
            '</tbody></table>' : '<p><b>Valeur :</b> ' + esc(valeurAff(sel)) + ' <span class="tp-gris">(stockée : ' + esc(sel.valeur) + ')</span></p>') +
          '<p><b>Effet :</b> du ' + dfr(sel.debut) + (sel.fin ? ' au ' + dfr(sel.fin) : ' (sans date de fin)') + '</p><p><b>Source :</b> ' + esc(sel.source) + '</p>' +
          (sel.note ? '<p><b>Note :</b> ' + esc(sel.note) + '</p>' : '') +
          (sel.saisie ? '<p class="tp-gris">Saisie par ' + esc(sel.saisie.creePar) + ' le ' + esc(sel.saisie.creeLe) + '</p>' : '') +
          (sel.validation ? '<p class="tp-msg ok">Validé par ' + esc(sel.validation.validePar) + ' le ' + esc(sel.validation.valideLe) + ' — référence : ' + esc(sel.validation.reference) + '</p>' : '') +
          '<div class="tp-barre">' +
          (modif && sel.type !== 'RUBRIQUE' ? '<button class="tp-btn tp-prim tp-nv-version">' + (sel.tranches ? 'Nouveau barème…' : 'Nouvelle valeur…') + '</button>' : '') +
          (modif && sel.saisie ? '<button class="tp-btn tp-danger tp-suppr-version">Supprimer cette version saisie</button>' : '') +
          (sel.validation && peut('VALIDER_PARAMETRES') ? '<button class="tp-btn tp-danger tp-retirer">Retirer la validation</button>' : '') + '</div>' +
          (!sel.validation && peut('VALIDER_PARAMETRES') ? '<h3 style="margin-top:10px">Valider cette valeur</h3><div class="tp-form"><label>Validé par (nom du professionnel) *<input class="tp-vpar"></label>' +
            '<label>Référence officielle consultée *<input class="tp-vref"></label><button class="tp-btn tp-valider-param">Valider</button></div>' : '') +
          '<div class="tp-editeur"></div></div>';
      }
      contenu().innerHTML = html;
      var c = contenu();
      c.querySelector('.tp-histo').onchange = function (e) { etat.paramHisto = e.target.checked; dessinerParametres(); };
      c.querySelectorAll('[data-param]').forEach(function (tr) { tr.onclick = function () { etat.paramSel = tr.getAttribute('data-param'); dessinerParametres(); }; });
      var v = c.querySelector('.tp-valider-param');
      if (v) v.onclick = action(function () {
        return post('/parametres/validations', { code: sel.code, debut: sel.debut, valeur: sel.valeur, validePar: c.querySelector('.tp-vpar').value, reference: c.querySelector('.tp-vref').value })
          .then(function () { message('Élément validé.'); ecranParametres(); });
      });
      var rt = c.querySelector('.tp-retirer');
      if (rt) rt.onclick = action(function () {
        if (!confirm('Retirer la validation de ' + sel.code + ' ?')) return;
        return requete('DELETE', '/parametres/validations?code=' + encodeURIComponent(sel.code) + '&debut=' + sel.debut).then(ecranParametres);
      });
      var sv = c.querySelector('.tp-suppr-version');
      if (sv) sv.onclick = action(function () {
        if (!confirm('Supprimer la version ' + sel.code + ' du ' + dfr(sel.debut) + ' ? La version précédente redevient applicable.')) return;
        return requete('DELETE', '/parametres/versions/' + sel.saisie.id).then(function (rep) { etat.meta.paramsVersion = rep.version; etat.paramSel = null; rendre(); message('Version supprimée.'); });
      });
      var nb = c.querySelector('.tp-nv-version');
      if (nb) nb.onclick = function () { editeurVersion(sel, r.dateMinEffet); };
    }

    function editeurVersion(sel, dateMin) {
      var z = contenu().querySelector('.tp-editeur');
      var d = new Date(), proch = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
      if (dateMin && dateMin > proch) proch = dateMin;
      var taux = sel.type === 'TAUX';
      var lignes = sel.tranches ? sel.tranches.map(function (t) { return { de: t.de, a: t.a, taux: (Number(t.taux) * 100).toString() }; }) : null;
      var champsCommuns = '<label>Date d\'effet * (1er du mois)<input type="date" class="tp-e-debut" value="' + proch + '"></label>' +
        '<label>Date de fin (facultatif)<input type="date" class="tp-e-fin"></label>' +
        '<label style="grid-column:span 2">Texte officiel de référence *<input class="tp-e-source" placeholder="ex. Loi de finances 2027, art. …"></label>' +
        '<label style="grid-column:span 2">Note<input class="tp-e-note"></label>';
      function dessinerTranches() {
        return '<div class="tp-table"><table style="max-width:560px"><thead><tr><th>De (TND)</th><th>À (TND, vide = sans limite)</th><th>Taux (%)</th></tr></thead><tbody>' +
          lignes.map(function (t, i) {
            return '<tr><td><input data-t="de" data-i="' + i + '" value="' + esc(t.de) + '" inputmode="decimal" style="width:110px"' + (i === 0 ? ' readonly' : '') + '></td>' +
              '<td><input data-t="a" data-i="' + i + '" value="' + esc(t.a == null ? '' : t.a) + '" inputmode="decimal" style="width:130px"></td>' +
              '<td><input data-t="taux" data-i="' + i + '" value="' + esc(t.taux) + '" inputmode="decimal" style="width:80px"></td></tr>';
          }).join('') + '</tbody></table></div><div class="tp-barre" style="margin-top:6px"><button class="tp-btn tp-t-plus">+ Tranche</button>' +
          '<button class="tp-btn tp-t-moins">− Dernière tranche</button><span class="tp-gris">La borne « De » suit automatiquement la borne « À » précédente.</span></div>';
      }
      function rendreEditeur() {
        z.innerHTML = '<h3 style="margin-top:14px">' + (sel.tranches ? 'Nouveau barème' : 'Nouvelle valeur') + ' — ' + esc(sel.code) + '</h3><div class="tp-zone-ed"></div>' +
          (sel.tranches ? '<div class="tp-tranches">' + dessinerTranches() + '</div>' :
            '<p class="tp-gris">Valeur actuelle : ' + esc(valeurAff(sel)) + ' (depuis le ' + dfr(sel.debut) + ')</p>') +
          '<div class="tp-form" style="margin-top:8px">' + (sel.tranches ? '' : '<label>' + (taux ? 'Nouveau taux (%) *' : 'Nouvelle valeur' + (sel.type === 'MONTANT' ? ' (TND)' : '') + ' *') +
            (sel.code === 'CSS_MODE' ? '<select class="tp-e-val"><option>TOUTES</option><option>HORS_TRANCHE_ZERO</option></select>' :
              '<input class="tp-e-val" inputmode="decimal" value="' + esc(taux ? (Number(sel.valeur) * 100).toString() : sel.valeur) + '">') + '</label>') + champsCommuns +
          '</div><div class="tp-barre" style="margin-top:8px"><button class="tp-btn tp-prim tp-e-ok">Enregistrer la nouvelle version</button><button class="tp-btn tp-e-annuler">Annuler</button></div>';
        z.querySelector('.tp-e-annuler').onclick = function () { z.innerHTML = ''; };
        if (sel.tranches) {
          z.querySelectorAll('[data-t]').forEach(function (inp) {
            inp.oninput = function () {
              var i = Number(inp.getAttribute('data-i')), k = inp.getAttribute('data-t');
              lignes[i][k] = inp.value.replace(',', '.').trim();
              if (k === 'a' && lignes[i + 1]) { lignes[i + 1].de = lignes[i].a; var nx = z.querySelector('[data-t="de"][data-i="' + (i + 1) + '"]'); if (nx) nx.value = lignes[i].a; }
            };
          });
          z.querySelector('.tp-t-plus').onclick = function () { var der = lignes[lignes.length - 1]; lignes.push({ de: der.a || '', a: null, taux: '' }); rafraichirTranches(); };
          z.querySelector('.tp-t-moins').onclick = function () { if (lignes.length > 1) { lignes.pop(); rafraichirTranches(); } };
        }
        z.querySelector('.tp-e-ok').onclick = function () {
          var corps = { code: sel.code, debut: z.querySelector('.tp-e-debut').value, fin: z.querySelector('.tp-e-fin').value || null,
            source: z.querySelector('.tp-e-source').value, note: z.querySelector('.tp-e-note').value };
          var resume;
          try {
            if (sel.tranches) {
              corps.tranches = lignes.map(function (t, i) {
                var tx = String(t.taux).replace(',', '.').trim();
                if (tx === '' || isNaN(Number(tx))) throw new Error('Taux invalide (tranche ' + (i + 1) + ')');
                return { de: String(t.de).replace(',', '.').trim(), a: t.a == null || String(t.a).trim() === '' ? null : String(t.a).replace(',', '.').trim(), taux: pourcentVersFraction(tx) };
              });
              resume = 'ce barème (' + corps.tranches.length + ' tranches)';
            } else {
              var brute = z.querySelector('.tp-e-val').value.replace(',', '.').replace('%', '').trim();
              corps.valeur = taux ? pourcentVersFraction(brute) : brute;
              resume = sel.code + ' = ' + (taux ? brute + ' %' : brute);
            }
          } catch (e) { z.querySelector('.tp-zone-ed').innerHTML = '<div class="tp-msg err">' + esc(e.message) + '</div>'; return; }
          if (!confirm('Appliquer ' + resume + ' à partir du ' + dfr(corps.debut) + ' ?\nL\'ancienne valeur reste appliquée avant cette date.')) return;
          post('/parametres/versions', corps).then(function (rep) {
            etat.meta.paramsVersion = rep.version;
            etat.paramSel = corps.code + '@' + corps.debut;
            rendre();
            message('Nouvelle version enregistrée (à confirmer). Relancez les simulations en cours concernées.', 'warn');
          }).catch(function (e) { z.querySelector('.tp-zone-ed').innerHTML = '<div class="tp-msg err">' + esc(e.message) + '</div>'; });
        };
      }
      function rafraichirTranches() { rendreEditeur(); }
      rendreEditeur();
      z.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /** "9.68" (pourcentage saisi) -> "0.0968", sans flottant : décalage de la virgule sur le texte. */
    function pourcentVersFraction(p) {
      if (!/^\d+(\.\d+)?$/.test(p)) throw new Error('Pourcentage invalide : ' + p);
      var ent = p.split('.')[0], dec = p.split('.')[1] || '';
      var tout = (ent.padStart(3, '0') + dec), pos = tout.length - dec.length - 2;
      var r = (tout.slice(0, pos).replace(/^0+(?=\d)/, '') || '0') + '.' + tout.slice(pos);
      r = r.replace(/\.?0+$/, '');
      return r === '' ? '0' : r;
    }

    // ------------------------------------------------------------------ Entreprise & journal
    function ecranEntreprise() {
      get('/entreprise').then(function (e) {
        var ch = function (n, l, aide) { return '<label>' + l + '<input name="' + n + '" value="' + esc(e[n]) + '"' + (aide ? ' placeholder="' + aide + '"' : '') + '></label>'; };
        contenu().innerHTML = '<div class="tp-carte"><h3>Fiche entreprise</h3><div class="tp-form tp-ent">' + ch('raisonSociale', 'Raison sociale *') + ch('matriculeFiscal', 'Matricule fiscal') +
          ch('numEmployeurCnss', 'N° employeur CNSS') + ch('adresse', 'Adresse') + ch('tauxAT', 'Taux accident du travail notifié', 'ex. 0.004 (vide = défaut)') +
          ch('tauxTFP', 'Taux TFP', '0.01 ou 0.02 (vide = défaut)') + '<button class="tp-btn tp-prim tp-enr">Enregistrer</button></div></div>';
        contenu().querySelector('.tp-enr').onclick = action(function () {
          var o = {}; contenu().querySelectorAll('.tp-ent [name]').forEach(function (i) { o[i.name] = i.value.replace(',', '.').trim(); });
          return requete('PUT', '/entreprise', o).then(function () { message('Fiche entreprise enregistrée.'); });
        });
      }).catch(erreur);
    }

    function ecranJournal(q) {
      get('/journal' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (l) {
        contenu().innerHTML = '<div class="tp-carte"><div class="tp-barre"><input class="tp-jq" placeholder="Filtrer (utilisateur, action, détail)" value="' + esc(q || '') +
          '" style="flex:1"><span class="tp-gris">500 dernières entrées</span></div><div class="tp-table"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th>' +
          '<th>Id</th><th>Détails</th></tr></thead><tbody>' + l.map(function (a) {
            return '<tr><td style="white-space:nowrap">' + esc(a.horodatage) + '</td><td>' + esc(a.utilisateur) + '</td><td>' + esc(a.action) + '</td><td>' + esc(a.entite) + '</td><td>' +
              esc(a.entiteId) + '</td><td>' + esc(a.details) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
        var i = contenu().querySelector('.tp-jq'), t;
        i.oninput = function () { clearTimeout(t); t = setTimeout(function () { ecranJournal(i.value); }, 400); };
      }).catch(erreur);
    }

    // ------------------------------------------------------------------ démarrage
    racine.innerHTML = '<p class="tp-gris">Chargement du module paie…</p>';
    return get('/meta').then(function (meta) { etat.meta = meta; rendre(); })
      .catch(function (e) { racine.innerHTML = '<div class="tp-msg err">Module paie indisponible : ' + esc(e.message) + '</div>'; });
  }

  global.TinorPaie = { monter: monter, version: '1.0.0' };
})(window);
