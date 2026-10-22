// Coût réel d'un lot, calculé à la lecture (jamais figé : une correction de prix d'achat se répercute sur toute la chaîne).
//  - lot reçu       : coût saisi à la main (lots.cout_unitaire), sinon prix unitaire HT de la ligne d'achat rattachée, sinon coût standard de la fiche produit ;
//  - lot fabriqué   : (Σ quantité utilisée × coût unitaire de chaque lot source + frais d'étape × quantité produite) / quantité produite ;
//    les frais d'étape (main-d'œuvre, énergie…) se règlent dans « Marges & coûts ». Pertes comprises : la quantité utilisée
//    est celle réellement consommée. Le tourteau n'est pas valorisé : tout le coût est porté par l'huile.
//  - un coût est « incomplet » (null) dès qu'un lot source n'a pas de coût connu.
const ETAPE_FRAIS = { PRESSE: 'frais_presse', FILTRATION: 'frais_filtration', MELANGE: 'frais_melange', CONDITIONNEMENT: 'frais_conditionnement' };

async function lireFrais(pool) {
  const s = (await pool.query('SELECT frais_presse, frais_filtration, frais_melange, frais_conditionnement FROM settings WHERE id = 1')).rows[0] || {};
  return Object.fromEntries(Object.values(ETAPE_FRAIS).map(k => [k, Number(s[k] || 0)]));
}

async function coutDuLot(pool, lotId, ctx, profondeur = 0) {
  const { memo, frais } = ctx;
  if (memo.has(lotId)) return memo.get(lotId);
  const inconnu = { cout: null, complet: false, source: 'inconnu', detail: [] };
  if (profondeur > 12) return inconnu;
  const lot = (await pool.query('SELECT id, numero_lot, produit_id, origine, cout_unitaire, quantite_initiale FROM lots WHERE id = $1', [lotId])).rows[0];
  if (!lot) return inconnu;
  let r;
  if (lot.cout_unitaire !== null && lot.cout_unitaire !== undefined) {
    r = { cout: Number(lot.cout_unitaire), complet: true, source: 'manuel', detail: [] };
  } else {
    const origines = (await pool.query('SELECT lot_source_id, quantite_utilisee FROM lot_origines WHERE lot_fils_id = $1', [lot.id])).rows;
    if (origines.length) {
      let total = 0, complet = true;
      const detail = [];
      for (const o of origines) {
        const c = await coutDuLot(pool, o.lot_source_id, ctx, profondeur + 1);
        const src = (await pool.query('SELECT numero_lot FROM lots WHERE id = $1', [o.lot_source_id])).rows[0];
        const q = Number(o.quantite_utilisee || 0);
        detail.push({ numero_lot: src && src.numero_lot, quantite: q, cout_unitaire: c.cout, montant: c.cout === null ? null : q * c.cout });
        if (c.cout === null) complet = false; else total += q * c.cout;
      }
      const qte = Number(lot.quantite_initiale);
      const fraisUnitaire = frais[ETAPE_FRAIS[lot.origine]] || 0;
      r = complet && qte > 0
        ? { cout: (total + fraisUnitaire * qte) / qte, complet: true, source: 'compose', detail, frais_unitaire: fraisUnitaire }
        : { cout: null, complet: false, source: 'compose', detail, frais_unitaire: fraisUnitaire };
    } else {
      const achat = (await pool.query(
        `SELECT al.prix_unitaire FROM reception_lignes rl JOIN receptions re ON re.id = rl.reception_id
         JOIN achat_lignes al ON al.achat_id = re.achat_id AND al.produit_id = rl.produit_id
         WHERE rl.lot_id = $1 ORDER BY al.id LIMIT 1`, [lot.id])).rows[0];
      if (achat && Number(achat.prix_unitaire) > 0) r = { cout: Number(achat.prix_unitaire), complet: true, source: 'achat', detail: [] };
      else {
        // Pas d'achat enregistré : coût standard de la fiche produit (DT par unité, HT).
        const std = (await pool.query('SELECT cout_standard FROM produits WHERE id = $1', [lot.produit_id])).rows[0];
        r = std && Number(std.cout_standard) > 0 ? { cout: Number(std.cout_standard), complet: true, source: 'standard', detail: [] } : inconnu;
      }
    }
  }
  memo.set(lotId, r);
  return r;
}

const nouveauContexte = async (pool) => ({ memo: new Map(), frais: await lireFrais(pool) });

module.exports = { coutDuLot, nouveauContexte, lireFrais, ETAPE_FRAIS };
