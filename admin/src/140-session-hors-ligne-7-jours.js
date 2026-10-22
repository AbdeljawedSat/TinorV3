  // ---------- Session hors ligne (7 jours) ----------
  function hlSession() { try { return JSON.parse(localStorage.getItem(HL_SESSION_CLE) || 'null'); } catch { return null; } }
  async function hlEmpreinte(motDePasse, sel) {
    const texte = `${sel}|${motDePasse}`;
    try {
      if (window.crypto && crypto.subtle) {
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
        return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {}
    let h = 2166136261; // repli (page en http) : FNV-1a
    for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv' + (h >>> 0).toString(16);
  }
  async function hlMemoriserSession(username, motDePasse, user) {
    HL.motDePasse = motDePasse;
    const sel = hlUuid();
    try { localStorage.setItem(HL_SESSION_CLE, JSON.stringify({ api: API_BASE, username, user, sel, empreinte: await hlEmpreinte(motDePasse, sel), date: new Date().toISOString() })); } catch {}
  }
  async function hlConnexionHorsLigne(username, motDePasse) {
    const s = hlSession();
    if (!s || s.api !== API_BASE || s.username !== username) return false;
    if (Date.now() - new Date(s.date).getTime() > HL_SESSION_JOURS * 86400000) return false;
    if (await hlEmpreinte(motDePasse, s.sel) !== s.empreinte) return false;
    HL.motDePasse = motDePasse;
    CURRENT_USER = s.user;
    TOKEN = 'hors-ligne'; // remplacé par un vrai jeton dès le retour du réseau (reconnexion automatique)
    HL.horsLigne = true;
    HL.reconnexion = true;
    return true;
  }

