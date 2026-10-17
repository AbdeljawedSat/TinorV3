// Dérivés d'une graine : « Graines de X » + huile vrac, filtrée et flacons créés en une seule opération,
// dérivés déjà existants ignorés, tout ou rien, nom non reconnu refusé.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const post = (url, body) => api(url, { method: 'POST', body });
  const cats = (await api('/categories')).data;
  const cat = (cats.find(c => c.code === 'HUILE') || cats[0]).id;
  const kg = (await api('/unites')).data.find(u => u.code === 'kg').id;
  const formats = (await api('/formats')).data.filter(f => f.volume).sort((a, b) => a.volume - b.volume);
  const f10 = formats.find(f => Number(f.volume) === 10), f30 = formats.find(f => Number(f.volume) === 30);
  const suffixe = String(Date.now()).slice(-6);
  const nom = `Graines de Test${suffixe}`;

  console.log('AX. Dérivés d\'une graine');
  const mauvais = await post('/produits/avec-derives', { graine: { nom: `Test${suffixe}`, categorie_id: cat, unite_id: kg }, derives: { vrac: true } });
  check(mauvais.status === 400, `nom non reconnu refusé : ${mauvais.data.error}`);

  const r = await post('/produits/avec-derives', { graine: { nom, categorie_id: cat, unite_id: kg, bio_eligible: true },
    derives: { vrac: true, filtree: true, formats: [{ format_id: f30.id, prix_vente: 62 }, { format_id: f10.id }] } });
  const noms = (r.data.crees || []).map(p => p.nom);
  check(r.status === 201 && noms.length === 5, `graine + 4 dérivés créés : ${noms.join(' | ')}`);
  const base = `Huile de Test${suffixe}`;
  const vrac = r.data.crees.find(p => p.nom === `${base} — Vrac`), filtree = r.data.crees.find(p => p.nom === `${base} — Filtrée`);
  const flacon = r.data.crees.find(p => p.nom === `${base} — Flacon ${f30.code}`);
  check(vrac && !vrac.format_id && filtree.produit_source_id === vrac.id, 'vrac sans format ; filtrée liée au vrac');
  check(flacon.format_id === f30.id && flacon.produit_source_id === vrac.id && Number(flacon.prix_vente) === 62 && flacon.vendable, 'flacon 30 ml : format, lien vrac, prix 62, vendable');
  check(r.data.crees.every(p => !!p.bio_eligible), 'éligibilité bio reprise de la graine');

  const f100 = formats.find(f => Number(f.volume) === 100);
  const graine = r.data.graine;
  const plus = await post(`/produits/${graine.id}/derives`, { derives: { vrac: true, filtree: true, formats: [{ format_id: f30.id }, ...(f100 ? [{ format_id: f100.id, prix_vente: 150 }] : [])] } });
  check(plus.status === 201 && plus.data.ignores.length === 3 && plus.data.crees.length === (f100 ? 1 : 0), `ajout ultérieur : ${plus.data.crees.length} créé(s), ${plus.data.ignores.length} existant(s) ignoré(s)`);

  const avant = (await api('/produits')).data.length;
  const rollback = await post('/produits/avec-derives', { graine: { nom: `Graines de Echec${suffixe}`, categorie_id: cat, unite_id: kg }, derives: { vrac: true, formats: [{ format_id: 999999 }] } });
  const apres = (await api('/produits')).data.length;
  check(rollback.status === 400 && apres === avant, `format inexistant : rien n'est créé (${avant} → ${apres} produits)`);

  const nonGraine = await post(`/produits/${vrac.id}/derives`, { derives: { vrac: true } });
  check(nonGraine.status === 400, `dérivés refusés pour un produit qui n'est pas une graine : ${nonGraine.data.error}`);
})().catch(e => { console.error(e); process.exit(1); });
