  // ---------- À propos : date de mise à jour et version RÉEL / TEST d'après /api/health ----------
  async function chargerApropos() {
    try {
      const r = await hlFetch(API_BASE + '/health', {}, 6000);
      const h = r.ok ? await r.json() : {};
      document.getElementById('aproposMaj').textContent = h.mise_a_jour
        ? `${new Date(h.mise_a_jour.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} (${h.mise_a_jour.commit})` : '—';
      document.getElementById('aproposEnv').textContent = h.environnement === 'TEST' ? 'Version TEST' : h.environnement ? 'Version RÉELLE' : '—';
    } catch { /* hors ligne : on garde l'affichage précédent */ }
  }

