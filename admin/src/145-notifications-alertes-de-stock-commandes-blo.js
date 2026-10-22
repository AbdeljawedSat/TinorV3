  // ============================================================================
  // NOTIFICATIONS — alertes de stock, commandes bloquées.
  // ============================================================================
  function updateNotifBadge() {
    const nbEnAttente = APP_DATA.notifications.filter(n => n.statut === 'EN_ATTENTE').length;
    const badge = document.getElementById('notifBadge');
    if (nbEnAttente > 0) { badge.textContent = nbEnAttente; badge.style.display = 'inline-block'; }
    else { badge.style.display = 'none'; }
  }
  let NOTIF_FILTER = 'EN_ATTENTE';
  function renderNotifications() {
    updateNotifBadge();
    const body = document.getElementById('notificationsBody');
    const rows = NOTIF_FILTER ? APP_DATA.notifications.filter(n => n.statut === NOTIF_FILTER) : APP_DATA.notifications;
    if (!rows.length) { body.innerHTML = `<tr><td colspan="5" class="rowMeta" style="text-align:center; padding:22px;">Aucune notification${NOTIF_FILTER === 'EN_ATTENTE' ? ' en attente — tout est à jour.' : '.'}</td></tr>`; return; }
    body.innerHTML = rows.map(n => `
      <tr>
        <td>${esc(n.titre)}</td>
        <td class="rowMeta" style="max-width:340px;">${esc(n.message)}</td>
        <td class="${n.commande_numero ? 'lotCode' : 'rowMeta'}">${n.commande_numero || '—'}</td>
        <td>${n.statut === 'EN_ATTENTE' ? '<span class="pill warn">En attente</span>' : '<span class="pill good">Résolue</span>'}</td>
        <td class="rowActions">
          ${n.statut === 'EN_ATTENTE' ? `<button class="rowActionBtn" onclick="resoudreNotification(${n.id})">Résoudre</button>` : ''}
        </td>
      </tr>`).join('');
  }
  document.querySelectorAll('#view-notifications .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#view-notifications .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      NOTIF_FILTER = chip.dataset.filter;
      renderNotifications();
    });
  });
  async function resoudreNotification(id) {
    try {
      await apiFetch(`/notifications/${id}/resoudre`, { method: 'POST' });
      const [notifications, commandes, lots, produits] = await Promise.all([apiFetch('/notifications'), apiFetch('/commandes'), apiFetch('/lots'), apiFetch('/produits')]);
      APP_DATA.notifications = notifications; APP_DATA.commandes = commandes; APP_DATA.lots = lots; APP_DATA.produits = produits;
      renderNotifications(); renderCommandes(); renderLotsRegistre(); renderProduits();
    } catch (err) { notifier(err.message, 'erreur'); }
  }

