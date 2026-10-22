  // ---------- Changer mon mot de passe (proposé à la connexion tant que c'est « changeme ») ----------
  function ouvrirMotDePasse(ancien = '', parDefaut = false) {
    document.getElementById('mdpSousTitre').textContent = CURRENT_USER ? `Compte ${CURRENT_USER.username}` : 'Compte TinOR';
    const alerte = document.getElementById('mdpAlerte');
    alerte.style.display = parDefaut ? 'block' : 'none';
    alerte.textContent = 'Vous utilisez le mot de passe livré avec TinOR (« changeme ») : tout le monde le connaît. Choisissez le vôtre.';
    document.getElementById('mdpFormError').style.display = 'none';
    document.getElementById('mdpAncien').value = ancien;
    document.getElementById('mdpNouveau').value = ''; document.getElementById('mdpConfirmation').value = '';
    document.getElementById('mdpModalOverlay').classList.add('open');
    setTimeout(() => document.getElementById(ancien ? 'mdpNouveau' : 'mdpAncien').focus(), 50);
  }
  const fermerMotDePasse = () => document.getElementById('mdpModalOverlay').classList.remove('open');
  document.getElementById('mdpCancelBtn').addEventListener('click', fermerMotDePasse);
  document.getElementById('mdpModalCloseBtn').addEventListener('click', fermerMotDePasse);
  document.getElementById('mdpSaveBtn').addEventListener('click', async () => {
    const err = document.getElementById('mdpFormError'); err.style.display = 'none';
    const ancien = document.getElementById('mdpAncien').value, nouveau = document.getElementById('mdpNouveau').value;
    const montrer = (m) => { err.textContent = m; err.style.display = 'block'; };
    if (!ancien) return montrer('Saisissez votre mot de passe actuel.');
    if (nouveau.length < 10) return montrer('Le nouveau mot de passe doit faire au moins 10 caractères.');
    if (nouveau !== document.getElementById('mdpConfirmation').value) return montrer('La confirmation ne correspond pas.');
    try {
      await apiFetch('/auth/mot-de-passe', { method: 'POST', body: JSON.stringify({ ancien, nouveau }) });
      HL.motDePasse = nouveau; // reconnexion silencieuse et connexion hors ligne avec le nouveau mot de passe
      try { if (CURRENT_USER) await hlMemoriserSession(CURRENT_USER.username, nouveau, CURRENT_USER); } catch {}
      fermerMotDePasse();
      notifier('Mot de passe changé.', 'succes');
    } catch (e) { montrer(e.message); }
  });

