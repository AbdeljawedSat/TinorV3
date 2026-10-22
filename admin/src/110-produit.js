  // ---------- Produit ----------
  function openProduitModal(id) {
    produitUniteAutoGeneree = ''; // réinitialise l'état entre deux ouvertures du formulaire
    populateSelect(document.getElementById('produitCategorie'), REF_DATA.categories, 'id', 'nom');
    populateSelect(document.getElementById('produitFormat'), formatsAvecContenance(), 'id', 'label', '— Aucun —');
    populateSelect(document.getElementById('produitUnite'), REF_DATA.unites, 'id', 'nom');
    document.getElementById('produitFormError').style.display = 'none';

    const p = id ? APP_DATA.produits.find(x => x.id === id) : null;
    // Sources potentielles = produits sans format (vrac) — on exclut le produit
    // lui-même en édition, pour ne pas pouvoir se désigner comme sa propre source.
    const sourcesPossibles = APP_DATA.produits.filter(x => !x.format_id && (!p || x.id !== p.id));
    populateSelect(document.getElementById('produitSource'), sourcesPossibles, 'id', 'nom', '— Aucun (ce produit est lui-même le vrac, ou indépendant) —');

    document.getElementById('produitModalTitle').textContent = p ? `Modifier — ${p.nom}` : 'Nouveau produit';
    document.getElementById('produitId').value = p ? p.id : '';
    document.getElementById('produitNom').value = p ? p.nom : '';
    document.getElementById('produitDescription').value = p && p.description ? p.description : '';
    document.getElementById('produitBarcode').value = p && p.barcode ? p.barcode : '';
    document.getElementById('produitCategorie').value = p ? p.categorie_id : '';
    document.getElementById('produitUnite').value = p ? p.unite_id : '';
    document.getElementById('produitFormat').value = p && p.format_id ? p.format_id : '';
    document.getElementById('produitSource').value = p && p.produit_source_id ? p.produit_source_id : '';
    document.getElementById('produitType').value = p ? p.type_article : 'PRODUIT_FABRIQUE';
    document.getElementById('produitPrix').value = p && p.prix_vente != null ? p.prix_vente : '';
    document.getElementById('produitStockMin').value = p && p.stock_min != null ? p.stock_min : '';
    document.getElementById('produitCoutStandard').value = p && p.cout_standard != null ? p.cout_standard : '';
    document.getElementById('produitVendable').checked = p ? !!p.vendable : false;
    document.getElementById('produitAchetable').checked = p ? !!p.achetable : false;
    document.getElementById('produitFabriquable').checked = p ? !!p.fabriquable : false;
    document.getElementById('produitStockable').checked = p ? !!p.stockable : true;
    document.getElementById('produitActif').checked = p ? !!p.actif : true;
    document.getElementById('produitBio').checked = p ? !!p.bio_eligible : false;

    const boxD = document.getElementById('derivesBox'); boxD._d = null; boxD.className = ''; boxD.innerHTML = '';
    document.getElementById('produitModalOverlay').classList.add('open');
  }
  function closeProduitModal() { document.getElementById('produitModalOverlay').classList.remove('open'); }

  // Auto-remplissage du nom à partir du produit source choisi + format —
  // seulement si le nom est encore vide ou correspond à une précédente
  // auto-génération (on ne veut jamais écraser un nom saisi manuellement).
  let produitNomAutoGenere = '';
  document.getElementById('produitSource').addEventListener('change', () => {
    const nomActuel = document.getElementById('produitNom').value.trim();
    if (nomActuel && nomActuel !== produitNomAutoGenere) return; // l'utilisateur a personnalisé le nom, on ne touche plus
    const sourceId = document.getElementById('produitSource').value;
    if (!sourceId) return;
    const source = APP_DATA.produits.find(x => x.id === Number(sourceId));
    if (!source) return;
    const baseName = source.nom.replace(/\s*[-—]\s*vrac\b/i, '').replace(/\bvrac\b/i, '').trim();
    const formatId = document.getElementById('produitFormat').value;
    const format = formatId ? REF_DATA.formats.find(f => f.id === Number(formatId)) : null;
    const nouveauNom = format ? `${baseName} ${format.code || format.nom}` : baseName;
    document.getElementById('produitNom').value = nouveauNom;
    produitNomAutoGenere = nouveauNom;
  });
  document.getElementById('produitFormat').addEventListener('change', () => {
    document.getElementById('produitSource').dispatchEvent(new Event('change'));
  });
  // Choisir un format implique presque toujours un comptage à la pièce —
  // pré-remplit l'unité sur "unité" automatiquement (source du bug kg/g vu
  // plusieurs fois), sans jamais écraser un choix déjà fait manuellement.
  let produitUniteAutoGeneree = '';
  document.getElementById('produitFormat').addEventListener('change', () => {
    const formatId = document.getElementById('produitFormat').value;
    if (!formatId) return; // passage à "Vrac (sans format)" : on ne touche pas à l'unité existante
    const uniteActuelle = document.getElementById('produitUnite').value;
    if (uniteActuelle && uniteActuelle !== produitUniteAutoGeneree) return; // choix manuel déjà fait, on ne touche plus
    const uniteUnitaire = REF_DATA.unites.find(u => u.code === 'unite');
    if (!uniteUnitaire) return;
    document.getElementById('produitUnite').value = uniteUnitaire.id;
    produitUniteAutoGeneree = String(uniteUnitaire.id);
  });

