  // ---------- Bascule hors ligne / en ligne ----------
  function hlPasserHorsLigne() {
    if (HL.horsLigne) return;
    HL.horsLigne = true;
    hlMajAffichage();
  }
  function hlRepasserEnLigne() {
    if (!HL.horsLigne || HL.force) return;
    HL.horsLigne = false;
    hlMajAffichage();
    setTimeout(() => hlSynchroniser({ recharger: true }), 0); // envoi des opérations + données du PC
  }

  // Appel réseau d'apiFetch : délai max, puis bascule hors ligne en cas d'échec réseau.
  async function hlFetch(url, options, delaiMs = 20000) {
    if (HL.force) throw new TypeError('Mode hors ligne choisi'); // traité comme une absence de réseau
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const minuterie = ctrl ? setTimeout(() => ctrl.abort(), delaiMs) : null;
    try { return await fetch(url, { ...options, signal: ctrl ? ctrl.signal : undefined }); }
    finally { if (minuterie) clearTimeout(minuterie); }
  }

  // Mise en file d'une opération faite sans réseau.
  async function hlMettreEnFile(def, methode, path, corps, idOperation) {
    const op = {
      id: idOperation || hlUuid(), type: def.type, libelle: def.libelle, methode, path,
      payload: corps ? JSON.parse(corps) : {}, numero_provisoire: hlNumeroProvisoire(def.prefixe),
      cree_le: new Date().toISOString(), statut: 'EN_ATTENTE', erreur: null, tentatives: 0,
    };
    // Client / fournisseur créé hors ligne : identifiant provisoire NÉGATIF (jamais confondu avec un vrai) que les
    // commandes et réceptions suivantes utilisent ; il est remplacé par le vrai identifiant à la synchronisation.
    if (def.type === 'client' || def.type === 'fournisseur') op.id_provisoire = hlIdProvisoire();
    await hlEcrireOp(op);
    notifier(`Hors ligne — ${def.libelle.toLowerCase()} ${op.numero_provisoire} enregistrée sur cet appareil ; envoi automatique au retour de la connexion.`, 'info');
    hlMajAffichage();
    return { hors_ligne: true, id: op.id_provisoire || null, numero: op.numero_provisoire, numero_lot: op.numero_provisoire, operation_id: op.id };
  }

