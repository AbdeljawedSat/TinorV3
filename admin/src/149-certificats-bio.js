  // ============================================================================
  // CERTIFICATS BIO
  // ============================================================================
  function renderCertificats() {
    const body = document.getElementById('certificatsBody');
    if (!body) return;
    if (!APP_DATA.certificats.length) { body.innerHTML = `<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucun certificat — cliquez sur «＋ Nouveau».</td></tr>`; return; }
    body.innerHTML = APP_DATA.certificats.map(c => `
      <tr>
        <td class="lotCode">${esc(c.numero)}</td>
        <td class="rowMeta">${c.organisme}</td>
        <td class="rowMeta num">${fmtDate(c.date_delivrance)}</td>
        <td class="num">${fmtDate(c.date_expiration)}</td>
        <td>${c.expire ? '<span class="pill danger">Expiré</span>' : '<span class="pill good">Valide</span>'}</td>
        <td class="num">${c.nb_fournisseurs}</td>
        <td class="rowActions">
          <button class="rowActionBtn" onclick="openCertificatModal(${c.id})">Modifier</button>
          <button class="rowActionBtn danger" onclick="askDelete('certificats', ${c.id}, '${attrJs(c.numero)}', renderCertificatsAfterDelete)">Supprimer</button>
        </td>
      </tr>`).join('');
  }
  async function renderCertificatsAfterDelete() { APP_DATA.certificats = await apiFetch('/certificats'); renderCertificats(); }

  function openCertificatModal(id) {
    document.getElementById('certificatFormError').style.display = 'none';
    const c = id ? APP_DATA.certificats.find(x => x.id === id) : null;
    document.getElementById('certificatModalTitle').textContent = c ? `Modifier — ${c.numero}` : 'Nouveau certificat';
    document.getElementById('certificatId').value = c ? c.id : '';
    document.getElementById('certificatNumero').value = c ? c.numero : '';
    document.getElementById('certificatOrganisme').value = c ? c.organisme : 'INNORPI';
    document.getElementById('certificatDateDelivrance').value = c ? c.date_delivrance.slice(0, 10) : '';
    document.getElementById('certificatDateExpiration').value = c ? c.date_expiration.slice(0, 10) : '';
    document.getElementById('certificatPortee').value = c && c.portee ? c.portee : '';
    document.getElementById('certificatDocumentRef').value = c && c.document_ref ? c.document_ref : '';
    document.getElementById('certificatModalOverlay').classList.add('open');
  }
  function closeCertificatModal() { document.getElementById('certificatModalOverlay').classList.remove('open'); }

  async function saveCertificat() {
    const id = document.getElementById('certificatId').value;
    const errEl = document.getElementById('certificatFormError');
    errEl.style.display = 'none';
    const payload = {
      numero: document.getElementById('certificatNumero').value.trim(),
      organisme: document.getElementById('certificatOrganisme').value,
      date_delivrance: document.getElementById('certificatDateDelivrance').value,
      date_expiration: document.getElementById('certificatDateExpiration').value,
      portee: document.getElementById('certificatPortee').value.trim() || null,
      document_ref: document.getElementById('certificatDocumentRef').value.trim() || null,
    };
    if (!payload.numero || !payload.date_delivrance || !payload.date_expiration) {
      errEl.textContent = 'N°, date de délivrance et date d\'expiration sont requis.'; errEl.style.display = 'block'; return;
    }
    try {
      if (id) await apiFetch(`/certificats/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/certificats', { method: 'POST', body: JSON.stringify(payload) });
      closeCertificatModal();
      APP_DATA.certificats = await apiFetch('/certificats');
      renderCertificats();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
  document.getElementById('certificatSaveBtn').addEventListener('click', saveCertificat);
  document.getElementById('certificatCancelBtn').addEventListener('click', closeCertificatModal);
  document.getElementById('certificatModalCloseBtn').addEventListener('click', closeCertificatModal);

