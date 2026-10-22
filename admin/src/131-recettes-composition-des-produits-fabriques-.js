  // ============================================================================
  // RECETTES — composition des produits fabriqués hors filière huile.
  // ============================================================================
  function renderRecettes() {
    const body = document.getElementById('recettesBody');
    if (!APP_DATA.recettes.length) { body.innerHTML = `<tr><td colspan="3" class="rowMeta" style="text-align:center; padding:22px;">Aucune recette — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = APP_DATA.recettes.map(r => `
      <tr>
        <td>${esc(r.produit_nom || '—')}</td>
        <td class="rowMeta">${r.nb_ingredients} ingrédient${r.nb_ingredients > 1 ? 's' : ''}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="openRecetteModal(${r.id})">Modifier</button></td>
      </tr>`).join('');
  }

  function recetteIngredientRow(ingredientId, qte) {
    const options = APP_DATA.produits
      .map(p => `<option value="${p.id}" ${ingredientId === p.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'structRow';
    row.style.gridTemplateColumns = '1fr 110px 32px';
    row.innerHTML = `
      <select class="ingProduit formInput">${options}</select>
      <input type="number" step="0.0001" class="ingQte formInput" placeholder="Qté / unité" value="${qte != null ? qte : ''}">
      <button class="delField" type="button">✕</button>`;
    row.querySelector('.delField').addEventListener('click', () => row.remove());
    return row;
  }

  // Produits finis proposés : fabriqués/vendus (pas de matière première, emballage ni consommable),
  // sans recette (sauf celui de la recette ouverte).
  function remplirProduitsRecette(idCourant) {
    const avecRecette = new Set(APP_DATA.recettes.map(r => r.produit_id));
    const liste = APP_DATA.produits.filter(p => !['MATIERE_PREMIERE', 'EMBALLAGE', 'CONSOMMABLE', 'INGREDIENT'].includes(p.type_article)
      && (!avecRecette.has(p.id) || p.id === idCourant)).sort((a, b) => a.nom.localeCompare(b.nom));
    populateSelect(document.getElementById('recetteProduit'), liste, 'id', 'nom', liste.length ? null : '— Aucun produit sans recette : cochez « Nouveau produit fini » —');
    if (idCourant) document.getElementById('recetteProduit').value = idCourant;
  }
  function basculerNouveauProduitRecette() {
    const nouveau = document.getElementById('recetteNouveauProduit').checked;
    document.getElementById('recetteNouveauBloc').style.display = nouveau ? 'block' : 'none';
    document.getElementById('recetteProduit').style.display = nouveau ? 'none' : 'block';
    document.getElementById('recetteProduitInfo').style.display = nouveau ? 'none' : document.getElementById('recetteProduitInfo').dataset.vu ? 'block' : 'none';
  }
  document.getElementById('recetteNouveauProduit').addEventListener('change', basculerNouveauProduitRecette);
  async function openRecetteModal(id) {
    document.getElementById('recetteFormError').style.display = 'none';
    remplirProduitsRecette(null);
    document.getElementById('recetteNouveauProduit').checked = false;
    ['recetteNpNom', 'recetteNpPrix'].forEach(i => { document.getElementById(i).value = ''; });
    populateSelect(document.getElementById('recetteNpCategorie'), REF_DATA.categories, 'id', 'nom');
    populateSelect(document.getElementById('recetteNpUnite'), REF_DATA.unites, 'id', 'nom');
    populateSelect(document.getElementById('recetteNpFormat'), REF_DATA.formats, 'id', 'nom', '— Sans format —');
    const info = document.getElementById('recetteProduitInfo'); info.textContent = ''; delete info.dataset.vu;
    document.getElementById('recetteId').value = '';
    document.getElementById('recetteNotes').value = '';
    const rowsWrap = document.getElementById('recetteIngredientsRows');
    rowsWrap.innerHTML = '';

    if (id) {
      const detail = await apiFetch(`/recettes/${id}`);
      document.getElementById('recetteModalTitle').textContent = `Modifier — ${detail.produit_nom}`;
      document.getElementById('recetteId').value = detail.id;
      remplirProduitsRecette(detail.produit_id);
      document.getElementById('recetteProduit').dataset.initial = detail.produit_id;
      // Le produit fini peut changer (ou être un nouveau produit) tant que la recette n'a servi à aucune production.
      const utilisee = APP_DATA.ordresProduction.some(o => o.recette_id === detail.id);
      document.getElementById('recetteProduit').disabled = utilisee;
      document.getElementById('recetteNouveauProduit').closest('label').style.display = utilisee ? 'none' : 'flex';
      if (utilisee) { info.textContent = 'Recette déjà utilisée en production : le produit fini ne change plus (créez une nouvelle recette pour un autre produit).'; info.dataset.vu = '1'; }
      document.getElementById('recetteNotes').value = detail.notes || '';
      detail.ingredients.forEach(ing => rowsWrap.appendChild(recetteIngredientRow(ing.ingredient_id, ing.quantite_par_unite)));
    } else {
      document.getElementById('recetteModalTitle').textContent = 'Nouvelle recette';
      document.getElementById('recetteProduit').disabled = false;
      delete document.getElementById('recetteProduit').dataset.initial;
      document.getElementById('recetteNouveauProduit').closest('label').style.display = 'flex';
      rowsWrap.appendChild(recetteIngredientRow(null, null));
    }
    basculerNouveauProduitRecette();
    document.getElementById('recetteModalOverlay').classList.add('open');
  }
  function closeRecetteModal() { document.getElementById('recetteModalOverlay').classList.remove('open'); }
  document.getElementById('recetteAddIngredientBtn').addEventListener('click', () => {
    document.getElementById('recetteIngredientsRows').appendChild(recetteIngredientRow(null, null));
  });

  async function saveRecette() {
    const errEl = document.getElementById('recetteFormError');
    errEl.style.display = 'none';
    const id = document.getElementById('recetteId').value;
    const ingredients = [...document.querySelectorAll('#recetteIngredientsRows .structRow')].map(row => ({
      ingredient_id: Number(row.querySelector('.ingProduit').value) || null,
      quantite_par_unite: Number(row.querySelector('.ingQte').value) || null,
    })).filter(i => i.ingredient_id && i.quantite_par_unite);

    if (!ingredients.length) { errEl.textContent = 'Au moins un ingrédient valide est requis.'; errEl.style.display = 'block'; return; }

    const nouveau = document.getElementById('recetteNouveauProduit').checked;
    const corps = { notes: document.getElementById('recetteNotes').value.trim() || null, ingredients };
    if (nouveau) {
      corps.nouveau_produit = {
        nom: document.getElementById('recetteNpNom').value.trim(),
        categorie_id: Number(document.getElementById('recetteNpCategorie').value) || null,
        unite_id: Number(document.getElementById('recetteNpUnite').value) || null,
        format_id: Number(document.getElementById('recetteNpFormat').value) || null,
        prix_vente: document.getElementById('recetteNpPrix').value === '' ? null : Number(document.getElementById('recetteNpPrix').value),
      };
      if (!corps.nouveau_produit.nom) { errEl.textContent = 'Indiquez le nom du nouveau produit fini.'; errEl.style.display = 'block'; return; }
    } else {
      corps.produit_id = Number(document.getElementById('recetteProduit').value) || null;
      if (!corps.produit_id) { errEl.textContent = 'Choisissez le produit fini (ou cochez « Nouveau produit fini »).'; errEl.style.display = 'block'; return; }
    }
    try {
      if (id) await apiFetch(`/recettes/${id}`, { method: 'PUT', body: JSON.stringify(corps) });
      else await apiFetch('/recettes', { method: 'POST', body: JSON.stringify(corps) });
      closeRecetteModal();
      if (nouveau) { APP_DATA.produits = await apiFetch('/produits'); renderProduits(); notifier(`Produit « ${corps.nouveau_produit.nom} » créé avec sa recette.`, 'succes'); }
      APP_DATA.recettes = await apiFetch('/recettes');
      renderRecettes();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('recetteSaveBtn').addEventListener('click', saveRecette);
  document.getElementById('recetteCancelBtn').addEventListener('click', closeRecetteModal);
  document.getElementById('recetteModalCloseBtn').addEventListener('click', closeRecetteModal);

