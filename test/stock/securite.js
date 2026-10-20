// Connexion : blocage après 5 échecs, mot de passe livré signalé, changement de mot de passe.
// Prérequis : API démarrée sur une base de TEST (npm run reset:demo -- --confirmer).
const { api, login, check } = require('./api');

(async () => {
  await login();
  const post = (url, body, token) => api(url, { method: 'POST', body, headers: token ? { Authorization: 'Bearer ' + token } : {} });
  const nom = `testeur${String(Date.now()).slice(-6)}`;

  console.log('AY. Sécurité de la connexion');
  const cree = await post('/users', { username: nom, password: 'MotDePasse2026', role: 'vendeur' });
  check(cree.status === 201, `compte de test créé (${nom})`);
  const ok = await post('/auth/login', { username: nom, password: 'MotDePasse2026' });
  check(ok.status === 200 && ok.data.mot_de_passe_par_defaut === false, 'connexion : mot de passe personnel, pas de rappel « changeme »');
  const token = ok.data.token;

  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post('/auth/login', { username: nom, password: 'faux' })).status);
  check(codes.slice(0, 5).every(c => c === 401) && codes[5] === 429, `5 échecs (401) puis blocage (429) : ${codes.join(' ')}`);
  const bloque = await post('/auth/login', { username: nom, password: 'MotDePasse2026' });
  check(bloque.status === 429 && bloque.data.retry_apres > 0, `même le bon mot de passe est refusé pendant le blocage : ${bloque.data.error}`);

  const faux = await post('/auth/mot-de-passe', { ancien: 'nope', nouveau: 'NouveauMdp2027' }, token);
  check(faux.status === 401, 'changement refusé avec un mauvais ancien mot de passe');
  const court = await post('/auth/mot-de-passe', { ancien: 'MotDePasse2026', nouveau: 'abc' }, token);
  check(court.status === 400, `nouveau mot de passe trop court refusé : ${court.data.error}`);
  const defaut = await post('/auth/mot-de-passe', { ancien: 'MotDePasse2026', nouveau: 'changeme' }, token);
  check(defaut.status === 400, 'le mot de passe livré « changeme » est refusé comme nouveau mot de passe');
  const change = await post('/auth/mot-de-passe', { ancien: 'MotDePasse2026', nouveau: 'NouveauMdp2027' }, token);
  check(change.status === 200, 'changement accepté avec le bon ancien mot de passe');
  const sansJeton = await post('/auth/mot-de-passe', { ancien: 'a', nouveau: 'NouveauMdp2027' });
  check(sansJeton.status === 401, 'changement impossible sans être connecté');
})().catch(e => { console.error(e); process.exit(1); });
