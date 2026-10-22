  // ---------- Version RÉEL / TEST ----------
  // Le serveur dit s'il s'agit de la version TEST (/api/health → environnement) :
  // bandeau orange permanent et mention « TEST », pour ne jamais confondre.
  async function majEnvironnement(base = API_BASE) {
    try {
      const r = await hlFetch(base + '/health', {}, 6000);
      const h = r.ok ? await r.json() : {};
      const test = h.environnement === 'TEST';
      document.body.classList.toggle('modeTest', test);
      document.getElementById('modeTestBanner').style.display = test ? '' : 'none';
      const badge = document.getElementById('loginEnvBadge');
      if (badge) { badge.textContent = test ? 'VERSION TEST' : 'VERSION RÉELLE'; badge.style.display = h.environnement ? 'block' : 'none'; badge.style.background = test ? '#D98A1C' : '#2F6B2F'; }
      majVersionConsole(h.console);
      const maj = document.getElementById('loginVersionMaj');
      if (maj) maj.textContent = h.mise_a_jour ? `· mise à jour du ${new Date(h.mise_a_jour.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} (${h.mise_a_jour.commit})` : '';
    } catch { /* hors ligne : on garde l'affichage précédent */ }
  }

