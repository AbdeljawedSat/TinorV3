  // ---------- Onglets et filtres ----------
  document.querySelectorAll('.stockTab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stockTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.stockTabPanel').forEach(p => p.style.display = 'none');
      document.getElementById('stockPanel-' + btn.dataset.tab).style.display = 'block';
    });
  });
  document.querySelectorAll('.stockHuileToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stockHuileToggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStockAll();
    });
  });
  ['stockSearch', 'stockFilterDateDebut', 'stockFilterDateFin'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderStockAll);
  });
  document.getElementById('stockFilterResetBtn').addEventListener('click', () => {
    document.getElementById('stockSearch').value = '';
    document.getElementById('stockFilterDateDebut').value = '';
    document.getElementById('stockFilterDateFin').value = '';
    document.querySelectorAll('.stockHuileToggle').forEach(b => b.classList.remove('active'));
    document.querySelector('.stockHuileToggle[data-val="toutes"]').classList.add('active');
    renderStockAll();
  });

  const TYPE_MOUVEMENT_LABEL = {
    ACHAT:'Achat', RECEPTION:'Réception', VENTE:'Vente', PRODUCTION:'Production', CONDITIONNEMENT:'Conditionnement',
    CONSOMMATION:'Consommation', TRANSFERT:'Transfert', AJUSTEMENT:'Ajustement', INVENTAIRE:'Inventaire',
    RETOUR_CLIENT:'Retour client', RETOUR_FOURNISSEUR:'Retour fournisseur', PERTE:'Perte', CASSE:'Casse',
    DESTRUCTION:'Destruction', AUTRE:'Autre',
  };
  let STOCK_MVT_FILTER = '';
  function renderStockMouvements() {
    const body = document.getElementById('stockMouvementsBody');
    let rows = STOCK_MVT_FILTER ? APP_DATA.stockMouvements.filter(m => m.sens === STOCK_MVT_FILTER) : APP_DATA.stockMouvements;
    rows = filtrerParTexteEtDate(rows, 'mouvements', m => `${m.produit_nom || ''} ${m.numero_lot || ''}`, m => m.date_mouvement);
    if (!rows.length) { body.innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucun mouvement pour ce filtre.</td></tr>`; return; }
    body.innerHTML = rows.map(m => `
      <tr>
        <td class="rowMeta num">${fmtDate(m.date_mouvement)}</td>
        <td class="rowMeta">${TYPE_MOUVEMENT_LABEL[m.type_mouvement] || m.type_mouvement}</td>
        <td>${m.sens === 'ENTREE' ? '<span class="pill good">Entrée</span>' : m.sens === 'SORTIE' ? '<span class="pill warn">Sortie</span>' : '<span class="pill grey">Neutre</span>'}</td>
        <td>${esc(m.produit_nom || '—')}</td>
        <td class="${m.numero_lot ? 'lotCode' : 'rowMeta'}">${esc(m.numero_lot || '—')}</td>
        <td class="num">${m.quantite}</td>
        <td class="rowMeta">${m.source_type || '—'}</td>
      </tr>`).join('');
  }
  document.querySelectorAll('#view-stock-mouvements .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#view-stock-mouvements .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STOCK_MVT_FILTER = chip.dataset.filter;
      renderStockMouvements();
    });
  });

