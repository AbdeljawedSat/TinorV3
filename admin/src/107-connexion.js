  // ---------- Connexion ----------
  // « 192.168.1.20 » ou « 192.168.1.20:3001 » → « http://192.168.1.20:3001/api ».
  function normaliserAdresseApi(saisie) {
    let a = String(saisie || '').trim().replace(/\s+/g, '').replace(/\/+$/, '');
    if (!a) return a;
    if (!/^https?:\/\//i.test(a)) a = 'http://' + a;
    try {
      const u = new URL(a);
      const ipOuLocal = /^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname) || u.hostname === 'localhost';
      if (!u.port && u.protocol === 'http:' && ipOuLocal) u.port = '3001';
      if (u.pathname === '/' || u.pathname === '') u.pathname = '/api';
      return u.toString().replace(/\/+$/, '');
    } catch { return a; }
  }
  // Pourquoi le serveur ne répond pas : message concret pour l'utilisateur.
  async function diagnostiquerServeur(base) {
    if (HL.force) return 'Mode « Hors ligne » choisi (bouton en haut) : TinOR n\'appelle pas le serveur.';
    try {
      const r = await hlFetch(base + '/health', {}, 6000);
      if (r.ok) { const h = await r.json().catch(() => ({})); return h.version === 'v3' ? null : `L'adresse ${base} répond, mais ce n'est pas un serveur TinOR V3.`; }
      return `Le serveur répond (HTTP ${r.status}) mais l'adresse semble incomplète : elle doit finir par /api (ex. http://192.168.1.20:3001/api).`;
    } catch (e) {
      const delai = e && e.name === 'AbortError';
      return `Aucune réponse de ${base}${delai ? ' (délai dépassé)' : ''}. Vérifiez : 1) le serveur est démarré sur le PC (fenêtre « TinOR API V3 démarrée ») ; 2) le téléphone est sur le même Wi-Fi que le PC ; 3) l'adresse IP du PC (ipconfig) ; 4) le pare-feu Windows autorise le port 3001.`;
    }
  }
  async function handleLogin() {
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    const champAdresse = document.getElementById('apiBaseInput');
    champAdresse.value = normaliserAdresseApi(champAdresse.value);
    if (typeof majServeurAffiche === 'function') majServeurAffiche();
    API_BASE = champAdresse.value;
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const entrer = async (user) => {
      CURRENT_USER = user;
      try { localStorage.setItem(API_BASE_CLE, API_BASE); } catch {}
      document.getElementById('loginOverlay').classList.remove('open');
      document.getElementById('appRoot').style.display = 'flex';
      const who = document.querySelector('.sidebarFoot .who');
      const role = document.querySelector('.sidebarFoot .role');
      if (who) who.textContent = `${user.employe_prenom || ''} ${user.employe_nom || user.username}`.trim();
      if (role) role.textContent = LIBELLES_ROLES[user.role] || user.role;
      const utilisateursLink = document.querySelector('a[data-view="utilisateurs"]');
      if (utilisateursLink) utilisateursLink.style.display = isGerant() ? '' : 'none';
      document.querySelectorAll('a[data-view="journal"], a[data-view="qualite-parametres"], a[data-view="modules"]').forEach(a => { a.style.display = isGerant() ? '' : 'none'; });
      majEnvironnement();
      await loadAllData();
      chargerMenuModules();
    };
    // Changement de serveur (ex. version TEST → version RÉEL) : les opérations faites hors ligne
    // pour l'autre serveur ne doivent jamais partir vers celui-ci, ni sa copie locale s'afficher ici.
    const sessionPrecedente = hlSession();
    if (sessionPrecedente && sessionPrecedente.api && sessionPrecedente.api !== API_BASE) {
      const nonEnvoyees = (await hlOps()).filter(o => o.statut === 'EN_ATTENTE' || o.statut === 'A_CORRIGER').length;
      if (nonEnvoyees) {
        errEl.textContent = `${nonEnvoyees} opération(s) faite(s) hors ligne n'ont pas encore été envoyées au serveur ${sessionPrecedente.api}. Connectez-vous d'abord à ce serveur pour les envoyer (ou effacez les données de cet appareil dans Synchronisation).`;
        errEl.style.display = 'block';
        return;
      }
      try { await hlStore('cache', 'readwrite', st => st.clear()); } catch {}
    }
    let data;
    try {
      data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    } catch (err) {
      const reseau = err instanceof TypeError; // serveur injoignable (pas une erreur d'identifiants)
      // Pas de réseau : connexion hors ligne si ce compte s'est déjà connecté sur cet appareil (7 jours).
      const raison = reseau ? await diagnostiquerServeur(API_BASE) : null;
      if (reseau && await hlConnexionHorsLigne(username, password)) {
        await entrer(CURRENT_USER);
        // La raison reste affichée : sans elle, on croit que l'application « refuse » d'être en ligne.
        notifier(`Mode hors ligne (serveur injoignable). ${raison || ''} Reconnexion automatique dès que le serveur répond.`, 'info');
        return;
      }
      errEl.textContent = reseau ? `Serveur injoignable${hlSession() ? ' (connexion hors ligne impossible : autre adresse de serveur, autre compte, mot de passe différent ou plus de 7 jours)' : ''}. ${raison || ''}` : (err.message || 'Connexion impossible — vérifiez vos identifiants.');
      errEl.style.display = 'block';
      if (reseau) montrerChampServeur();
      return;
    }
    TOKEN = data.token;
    HL.reconnexion = false;
    await hlMemoriserSession(username, password, data.user);
    await entrer(data.user);
    if (data.mot_de_passe_par_defaut) ouvrirMotDePasse(password, true);
  }
  document.getElementById('loginSubmitBtn').addEventListener('click', handleLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

