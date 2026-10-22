  // ---------- Fournisseur ----------
  function openFournisseurModal(id) {
    document.getElementById('fournisseurFormError').style.display = 'none';
    const f = id ? APP_DATA.fournisseurs.find(x => x.id === id) : null;
    document.getElementById('fournisseurModalTitle').textContent = f ? `Modifier — ${f.nom}` : 'Nouveau fournisseur';
    document.getElementById('fournisseurId').value = f ? f.id : '';
    document.getElementById('fournisseurNom').value = f ? f.nom : '';
    document.getElementById('fournisseurMatriculeFiscal').value = f && f.matricule_fiscal ? f.matricule_fiscal : '';
    document.getElementById('fournisseurType').value = f ? f.type : 'fournisseur_externe';
    document.getElementById('fournisseurLocalisation').value = f && f.localisation ? f.localisation : '';
    document.getElementById('fournisseurStatutBio').value = f ? f.statut_bio : 'conversion';
    populateSelect(document.getElementById('fournisseurCertificat'), APP_DATA.certificats, 'id', 'numero', '— Aucun —');
    document.getElementById('fournisseurCertificat').value = f && f.certificat_id ? f.certificat_id : '';
    document.getElementById('fournisseurTelephone').value = f && f.telephone ? f.telephone : '';
    document.getElementById('fournisseurEmail').value = f && f.email ? f.email : '';
    document.getElementById('fournisseurNotes').value = f && f.notes ? f.notes : '';
    document.getElementById('fournisseurModalOverlay').classList.add('open');
  }
  function closeFournisseurModal() { document.getElementById('fournisseurModalOverlay').classList.remove('open'); }

  async function saveFournisseur() {
    const id = document.getElementById('fournisseurId').value;
    const errEl = document.getElementById('fournisseurFormError');
    errEl.style.display = 'none';
    const payload = {
      nom: document.getElementById('fournisseurNom').value.trim(),
      matricule_fiscal: document.getElementById('fournisseurMatriculeFiscal').value.trim() || null,
      type: document.getElementById('fournisseurType').value,
      localisation: document.getElementById('fournisseurLocalisation').value.trim() || null,
      statut_bio: document.getElementById('fournisseurStatutBio').value,
      certificat_id: document.getElementById('fournisseurCertificat').value ? Number(document.getElementById('fournisseurCertificat').value) : null,
      telephone: document.getElementById('fournisseurTelephone').value.trim() || null,
      email: document.getElementById('fournisseurEmail').value.trim() || null,
      notes: document.getElementById('fournisseurNotes').value.trim() || null,
    };
    if (!payload.nom) { errEl.textContent = 'Le nom est requis.'; errEl.style.display = 'block'; return; }
    try {
      if (id) await apiFetch(`/fournisseurs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/fournisseurs', { method: 'POST', body: JSON.stringify(payload) });
      closeFournisseurModal();
      APP_DATA.fournisseurs = await apiFetch('/fournisseurs');
      renderFournisseurs();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }

