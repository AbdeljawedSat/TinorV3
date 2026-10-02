// Reproduit chaque source d'écart de stock suspectée. Chaque cas part d'un lot
// neuf et vérifie : (1) quantité du lot = somme des mouvements, (2) quantité
// = valeur physique attendue.
const { api, login, check } = require('./api');
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
let db;
async function ecart(lotId) {
  const [[r]] = await db.query(`SELECT l.quantite_actuelle AS q,
     COALESCE(SUM(CASE WHEN m.sens='ENTREE' THEN m.quantite WHEN m.sens='SORTIE' THEN -m.quantite END),0) AS m
     FROM lots l LEFT JOIN stock_mouvements m ON m.lot_id=l.id WHERE l.id=? GROUP BY l.id`, [lotId]);
  return { q: Number(r.q), m: Number(r.m) };
}
(async () => {
  db = await mysql.createConnection(process.env.DATABASE_URL || {
    host: process.env.DB_HOST || '127.0.0.1', port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'tinor', password: process.env.DB_PASSWORD || 'tinor', database: process.env.DB_NAME || 'tinor_v3',
  });
  await login();
  const cat = (await api('/categories')).data[0], unite = (await api('/unites')).data[0];
  const client = (await api('/clients')).data[0];
  let n = 0;
  async function lotNeuf(qte) {
    const p = (await api('/produits', { method: 'POST', body: { nom: 'Écart test ' + Date.now() + (n++), categorie_id: cat.id, unite_id: unite.id, type_article: 'PRODUIT_FABRIQUE', vendable: true, prix_vente: 10 } })).data;
    const l = (await api('/lots', { method: 'POST', body: { produit_id: p.id, origine: 'AUTRE', quantite_initiale: qte } })).data;
    return { p, l };
  }
  const bilan = async (titre, lotId, physiqueAttendu) => {
    const e = await ecart(lotId);
    check(e.q === e.m, `${titre} — lot ${e.q} / mouvements ${e.m}`);
    if (physiqueAttendu !== undefined) check(e.q === physiqueAttendu, `${titre} — stock ${e.q}, physique attendu ${physiqueAttendu}`);
  };

  console.log('A. Même produit sur deux lignes d\'une commande');
  { const { p, l } = await lotNeuf(100);
    const r = await api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 5 }, { produit_id: p.id, qty: 3 }] } });
    console.log('   HTTP', r.status, r.status >= 400 ? JSON.stringify(r.data).slice(0, 100) : '');
    await bilan('A', l.id, r.status < 300 ? 92 : 100); }

  console.log('B. Annulation de facture puis refacturation de la même commande');
  { const { p, l } = await lotNeuf(100);
    const c = (await api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 10 }] } })).data;
    const f1 = (await api('/factures', { method: 'POST', body: { commande_id: c.id } })).data;
    await api(`/factures/${f1.id}/annuler`, { method: 'POST' });
    const f2 = await api('/factures', { method: 'POST', body: { commande_id: c.id } });
    console.log('   refacturation HTTP', f2.status, f2.status >= 400 ? f2.data.error : '(10 unités facturées et livrées)');
    await bilan('B', l.id, f2.status < 300 ? 90 : 100); }

  console.log('C. Commande passée au statut « annulee » par l\'API');
  { const { p, l } = await lotNeuf(100);
    const c = (await api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 10 }] } })).data;
    const r = await api(`/commandes/${c.id}/statut`, { method: 'PUT', body: { statut: 'annulee' } });
    console.log('   HTTP', r.status, r.status >= 400 ? r.data.error : '');
    await bilan('C', l.id, r.status < 300 ? 100 : 90); }

  console.log('D. Inventaire clôturé après une vente faite pendant le comptage');
  { const { p, l } = await lotNeuf(10);
    const local = (await api('/locaux')).data[0];
    const autres = (await api('/inventaires')).data.filter(i => i.statut === 'en_cours');
    for (const i of autres) await api(`/inventaires/${i.id}`, { method: 'DELETE' });
    const inv = (await api('/inventaires', { method: 'POST', body: { local_id: local.id } })).data;
    const ligne = inv.lignes.find(x => x.lot_id === l.id);
    await api(`/inventaires/${inv.id}/lignes`, { method: 'PUT', body: { lignes: [{ id: ligne.id, quantite_physique: 2 }] } }); // compté 2 (8 manquants)
    await api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 6 }] } }); // vente de 6 pendant le comptage
    await api(`/inventaires/${inv.id}/cloturer`, { method: 'POST' });
    await bilan('D', l.id, 0); }

  console.log('E. Deux commandes simultanées sur le même lot');
  { const { p, l } = await lotNeuf(10);
    const rs = await Promise.all([1, 2, 3].map(() => api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 6 }] } })));
    const ok = rs.filter(r => r.status < 300).length;
    console.log('   commandes acceptées :', ok, '/ 3 (une seule possible)');
    const e = await ecart(l.id);
    check(ok === 1 && e.q >= 0, `E — stock final ${e.q} (jamais négatif)`);
    await bilan('E', l.id); }

  console.log('F. Double clic sur « Annuler la facture »');
  { const { p, l } = await lotNeuf(100);
    const c = (await api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 10 }] } })).data;
    const f = (await api('/factures', { method: 'POST', body: { commande_id: c.id } })).data;
    const rs = await Promise.all([1, 2].map(() => api(`/factures/${f.id}/annuler`, { method: 'POST' })));
    console.log('   réponses :', rs.map(r => r.status).join(', '));
    await bilan('F', l.id, 100); }

  console.log('G. Deux pressages simultanés sur le même lot de matière première');
  { const graine = 'Test' + Date.now();
    const mp = (await api('/produits', { method: 'POST', body: { nom: 'Graines de ' + graine, categorie_id: cat.id, unite_id: unite.id, type_article: 'MATIERE_PREMIERE' } })).data;
    const vrac = (await api('/produits', { method: 'POST', body: { nom: 'Huile de ' + graine + ' — Vrac', categorie_id: cat.id, unite_id: unite.id, type_article: 'PRODUIT_FABRIQUE' } })).data;
    const lmp = (await api('/lots', { method: 'POST', body: { produit_id: mp.id, origine: 'RECEPTION_MP', quantite_initiale: 100 } })).data;
    const rs = await Promise.all([1, 2].map(() => api('/presse', { method: 'POST', body: { date: '2026-10-02', produit_id: vrac.id, lot_source_id: lmp.id, quantite_matiere_utilisee: 70, quantite_produite: 20 } })));
    console.log('   réponses :', rs.map(r => r.status).join(', '));
    check(rs.filter(r => r.status === 201).length === 1, 'G — un seul pressage accepté');
    await bilan('G', lmp.id, 30);
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM lots WHERE produit_id = ?', [vrac.id]);
    check(Number(n) === 1, `G — un seul lot de vrac créé (${n}) : le refusé n'a rien laissé`); }

  console.log('I. Pressage : graines → huile en vrac de la même graine uniquement');
  { const t = Date.now();
    const mk = (nom, type_article) => api('/produits', { method: 'POST', body: { nom, categorie_id: cat.id, unite_id: unite.id, type_article } }).then(r => r.data);
    const sesame = await mk(`Graines de Sésame ${t}`, 'MATIERE_PREMIERE');
    const nigelle = await mk(`Graines de Nigelle ${t}`, 'MATIERE_PREMIERE');
    const olive = await mk(`Huile d'Olive ${t}`, 'MATIERE_PREMIERE');
    const huileSesame = await mk(`Huile de Sesame ${t} — Vrac`, 'PRODUIT_FABRIQUE');
    const savon = await mk(`Pâte à Savon ${t} — Vrac`, 'PRODUIT_FABRIQUE');
    const lot = async (p) => (await api('/lots', { method: 'POST', body: { produit_id: p.id, origine: 'RECEPTION_MP', quantite_initiale: 50 } })).data;
    const lSesame = await lot(sesame), lNigelle = await lot(nigelle), lOlive = await lot(olive);
    const presse = (produit, source) => api('/presse', { method: 'POST', body: { date: '2026-10-02', produit_id: produit.id, lot_source_id: source.id, quantite_matiere_utilisee: 10, quantite_produite: 3 } });
    const ok = await presse(huileSesame, lSesame);
    check(ok.status === 201, `graines de sésame → huile de sésame en vrac acceptée, accents ignorés (HTTP ${ok.status})`);
    const r1 = await presse(huileSesame, lNigelle);
    check(r1.status === 400, `graines de nigelle → huile de sésame refusée : ${r1.data.error}`);
    const r2 = await presse(huileSesame, lOlive);
    check(r2.status === 400, `matière qui n'est pas une graine refusée : ${r2.data.error}`);
    const r3 = await presse(savon, lSesame);
    check(r3.status === 400, `savon en vrac comme produit obtenu refusé : ${r3.data.error}`);
    const e = await ecart(lNigelle.id);
    check(e.q === 50 && e.m === 50, "les pressages refusés n'ont rien consommé"); }

  console.log('H. Commande refusée : aucune trace partielle');
  { const { p, l } = await lotNeuf(5);
    const [[{ n: avant }]] = await db.query('SELECT COUNT(*) AS n FROM commandes');
    const r = await api('/commandes', { method: 'POST', body: { client_id: client.id, lignes: [{ produit_id: p.id, qty: 3 }, { produit_id: p.id, qty: 3 }] } });
    const [[{ n: apres }]] = await db.query('SELECT COUNT(*) AS n FROM commandes');
    console.log('   HTTP', r.status, r.data.error ? r.data.error.slice(0, 90) : '');
    check(r.status === 409 && Number(apres) === Number(avant), 'H — refus propre, aucune commande orpheline');
    await bilan('H', l.id, 5); }
  await db.end();
})();
