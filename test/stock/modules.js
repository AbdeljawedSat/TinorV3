// Modules installables : installation sûre (zip), activation, droits par module, module Paie Tunisie de bout en bout.
// Prérequis : API démarrée sur une base de TEST (la copie de modules-catalogue/ sert de catalogue).
const JSZip = require('jszip');
const { api, login, check } = require('./api');
const API = process.env.API_URL || 'http://127.0.0.1:3001/api';

async function appeler(token, methode, chemin, corps, brut) {
  const res = await fetch(API + chemin, { method: methode, body: brut || (corps && JSON.stringify(corps)),
    headers: { ...(brut ? { 'Content-Type': 'application/zip' } : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
  const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: res.status, data: d, type: res.headers.get('content-type') || '' };
}
async function fabriquer(fichiers) {
  const z = new JSZip();
  for (const [nom, contenu] of Object.entries(fichiers)) z.file(nom, contenu);
  return z.generateAsync({ type: 'nodebuffer' });
}
const manifeste = (o = {}) => JSON.stringify({ id: 'demo-mod', nom: 'Module de démonstration', version: '1.0.0', main: 'index.js',
  ecran: { titre: 'Démo', ui: { script: 'ui/demo.js', global: 'Demo', monter: 'monter' } }, ...o });
const INDEX = "const express = require('express'); module.exports = { installer(ctx) { const r = express.Router(); r.get('/qui', (req, res) => res.json({ moi: ctx.utilisateur(req), version: ctx.version })); return r; } };";

(async () => {
  await login();
  const admin = (await appeler(null, 'POST', '/auth/login', { username: 'admin', password: 'changeme' })).data.token;
  const sfx = String(Date.now()).slice(-6), mdp = 'Phrase-de-passe-2026';
  const creer = async (role) => {
    const c = await appeler(admin, 'POST', '/users', { username: `${role}${sfx}`, password: mdp, role });
    return { id: c.data.id, token: (await appeler(null, 'POST', '/auth/login', { username: `${role}${sfx}`, password: mdp })).data.token };
  };
  const vendeur = await creer('vendeur'), comptable = await creer('comptable'), prod = await creer('production');

  console.log('MA. Administration réservée au gérant');
  for (const [m, c, b] of [['GET', '/modules-admin'], ['POST', '/modules-admin/installer-catalogue', { fichier: 'x.zip' }], ['DELETE', '/modules-admin/paie-tn']]) {
    const r = await appeler(vendeur.token, m, c, b);
    check(r.status === 403, `${m} ${c} refusé au vendeur (${r.status})`);
  }
  check((await appeler(null, 'GET', '/modules')).status === 401, 'liste des modules : connexion requise');

  console.log('MB. Installation depuis le catalogue (module Paie Tunisie)');
  const cat = (await appeler(admin, 'GET', '/modules-admin')).data;
  const paie = cat.catalogue.find(m => m.id === 'paie-tn');
  check(!!paie, `catalogue : ${cat.catalogue.map(m => `${m.nom} ${m.version}`).join(', ')}`);
  let r = await appeler(admin, 'POST', '/modules-admin/installer-catalogue', { fichier: paie.fichier });
  check(r.status === 201 && r.data.actif === true, `Paie Tunisie installé et actif (${r.status}${r.data.error ? ' ' + r.data.error : ''})`);
  check((await appeler(admin, 'POST', '/modules-admin/installer-catalogue', { fichier: '../../etc/passwd' })).status === 404, 'nom de fichier du catalogue : sortie du dossier impossible');
  const visibles = async (t) => (await appeler(t, 'GET', '/modules')).data;
  check((await visibles(admin)).some(m => m.id === 'paie-tn' && m.role === 'ADMIN' && m.ui.global === 'TinorPaie' && m.api === '/api/m/paie-tn'), 'le gérant voit le module avec le rôle ADMIN');
  check((await visibles(comptable.token)).some(m => m.id === 'paie-tn' && m.role === 'GESTIONNAIRE'), 'le comptable : GESTIONNAIRE par défaut');
  check(!(await visibles(vendeur.token)).some(m => m.id === 'paie-tn'), 'le vendeur : pas de menu Paie');
  check((await appeler(vendeur.token, 'GET', '/m/paie-tn/meta')).status === 403, 'le vendeur : API de paie refusée (403)');
  check((await appeler(null, 'GET', '/m/paie-tn/meta')).status === 401, 'sans connexion : 401');
  const ui = await fetch(API.replace('/api', '') + '/modules-ui/paie-tn/tinor-paie-ui.js');
  check(ui.status === 200 && /TinorPaie/.test(await ui.text()), 'interface du module servie');
  check((await fetch(API.replace('/api', '') + '/modules-ui/paie-tn/..%2Fmodule.json')).status !== 200, 'l\'interface ne sert que le dossier ui/');
  check((await fetch(API.replace('/api', '') + '/modules-ui/paie-tn/../tinor-module.js')).status !== 200, 'pas de sortie du dossier ui/ (..)');

  console.log('MC. Droits dans le module');
  const droits = (await appeler(admin, 'GET', '/modules-admin/paie-tn/droits')).data;
  check(droits.roles.liste.length === 4 && droits.utilisateurs.some(u => u.username === `comptable${sfx}` && u.effectif === 'GESTIONNAIRE'), 'droits : rôles et utilisateurs listés');
  check((await appeler(admin, 'PUT', '/modules-admin/paie-tn/droits', { droits: [{ user_id: prod.id, role: 'SUPERVISEUR' }] })).status === 400, 'rôle inconnu refusé');
  check((await appeler(admin, 'PUT', '/modules-admin/paie-tn/droits', { droits: [{ user_id: prod.id, role: 'VALIDEUR' }] })).status === 200, 'utilisateur « production » nommé VALIDEUR de la paie');
  check((await appeler(prod.token, 'GET', '/m/paie-tn/meta')).data.utilisateur.role === 'VALIDEUR', 'rôle appliqué aussitôt');
  await appeler(admin, 'PUT', '/modules-admin/paie-tn/droits', { droits: [{ user_id: comptable.id, role: 'AUCUN' }] });
  check((await appeler(comptable.token, 'GET', '/m/paie-tn/meta')).status === 403, '« AUCUN » retire l\'accès');
  await appeler(admin, 'PUT', '/modules-admin/paie-tn/droits', { droits: [{ user_id: comptable.id, role: null }] });
  check((await appeler(comptable.token, 'GET', '/m/paie-tn/meta')).status === 200, 'retour au rôle par défaut');

  console.log('MD. Paie : du salarié au bulletin');
  const G = comptable.token, V = prod.token, A = admin;
  // Les tables de paie survivent au retrait du module : une période différente à chaque essai (2023-2026, paramètres réglementaires en vigueur).
  const N = Math.floor(Date.now() / 1000) % 48, ANNEE = 2023 + (N % 4), MOIS = 1 + (Math.floor(N / 4) % 12), MOIS2 = (MOIS % 12) + 1;
  const p = (t, m, c, b) => appeler(t, m, `/m/paie-tn${c}`, b);
  check((await p(A, 'PUT', '/entreprise', { raisonSociale: 'JARDINS DE JERBA (TEST)', tauxAT: '0.004', tauxTFP: '0.01' })).status === 200, 'fiche entreprise');
  const s1 = (await p(G, 'POST', '/salaries', { matricule: `M${sfx}`, nom: 'Ben Test', prenom: 'Ali', dateEntree: '2020-01-01', chefFamille: true, nbEnfants: 2 })).data;
  await p(G, 'POST', `/salaries/${s1.id}/contrats`, { dateDebut: '2020-01-01', salaireBase: '2000' });
  const per = (await p(G, 'POST', '/periodes', { annee: ANNEE, mois: MOIS })).data;
  check(per.statut === 'OUVERTE', 'période ouverte');
  await p(G, 'POST', `/periodes/${per.id}/variables`, { salarieId: s1.id, rubrique: 'PRIME_PRESENCE', montant: '100' });
  const sim = (await p(G, 'POST', `/periodes/${per.id}/simuler`)).data;
  check(sim.calculs && sim.calculs.some(c => c.salarieId === s1.id), 'simulation faite');
  check((await p(G, 'POST', `/periodes/${per.id}/valider`)).status === 403, 'le gestionnaire ne valide pas');
  await p(A, 'POST', `/periodes/${per.id}/simuler`);
  check(/deux niveaux/.test((await p(A, 'POST', `/periodes/${per.id}/valider`)).data.erreur), 'contrôle à deux niveaux : on ne valide pas sa propre simulation');
  await p(G, 'POST', `/periodes/${per.id}/simuler`);
  const vv = await p(V, 'POST', `/periodes/${per.id}/valider`); check(vv.status === 200, 'validée par une autre personne' + (vv.status === 200 ? '' : ' : ' + JSON.stringify(vv.data)));
  const bulletin = await p(G, 'GET', `/periodes/${per.id}/bulletins?langue=fr-ar`);
  check(bulletin.status === 200 && /BULLETIN DE PAIE/.test(bulletin.data) && /NON CERTIFIÉ/.test(bulletin.data), 'bulletin imprimable (non certifié tant que les paramètres ne sont pas validés)');
  const journal = (await p(A, 'GET', '/journal')).data;
  check(journal.some(e => e.action === 'VALIDATION'), 'journal de la paie tenu par le module');
  const audit = (await appeler(admin, 'GET', '/audit?rubrique=m')).data.lignes;
  check(audit.length > 0 && audit.every(l => !l.resume), 'journal d\'audit TinOR : actions tracées sans détails sensibles (pas de salaires)');

  console.log('MD2. Import des employés de TinOR');
  const e1 = (await appeler(admin, 'POST', '/employes', { matricule: `E1${sfx}`, nom: 'Hamdi', prenom: 'Sonia', fonction: 'Presse' })).data;
  const e2 = (await appeler(admin, 'POST', '/employes', { matricule: `E2${sfx}`, nom: 'Jlassi', prenom: 'Karim', fonction: 'Conditionnement' })).data;
  const liste = (await p(G, 'GET', '/tinor/employes')).data;
  check(liste.some(e => e.matricule === `E1${sfx}` && !e.dejaImporte), 'les employés de TinOR sont listés pour l\'import');
  check((await p(prod.token, 'GET', '/tinor/employes')).status === 403 && (await p(vendeur.token, 'GET', '/tinor/employes')).status === 403, 'import : réservé à qui gère les salariés (le valideur et le vendeur sont refusés)');
  const sansDate = (await p(G, 'POST', '/tinor/importer', { employes: [{ id: e1.id }] })).data;
  check(sansDate.importes.length === 0 && /date d'entrée/.test(sansDate.ignores[0].raison), `sans date d'entrée : ignoré (${sansDate.ignores[0].raison})`);
  const imp = (await p(G, 'POST', '/tinor/importer', { employes: [{ id: e1.id, dateEntree: '2022-03-01' }, { id: e2.id, dateEntree: '2023-06-15' }, { id: 999999 }] })).data;
  check(imp.importes.length === 2 && imp.ignores.length === 1, `2 employés importés, 1 introuvable ignoré`);
  const sal = (await p(G, 'GET', '/salaries')).data.find(x => x.matricule === `E1${sfx}`);
  check(sal && sal.nom === 'HAMDI' && sal.prenom === 'Sonia' && sal.fonction === 'Presse' && sal.dateEntree === '2022-03-01', 'fiche de paie : identité reprise de TinOR');
  const encore = (await p(G, 'POST', '/tinor/importer', { employes: [{ id: e1.id, dateEntree: '2022-03-01' }] })).data;
  check(encore.importes.length === 0 && encore.ignores[0].raison === 'déjà importé', 'déjà importé : jamais écrasé');
  check((await p(G, 'GET', '/tinor/employes')).data.find(e => e.matricule === `E1${sfx}`).dejaImporte === true, 'la liste marque « déjà importé »');
  check((await p(G, 'POST', '/tinor/importer', { employes: [] })).status === 400, 'sélection vide refusée');
  check((await p(A, 'GET', '/journal?q=IMPORT')).data.some(e => e.action === 'IMPORT'), 'import tracé dans le journal de la paie');
  for (const x of imp.importes) { const f = (await p(G, 'GET', '/salaries')).data.find(y => y.id === x.id); await p(G, 'PUT', `/salaries/${x.id}`, { ...f, actif: false }); } // sans contrat : hors de la paie du test
  await appeler(admin, 'DELETE', `/employes/${e1.id}`); await appeler(admin, 'DELETE', `/employes/${e2.id}`);

  console.log('ME. Désactivation, réglages, données conservées');
  check((await appeler(admin, 'PUT', '/modules-admin/paie-tn/config', { controleDeuxNiveaux: false })).status === 200, 'réglage : contrôle à deux niveaux désactivé (le module redémarre)');
  const per2 = (await p(G, 'POST', '/periodes', { annee: ANNEE, mois: MOIS2 })).data;
  await p(A, 'POST', `/periodes/${per2.id}/simuler`);
  check((await p(A, 'POST', `/periodes/${per2.id}/valider`)).status === 200, 'sans contrôle à deux niveaux : le gérant valide lui-même');
  await appeler(admin, 'PUT', '/modules-admin/paie-tn/config', { controleDeuxNiveaux: true });
  check((await appeler(admin, 'POST', '/modules-admin/paie-tn/desactiver')).status === 200, 'module désactivé');
  check((await p(A, 'GET', '/meta')).status === 404 && !(await visibles(admin)).some(m => m.id === 'paie-tn'), 'désactivé : API absente, menu absent');
  check((await appeler(admin, 'POST', '/modules-admin/paie-tn/activer')).status === 200 && (await p(A, 'GET', '/salaries')).data.some(s => s.id === s1.id), 'réactivé : les données sont là');
  check((await appeler(admin, 'DELETE', '/modules-admin/paie-tn')).status === 204 && (await p(A, 'GET', '/meta')).status === 404, 'module retiré');
  r = await appeler(admin, 'POST', '/modules-admin/installer-catalogue', { fichier: paie.fichier });
  check(r.status === 201 && (await p(A, 'GET', '/salaries')).data.some(s => s.id === s1.id), 'réinstallé : les salariés saisis auparavant sont conservés');

  console.log('MF. Zips dangereux ou invalides refusés');
  const refuse = async (nom, buf, motif) => { const x = await appeler(admin, 'POST', '/modules-admin/installer', null, buf); check(x.status >= 400 && x.status < 500 && (!motif || motif.test(x.data.error)), `${nom} : refusé (${x.status} ${x.data.error})`); };
  await refuse('fichier qui n\'est pas un zip', Buffer.from('bonjour'), /zip/);
  await refuse('sans module.json', await fabriquer({ 'index.js': INDEX }), /module\.json/);
  await refuse('id invalide', await fabriquer({ 'module.json': manifeste({ id: '../x' }), 'index.js': INDEX }), /id/);
  await refuse('version de TinOR trop ancienne', await fabriquer({ 'module.json': manifeste({ tinor: '>=99.0.0' }), 'index.js': INDEX }), /TinOR/);
  await refuse('fichier principal absent', await fabriquer({ 'module.json': manifeste() }), /index\.js/);
  await refuse('écran sans interface valide', await fabriquer({ 'module.json': manifeste({ ecran: { titre: 'X', ui: { script: '../x.js', global: 'X' } } }), 'index.js': INDEX }), /ecran/);
  const casse = await appeler(admin, 'POST', '/modules-admin/installer', null, await fabriquer({ 'module.json': manifeste({ id: 'casse' }), 'index.js': "module.exports = { installer() { throw new Error('boum'); } };" }));
  check(casse.status === 500 && /boum/.test(casse.data.error) && !(await appeler(admin, 'GET', '/modules-admin')).data.installes.some(m => m.id === 'casse'), 'module qui plante au démarrage : refusé et rien d\'installé');

  const evil = require('path').join(require('../../src/services/modules').DOSSIER, '..', 'evil-zip.js');
  const piege = await appeler(admin, 'POST', '/modules-admin/installer', null, await fabriquer({ 'module.json': manifeste({ id: 'piege' }), 'index.js': INDEX, '../../evil-zip.js': 'x', 'ui/demo.js': 'x' }));
  check(!require('fs').existsSync(evil), `zip-slip : aucun fichier écrit hors du dossier des modules (réponse ${piege.status})`);
  await appeler(admin, 'DELETE', '/modules-admin/piege');

  console.log('MG. Un module minimal (contrat de l\'extension)');
  const demo = await fabriquer({ 'module.json': manifeste(), 'index.js': INDEX, 'ui/demo.js': 'window.Demo = { monter(c) { c.textContent = "ok"; } };' });
  r = await appeler(admin, 'POST', '/modules-admin/installer', null, demo);
  check(r.status === 201 && r.data.actif, 'module de démonstration installé');
  const qui = (await appeler(comptable.token, 'GET', '/m/demo-mod/qui')).data;
  check(qui.moi && qui.moi.login === `comptable${sfx}` && qui.moi.role === 'comptable' && /^4\./.test(qui.version), 'sans rôles propres : droits TinOR transmis au module');
  check((await fetch(API.replace('/api', '') + '/modules-ui/demo-mod/demo.js')).status === 200, 'interface du module servie');
  const demo2 = await fabriquer({ 'module.json': manifeste({ version: '1.1.0' }), 'index.js': INDEX, 'ui/demo.js': 'window.Demo = { monter(c) { c.textContent = "v2"; } };' });
  check((await appeler(admin, 'POST', '/modules-admin/installer', null, demo2)).data.mise_a_jour === true, 'mise à jour vers 1.1.0');
  check((await appeler(admin, 'POST', '/modules-admin/installer', null, demo)).status === 409, 'retour à une version plus ancienne refusé');
  await appeler(admin, 'DELETE', '/modules-admin/demo-mod');
  await appeler(admin, 'DELETE', '/modules-admin/paie-tn');
  for (const u of [vendeur, comptable, prod]) await appeler(admin, 'DELETE', `/users/${u.id}`);
})();
