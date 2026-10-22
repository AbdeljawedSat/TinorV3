  // ============================================================================
  // MESSAGES INTÉGRÉS (V3.3) — remplacent les fenêtres alert()/confirm() du navigateur
  // ============================================================================
  // notifier(message, 'info' | 'succes' | 'erreur') : petit message en bas à droite.
  function notifier(message, type = 'info') {
    const zone = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = `notif ${type}`;
    el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
    el.innerHTML = '<span></span><button class="x" aria-label="Fermer">×</button>';
    el.firstChild.textContent = String(message ?? '');
    const fermer = () => el.remove();
    el.querySelector('.x').addEventListener('click', fermer);
    zone.appendChild(el);
    setTimeout(fermer, type === 'erreur' ? 9000 : 4500);
  }
  // confirmer(message, { titre, ok, danger }) → Promise<boolean>
  // Avec `saisie` ({ label, placeholder }), un champ obligatoire est affiché
  // (ex. motif d'annulation) et la promesse rend le texte saisi, ou false.
  function confirmer(message, { titre = 'Confirmer', ok = 'Confirmer', non: libelleNon = 'Annuler', danger = false, saisie = null } = {}) {
    return new Promise(resolve => {
      const overlay = document.getElementById('confirmOverlay');
      const oui = document.getElementById('confirmOui'), non = document.getElementById('confirmNon');
      const bloc = document.getElementById('confirmSaisieBloc'), champ = document.getElementById('confirmSaisie');
      bloc.style.display = saisie ? 'block' : 'none';
      champ.value = '';
      if (saisie) {
        document.getElementById('confirmSaisieLabel').textContent = saisie.label || '';
        champ.placeholder = saisie.placeholder || '';
        oui.disabled = true;
        champ.oninput = () => { oui.disabled = !champ.value.trim(); };
        champ.onkeydown = (e) => { if (e.key === 'Enter' && champ.value.trim()) oui.click(); };
      } else oui.disabled = false;
      document.getElementById('confirmTitre').textContent = titre;
      document.getElementById('confirmMessage').textContent = message;
      oui.textContent = ok;
      non.textContent = libelleNon;
      oui.className = danger ? 'btnDanger' : 'btnPrimary';
      const fin = (val) => {
        overlay.classList.remove('open');
        oui.onclick = non.onclick = overlay.onclick = document.onkeydown = null;
        resolve(val);
      };
      oui.onclick = () => fin(saisie ? champ.value.trim() : true);
      non.onclick = () => fin(false);
      overlay.onclick = (e) => { if (e.target === overlay) fin(false); };
      document.onkeydown = (e) => { if (e.key === 'Escape') fin(false); };
      overlay.classList.add('open');
      setTimeout(() => (saisie ? champ : danger ? non : oui).focus(), 0);
    });
  }

  let API_BASE = 'http://127.0.0.1:3001/api';
  // Adresse de l'API proposée à la connexion : celle utilisée la dernière fois
  // (mémorisée sur cet appareil) ; sinon, si la console est servie par l'API
  // elle-même (ex. https://tinor.up.railway.app/), la même adresse + /api.
  const API_BASE_CLE = 'tinor_api_base';
  (function initAdresseApi() {
    const champ = document.getElementById('apiBaseInput');
    let adresse = null;
    try { adresse = localStorage.getItem(API_BASE_CLE); } catch {}
    if (adresse) { champ.value = adresse; return; }
    if (!/^https?:$/.test(location.protocol) || location.hostname === 'appassets.androidplatform.net') return;
    fetch(`${location.origin}/api/health`).then(r => r.ok ? r.json() : null).then(h => {
      if (h && h.version === 'v3' && champ.value === champ.defaultValue) champ.value = `${location.origin}/api`;
    }).catch(() => {});
  })();
  let TOKEN = null; // gardé en mémoire JS uniquement (pas de stockage navigateur)
  let CURRENT_USER = null;
  const LIBELLES_ROLES = { gerant: 'Gérant', vendeur: 'Vendeur', magasinier: 'Magasinier', production: 'Production', comptable: 'Comptable' };
  function isGerant() { return CURRENT_USER && CURRENT_USER.role === 'gerant'; }

  // Appel à l'API. Sans réseau (voir « HORS LIGNE ») : lectures depuis la copie
  // locale, opérations autorisées mises en file, les autres refusées clairement.
  async function apiFetch(path, options = {}) {
    const methode = (options.method || 'GET').toUpperCase();
    const def = methode !== 'GET' ? hlOperation(methode, path) : null;
    const idOperation = def ? hlUuid() : null; // même identifiant si l'opération doit être renvoyée
    const envoyer = () => hlFetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(idOperation && methode === 'POST' ? { 'X-Operation-Id': idOperation } : {}),
        ...(TOKEN && TOKEN !== 'hors-ligne' ? { Authorization: `Bearer ${TOKEN}` } : {}),
        ...(options.headers || {}),
      },
    });
    let res;
    try {
      res = await envoyer();
    } catch (err) {
      if (path.startsWith('/auth/')) throw (err instanceof TypeError ? err : new TypeError('Serveur injoignable'));
      hlPasserHorsLigne();
      if (methode === 'GET') {
        const copie = await hlLireCache(path);
        if (copie) {
          if (!HL.donneesDu || copie.date < HL.donneesDu) { HL.donneesDu = copie.date; hlMajAffichage(); }
          return hlAppliquerEffets(path, copie.data);
        }
        throw new Error('Hors ligne : ces données ne sont pas encore sur cet appareil (elles le seront après une connexion).');
      }
      if (def) return hlMettreEnFile(def, methode, path, options.body, idOperation);
      throw new Error('Hors ligne : cette action demande une connexion (factures, avoirs, annulations, modification ou suppression d\'un client ou fournisseur, produits, réglages…). Réessayez une fois connecté.');
    }
    // Jeton expiré (ou session ouverte hors ligne) : reconnexion automatique puis nouvel essai.
    if (res.status === 401 && !path.startsWith('/auth/') && HL.motDePasse && await hlReconnexionSilencieuse()) {
      try { res = await envoyer(); } catch { /* réseau perdu entre-temps */ }
    }
    if (!path.startsWith('/auth/')) { HL.donneesDu = null; hlRepasserEnLigne(); }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);
    if (methode === 'GET') hlEcrireCache(path, data);
    return data;
  }

