// Pont entre la console TinOR et Android, injecté avant le chargement de la page.
// Dans une WebView, deux choses ne fonctionnent pas comme dans un navigateur :
//  1. window.open('') + document.write(...) + window.print() (factures,
//     étiquettes, listes PDF) → on récupère le HTML et Android l'imprime
//     (imprimante ou « Enregistrer en PDF »).
//  2. <a download href="blob:..."> (exports Excel / Word) → le fichier est
//     transmis à Android, qui l'enregistre dans Téléchargements/TinOR.
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
