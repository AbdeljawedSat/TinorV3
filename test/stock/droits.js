// Droits par rôle (testés en HTTP, pas seulement dans l'interface), règles des comptes, journal d'audit, CORS.
// Prérequis : API démarrée sur une base de TEST.
const { api, login, check } = require('./api');
const API = process.env.API_URL || 'http://127.0.0.1:3001/api';

async function appeler(token, methode, chemin, body, entetes = {}) {
  const res = await fetch(API + chemin, { method: methode, body: body && JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...entetes } });
  const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: res.status, data: d, headers: res.headers };
}

(async () => {
  await login();
  const admin = (await appeler(null, 'POST', '/auth/login', { username: 'admin', password: 'changeme' })).data.token;
  const sfx = String(Date.now()).slice(-6);
  const mdp = 'Phrase-de-passe-2026';
  const comptes = {};
  console.log('DA. Création des comptes et règles');
  const faible = await appeler(admin, 'POST', '/users', { username: `x${sfx}`, password: 'abc', role: 'vendeur' });
  check(faible.status === 400, `mot de passe trop court refusé : ${faible.data.error}`);
  const courant = await appeler(admin, 'POST', '/users', { username: `y${sfx}`, password: 'azertyuiop', role: 'vendeur' });
  check(courant.status === 400, `mot de passe courant refusé : ${courant.data.error}`);
  const roleInconnu = await appeler(admin, 'POST', '/users', { username: `z${sfx}`, password: mdp, role: 'superadmin' });
  check(roleInconnu.status === 400, `rôle inconnu refusé : ${roleInconnu.data.error}`);
  for (const role of ['vendeur', 'magasinier', 'production', 'comptable']) {
    const c = await appeler(admin, 'POST', '/users', { username: `${role}${sfx}`, password: mdp, role });
    check(c.status === 201, `compte ${role} créé`);
    comptes[role] = { id: c.data.id, token: (await appeler(null, 'POST', '/auth/login', { username: `${role}${sfx}`, password: mdp })).data.token };
  }

  console.log('DB. Administration réservée au gérant');
  for (const [chemin, methode, body] of [['/users', 'GET'], ['/audit', 'GET'], ['/backup', 'GET'], ['/backup/now', 'POST'], ['/settings', 'PUT', { tva: 19 }], ['/numerotation/commande', 'PUT', { mode: 'actuel' }]]) {
    const sans = await appeler(null, methode, chemin, body);
    const vend = await appeler(comptes.vendeur.token, methode, chemin, body);
    check(sans.status === 401 && vend.status === 403, `${methode} ${chemin} : sans jeton 401, vendeur 403 (${sans.status}/${vend.status})`);
  }
  check((await appeler(comptes.vendeur.token, 'GET', '/settings')).status === 200, 'le vendeur peut lire les paramètres (nom de l\'entreprise)');
  check((await appeler(admin, 'GET', '/users')).status === 200, 'le gérant lit les utilisateurs');

  console.log('DC. Rôles limités');
  const refus = async (role, methode, chemin, body) => (await appeler(comptes[role].token, methode, chemin, body)).status === 403;
  check(await refus('magasinier', 'POST', '/commandes', {}), 'magasinier : création de commande refusée');
  check(await refus('production', 'POST', '/commandes', {}), 'production : création de commande refusée');
  check(await refus('production', 'POST', '/receptions', {}), 'production : réception refusée');
  check(await refus('comptable', 'POST', '/presse', {}), 'comptable : pressage refusé');
  check(await refus('comptable', 'POST', '/receptions', {}), 'comptable : réception refusée');
  check(!(await refus('magasinier', 'POST', '/receptions', {})), 'magasinier : réception autorisée (rejetée seulement pour données manquantes)');
  check(!(await refus('production', 'POST', '/presse', {})), 'production : pressage autorisé');
  check(!(await refus('comptable', 'POST', '/paiements', {})), 'comptable : paiement autorisé');
  check(!(await refus('vendeur', 'POST', '/clients', {})), 'vendeur : clients autorisés');
  for (const role of ['magasinier', 'production', 'comptable']) {
    check((await appeler(comptes[role].token, 'GET', '/produits')).status === 200, `${role} : lecture du catalogue`);
  }

  console.log('DD. Dernier gérant et comptes');
  const moi = (await appeler(admin, 'GET', '/users')).data.find(u => u.username === 'admin');
  const retrograde = await appeler(admin, 'PUT', `/users/${moi.id}`, { username: 'admin', role: 'vendeur', actif: true });
  check(retrograde.status === 409, `le dernier gérant ne peut pas être rétrogradé : ${retrograde.data.error}`);
  const suppr = await appeler(admin, 'DELETE', `/users/${moi.id}`);
  check(suppr.status === 409, 'on ne peut pas supprimer son propre compte');
  const desactive = await appeler(admin, 'PUT', `/users/${comptes.comptable.id}`, { username: `comptable${sfx}`, role: 'comptable', actif: false });
  check(desactive.status === 200, 'compte comptable désactivé');
  check((await appeler(comptes.comptable.token, 'GET', '/produits')).status === 401, 'le jeton d\'un compte désactivé est refusé aussitôt');
  const promu = await appeler(admin, 'PUT', `/users/${comptes.vendeur.id}`, { username: `vendeur${sfx}`, role: 'magasinier', actif: true });
  check(promu.status === 200 && (await refus('vendeur', 'POST', '/commandes', {})), 'changement de rôle appliqué immédiatement (sans nouvelle connexion)');

  console.log('DE. Journal d\'audit');
  const journal = (await appeler(admin, 'GET', `/audit?q=${encodeURIComponent('vendeur' + sfx)}`)).data;
  check(journal.lignes.some(l => l.methode === 'POST' && l.chemin === '/api/users'), 'création de compte tracée');
  check(!JSON.stringify(journal.lignes).includes(mdp), 'aucun mot de passe dans le journal');
  const refuses = (await appeler(admin, 'GET', '/audit?rubrique=backup')).data.lignes;
  check(refuses.some(l => l.statut_http === 403), 'les refus de droits sont tracés');
  const echec = await appeler(null, 'POST', '/auth/login', { username: `inconnu${sfx}`, password: 'xxxxxxxxxx' });
  const conn = (await appeler(admin, 'GET', `/audit?q=inconnu${sfx}`)).data.lignes;
  check(echec.status === 401 && conn.some(l => l.statut_http === 401), 'connexion échouée tracée');

  console.log('DF. CORS');
  const etranger = await appeler(null, 'GET', '/health', null, { Origin: 'https://site-inconnu.example' });
  check(!etranger.headers.get('access-control-allow-origin'), 'un site inconnu n\'est pas autorisé');
  const appAndroid = await appeler(null, 'GET', '/health', null, { Origin: 'https://appassets.androidplatform.net' });
  check(appAndroid.headers.get('access-control-allow-origin') === 'https://appassets.androidplatform.net', 'l\'application Android est autorisée');
  const lan = await appeler(null, 'GET', '/health', null, { Origin: 'http://192.168.1.20:3001' });
  check(!!lan.headers.get('access-control-allow-origin'), 'le réseau local est autorisé');
  check(etranger.headers.get('x-content-type-options') === 'nosniff', 'en-têtes de protection présents');

  console.log('DG. Saisies piégées');
  const piege = await appeler(admin, 'POST', '/clients', { nom: `<img src=x onerror=alert(1)> ${sfx}`, telephone: '1' });
  check(piege.status === 400, `balise HTML refusée dans un nom de client : ${piege.data.error}`);
  const normal = await appeler(admin, 'POST', '/clients', { nom: `Dupont & Fils "Bio" 5<10 ${sfx}`, telephone: '1' });
  check(normal.status === 201, 'un nom avec & et guillemets reste accepté');
  if (normal.data.id) await appeler(admin, 'DELETE', `/clients/${normal.data.id}`);

  for (const role of ['vendeur', 'magasinier', 'production', 'comptable']) await appeler(admin, 'DELETE', `/users/${comptes[role].id}`);
})();
