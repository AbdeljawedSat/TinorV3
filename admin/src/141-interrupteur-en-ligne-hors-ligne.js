  // ---------- Interrupteur En ligne / Hors ligne ----------
  function majBoutonMode() {
    document.querySelectorAll('.modeConnexion button').forEach(b => {
      const horsLigne = b.dataset.mode === 'hors_ligne';
      b.classList.toggle('actif', horsLigne ? HL.horsLigne : !HL.horsLigne);
      if (horsLigne) b.title = HL.force ? 'Hors ligne choisi : la copie de cet appareil est utilisée' : HL.horsLigne ? 'Réseau perdu : hors ligne automatique' : 'Travailler sans serveur, sur la copie de cet appareil';
    });
  }
  async function choisirMode(mode) {
    if (mode === 'hors_ligne') {
      if (HL.force) return;
      HL.force = true; HL.horsLigne = true;
      try { localStorage.setItem('tinor_mode_hors_ligne', '1'); } catch {}
      hlMajAffichage();
      if (TOKEN) notifier('Hors ligne : vous travaillez sur la copie de cet appareil ; les opérations seront envoyées en repassant « En ligne ».', 'info');
      return;
    }
    const etaitForce = HL.force;
    HL.force = false;
    try { localStorage.removeItem('tinor_mode_hors_ligne'); } catch {}
    majBoutonMode();
    if (!TOKEN) { HL.horsLigne = false; hlMajAffichage(); return; } // écran de connexion : la connexion se fera en ligne
    if (!(await hlServeurJoignable())) {
      HL.horsLigne = true; hlMajAffichage();
      notifier(await diagnostiquerServeur(API_BASE) || 'Serveur injoignable : TinOR reste hors ligne et réessaiera tout seul.', 'erreur');
      return;
    }
    if (HL.reconnexion && !(await hlReconnexionSilencieuse())) { HL.horsLigne = false; hlMajAffichage(); notifier('Serveur joignable, mais reconnectez-vous pour envoyer les opérations.', 'erreur'); return; }
    HL.horsLigne = false;
    if (etaitForce) notifier('En ligne : envoi des opérations en attente puis mise à jour des données.', 'succes');
    await hlSynchroniser({ recharger: true, manuel: true });
    hlMajAffichage();
  }
  document.querySelectorAll('.modeConnexion').forEach(g => g.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (b) choisirMode(b.dataset.mode);
  }));

