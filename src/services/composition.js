// Composition d'un lot fabriqué : matière par matière (graines, huiles), en quantité et en %.
async function compositions(pool, lotIds) {
  const res = new Map();
  if (!lotIds.length) return res;
  const r = await pool.query(
    `SELECT lo.lot_fils_id, p.nom, SUM(lo.quantite_utilisee) AS quantite
     FROM lot_origines lo JOIN lots ls ON ls.id = lo.lot_source_id JOIN produits p ON p.id = ls.produit_id
     WHERE lo.lot_fils_id IN (${lotIds.map(Number).join(',')}) GROUP BY lo.lot_fils_id, p.nom`);
  for (const c of r.rows) {
    const k = String(c.lot_fils_id);
    if (!res.has(k)) res.set(k, []);
    res.get(k).push({ matiere: c.nom, quantite: Number(c.quantite) });
  }
  for (const liste of res.values()) {
    const total = liste.reduce((t, c) => t + c.quantite, 0);
    liste.forEach(c => { c.pourcentage = total ? Math.round(c.quantite / total * 1000) / 10 : null; });
  }
  return res;
}

module.exports = { compositions };
