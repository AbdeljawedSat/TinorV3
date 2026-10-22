  // ============================================================================
  // FACTURES — émission depuis une commande, paiements, annulation.
  // ============================================================================
  function renderFactures() {
    const body = document.getElementById('facturesBody');
    const rows = filtreVue('factures', filtrerParTexteEtDate(APP_DATA.factures, 'factures', f => `${f.client_nom || ''} ${f.numero}`, f => f.date_emission));
    document.getElementById('facturesCount').textContent = `${rows.length} facture${rows.length > 1 ? 's' : ''}`;
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="8" class="videAction">${APP_DATA.factures.length ? 'Aucune facture pour ce filtre.' : 'Aucune facture pour le moment : une facture s\'émet depuis une commande.'}<br>
        ${APP_DATA.factures.length ? `<button class="btnGhost" onclick="document.getElementById('facturesFilterResetBtn').click()">Effacer les filtres</button>` : `<button class="btnPrimary" onclick="allerVers('commandes')">Voir les commandes</button>`}</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(f => `
      <tr data-id="${f.id}">
        <td class="lotCode">${esc(f.numero)}</td>
        <td>${esc(f.client_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(f.date_emission)}</td>
        <td>${f.statut === 'annulee' ? '<span class="pill danger">Annulée</span>' : '<span class="pill good">Émise</span>'}${pastilleAvoir(f)}</td>
        <td class="num">${fmtDT(f.total_ttc)}</td>
        <td class="num">${fmtDT(f.total_paye)}</td>
        <td class="num">${f.statut === 'annulee' ? '<span class="rowMeta">—</span>' : fmtSolde(f.solde)}</td>
        <td class="rowActions">
          ${factureAEncaisser(f)
            ? `<button class="rowActionBtn principal" onclick="openPaiementModal(${f.id})">Encaisser</button>`
            : `<button class="rowActionBtn" onclick="imprimerFacture(${f.id})">🖨 Imprimer</button>`}
          <button class="rowActionBtn plus" title="Plus d'actions" onclick="ouvrirMenuLigne(event, 'facturesBody', ${f.id})">⋯</button>
        </td>
      </tr>`).join('');
    cablerMenuContextuel('facturesBody', (id) => {
      const f = APP_DATA.factures.find(x => x.id === id);
      if (!f) return [];
      const items = [];
      items.push(factureAEncaisser(f)
        ? { label: '💰 Encaisser un paiement', action: () => openPaiementModal(id) }
        : { label: '💰 Encaisser un paiement', desactive: f.statut === 'annulee' ? 'Facture annulée' : 'Facture déjà soldée' });
      items.push({ label: '🖨 Imprimer / PDF', action: () => imprimerFacture(id) });
      items.push({ label: '⬇ Word (.docx)', action: () => exportFactureDocx(id) });
      items.push({ label: '⬇ Excel (.xlsx)', action: () => exportFactureXlsx(id) });
      items.push({ label: '✉ Envoyer par e-mail…', action: () => envoyerFactureParEmail(id) });
      items.push({ label: '✔ Contrôler les mentions obligatoires', action: () => controlerMentionsFacture(id) });
      const actifs = APP_DATA.paiements.filter(p => p.facture_id === id && !p.annule_le);
      if (isGerant() && actifs.length) {
        items.push(null);
        actifs.forEach(p => items.push({ label: `Annuler le paiement du ${fmtDate(p.date_paiement)} (${fmtDT(p.montant)})…`, danger: true, action: () => annulerPaiement(id, p.id) }));
      }
      // Une facture émise ne s'annule pas : on la corrige par un avoir.
      if (f.statut !== 'annulee') {
        const toutRepris = Number(f.total_avoirs) >= Number(f.total_ttc) - 0.0005;
        items.push(null, !isGerant() ? { label: '↩ Émettre un avoir', desactive: 'Réservé au gérant' }
          : toutRepris ? { label: '↩ Émettre un avoir', desactive: 'Toute la facture est déjà reprise en avoir' }
          : { label: '↩ Émettre un avoir…', danger: true, action: () => ouvrirAvoir(id) });
      }
      return items;
    });
  }
  const factureAEncaisser = (f) => f.statut !== 'annulee' && Number(f.solde) > 0.0005;
  // Solde négatif : le client a payé plus que ce qu'il doit après avoir → crédit en sa faveur.
  const fmtSolde = (s) => Number(s) < -0.0005 ? `<span style="color:var(--good);" title="En faveur du client (à rembourser ou à déduire)">Crédit ${fmtDT(-Number(s))}</span>` : fmtDT(Math.max(0, Number(s)));
  const pastilleAvoir = (f) => !Number(f.total_avoirs) ? '' : Number(f.total_avoirs) >= Number(f.total_ttc) - 0.0005
    ? ' <span class="pill grey" title="Facture entièrement reprise par avoir">Reprise par avoir</span>'
    : ` <span class="pill warn" title="Avoir de ${fmtDT(f.total_avoirs)}">Avoir partiel</span>`;

