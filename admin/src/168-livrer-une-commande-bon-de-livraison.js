  // ---------- Livrer une commande (bon de livraison) ----------
  let LIVRAISON_COMMANDE = null;
  async function ouvrirLivraison(commandeId) {
    try {
      const c = await apiFetch(`/commandes/${commandeId}`);
      LIVRAISON_COMMANDE = c;
      document.getElementById('livraisonTitre').textContent = `Livrer la commande ${c.numero}`;
      document.getElementById('livraisonSous').textContent = `${c.client_nom || ''} — chaque livraison crée un bon de livraison (BL)`;
      document.getElementById('livraisonDate').value = new Date().toISOString().slice(0, 10);
      document.getElementById('livraisonNotes').value = '';
      document.getElementById('livraisonErreur').style.display = 'none';
      const lignes = (c.lignes || []).map(l => {
        const reste = Math.round((Number(l.qty) - Number(l.qty_livree || 0)) * 100) / 100;
        const bloque = !l.lot_id;
        return `<tr data-ligne="${l.id}">
          <td>${esc(l.produit_nom)}<div class="rowMeta" style="font-size:11px;">${l.numero_lot ? 'Lot ' + esc(l.numero_lot) : '<span style="color:var(--warn);">En attente de conditionnement / production</span>'}</div></td>
          <td class="num">${Number(l.qty)}</td><td class="num">${Number(l.qty_livree || 0)}</td><td class="num">${reste}</td>
          <td><input type="number" class="formInput livQte" min="0" max="${reste}" step="1" value="${bloque ? 0 : reste}" ${bloque || reste <= 0 ? 'disabled' : ''} style="width:90px; margin:0;"></td>
        </tr>`;
      }).join('');
      document.getElementById('livraisonLignes').innerHTML = lignes;
      document.getElementById('livraisonOverlay').classList.add('open');
    } catch (err) { notifier(err.message, 'erreur'); }
  }
  async function enregistrerLivraison() {
    const err = document.getElementById('livraisonErreur');
    err.style.display = 'none';
    const lignes = [...document.querySelectorAll('#livraisonLignes tr[data-ligne]')]
      .map(tr => ({ commande_ligne_id: Number(tr.dataset.ligne), qty: Number(tr.querySelector('.livQte').value) || 0 }))
      .filter(l => l.qty > 0);
    if (!lignes.length) { err.textContent = 'Indiquez au moins une quantité à livrer.'; err.style.display = 'block'; return; }
    try {
      const bl = await apiFetch('/livraisons', { method: 'POST', body: JSON.stringify({
        commande_id: LIVRAISON_COMMANDE.id, date_livraison: document.getElementById('livraisonDate').value,
        notes: document.getElementById('livraisonNotes').value.trim() || null, lignes, employe_id: CURRENT_USER ? CURRENT_USER.employe_id : null }) });
      document.getElementById('livraisonOverlay').classList.remove('open');
      await rafraichirVentes();
      if (!bl.hors_ligne) {
        notifier(`Bon de livraison ${bl.numero} créé.`, 'succes');
        if (await confirmer(`Imprimer le bon de livraison ${bl.numero} maintenant ?`, { titre: 'Bon de livraison créé', ok: 'Imprimer', non: 'Plus tard' })) imprimerLivraison(bl.id);
      }
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  }
  document.getElementById('livraisonValider').addEventListener('click', enregistrerLivraison);
  document.getElementById('livraisonToutReste').addEventListener('click', () => {
    document.querySelectorAll('#livraisonLignes .livQte:not(:disabled)').forEach(i => { i.value = i.max; });
  });
  ['livraisonFermer', 'livraisonAnnuler'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('livraisonOverlay').classList.remove('open')));

  async function solderCommande(id) {
    const c = APP_DATA.commandes.find(x => x.id === id);
    const motif = await confirmer(`Les quantités non livrées de ${c ? c.numero : 'la commande'} reviennent en stock ; la commande ne garde que ce qui a été livré (facturable ensuite).`,
      { titre: 'Solder le reliquat ?', ok: 'Solder', non: 'Garder', saisie: { label: 'Motif (obligatoire)', placeholder: 'ex. le client ne prend que ce qui a été livré' } });
    if (!motif) return;
    try { await apiFetch(`/commandes/${id}/solder`, { method: 'POST', body: JSON.stringify({ motif }) }); notifier('Reliquat soldé : le reste est revenu en stock.', 'succes'); await rafraichirVentes(); }
    catch (err) { notifier(err.message, 'erreur'); }
  }
  async function annulerLivraison(id) {
    const b = (APP_DATA.livraisons || []).find(x => x.id === id);
    const motif = await confirmer(`Les quantités du ${b ? b.numero : 'bon de livraison'} redeviennent « à livrer » sur la commande (le stock reste réservé).`,
      { titre: 'Annuler le bon de livraison ?', ok: 'Annuler le BL', non: 'Garder', danger: true, saisie: { label: 'Motif (obligatoire)', placeholder: 'ex. livraison refusée, erreur de saisie' } });
    if (!motif) return;
    try { await apiFetch(`/livraisons/${id}/annuler`, { method: 'POST', body: JSON.stringify({ motif }) }); notifier('Bon de livraison annulé.', 'succes'); await rafraichirVentes(); }
    catch (err) { notifier(err.message, 'erreur'); }
  }

