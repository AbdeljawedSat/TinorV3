  // ---------- Effets locaux : le stock affiché hors ligne tient compte des opérations en attente ----------
  async function hlAppliquerEffets(path, data) {
    const ops = (await hlOps()).filter(o => o.statut === 'EN_ATTENTE');
    if (!ops.length || !Array.isArray(data)) return data;
    if (path === '/clients' || path === '/fournisseurs') { // créés hors ligne, pas encore envoyés : visibles et utilisables (commande, réception)
      const type = path === '/clients' ? 'client' : 'fournisseur';
      const ajoutes = ops.filter(o => o.type === type).map(o => ({
        ...(type === 'client' ? { type: 'particulier', commandes_count: 0, total_achete: 0, total_facture: 0, total_paye: 0, solde: 0 } : { type: 'fournisseur_externe', statut_bio: 'conversion' }),
        ...o.payload, id: o.id_provisoire, en_attente_envoi: true, numero_provisoire: o.numero_provisoire, created_at: o.cree_le }));
      return [...data, ...ajoutes].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
    }
    const copie = JSON.parse(JSON.stringify(data));
    const presse = path === '/presse' ? copie : ((await hlLireCache('/presse'))?.data || []);
    const filtration = path === '/filtration' ? copie : ((await hlLireCache('/filtration'))?.data || []);
    const lots = path === '/lots' ? copie : ((await hlLireCache('/lots'))?.data || []);
    const deltasLot = new Map();     // lot_id → quantité retirée
    const deltasProduit = new Map(); // produit_id → variation de stock
    const ajouterLot = (lotId, q) => { if (lotId) deltasLot.set(Number(lotId), (deltasLot.get(Number(lotId)) || 0) + Number(q || 0)); };
    const ajouterProduit = (pid, q) => { if (pid) deltasProduit.set(Number(pid), (deltasProduit.get(Number(pid)) || 0) + Number(q || 0)); };
    const lotDeSource = s => s.lot_id || (s.lot_presse_id ? presse.find(l => l.id === Number(s.lot_presse_id))?.lot_id : s.lot_filtration_id ? filtration.find(l => l.id === Number(s.lot_filtration_id))?.lot_id : null);
    const produitDuLot = id => lots.find(l => l.id === Number(id))?.produit_id;
    // Vente : prélèvement « premier périmé, premier sorti » sur les lots du produit.
    const prelever = (pid, q) => {
      ajouterProduit(pid, -q);
      let reste = Number(q || 0);
      const candidats = lots.filter(l => l.produit_id === Number(pid) && l.statut === 'LIBERE')
        .sort((a, b) => String(a.date_expiration || '9999').localeCompare(String(b.date_expiration || '9999')) || a.id - b.id);
      for (const l of candidats) {
        if (reste <= 0) break;
        const dispo = Number(l.quantite_actuelle) - (deltasLot.get(l.id) || 0);
        const pris = Math.min(Math.max(dispo, 0), reste);
        if (pris > 0) { ajouterLot(l.id, pris); reste -= pris; }
      }
    };
    for (const op of ops) {
      const p = op.payload || {};
      if (op.type === 'commande') (p.lignes || []).forEach(l => prelever(l.produit_id, l.qty));
      if (op.type === 'reception') (p.lignes || []).forEach(l => ajouterProduit(l.produit_id, l.quantite));
      if (['presse', 'filtration', 'conditionnement'].includes(op.type)) {
        (p.sources || []).forEach(s => { const lotId = lotDeSource(s); const q = s.quantite ?? s.quantite_utilisee; ajouterLot(lotId, q); ajouterProduit(produitDuLot(lotId), -q); });
        (p.consommables || []).forEach(c => prelever(c.produit_id, c.quantite));
      }
    }
    const arrondi3 = x => Math.round(x * 1000) / 1000;
    if (path === '/lots') copie.forEach(l => { if (deltasLot.has(l.id)) l.quantite_actuelle = Math.max(0, arrondi3(Number(l.quantite_actuelle) - deltasLot.get(l.id))); });
    if (path === '/presse' || path === '/filtration') copie.forEach(l => { if (deltasLot.has(Number(l.lot_id))) l.quantite_actuelle = Math.max(0, arrondi3(Number(l.quantite_actuelle) - deltasLot.get(Number(l.lot_id)))); });
    if (path === '/produits') copie.forEach(pr => { if (deltasProduit.has(pr.id) && pr.stock_actuel != null) pr.stock_actuel = Math.max(0, arrondi3(Number(pr.stock_actuel) + deltasProduit.get(pr.id))); });
    if (path === '/factures') {
      ops.filter(o => o.type === 'paiement').forEach(o => {
        const f = copie.find(x => `/factures/${x.id}/paiements` === o.path);
        if (!f) return;
        f.total_paye = arrondi3(Number(f.total_paye || 0) + Number(o.payload.montant || 0));
        if (f.solde != null) f.solde = arrondi3(Number(f.solde) - Number(o.payload.montant || 0));
      });
    }
    return copie;
  }

