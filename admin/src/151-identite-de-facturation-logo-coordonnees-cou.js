  // ---------- Identité de facturation (logo, coordonnées, couleur) ----------
  let LOGO_BASE64_EN_ATTENTE = null; // null = pas de changement, garder le logo existant
  document.getElementById('paramLogoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      LOGO_BASE64_EN_ATTENTE = reader.result; // data URL base64, prête à stocker/afficher telle quelle
      const preview = document.getElementById('paramLogoPreview');
      preview.src = LOGO_BASE64_EN_ATTENTE;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('parametresFactureSaveBtn')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('parametresFactureFormStatus');
    const payload = {
      entreprise_nom: document.getElementById('paramEntrepriseNom').value.trim() || null,
      entreprise_adresse: document.getElementById('paramEntrepriseAdresse').value.trim() || null,
      entreprise_telephone: document.getElementById('paramEntrepriseTelephone').value.trim() || null,
      entreprise_email: document.getElementById('paramEntrepriseEmail').value.trim() || null,
      entreprise_matricule_fiscal: document.getElementById('paramEntrepriseMatriculeFiscal').value.trim() || null,
      facture_couleur: document.getElementById('paramFactureCouleur').value,
    };
    if (LOGO_BASE64_EN_ATTENTE) payload.entreprise_logo = LOGO_BASE64_EN_ATTENTE;
    try {
      APP_DATA.settings = await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      LOGO_BASE64_EN_ATTENTE = null;
      statusEl.textContent = 'Enregistré.';
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    } catch (err) { statusEl.textContent = err.message; }
  });

  // ============================================================================
  // SAUVEGARDE DE LA BASE — déclenchement manuel + liste des sauvegardes
  // existantes (la planification automatique se fait via Tâche planifiée
  // Windows, voir scripts/README_SAUVEGARDE.md).
  // ============================================================================
  function fmtTailleFichier(octets) {
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
    return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  }
  async function chargerListeBackups() {
    const body = document.getElementById('backupListBody');
    if (!body) return;
    try {
      const liste = await apiFetch('/backup');
      body.innerHTML = liste.length
        ? liste.map(b => `
          <tr>
            <td style="font-size:11.5px;">${b.fichier}</td>
            <td class="num" style="font-size:11.5px;">${fmtTailleFichier(b.taille)}</td>
            <td><a href="${API_BASE}/backup/${encodeURIComponent(b.fichier)}" target="_blank" style="font-size:11.5px;">⬇ Télécharger</a></td>
          </tr>`).join('')
        : `<tr><td colspan="3" class="rowMeta">Aucune sauvegarde pour l'instant.</td></tr>`;
    } catch (err) {
      body.innerHTML = `<tr><td colspan="3" class="rowMeta">Erreur : ${esc(err.message)}</td></tr>`;
    }
  }
  document.getElementById('backupNowBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('backupNowBtn');
    const statusEl = document.getElementById('backupStatus');
    const errEl = document.getElementById('backupError');
    errEl.style.display = 'none';
    btn.disabled = true;
    statusEl.textContent = 'Sauvegarde en cours…';
    try {
      const res = await apiFetch('/backup/now', { method: 'POST' });
      statusEl.textContent = `✓ ${res.fichier} (${fmtTailleFichier(res.taille)})`;
      setTimeout(() => { statusEl.textContent = ''; }, 4000);
      await chargerListeBackups();
    } catch (err) {
      statusEl.textContent = '';
      errEl.textContent = err.message.includes('mysqldump')
        ? `${err.message} — vérifiez que le dossier bin de MySQL/MariaDB est dans le PATH système.`
        : err.message;
      errEl.style.display = 'block';
    } finally { btn.disabled = false; }
  });

  // ============================================================================
  // ONGLETS INTERNES D'ÉCRAN — pour les écrans devenus trop chargés
  // (Paramètres, Statistiques) : bascule entre plusieurs panneaux dans la
  // même zone, plutôt que tout empiler verticalement.
  // ============================================================================
  function cablerOngletsEcran(tabBtnClass, paneClass) {
    document.querySelectorAll(`.${tabBtnClass}`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`.${tabBtnClass}`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cible = btn.dataset.tab;
        document.querySelectorAll(`.${paneClass}`).forEach(pane => {
          pane.style.display = pane.dataset.tab === cible ? '' : 'none';
        });
      });
    });
  }
  cablerOngletsEcran('paramTabBtn', 'paramTabPane');
  cablerOngletsEcran('statsTabBtn', 'statsTabPane');

  // ============================================================================
  // MENU CONTEXTUEL GÉNÉRIQUE (clic droit) — réutilisable sur n'importe quel
  // tableau. items: [{ label, action, danger? }] ou null pour un séparateur.
  // ============================================================================
  function afficherMenuContextuel(event, items) {
    event.preventDefault();
    const menu = document.getElementById('menuContextuel');
    menu.innerHTML = items.map((it, i) => it === null
      ? `<div style="height:1px; background:var(--line); margin:4px 2px;"></div>`
      : it.desactive
      ? `<div style="padding:7px 12px; color:var(--text-soft); opacity:.75; cursor:not-allowed;">${esc(it.label)}<div style="font-size:11px; margin-top:1px;">${esc(it.desactive)}</div></div>`
      : `<div class="menuContextuelItem" data-idx="${i}" style="padding:8px 12px; border-radius:5px; cursor:pointer; color:${it.danger ? 'var(--danger)' : 'inherit'};">${esc(it.label)}</div>`
    ).join('');
    menu.querySelectorAll('.menuContextuelItem').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'var(--sand)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('click', () => {
        const item = items[Number(el.dataset.idx)];
        fermerMenuContextuel();
        item.action();
      });
    });
    // Téléphone : feuille pleine largeur au-dessus des onglets du bas (le menu
    // n'est jamais coupé). Ordinateur : au curseur, contenu dans l'écran.
    menu.style.display = 'block';
    const { innerWidth: vw, innerHeight: vh } = window;
    if (vw <= 700) {
      const onglets = document.getElementById('ongletsMobile');
      const bas = (onglets && onglets.offsetHeight) || 0;
      menu.classList.add('feuille');
      menu.style.left = '8px'; menu.style.right = '8px'; menu.style.top = 'auto';
      menu.style.bottom = `${bas + 8}px`;
      menu.style.maxHeight = `${Math.max(160, vh - bas - 24)}px`;
      return;
    }
    menu.classList.remove('feuille');
    menu.style.right = 'auto'; menu.style.bottom = 'auto';
    menu.style.maxHeight = `${vh - 16}px`;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, vw - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, vh - rect.height - 8))}px`;
  }
  function fermerMenuContextuel() { document.getElementById('menuContextuel').style.display = 'none'; }
  document.addEventListener('click', fermerMenuContextuel);
  document.addEventListener('scroll', (e) => { if (!e.target.closest || !e.target.closest('#menuContextuel')) fermerMenuContextuel(); }, true);
  window.addEventListener('resize', fermerMenuContextuel);
  // Attache le clic droit à toutes les lignes <tr data-id> d'un tbody, en
  // appelant buildItems(id) pour construire le menu à la volée (les données
  // peuvent changer entre deux rendus, donc jamais figé à l'avance).
  const MENUS_LIGNE = {};
  function cablerMenuContextuel(tbodyId, buildItems) {
    MENUS_LIGNE[tbodyId] = buildItems;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    // Bouton « ⋯ » sur chaque ligne (le clic droit n'existe pas sur téléphone) :
    // ajouté ici une fois pour toutes les listes qui ont un menu de ligne.
    tbody.querySelectorAll('tr[data-id] > td.rowActions').forEach(td => {
      if (td.querySelector('.rowActionBtn.plus')) return;
      const id = Number(td.parentElement.dataset.id);
      td.insertAdjacentHTML('beforeend', ` <button class="rowActionBtn plus" title="Plus d'actions" onclick="ouvrirMenuLigne(event, '${tbodyId}', ${id})">⋯</button>`);
    });
    if (tbody._menuContextuelCable) return; // évite d'empiler les écouteurs à chaque rendu
    tbody._menuContextuelCable = true;
    tbody.addEventListener('contextmenu', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const id = Number(tr.dataset.id);
      const items = buildItems(id);
      if (items && items.length) afficherMenuContextuel(e, items);
    });
  }

