// Pont entre la console TinOR et Android, injecté avant le chargement de la page.
// Dans une WebView, deux choses ne fonctionnent pas comme dans un navigateur :
//  1. window.open('') + document.write(...) + window.print() (factures,
//     étiquettes, listes PDF) → on récupère le HTML et Android l'imprime
//     (imprimante ou « Enregistrer en PDF »).
//  2. <a download href="blob:..."> (exports Excel / Word) → le fichier est
//     transmis à Android, qui l'enregistre dans Téléchargements/TinOR.
//  3. Appels au serveur du PC (http, réseau local) depuis une page https →
//     faits par Android (voir plus bas).
(function () {
  if (!window.TinorAndroid || window.__tinorAndroidPret) return;
  window.__tinorAndroidPret = true;

  window.open = function (url) {
    if (url && url !== 'about:blank') {
      TinorAndroid.ouvrirLien(String(new URL(url, location.href)));
      return null;
    }
    var html = '', envoye = false, minuterie = null;
    function envoyer() {
      if (envoye || !html) return;
      envoye = true;
      var titre = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'TinOR';
      TinorAndroid.imprimer(html, titre.trim());
    }
    // Certains écrans n'appellent pas document.close() : l'impression part
    // alors peu après la dernière écriture.
    function planifier() { clearTimeout(minuterie); minuterie = setTimeout(envoyer, 400); }
    return {
      closed: false,
      document: {
        open: function () { html = ''; },
        write: function () { html += Array.prototype.join.call(arguments, ''); planifier(); },
        writeln: function () { html += Array.prototype.join.call(arguments, '') + '\n'; planifier(); },
        close: function () { clearTimeout(minuterie); envoyer(); }
      },
      focus: function () {},
      close: function () {},
      print: function () { clearTimeout(minuterie); envoyer(); },
      addEventListener: function () {}
    };
  };

  // 3. Appels au serveur TinOR (http sur le réseau local) : faits par Android.
  //    Les WebView récentes bloquent une page https qui appelle une adresse
  //    http locale (192.168…, 10…) alors que Chrome y arrive ; Android, non.
  if (typeof TinorAndroid.requete === 'function') {
    var fetchOrigine = window.fetch.bind(window);
    var attentes = {}, compteur = 0;
    window.__tinorReponse = function (id, json) {
      var a = attentes[id];
      if (!a) return;
      delete attentes[id];
      var r;
      try { r = JSON.parse(json); } catch (e) { r = { erreur: 'Réponse illisible' }; }
      if (r.erreur) { a.ko(new TypeError('Failed to fetch (' + r.erreur + ')')); return; }
      var sansCorps = r.status === 204 || r.status === 205 || r.status === 304;
      a.ok(new Response(sansCorps ? null : r.body, { status: r.status, headers: r.type ? { 'Content-Type': r.type } : {} }));
    };
    window.fetch = function (entree, options) {
      options = options || {};
      var url = typeof entree === 'string' ? entree : (entree instanceof URL ? entree.href : null);
      var corps = options.body;
      if (!url || !/^https?:/i.test(url) || new URL(url, location.href).origin === location.origin
          || (corps != null && typeof corps !== 'string')) {
        return fetchOrigine(entree, options);
      }
      return new Promise(function (ok, ko) {
        var signal = options.signal;
        if (signal && signal.aborted) { ko(new DOMException('Requête annulée', 'AbortError')); return; }
        var id = 'r' + (++compteur) + '_' + Date.now();
        attentes[id] = { ok: ok, ko: ko };
        if (signal) signal.addEventListener('abort', function () {
          if (attentes[id]) { delete attentes[id]; ko(new DOMException('Requête annulée', 'AbortError')); }
        });
        var entetes = {};
        new Headers(options.headers || {}).forEach(function (v, k) { entetes[k] = v; });
        TinorAndroid.requete(id, String(options.method || 'GET').toUpperCase(), url, JSON.stringify(entetes), corps == null ? null : corps);
      });
    };
  }

  var clicOrigine = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || '';
    if (this.hasAttribute('download') && (href.indexOf('blob:') === 0 || href.indexOf('data:') === 0)) {
      var nom = this.getAttribute('download') || 'tinor-export';
      fetch(href)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          return new Promise(function (ok, ko) {
            var fr = new FileReader();
            fr.onload = function () { ok({ type: blob.type, data: String(fr.result) }); };
            fr.onerror = function () { ko(fr.error); };
            fr.readAsDataURL(blob);
          });
        })
        .then(function (f) {
          TinorAndroid.enregistrerFichier(f.data.slice(f.data.indexOf(',') + 1), nom, f.type || 'application/octet-stream');
        })
        .catch(function (e) { alert('Téléchargement impossible : ' + (e && e.message ? e.message : e)); });
      return;
    }
    return clicOrigine.call(this);
  };
})();
