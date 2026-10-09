// Traçabilité sur tous les niveaux + exports Word / Excel à la forme du PDF.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');
const API = process.env.API_URL || 'http://127.0.0.1:3001/api';

(async () => {
  await login();
  const lots = (await api('/lots')).data;

  console.log('AG. Un lot conditionné remonte jusqu\'aux lots de graines (MP)');
  const pf = lots.find(l => l.numero_lot === '06-PF-001') || lots.find(l => l.origine === 'CONDITIONNEMENT');
  const t = (await api(`/lots/${encodeURIComponent(pf.numero_lot)}/tracabilite`)).data;
  const origines = t.ascendants.map(a => a.origine);
  check(origines.includes('FILTRATION') || origines.includes('PRESSE'), `amont direct : ${t.ascendants.filter(a => a.niveau === 1).map(a => a.numero_lot).join(', ')}`);
  const mp = t.ascendants.find(a => a.origine === 'RECEPTION_MP');
  check(!!mp && mp.niveau >= 2, `lot de graines présent : ${mp ? `${mp.numero_lot} (niveau ${mp.niveau}, utilisé dans ${mp.lot_voisin})` : 'absent'}`);
  check(t.ascendants.every(a => a.niveau >= 1 && a.lot_voisin), 'chaque lien a son niveau et son lot voisin');
  check(new Set(t.ascendants.map(a => a.numero_lot)).size === t.ascendants.length, 'aucun lot en double dans la chaîne');

  console.log('AH. Un lot filtré montre son lot de presse ET le lot de graines');
  const filtre = t.ascendants.find(a => a.origine === 'FILTRATION');
  if (filtre) {
    const tf = (await api(`/lots/${encodeURIComponent(filtre.numero_lot)}/tracabilite`)).data;
    check(tf.ascendants.some(a => a.origine === 'PRESSE' && a.niveau === 1), 'presse au niveau 1');
    check(tf.ascendants.some(a => a.origine === 'RECEPTION_MP' && a.niveau === 2), 'graines (MP) au niveau 2');
  } else check(true, '(pas de filtration dans cette chaîne)');

  console.log('AI. Dans l\'autre sens, le lot de graines descend jusqu\'au produit conditionné');
  const tm = (await api(`/lots/${encodeURIComponent(mp.numero_lot)}/tracabilite`)).data;
  check(tm.descendants.some(d => d.numero_lot === pf.numero_lot), `${pf.numero_lot} trouvé en aval de ${mp.numero_lot}`);

  console.log('AJ. Exports Word / Excel : vrais fichiers, avec en-tête et logo');
  const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const entete = { couleur: '#A97D2F', logo, nom: 'Test société', lignes: ['Adresse', 'MF : 0'] };
  const spec = { couleur: '#A97D2F', logo, societe: { nom: 'Test société', lignes: ['Adresse'] }, numero: 'FAC-TEST', titre: 'Facture',
    refs: [['N°', 'FAC-TEST'], ['Date', '01/01/2026']], client: { nom: 'Client', lignes: [['Adresse', 'Tunis']] },
    colonnes: [{ label: 'Désignation' }, { label: 'Qté', num: 1 }], lignes: [['Article', '2']], piedLignes: ['1', '2'],
    bas: { totaux: [['Total HT', '1,000']], net: ['Net à payer', '1,190'] }, lettres: { intro: 'Arrêtée…', texte: 'Un dinar' }, piedPage: 'Facture N° FAC-TEST' };
  const T = (await api('/auth/login', { method: 'POST', body: { username: 'admin', password: 'changeme' } })).data.token;
  for (const [route, corps, fmt] of [['document', { spec, format: 'docx' }, 'docx'], ['document', { spec, format: 'xlsx' }, 'xlsx'],
    ['generique', { titre: 'Liste', sousTitre: 'x', headers: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }], format: 'docx', entete }, 'docx'],
    ['generique', { titre: 'Liste', headers: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }], format: 'xlsx', entete }, 'xlsx']]) {
    const r = await fetch(`${API}/exports/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` }, body: JSON.stringify(corps) });
    const buf = Buffer.from(await r.arrayBuffer());
    const zip = buf.slice(0, 2).toString() === 'PK';
    const media = buf.includes(Buffer.from(fmt === 'docx' ? 'word/media/' : 'xl/media/'));
    check(r.status === 200 && zip && media, `${route} .${fmt} : fichier Office valide avec logo (${buf.length} octets)`);
  }
})();
