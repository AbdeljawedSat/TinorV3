  // ============================================================================
  // NOUVELLE CATÉGORIE (rapide) — accessible depuis le formulaire produit.
  // ============================================================================
  function openCategorieRapideModal() {
    document.getElementById('categorieRapideFormError').style.display = 'none';
    document.getElementById('categorieRapideCode').value = '';
    document.getElementById('categorieRapideNom').value = '';
    document.getElementById('categorieRapideType').value = 'PRODUIT';
    document.getElementById('categorieRapideModalOverlay').classList.add('open');
  }
  function closeCategorieRapideModal() { document.getElementById('categorieRapideModalOverlay').classList.remove('open'); }
  document.getElementById('nouvelleCategorieBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openCategorieRapideModal();
  });
  document.getElementById('categorieRapideCancelBtn').addEventListener('click', closeCategorieRapideModal);
  document.getElementById('categorieRapideModalCloseBtn').addEventListener('click', closeCategorieRapideModal);
  document.getElementById('categorieRapideSaveBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('categorieRapideFormError');
    errEl.style.display = 'none';
    const payload = {
      code: document.getElementById('categorieRapideCode').value.trim().toUpperCase(),
      nom: document.getElementById('categorieRapideNom').value.trim(),
      type_category: document.getElementById('categorieRapideType').value,
    };
    if (!payload.code || !payload.nom) {
      errEl.textContent = 'Code et nom sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      const nouvelleCategorie = await apiFetch('/categories', { method: 'POST', body: JSON.stringify(payload) });
      REF_DATA.categories = await apiFetch('/categories');
      closeCategorieRapideModal();
      populateSelect(document.getElementById('produitCategorie'), REF_DATA.categories, 'id', 'nom');
      document.getElementById('produitCategorie').value = nouvelleCategorie.id;
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

  // ============================================================================
  // NOUVEAU FORMAT (rapide) — accessible depuis le formulaire produit, pour
  // ne plus dépendre de SQL direct.
  // ============================================================================
  function openFormatRapideModal() {
    document.getElementById('formatRapideFormError').style.display = 'none';
    document.getElementById('formatRapideCode').value = '';
    document.getElementById('formatRapideNom').value = '';
    document.getElementById('formatRapideType').value = 'volume';
    document.getElementById('formatRapideValeur').value = '';
    document.getElementById('formatRapideModalOverlay').classList.add('open');
  }
  function closeFormatRapideModal() { document.getElementById('formatRapideModalOverlay').classList.remove('open'); }
  document.getElementById('nouveauFormatBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openFormatRapideModal();
  });
  document.getElementById('formatRapideCancelBtn').addEventListener('click', closeFormatRapideModal);
  document.getElementById('formatRapideModalCloseBtn').addEventListener('click', closeFormatRapideModal);

  document.getElementById('formatRapideSaveBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('formatRapideFormError');
    errEl.style.display = 'none';
    const type = document.getElementById('formatRapideType').value;
    const valeur = Number(document.getElementById('formatRapideValeur').value) || null;
    const payload = {
      code: document.getElementById('formatRapideCode').value.trim(),
      nom: document.getElementById('formatRapideNom').value.trim(),
      volume: type === 'volume' ? valeur : null,
      poids: type === 'poids' ? valeur : null,
    };
    if (!payload.code || !payload.nom || !valeur) {
      errEl.textContent = 'Code, nom et valeur sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      const nouveauFormat = await apiFetch('/formats', { method: 'POST', body: JSON.stringify(payload) });
      REF_DATA.formats = await apiFetch('/formats');
      closeFormatRapideModal();
      // Re-remplit le sélecteur Format du formulaire produit ouvert et
      // sélectionne directement le format qu'on vient de créer.
      populateSelect(document.getElementById('produitFormat'), formatsAvecContenance(), 'id', 'label', '— Aucun —');
      document.getElementById('produitFormat').value = nouveauFormat.id;
      document.dispatchEvent(new CustomEvent('formatCree', { detail: nouveauFormat }));
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });

