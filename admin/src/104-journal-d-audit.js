  // ---------- Journal d'audit ----------
  let JOURNAL = [];
  const ACTIONS_JOURNAL = { POST: 'Création / action', PUT: 'Modification', PATCH: 'Modification', DELETE: 'Suppression' };
  async function chargerJournal() {
    const p = new URLSearchParams();
    [['du', 'jrDu'], ['au', 'jrAu'], ['utilisateur', 'jrUser'], ['rubrique', 'jrRub'], ['q', 'jrQ']].forEach(([k, id]) => { const v = document.getElementById(id).value; if (v) p.set(k, v); });
    const r = await apiFetch('/audit?' + p.toString());
    JOURNAL = r.lignes;
    const garde = (id, liste) => { const el = document.getElementById(id), v = el.value; el.innerHTML = el.options[0].outerHTML + liste.map(x => `<option>${esc(x)}</option>`).join(''); el.value = v; };
    garde('jrUser', r.utilisateurs); garde('jrRub', r.rubriques);
    document.getElementById('jrBody').innerHTML = r.lignes.map(l => {
      const refuse = l.statut_http === 403 || l.statut_http === 401 || l.statut_http === 429;
      const action = l.chemin.startsWith('/api/auth/login') ? 'Connexion' : (ACTIONS_JOURNAL[l.methode] || l.methode);
      return `<tr><td style="white-space:nowrap">${new Date(l.cree_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}</td>
        <td>${esc(l.username || '—')}<div class="rowMeta">${esc(LIBELLES_ROLES[l.role] || '')}</div></td><td>${action}</td>
        <td>${esc(l.rubrique)}${l.entite_id ? ` <span class="rowMeta">n°${esc(l.entite_id)}</span>` : ''}<div class="rowMeta">${esc(l.methode)} ${esc(l.chemin)}</div></td>
        <td style="color:${refuse ? 'var(--danger,#b3261e)' : 'inherit'}">${refuse ? '✖ Refusé' : '✔'} <span class="rowMeta">${l.statut_http}</span></td>
        <td class="rowMeta">${esc(l.ip || '')}</td><td class="rowMeta" style="max-width:340px; word-break:break-all;">${esc((l.resume || '').slice(0, 300))}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="rowMeta" style="text-align:center; padding:22px;">Aucune entrée.</td></tr>';
  }
  document.getElementById('jrGo').onclick = () => chargerJournal().catch(e => notifier(e.message, 'erreur'));
  document.getElementById('jrCsv').onclick = () => {
    const csv = [['date', 'utilisateur', 'rôle', 'méthode', 'chemin', 'statut', 'adresse', 'détail']].concat(JOURNAL.map(l => [l.cree_le, l.username, l.role, l.methode, l.chemin, l.statut_http, l.ip, l.resume]))
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

