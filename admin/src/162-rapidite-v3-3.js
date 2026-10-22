  // ---------- Rapidité (V3.3) ----------
  // Menu « ⋯ » d'une ligne : mêmes entrées que le clic droit (une seule
  // définition par tableau, enregistrée par cablerMenuContextuel).
  function ouvrirMenuLigne(event, tbodyId, id) {
    event.stopPropagation();
    const construire = MENUS_LIGNE[tbodyId];
    const items = construire ? construire(id) : [];
    if (!items.length) return;
    const r = event.currentTarget.getBoundingClientRect();
    afficherMenuContextuel({ preventDefault() {}, clientX: r.right - 170, clientY: r.bottom + 4 }, items);
  }

  // Un seul bouton « Exporter ▾ » à la place des trois boutons DOCX / XLSX / PDF.
  function regrouperExports() {
    document.querySelectorAll('button[id$="ExportDocxBtn"]').forEach(docx => {
      const groupe = docx.parentElement;
      if (groupe.dataset.exportGroupe) return;
      groupe.dataset.exportGroupe = '1';
      const formats = [['Docx', 'Word (.docx)'], ['Xlsx', 'Excel (.xlsx)'], ['Pdf', 'PDF / impression']]
        .map(([f, libelle]) => [document.getElementById(docx.id.replace('Docx', f)), libelle])
        .filter(([b]) => b && b.parentElement === groupe);
      formats.forEach(([b]) => b.style.display = 'none');
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'btnGhost exportBtn';
      bouton.textContent = '⬇ Exporter ▾';
      bouton.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = bouton.getBoundingClientRect();
        afficherMenuContextuel({ preventDefault() {}, clientX: r.left, clientY: r.bottom + 4 },
          formats.map(([b, libelle]) => ({ label: libelle, action: () => b.click() })));
      });
      groupe.insertBefore(bouton, docx);
    });
  }

  // Filtres de période : Aujourd'hui / 7 jours / Ce mois / Tout / Autre période.
  // Les champs Du / Au restent la source du filtre ; ils ne s'affichent que pour
  // « Autre période ».
  function isoLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  // Barre de recherche compacte (V3.3, proposition 1) : recherche, « Période ▾ »
  // et étiquettes des filtres actifs, retirables d'un clic. Les champs Du / Au
  // et le bouton Réinitialiser d'origine restent la source du filtre (cachés).
  const PERIODES_LIB = { tout: 'Toutes les dates', jour: "Aujourd'hui", '7j': '7 derniers jours', mois: 'Ce mois', autre: 'Autre période…' };
  function ajouterChipsPeriode() {
    document.querySelectorAll('input[type="date"][id$="FilterDateDebut"]').forEach(du => {
      const au = document.getElementById(du.id.replace('Debut', 'Fin'));
      if (!au || du.dataset.periode) return;
      du.dataset.periode = 'tout';
      const prefixe = du.id.replace('FilterDateDebut', '');
      const blocDu = du.parentElement, blocAu = au.parentElement, ligne = blocDu.parentElement;
      const texte = document.getElementById(`${prefixe}FilterTexte`) || (prefixe === 'stock' ? document.getElementById('stockSearch') : null);
      const reset = document.getElementById(`${prefixe}FilterResetBtn`);
      ligne.classList.add('barreCompacte');
      if (texte) { texte.closest('.barreCompacte > div')?.classList.add('barreTexte'); texte.setAttribute('aria-label', texte.placeholder || 'Rechercher'); }
      const wrap = document.createElement('div');
      wrap.className = 'periodeWrap';
      wrap.innerHTML = `<button type="button" class="btnGhost periodeBtn" aria-haspopup="true" aria-expanded="false">Période ▾</button>
        <div class="periodeMenu" hidden>${Object.entries(PERIODES_LIB).map(([k, l]) => `<button type="button" data-periode="${k}">${l}</button>`).join('')}<div class="periodeDates" hidden></div></div>`;
      ligne.insertBefore(wrap, blocDu);
      const bouton = wrap.querySelector('.periodeBtn'), menu = wrap.querySelector('.periodeMenu'), dates = wrap.querySelector('.periodeDates');
      dates.append(blocDu, blocAu);
      if (reset) reset.classList.add('periodeCachee');
      const jetons = document.createElement('div');
      jetons.className = 'jetonsFiltres';
      ligne.insertAdjacentElement('afterend', jetons);
      const appliquer = (debut, fin) => {
        du.value = debut; au.value = fin;
        du.dispatchEvent(new Event('input', { bubbles: true }));
        au.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const fermer = () => { menu.hidden = true; bouton.setAttribute('aria-expanded', 'false'); };
      const majJetons = () => {
        const k = du.dataset.periode;
        const actifPeriode = !!(du.value || au.value);
        const libPeriode = k && k !== 'autre' && k !== 'tout' ? PERIODES_LIB[k] : `${du.value ? 'Du ' + fmtDate(du.value) : ''}${au.value ? ' au ' + fmtDate(au.value) : ''}`.trim();
        bouton.classList.toggle('actif', actifPeriode);
        bouton.textContent = actifPeriode ? `${libPeriode} ▾` : 'Période ▾';
        const liste = [];
        if (actifPeriode) liste.push(['periode', libPeriode]);
        if (texte && texte.value.trim()) liste.push(['texte', `« ${texte.value.trim()} »`]);
        jetons.innerHTML = liste.map(([t, l]) => `<span class="jetonFiltre">${l.replace(/[<>&]/g, '')}<button type="button" data-retirer="${t}" aria-label="Retirer ce filtre">×</button></span>`).join('')
          + (liste.length ? '<button type="button" class="lienEffacer" data-retirer="tout">Tout effacer</button>' : '');
      };
      bouton.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; bouton.setAttribute('aria-expanded', String(!menu.hidden)); });
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = e.target.closest('[data-periode]');
        if (!b) return;
        const k = b.dataset.periode, auj = new Date();
        du.dataset.periode = k;
        menu.querySelectorAll('[data-periode]').forEach(x => x.classList.toggle('choisi', x === b));
        dates.hidden = k !== 'autre';
        if (k === 'tout') appliquer('', '');
        if (k === 'jour') appliquer(isoLocal(auj), isoLocal(auj));
        if (k === '7j') appliquer(isoLocal(new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - 6)), isoLocal(auj));
        if (k === 'mois') appliquer(isoLocal(new Date(auj.getFullYear(), auj.getMonth(), 1)), isoLocal(auj));
        if (k === 'autre') du.focus(); else fermer();
        majJetons();
      });
      document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) fermer(); });
      [du, au, texte].filter(Boolean).forEach(el => el.addEventListener('input', () => { if (el !== texte) du.dataset.periode = du.dataset.periode === 'tout' && (du.value || au.value) ? 'autre' : du.dataset.periode; majJetons(); }));
      jetons.addEventListener('click', (e) => {
        const t = e.target.closest('[data-retirer]')?.dataset.retirer;
        if (!t) return;
        if (t === 'tout') { if (reset) reset.click(); else { if (texte) { texte.value = ''; texte.dispatchEvent(new Event('input', { bubbles: true })); } appliquer('', ''); } du.dataset.periode = 'tout'; }
        if (t === 'periode') { du.dataset.periode = 'tout'; appliquer('', ''); }
        if (t === 'texte' && texte) { texte.value = ''; texte.dispatchEvent(new Event('input', { bubbles: true })); }
        majJetons();
      });
      if (reset) reset.addEventListener('click', () => { du.dataset.periode = 'tout'; setTimeout(majJetons, 0); });
      majJetons();
    });
  }
  regrouperExports();
  ajouterChipsPeriode();
