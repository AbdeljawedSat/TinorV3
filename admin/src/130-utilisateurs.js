  // ============================================================================
  // UTILISATEURS
  // ============================================================================
  function renderUtilisateurs() {
    const body = document.getElementById('utilisateursBody');
    if (!APP_DATA.users.length) { body.innerHTML = `<tr><td colspan="5" class="rowMeta" style="text-align:center; padding:22px;">Aucun utilisateur.</td></tr>`; return; }
    body.innerHTML = APP_DATA.users.map(u => `
      <tr>
        <td class="lotCode">${esc(u.username)}</td>
        <td>${u.employe_nom ? `${esc(u.employe_nom)} ${esc(u.employe_prenom || '')}` : '—'}</td>
        <td class="rowMeta">${LIBELLES_ROLES[u.role] || u.role}</td>
        <td>${u.actif ? '<span class="pill good">Actif</span>' : '<span class="pill grey">Inactif</span>'}</td>
        <td class="rowActions">
          ${isGerant() ? `
            <button class="rowActionBtn" onclick="openUserModal(${u.id})">Modifier</button>
            <button class="rowActionBtn danger" onclick="askDelete('users', ${u.id}, '${attrJs(u.username)}', renderUtilisateursAfterDelete)">Supprimer</button>` : '<span class="rowMeta">—</span>'}
        </td>
      </tr>`).join('');
  }
  async function renderUtilisateursAfterDelete() { APP_DATA.users = await apiFetch('/users'); renderUtilisateurs(); }

  function openUserModal(id) {
    document.getElementById('userFormError').style.display = 'none';
    populateSelect(document.getElementById('userEmploye'), APP_DATA.employes, 'id', 'nom', '— Aucun —');
    const u = id ? APP_DATA.users.find(x => x.id === id) : null;
    document.getElementById('userModalTitle').textContent = u ? `Modifier — ${u.username}` : 'Nouvel utilisateur';
    document.getElementById('userId').value = u ? u.id : '';
    document.getElementById('userUsername').value = u ? u.username : '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPasswordHint').textContent = u ? '(laisser vide pour ne pas changer)' : '';
    document.getElementById('userEmploye').value = u && u.employe_id ? u.employe_id : '';
    document.getElementById('userRole').value = u ? u.role : 'vendeur';
    document.getElementById('userActif').checked = u ? !!u.actif : true;
    document.getElementById('userModalOverlay').classList.add('open');
  }
  function closeUserModal() { document.getElementById('userModalOverlay').classList.remove('open'); }

  async function saveUser() {
    const id = document.getElementById('userId').value;
    const errEl = document.getElementById('userFormError');
    errEl.style.display = 'none';
    const payload = {
      username: document.getElementById('userUsername').value.trim(),
      employe_id: document.getElementById('userEmploye').value ? Number(document.getElementById('userEmploye').value) : null,
      role: document.getElementById('userRole').value,
      actif: document.getElementById('userActif').checked,
    };
    const password = document.getElementById('userPassword').value;
    if (password) payload.password = password;
    if (!payload.username || (!id && !password)) {
      errEl.textContent = "Identifiant requis, et mot de passe requis pour un nouvel utilisateur."; errEl.style.display = 'block'; return;
    }
    try {
      if (id) await apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
      closeUserModal();
      APP_DATA.users = await apiFetch('/users');
      renderUtilisateurs();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('userSaveBtn').addEventListener('click', saveUser);
  document.getElementById('userCancelBtn').addEventListener('click', closeUserModal);
  document.getElementById('userModalCloseBtn').addEventListener('click', closeUserModal);

