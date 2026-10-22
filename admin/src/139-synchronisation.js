  // ---------- Synchronisation ----------
  async function hlServeurJoignable() {
    try { const r = await hlFetch(API_BASE + '/health', {}, 6000); return r.ok; } catch { return false; }
  }
  async function hlReconnexionSilencieuse() {
    const s = hlSession();
    if (!s || !HL.motDePasse) return false;
    try {
      const r = await hlFetch(API_BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: s.username, password: HL.motDePasse }) });
      if (!r.ok) return false;
      const d = await r.json();
      TOKEN = d.token; CURRENT_USER = d.user; HL.reconnexion = false;
      return true;
    } catch { return false; }
  }
  async function hlEnvoyer(op) {
    return hlFetch(API_BASE + op.path, {
      method: op.methode,
      headers: { 'Content-Type': 'application/json', 'X-Operation-Id': op.id, ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
      body: JSON.stringify(op.payload),
    });
  }
  // Client / fournisseur déjà présent sur le serveur (même nom, casse, accents et espaces ignorés).
  async function hlTrouverExistant(op) {
    try {
      const rep = await hlFetch(API_BASE + (op.type === 'client' ? '/clients' : '/fournisseurs'), { headers: { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) } });
      if (!rep.ok) return null;
      const cle = normaliserNomGraine(op.payload.nom);
      return (await rep.json()).find(x => normaliserNomGraine(x.nom) === cle) || null;
    } catch { return null; }
  }
  // Le client / fournisseur a maintenant un vrai identifiant : les opérations en attente qui l'utilisaient le reprennent.
  async function hlRemplacerIdProvisoire(op, idReel) {
    if (!op.id_provisoire || !idReel) return;
    const champ = op.type === 'client' ? 'client_id' : 'fournisseur_id';
    HL.noms = HL.noms || {}; HL.noms[`${op.type}:${idReel}`] = op.payload.nom;
    for (const o of await hlOps()) {
      if (o.id !== op.id && o.payload && Number(o.payload[champ]) === op.id_provisoire) { o.payload[champ] = idReel; await hlEcrireOp(o); }
    }
  }
  async function hlSynchroniser({ recharger = false, manuel = false } = {}) {
    if (HL.synchroEnCours || !TOKEN) return;
    if (HL.force) { if (manuel) notifier('Mode « Hors ligne » choisi : passez sur « En ligne » pour envoyer.', 'info'); return; }
    HL.synchroEnCours = true;
    hlMajAffichage();
    let envoyees = 0, refusees = 0;
    try {
      if (!(await hlServeurJoignable())) { HL.horsLigne = true; if (manuel) notifier('Serveur toujours injoignable : nouvel essai automatique dans quelques secondes.', 'erreur'); return; }
      HL.horsLigne = false;
      const idsEnAttente = (await hlOps()).filter(o => o.statut === 'EN_ATTENTE').map(o => o.id);
      for (const idOp of idsEnAttente) {
        const op = (await hlOps()).find(o => o.id === idOp); // relue à chaque tour : un client envoyé juste avant a pu changer son contenu
        if (!op || op.statut !== 'EN_ATTENTE') continue;
        // Rattachée à un client / fournisseur créé hors ligne et pas encore envoyé (ou à corriger) : elle attend son tour.
        if (Number(op.payload?.client_id) < 0 || Number(op.payload?.fournisseur_id) < 0) continue;
        // Client / fournisseur de même nom déjà sur le serveur : pas de doublon, on rattache à la fiche existante.
        if (op.type === 'client' || op.type === 'fournisseur') {
          const existant = await hlTrouverExistant(op);
          if (existant) {
            await hlRemplacerIdProvisoire(op, existant.id);
            await hlSupprimerOp(op.id);
            await hlAjouterHistorique({ id: op.id, type: op.type, libelle: op.libelle, numero_provisoire: op.numero_provisoire,
              numero: `rattaché à « ${existant.nom} » (existait déjà)`, description: hlDescription(op), envoye_le: new Date().toISOString(), statut: '' });
            notifier(`${op.libelle} « ${op.payload.nom} » existait déjà : rattaché à la fiche existante, aucun doublon créé.`, 'info');
            envoyees++;
            continue;
          }
        }
        let rep;
        try { rep = await hlEnvoyer(op); } catch { HL.horsLigne = true; break; } // connexion reperdue : on reprendra plus tard
        if (rep.status === 401) {
          if (await hlReconnexionSilencieuse()) { try { rep = await hlEnvoyer(op); } catch { HL.horsLigne = true; break; } }
          if (rep.status === 401) { HL.reconnexion = true; break; }
        }
        const data = await rep.json().catch(() => ({}));
        if (rep.ok) {
          if (op.id_provisoire && data.id) await hlRemplacerIdProvisoire(op, data.id); // avant de supprimer : repris au prochain essai si coupure
          await hlSupprimerOp(op.id);
          await hlAjouterHistorique({ id: op.id, type: op.type, libelle: op.libelle, numero_provisoire: op.numero_provisoire,
            numero: data.numero || data.numero_lot || (data.lots_presse && data.lots_presse[0] && data.lots_presse[0].numero_lot) || '✓ enregistrée', description: hlDescription(op), envoye_le: new Date().toISOString(),
            statut: data.statut || '' });
          if (op.signale) apiFetch('/sync/conflits/resolus', { method: 'POST', body: JSON.stringify({ numero_provisoire: op.numero_provisoire }) }).catch(() => {});
          envoyees++;
          continue;
        }
        if (rep.status >= 500 || data.en_cours) { op.tentatives++; await hlEcrireOp(op); break; } // serveur occupé : on réessaiera
        // Refus métier : l'opération attend une correction (jamais perdue).
        op.statut = 'A_CORRIGER'; op.erreur = data.error || `Erreur ${rep.status}`; op.tentatives++;
        if (!op.signale) {
          try { await apiFetch('/sync/conflits', { method: 'POST', body: JSON.stringify({ libelle: `${op.libelle} — ${hlDescription(op)}`.slice(0, 140), erreur: op.erreur, numero_provisoire: op.numero_provisoire }) }); op.signale = true; } catch {}
        }
        await hlEcrireOp(op);
        refusees++;
      }
      if (envoyees || recharger || refusees) {
        HL.derniereSynchro = new Date().toISOString();
        try { localStorage.setItem('tinor_derniere_synchro', HL.derniereSynchro); } catch {}
        if (!HL.horsLigne) await loadAllData(); // données du PC → téléphone (double sens)
      }
      if (envoyees) notifier(`${envoyees} opération(s) hors ligne envoyée(s) au serveur.`, 'succes');
      if (refusees) hlAlerter(`${refusees} opération(s) à corriger`, 'Le serveur a refusé des opérations faites hors ligne (stock insuffisant, lot épuisé…). Ouvrez Synchronisation pour les corriger.');
      if (HL.reconnexion) notifier('Session expirée : reconnectez-vous pour envoyer les opérations en attente.', 'erreur');
    } finally {
      HL.synchroEnCours = false;
      hlMajAffichage();
    }
  }
  // Notification visible même si l'application est en arrière-plan (Android), sinon message à l'écran.
  function hlAlerter(titre, texte) {
    notifier(`${titre} — ${texte}`, 'erreur');
    try {
      if (window.TinorAndroid && typeof TinorAndroid.notifier === 'function') TinorAndroid.notifier(titre, texte);
      else if ('Notification' in window && Notification.permission === 'granted') new Notification(`TinOR — ${titre}`, { body: texte });
    } catch {}
  }

