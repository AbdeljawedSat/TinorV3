  // ---------- Fenêtre à jour ? ----------
  // Empreinte de cette page (posée par le serveur ou par le build Android) comparée à celle
  // du serveur : différente → fenêtre ancienne (cache du navigateur) ou application Android
  // plus ancienne que le serveur.
  const CONSOLE_VERSION = '__TINOR_CONSOLE__';
  function majVersionConsole(serveur) {
    const el = document.getElementById('consoleMajBanner');
    const empreinte = (v) => /^[0-9a-f]{10}$/.test(v || '');
    const perimee = empreinte(CONSOLE_VERSION) && empreinte(serveur) && serveur !== CONSOLE_VERSION;
    el.style.display = perimee ? '' : 'none';
    if (!perimee) return;
    if (window.TinorAndroid) {
      el.innerHTML = `<span>📲 Application pas à jour : le serveur a une version plus récente de TinOR.</span>
        <a href="https://github.com/AbdeljawedSat/TinorV3/releases/latest">Installer la dernière version</a>`;
    } else {
      el.innerHTML = `<span>🔄 Fenêtre pas à jour : une nouvelle version de TinOR est installée sur le serveur.</span><button type="button" id="consoleMajBtn">Mettre à jour</button>`;
      document.getElementById('consoleMajBtn').addEventListener('click', async () => {
        try { for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister(); } catch {}
        try { for (const c of await caches.keys()) await caches.delete(c); } catch {}
        location.reload();
      });
    }
  }

  // Écran de connexion : la version (RÉEL / TEST) du serveur est affichée avant même de se connecter.
  setTimeout(() => { const c = document.getElementById('apiBaseInput'); if (c && c.value && !TOKEN) majEnvironnement(normaliserAdresseApi(c.value)); }, 1200);

