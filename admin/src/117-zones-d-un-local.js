  // ---------- Zones d'un local ----------
  let ZONES_CURRENT_LOCAL_ID = null;
  async function refreshZonesList() {
    const zones = await apiFetch(`/locaux/${ZONES_CURRENT_LOCAL_ID}/zones`);
    document.getElementById('zonesBody').innerHTML = zones.length
      ? zones.map(z => `<tr><td class="lotCode">${esc(z.code)}</td><td>${esc(z.nom)}</td></tr>`).join('')
      : `<tr><td colspan="2" class="rowMeta">Aucune zone pour l'instant.</td></tr>`;
  }
  async function openZonesModal(localId) {
    ZONES_CURRENT_LOCAL_ID = localId;
    const local = APP_DATA.locaux.find(l => l.id === localId);
    document.getElementById('zonesModalTitle').textContent = `Zones — ${local ? local.nom : ''}`;
    document.getElementById('zoneNewCode').value = '';
    document.getElementById('zoneNewNom').value = '';
    document.getElementById('zonesFormError').style.display = 'none';
    await refreshZonesList();
    document.getElementById('zonesModalOverlay').classList.add('open');
  }
  function closeZonesModal() {
    document.getElementById('zonesModalOverlay').classList.remove('open');
    loadAllData(); // rafraîchit le compteur "nb_zones" affiché dans le tableau Locaux
  }
  document.getElementById('zoneAddBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('zonesFormError');
    errEl.style.display = 'none';
    const code = document.getElementById('zoneNewCode').value.trim();
    const nom = document.getElementById('zoneNewNom').value.trim();
    if (!code || !nom) { errEl.textContent = 'Code et nom sont requis.'; errEl.style.display = 'block'; return; }
    try {
      await apiFetch(`/locaux/${ZONES_CURRENT_LOCAL_ID}/zones`, { method: 'POST', body: JSON.stringify({ code, nom }) });
      document.getElementById('zoneNewCode').value = '';
      document.getElementById('zoneNewNom').value = '';
      await refreshZonesList();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  });
  document.getElementById('zonesModalCloseBtn').addEventListener('click', closeZonesModal);
  document.getElementById('zonesCloseFooterBtn').addEventListener('click', closeZonesModal);

