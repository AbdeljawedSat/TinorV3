  // ---------- Liens de la vente (V3.3) ----------
  // Ce qui reste à faire à chaque étape de la chaîne (mêmes règles que les vues rapides).
  const commandeALivrer = c => c.statut === 'confirmee' && Number(c.qte_commandee || 0) - Number(c.qte_livree || 0) > 0.0005 && !commandeFacturee(c.id);
  const commandeAFacturer = c => (c.statut === 'confirmee' || c.statut === 'livree') && !commandeFacturee(c.id);
  function aFaireVente() {
    const cmds = APP_DATA.commandes || [], facs = APP_DATA.factures || [];
    const aEncaisser = facs.filter(factureAEncaisser);
    return {
      commandes: cmds.filter(c => c.statut !== 'annulee').length,
      confirmer: cmds.filter(c => c.statut === 'en_attente').length,
      bl: (APP_DATA.livraisons || []).filter(b => b.statut === 'emis').length,
      livrer: cmds.filter(commandeALivrer).length,
      valider: (APP_DATA.proformas || []).filter(p => p.statut === 'en_attente').length,
      fac: facs.filter(f => f.statut === 'emise').length,
      facturer: cmds.filter(commandeAFacturer).length,
      encaisser: aEncaisser.length,
      reste: aEncaisser.reduce((t, f) => t + Number(f.solde || 0), 0),
    };
  }
  // Ouvre un écran (et, si demandé, sa vue rapide « à faire »).
  function allerVente(vue, vueRapide) {
    const lien = document.querySelector(`#navScroll a[data-view="${vue}"]`);
    if (lien) setActive(vue, lien);
    if (vueRapide) choisirVue(vue, vueRapide);
  }
  const ECRANS_CHAINE = ['commandes', 'livraisons', 'proformas', 'factures', 'paiements'];
  function majFilVente() {
    const a = aFaireVente();
    const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
    const etapes = [
      ['commandes', 'Commandes', pl(a.commandes, 'commande', 'commandes'), a.confirmer, 'à confirmer', ['commandes', 'confirmer']],
      ['livraisons', 'Livraisons', pl(a.bl, 'BL', 'BL'), a.livrer, 'à livrer', ['commandes', 'livrer']],
      ['proformas', 'En attente', pl(a.valider, 'pro forma', 'pro forma'), a.valider, 'à valider', ['proformas', null]],
      ['factures', 'Factures', pl(a.fac, 'facture', 'factures'), a.facturer, 'à facturer', ['commandes', 'facturer']],
      ['paiements', 'Paiements', a.encaisser ? fmtDT(a.reste) : 'Tout encaissé', a.encaisser, 'à encaisser', ['factures', 'encaisser']],
    ];
    document.querySelectorAll('.filVente').forEach(fil => {
      fil.innerHTML = etapes.map(([vue, lib, val, n, quoi], i) => `
        <button type="button" class="filEtape${fil.dataset.ecran === vue ? ' cour' : ''}" data-i="${i}" title="Ouvrir : ${lib}">
          <span class="filLib"><b>${i + 1}</b>${lib}</span>
          <span class="filVal">${val}</span>
          ${n ? `<span class="filAFaire" data-afaire="${i}" title="Voir la liste">${n} ${quoi}</span>` : '<span class="filAFaire ok">✓ à jour</span>'}
        </button>`).join('');
      fil.onclick = (e) => {
        const b = e.target.closest('.filEtape'); if (!b) return;
        const et = etapes[Number(b.dataset.i)];
        const lien = e.target.closest('[data-afaire]');
        if (lien) allerVente(et[5][0], et[5][1]); else allerVente(et[0]);
      };
    });
  }
  ECRANS_CHAINE.forEach(vue => {
    const tete = document.querySelector(`#view-${vue} .pageHead`);
    if (!tete || tete.nextElementSibling?.classList.contains('filVente')) return;
    tete.insertAdjacentHTML('afterend', `<nav class="filVente" data-ecran="${vue}" aria-label="Chaîne de vente"></nav>`);
  });

  // Prochaine étape d'une commande : un seul bouton principal selon l'état.
  function prochaineEtapeCommande(c) {
    if (!c || c.statut === 'annulee' || c.statut === 'payee') return null;
    const fac = APP_DATA.factures.find(f => f.statut === 'emise' && f.commande_id === c.id);
    if (fac) return factureAEncaisser(fac) ? { court: 'Encaisser', label: '💰 Encaisser', action: () => openPaiementModal(fac.id) } : null;
    if (c.statut === 'en_attente') return { court: 'Confirmer', label: '✓ Confirmer', action: () => changerStatutCommande(c.id, 'confirmee') };
    if (Number(c.qte_commandee || 0) - Number(c.qte_livree || 0) > 0.0005) return { court: 'Livrer', label: '🚚 Livrer…', action: () => ouvrirLivraison(c.id) };
    if (c.proforma_id) return { court: 'Valider', label: `🧾 Valider la facture en attente ${c.proforma_numero || ''}`.trim(), action: () => ouvrirProforma(c.proforma_id) };
    return { court: 'Facturer', label: '🧾 Facturer', action: () => emettreFacture(c.id) };
  }
  // Documents liés : toute la chaîne d'une commande, chaque document s'ouvre d'un clic.
  // `ici` = document affiché (« BC-… » ou « FAC-… »).
  function chaineDocumentsHtml(c, ici) {
    const bouton = (cls, numero, texte, action) => `<button type="button" class="docLie ${cls}"${action ? ` onclick="${action}"` : ''}><b>${esc(numero)}</b>${texte}</button>`;
    const fleche = '<span class="flecheDoc">→</span>';
    const morceaux = [bouton(ici === c.numero ? 'ici' : 'fait', c.numero, `Commande · ${Number(c.qte_commandee || (c.lignes || []).reduce((t, l) => t + Number(l.qty || 0), 0))} u`,
      ici === c.numero ? null : `fermerFiche(); ouvrirFicheCommande(${c.id})`)];
    const bls = (c.bons_livraison || []);
    morceaux.push(fleche, bls.length
      ? bls.map(b => bouton(b.statut === 'annule' ? 'annule' : 'fait', b.numero, `${Number(b.qte || 0)} u · ${fmtDate(b.date_livraison)}`, `imprimerLivraison(${b.id})`)).join('')
      : (c.statut === 'annulee' ? '' : bouton('attente', 'Livraison', 'à faire', `fermerFiche(); ouvrirLivraison(${c.id})`)));
    const pros = (c.proformas || []).filter(p => p.statut !== 'annulee');
    if (pros.length) morceaux.push(fleche, pros.map(p => bouton(p.statut === 'en_attente' ? 'attente' : 'fait', p.numero, p.statut === 'en_attente' ? 'à valider' : 'validée', `fermerFiche(); ouvrirProforma(${p.id})`)).join(''));
    const facs = APP_DATA.factures.filter(f => f.commande_id === c.id);
    const fac = facs.find(f => f.statut === 'emise');
    morceaux.push(fleche, facs.length
      ? facs.map(f => bouton(f.numero === ici ? 'ici' : f.statut === 'annulee' ? 'annule' : 'fait', f.numero, fmtDT(f.total_ttc), f.numero === ici ? null : `fermerFiche(); ouvrirFicheFacture(${f.id})`)).join('')
      : (c.statut === 'annulee' ? '' : bouton('attente', 'Facture', 'à faire', `fermerFiche(); emettreFacture(${c.id})`)));
    if (fac) morceaux.push(fleche, factureAEncaisser(fac)
      ? bouton('attente', 'Paiement', `reste ${fmtDT(fac.solde)}`, `fermerFiche(); openPaiementModal(${fac.id})`)
      : bouton('fait', 'Payée', fmtDT(fac.total_paye), null));
    return `<div class="ficheBloc"><h3>Documents liés</h3><div class="chaineDocs">${morceaux.join('')}</div></div>`;
  }
  // Bouton « Prochaine étape » + « Imprimer… » en tête des actions de la fiche.
  function actionsChaineFiche(etape, documents) {
    const zone = document.getElementById('ficheActions');
    if (!zone) return;
    if (documents && documents.length) {
      // « Imprimer… » remplace les boutons d'impression un par un.
      zone.querySelectorAll('button').forEach(b => { if (/^🖨 Imprimer /.test(b.textContent)) b.remove(); });
      const imp = document.createElement('button');
      imp.type = 'button'; imp.textContent = '🖨 Imprimer…';
      imp.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = imp.getBoundingClientRect();
        afficherMenuContextuel({ preventDefault() {}, clientX: r.left, clientY: r.top - 8 - documents.length * 36 }, documents);
      });
      zone.insertBefore(imp, zone.firstChild);
    }
    if (etape) {
      zone.querySelectorAll('button.principal').forEach(b => b.classList.remove('principal'));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'principal'; b.textContent = `Prochaine étape : ${etape.label.replace(/…$/, '')} →`;
      b.addEventListener('click', () => { fermerFiche(); etape.action(); });
      zone.insertBefore(b, zone.firstChild);
    }
  }
  function documentsImprimables(c) {
    const docs = [{ label: `🖨 Bon de commande ${c.numero}`, action: () => imprimerBonCommande(c.id) }];
    (c.bons_livraison || []).filter(b => b.statut !== 'annule').forEach(b => docs.push({ label: `🖨 Bon de livraison ${b.numero}`, action: () => imprimerLivraison(b.id) }));
    (c.proformas || []).filter(p => p.statut !== 'annulee').forEach(p => docs.push({ label: `🖨 Facture en attente ${p.numero}`, action: () => imprimerProforma(p.id) }));
    APP_DATA.factures.filter(f => f.commande_id === c.id && f.statut === 'emise').forEach(f => docs.push({ label: `🖨 Facture ${f.numero}`, action: () => imprimerFacture(f.id) }));
    return docs;
  }

  function renderLivraisons() {
    const body = document.getElementById('livraisonsBody');
    if (!body) return;
    const liste = APP_DATA.livraisons || [];
    document.getElementById('livraisonsCount').textContent = `${liste.filter(b => b.statut === 'emis').length} bon(s) de livraison — sortie physique de la marchandise, sans prix`;
    if (!liste.length) { body.innerHTML = `<tr><td colspan="8" class="videAction">Aucun bon de livraison : livrez une commande (menu ⋯ › Livrer).</td></tr>`; return; }
    body.innerHTML = liste.map(b => `
      <tr data-id="${b.id}"${b.statut === 'annule' ? ' class="ligneAnnulee"' : ''}>
        <td class="lotCode">${esc(b.numero)}</td>
        <td><span class="ficheLien" onclick="ouvrirFicheCommande(${b.commande_id})">${esc(b.commande_numero)}</span></td>
        <td>${esc(b.client_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(b.date_livraison)}</td>
        <td class="num">${Number(b.qte || 0)}</td>
        <td class="rowMeta">${b.facture_numero ? esc(b.facture_numero) : '—'}</td>
        <td>${pastille(STATUT_BL[b.statut] || ['grey', b.statut])}${b.annule_motif ? `<div class="rowMeta" style="font-size:11px;">${esc(b.annule_motif)}</div>` : ''}</td>
        <td class="rowActions"><button class="rowActionBtn" onclick="imprimerLivraison(${b.id})">🖨 Imprimer</button>
          <button class="rowActionBtn plus" title="Plus d'actions" onclick="ouvrirMenuLigne(event, 'livraisonsBody', ${b.id})">⋯</button></td>
      </tr>`).join('');
    colorerNumeros(body);
    cablerMenuContextuel('livraisonsBody', (id) => {
      const b = (APP_DATA.livraisons || []).find(x => x.id === id);
      if (!b) return [];
      return [{ label: '🖨 Imprimer', action: () => imprimerLivraison(id) }, { label: '⬇ Word (.docx)', action: () => imprimerLivraison(id, 'docx') },
        { label: '⬇ Excel (.xlsx)', action: () => imprimerLivraison(id, 'xlsx') }, { label: 'Voir la commande', action: () => ouvrirFicheCommande(b.commande_id) }, null,
        b.statut !== 'emis' ? { label: 'Annuler le bon de livraison', desactive: 'Déjà annulé' }
        : !isGerant() ? { label: 'Annuler le bon de livraison', desactive: 'Réservé au gérant' }
        : b.facture_numero ? { label: 'Annuler le bon de livraison', desactive: `Commande facturée (${b.facture_numero}) : retour par avoir` }
        : { label: 'Annuler le bon de livraison…', danger: true, action: () => annulerLivraison(id) }];
    });
  }

  function renderProformas() {
    const body = document.getElementById('proformasBody');
    if (!body) return;
    const liste = APP_DATA.proformas || [];
    const enAttente = liste.filter(p => p.statut === 'en_attente').length;
    document.getElementById('proformasCount').textContent = `${enAttente} facture(s) en attente — pro forma modifiables, sans valeur comptable jusqu'à validation`;
    if (!liste.length) { body.innerHTML = `<tr><td colspan="7" class="videAction">Aucune facture en attente : préparez-en une depuis une commande (menu ⋯ › Facture en attente).</td></tr>`; return; }
    body.innerHTML = liste.map(p => `
      <tr data-id="${p.id}"${p.statut === 'annulee' ? ' class="ligneAnnulee"' : ''}>
        <td class="lotCode">${esc(p.numero)}</td>
        <td><span class="ficheLien" onclick="ouvrirFicheCommande(${p.commande_id})">${esc(p.commande_numero)}</span></td>
        <td>${esc(p.client_nom || '—')}</td>
        <td class="rowMeta num">${fmtDate(p.date_proforma)}</td>
        <td class="num"><span class="montant">${fmtDT(p.total_ttc)}</span></td>
        <td>${pastille(STATUT_PRO[p.statut] || ['grey', p.statut])}${p.facture_numero ? ` <span class="rowMeta">→ ${esc(p.facture_numero)}</span>` : ''}</td>
        <td class="rowActions">
          ${p.statut === 'en_attente' ? `<button class="rowActionBtn principal" onclick="ouvrirProforma(${p.id})">Modifier / valider</button>` : ''}
          <button class="rowActionBtn" onclick="imprimerProforma(${p.id})">🖨 Imprimer</button>
        </td>
      </tr>`).join('');
    colorerNumeros(body);
    cablerMenuContextuel('proformasBody', (id) => {
      const p = (APP_DATA.proformas || []).find(x => x.id === id);
      if (!p) return [];
      return [{ label: '🖨 Imprimer', action: () => imprimerProforma(id) }, { label: '⬇ Word (.docx)', action: () => imprimerProforma(id, 'docx') },
        { label: '⬇ Excel (.xlsx)', action: () => imprimerProforma(id, 'xlsx') }, { label: 'Voir la commande', action: () => ouvrirFicheCommande(p.commande_id) }];
    });
  }

