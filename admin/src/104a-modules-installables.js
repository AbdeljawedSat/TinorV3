  // ---------- Modules installables : menu, montage de leur interface, écran d'administration ----------
  const MODULES = { actifs: [], montes: new Set() };
  const ICONE_MODULE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H5a2 2 0 0 0-2 2v5h3a2 2 0 1 1 0 4H3v5a2 2 0 0 0 2 2h5v-3a2 2 0 1 1 4 0v3h5a2 2 0 0 0 2-2v-5h-3a2 2 0 1 1 0-4h3V5a2 2 0 0 0-2-2h-5v3a2 2 0 1 1-4 0z"/></svg>';
  const RACINE_SERVEUR = () => API_BASE.replace(/\/api\/?$/, '');

  // Menu « Modules » : une entrée par module actif auquel l'utilisateur a accès.
  async function chargerMenuModules() {
    let liste = [];
    try { liste = await apiFetch('/modules'); } catch { liste = []; }
    MODULES.actifs = liste;
    const groupe = document.getElementById('navModules'), enfants = groupe.querySelector('.navChildren');
    enfants.innerHTML = '';
    for (const m of liste) {
      const cle = `m-${m.id}`;
      views[cle] = `view-m-${m.id}`;
      titles[cle] = ['Modules', m.titre];
      ICONE_ECRAN[cle] = document.getElementById(`e-${m.icone}`) ? m.icone : 'parametre';
      if (!document.getElementById(views[cle])) {
        document.getElementById('content').insertAdjacentHTML('beforeend', `<div class="view" id="${views[cle]}">
          <div class="pageHead"><h1>${esc(m.titre)}</h1><p>Module ${esc(m.nom)} ${esc(m.version)} — votre rôle : ${esc(m.role)}</p></div>
          <div class="panel" style="padding:12px;"><div id="mod-zone-${esc(m.id)}"></div></div></div>`);
      }
      const a = document.createElement('a');
      a.dataset.view = cle;
      a.innerHTML = `${iconeEcran(cle)}<span>${esc(m.titre)}</span>`;
      a.addEventListener('click', (e) => { e.preventDefault(); setActive(cle, a); });
      enfants.appendChild(a);
    }
    groupe.style.display = liste.length ? '' : 'none';
  }
  // Charge le script du module une seule fois, puis monte son interface dans son écran.
  async function monterModule(id) {
    const m = MODULES.actifs.find(x => x.id === id);
    const zone = document.getElementById(`mod-zone-${id}`);
    if (!m || !zone || MODULES.montes.has(id)) return;
    MODULES.montes.add(id);
    try {
      if (!window[m.ui.global]) {
        await new Promise((ok, ko) => {
          const s = document.createElement('script');
          s.src = `${RACINE_SERVEUR()}/modules-ui/${encodeURIComponent(id)}/${m.ui.script.replace(/^ui\//, '')}?v=${encodeURIComponent(m.version)}`;
          s.onload = ok; s.onerror = () => ko(new Error('Interface du module introuvable (module désactivé ?).'));
          document.head.appendChild(s);
        });
      }
      const interfaceModule = window[m.ui.global];
      const monter = interfaceModule && interfaceModule[m.ui.monter || 'monter'];
      if (typeof monter !== 'function') throw new Error(`Le module n'expose pas ${m.ui.global}.${m.ui.monter || 'monter'}().`);
      monter.call(interfaceModule, zone, { api: API_BASE + `/m/${id}`, entetes: () => ({ Authorization: `Bearer ${TOKEN}` }), credentials: 'omit' });
    } catch (e) {
      MODULES.montes.delete(id);
      zone.innerHTML = `<div class="numLegal ko">${esc(e.message)}</div>`;
    }
  }

  // ----- Écran d'administration (gérant) -----
  let MOD_ADMIN = null;
  async function chargerModules() {
    MOD_ADMIN = await apiFetch('/modules-admin');
    const etat = (m) => m.probleme ? `<span class="pill danger">${esc(m.probleme)}</span>` : m.actif ? '<span class="pill good">Actif</span>' : '<span class="pill grey">Désactivé</span>';
    document.getElementById('modInstalles').innerHTML = MOD_ADMIN.installes.map(m => `<div class="panel" style="padding:12px 14px; margin-bottom:8px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div><b>${esc(m.nom)}</b> <span class="rowMeta">v${esc(m.version)} · ${esc(m.auteur || '')}</span> ${etat(m)}
          <div class="rowMeta">${esc(m.description || '')}</div><div class="rowMeta">Installé le ${fmtDate(m.installe_le)} par ${esc(m.installe_par || '—')}${m.donnees ? ' · ' + esc(m.donnees) : ''}</div></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${m.actif ? `<button class="rowActionBtn" onclick="reglagesModule('${attrJs(m.id)}')">Réglages et droits</button><button class="rowActionBtn" onclick="actionModule('${attrJs(m.id)}', 'desactiver')">Désactiver</button>`
            : `<button class="rowActionBtn" onclick="actionModule('${attrJs(m.id)}', 'activer')">Activer</button>`}
          <button class="rowActionBtn danger" onclick="retirerModule('${attrJs(m.id)}', '${attrJs(m.nom)}')">Retirer</button>
        </div></div></div>`).join('') || '<div class="rowMeta">Aucun module installé.</div>';
    document.getElementById('modCatalogue').innerHTML = MOD_ADMIN.catalogue.map(c => `<div class="panel" style="padding:12px 14px; margin-bottom:8px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div><b>${esc(c.nom)}</b> <span class="rowMeta">v${esc(c.version)} · ${esc(c.auteur || '')}</span>
          <div class="rowMeta">${esc(c.description || '')}</div></div>
        <div>${c.installe && c.a_jour ? `<span class="pill good">Installé (v${esc(c.installe)})</span>`
          : `<button class="btnPrimary" onclick="installerDuCatalogue('${attrJs(c.fichier)}', '${attrJs(c.nom)}', ${!!c.installe})">${c.installe ? `Mettre à jour (v${esc(c.installe)} → v${esc(c.version)})` : 'Installer'}</button>`}</div></div></div>`).join('')
      || '<div class="rowMeta">Aucun module dans le catalogue.</div>';
  }
  async function apresChangementModule() {
    await chargerModules();
    await chargerMenuModules();
    MODULES.montes.clear(); // interface remontée proprement à la prochaine ouverture
    document.querySelectorAll('[id^="mod-zone-"]').forEach(z => { z.innerHTML = ''; });
  }
  const CONFIANCE = "Un module s'exécute dans le serveur TinOR avec ses droits : il peut lire et modifier toute la base.\nN'installez que des modules dont vous connaissez l'auteur.";
  async function installerDuCatalogue(fichier, nom, miseAJour) {
    if (!(await confirmer(`${CONFIANCE}\n\n${miseAJour ? 'Mettre à jour' : 'Installer'} « ${nom} » ? Il sera activé aussitôt.`, { titre: miseAJour ? 'Mettre à jour le module' : 'Installer le module', ok: miseAJour ? 'Mettre à jour' : 'Installer' }))) return;
    try { await apiFetch('/modules-admin/installer-catalogue', { method: 'POST', body: JSON.stringify({ fichier }) }); notifier(`Module « ${nom} » installé.`, 'succes'); await apresChangementModule(); }
    catch (e) { notifier(e.message, 'erreur'); }
  }
  async function actionModule(id, action) {
    try { await apiFetch(`/modules-admin/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' }); await apresChangementModule(); }
    catch (e) { notifier(e.message, 'erreur'); }
  }
  async function retirerModule(id, nom) {
    if (!(await confirmer(`Le module « ${nom} » sera retiré (code et réglages). Ses données restent dans la base : réinstaller le module les retrouve.`, { titre: 'Retirer le module ?', ok: 'Retirer', danger: true }))) return;
    try { await apiFetch(`/modules-admin/${encodeURIComponent(id)}`, { method: 'DELETE' }); notifier('Module retiré.', 'succes'); await apresChangementModule(); }
    catch (e) { notifier(e.message, 'erreur'); }
  }
  document.getElementById('modInstaller').onclick = async () => {
    const f = document.getElementById('modFichier').files[0];
    if (!f) { notifier('Choisissez le fichier .zip du module.'); return; }
    if (!document.getElementById('modConfiance').checked) { notifier("Cochez « Je connais l'auteur de ce module » pour continuer."); return; }
    if (!(await confirmer(`${CONFIANCE}\n\nInstaller le fichier « ${f.name} » ?`, { titre: 'Installer ce module ?', ok: 'Installer', danger: true }))) return;
    try {
      const res = await fetch(`${API_BASE}/modules-admin/installer`, { method: 'POST', headers: { 'Content-Type': 'application/zip', Authorization: `Bearer ${TOKEN}` }, body: f });
      const corps = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corps.error || `Erreur HTTP ${res.status}`);
      notifier(`Module « ${corps.nom} » ${corps.mise_a_jour ? 'mis à jour' : 'installé'} (v${corps.version}).`, 'succes');
      document.getElementById('modFichier').value = ''; document.getElementById('modConfiance').checked = false;
      await apresChangementModule();
    } catch (e) { notifier(e.message, 'erreur'); }
  };

  // Réglages et droits d'un module
  async function reglagesModule(id) {
    const m = MOD_ADMIN.installes.find(x => x.id === id);
    document.getElementById('moduleModalTitle').textContent = `${m.nom} — réglages et droits`;
    document.getElementById('moduleModalSub').textContent = `Version ${m.version}`;
    document.getElementById('moduleStatus').textContent = '';
    const cfg = await apiFetch(`/modules-admin/${encodeURIComponent(id)}/config`);
    document.getElementById('moduleConfig').innerHTML = (m.config_def || []).length ? `<div class="rowMeta"><b>Réglages</b></div>` + m.config_def.map(c => `<div style="margin:8px 0;">
      ${c.type === 'booleen' ? `<label class="chkLbl"><input type="checkbox" data-cfg="${esc(c.cle)}" ${cfg[c.cle] ? 'checked' : ''}> ${esc(c.libelle || c.cle)}</label>`
        : `<label>${esc(c.libelle || c.cle)}</label><input type="${c.type === 'nombre' ? 'number' : 'text'}" data-cfg="${esc(c.cle)}" value="${esc(cfg[c.cle] ?? '')}">`}</div>`).join('')
      + '<button class="btnPrimary" id="moduleCfgSave">Enregistrer les réglages</button>' : '';
    const cs = document.getElementById('moduleCfgSave');
    if (cs) cs.onclick = async () => {
      const valeurs = {};
      document.querySelectorAll('#moduleConfig [data-cfg]').forEach(i => { valeurs[i.dataset.cfg] = i.type === 'checkbox' ? i.checked : i.value; });
      try { await apiFetch(`/modules-admin/${encodeURIComponent(id)}/config`, { method: 'PUT', body: JSON.stringify(valeurs) }); document.getElementById('moduleStatus').textContent = 'Réglages enregistrés (le module a redémarré).'; }
      catch (e) { document.getElementById('moduleStatus').textContent = e.message; }
    };
    const d = await apiFetch(`/modules-admin/${encodeURIComponent(id)}/droits`);
    if (d.roles) {
      const desc = d.roles.descriptions || {};
      document.getElementById('moduleDroits').innerHTML = `<div class="rowMeta" style="margin-top:16px;"><b>Droits dans le module</b> — « par défaut » suit le rôle TinOR de la personne</div>
        <div class="rowMeta">${d.roles.liste.map(r => `<b>${esc(r)}</b> : ${esc(desc[r] || '')}`).join(' · ')}</div>
        <table style="width:100%; margin-top:8px;"><thead><tr><th>Utilisateur</th><th>Rôle TinOR</th><th>Rôle dans le module</th></tr></thead><tbody>
        ${d.utilisateurs.map(u => `<tr><td>${esc(u.username)}${u.actif ? '' : ' <span class="rowMeta">(désactivé)</span>'}</td><td class="rowMeta">${esc(LIBELLES_ROLES[u.role_tinor] || u.role_tinor)}</td>
          <td><select data-droit="${u.user_id}"><option value="">Par défaut (${esc(u.choisi ? '—' : (u.effectif || 'aucun accès'))})</option>
            ${d.roles.liste.map(r => `<option value="${esc(r)}" ${u.choisi === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            <option value="AUCUN" ${u.choisi === 'AUCUN' ? 'selected' : ''}>Aucun accès</option></select></td></tr>`).join('')}</tbody></table>
        <button class="btnPrimary" id="moduleDroitsSave" style="margin-top:10px;">Enregistrer les droits</button>`;
      document.getElementById('moduleDroitsSave').onclick = async () => {
        const droits = [...document.querySelectorAll('#moduleDroits [data-droit]')].map(s => ({ user_id: Number(s.dataset.droit), role: s.value || null }));
        try { await apiFetch(`/modules-admin/${encodeURIComponent(id)}/droits`, { method: 'PUT', body: JSON.stringify({ droits }) }); document.getElementById('moduleStatus').textContent = 'Droits enregistrés.'; reglagesModule(id); }
        catch (e) { document.getElementById('moduleStatus').textContent = e.message; }
      };
    } else document.getElementById('moduleDroits').innerHTML = '';
    document.getElementById('moduleModalOverlay').classList.add('open');
  }
  ['moduleModalCloseBtn', 'moduleFermer'].forEach(i => document.getElementById(i).onclick = () => document.getElementById('moduleModalOverlay').classList.remove('open'));

