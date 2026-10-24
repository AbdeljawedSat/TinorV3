// Gestionnaire de modules : TinOR s'étend par des modules installables depuis l'écran Réglages › Modules.
//
// Un module est un dossier (ou un .zip) avec un fichier module.json (voir modules-catalogue/paie-tn pour un exemple complet) :
//   id, nom, version, description, auteur, tinor (version minimale), main (fichier serveur), dependances,
//   ecran { titre, icone, ui { script, global, monter } }, roles { liste, parDefaut, descriptions }, config [ … ].
// Le fichier « main » exporte { installer(ctx) } et renvoie un routeur Express ; il est monté sur /api/m/<id>.
// L'interface du module (ui/…) est servie sur /modules-ui/<id>/ et montée par la console dans un écran dédié.
//
// ⚠ Un module s'exécute dans le serveur TinOR, avec ses droits : n'installer que des modules dont on connaît l'auteur.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const RACINE = path.join(__dirname, '..', '..');
const DOSSIER = path.resolve(process.env.MODULES_DIR || path.join(RACINE, 'modules'));
const CATALOGUE = path.join(RACINE, 'modules-catalogue');
const LIMITES = { fichiers: 3000, octets: 80 * 1024 * 1024, zip: 30 * 1024 * 1024 };
const RE_ID = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
const RE_VERSION = /^\d+\.\d+\.\d+$/;

const versionTinor = () => require('../../package.json').version;
const comparer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const erreur = (message, status = 400) => Object.assign(new Error(message), { status });

// ---------- Manifeste ----------
function validerManifeste(m, dossier) {
  if (!m || typeof m !== 'object') throw erreur('module.json illisible.');
  if (!RE_ID.test(String(m.id || ''))) throw erreur('module.json : « id » invalide (minuscules, chiffres et tirets, 3 à 40 caractères).');
  if (!String(m.nom || '').trim()) throw erreur('module.json : « nom » requis.');
  if (!RE_VERSION.test(String(m.version || ''))) throw erreur('module.json : « version » au format 1.2.3 requise.');
  if (m.tinor !== undefined) {
    const mini = String(m.tinor).replace(/^>=\s*/, '');
    if (!RE_VERSION.test(mini)) throw erreur('module.json : « tinor » doit être de la forme ">=4.0.0".');
    if (comparer(versionTinor(), mini) < 0) throw erreur(`Ce module demande TinOR ${mini} ou plus récent (version installée : ${versionTinor()}).`);
  }
  const main = String(m.main || '');
  if (!main || main.includes('..') || path.isAbsolute(main) || !main.endsWith('.js')) throw erreur('module.json : « main » doit être un fichier .js du module.');
  if (dossier && !fs.existsSync(path.join(dossier, main))) throw erreur(`Fichier « ${main} » absent du module.`);
  if (m.ecran) {
    if (!String(m.ecran.titre || '').trim()) throw erreur('module.json : ecran.titre requis.');
    const ui = m.ecran.ui;
    if (!ui || !/^ui\/[\w./-]+\.js$/.test(ui.script || '') || ui.script.includes('..') || !/^[A-Za-z_]\w*$/.test(ui.global || '')) throw erreur('module.json : ecran.ui { script: "ui/….js", global, monter } invalide.');
    if (ui.monter && !/^[A-Za-z_]\w*$/.test(ui.monter)) throw erreur('module.json : ecran.ui.monter invalide.');
  }
  if (m.roles) {
    if (!Array.isArray(m.roles.liste) || !m.roles.liste.length || m.roles.liste.some(r => !/^[A-Z_]{2,30}$/.test(r))) throw erreur('module.json : roles.liste (MAJUSCULES) invalide.');
    for (const [tinor, r] of Object.entries(m.roles.parDefaut || {})) if (!m.roles.liste.includes(r)) throw erreur(`module.json : rôle par défaut inconnu (${tinor} → ${r}).`);
  }
  for (const c of m.config || []) if (!/^\w{1,40}$/.test(c.cle || '') || !['booleen', 'texte', 'nombre'].includes(c.type)) throw erreur('module.json : config invalide.');
  return m;
}
const lireManifeste = (dossier) => {
  let brut;
  try { brut = JSON.parse(fs.readFileSync(path.join(dossier, 'module.json'), 'utf8')); } catch { throw erreur('module.json absent ou illisible.'); }
  return validerManifeste(brut, dossier);
};

// ---------- Extraction sûre d'un zip ----------
async function extraireZip(buffer, destination) {
  if (buffer.length > LIMITES.zip) throw erreur(`Fichier trop gros (${LIMITES.zip / 1048576} Mo maximum).`, 413);
  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch { throw erreur('Ce fichier n\'est pas un zip valide.'); }
  let entrees = Object.values(zip.files).filter(e => !e.dir);
  if (!entrees.length) throw erreur('Zip vide.');
  if (entrees.length > LIMITES.fichiers) throw erreur(`Trop de fichiers (${LIMITES.fichiers} maximum).`);
  const noms = entrees.map(e => e.name.replace(/\\/g, '/'));
  // Un seul dossier racine (ex. paie-tn/…) : on le retire.
  const premiers = new Set(noms.map(n => n.split('/')[0]));
  const prefixe = premiers.size === 1 && noms.every(n => n.includes('/')) ? [...premiers][0] + '/' : '';
  fs.mkdirSync(destination, { recursive: true });
  const base = path.resolve(destination);
  let total = 0;
  for (const e of entrees) {
    const nom = e.name.replace(/\\/g, '/');
    const rel = prefixe ? nom.slice(prefixe.length) : nom;
    if (!rel || rel.startsWith('/') || /(^|\/)\.\.(\/|$)/.test(rel) || /[\0:]/.test(rel) || rel.split('/').some(p => p === '' || p === '.git')) throw erreur(`Chemin refusé dans le zip : ${nom}`);
    const unix = e.unixPermissions;
    if (typeof unix === 'number' && (unix & 0o170000) === 0o120000) throw erreur(`Lien symbolique refusé dans le zip : ${nom}`);
    const cible = path.resolve(base, rel);
    if (!cible.startsWith(base + path.sep)) throw erreur(`Chemin refusé dans le zip : ${nom}`);
    const contenu = await e.async('nodebuffer');
    total += contenu.length;
    if (total > LIMITES.octets) throw erreur('Module trop volumineux une fois décompressé.', 413);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu);
  }
}
const supprimerDossier = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* déjà absent */ } };

// ---------- Gestionnaire ----------
class Modules {
  constructor(pool, creerPoolBrut, journal = () => {}) {
    this.pool = pool; this.creerPoolBrut = creerPoolBrut; this.journal = journal;
    this.actifs = new Map(); // id → { manifeste, routeur, poolBrut, dossier }
    this._configCache = new Map();
    this.pret = Promise.resolve();
  }
  dossier(id) { return path.join(DOSSIER, id); }

  async demarrer() {
    fs.mkdirSync(DOSSIER, { recursive: true });
    let lignes = [];
    try { lignes = (await this.pool.query('SELECT id FROM modules_installes WHERE actif = 1')).rows; } catch { return; } // migration pas encore faite
    for (const { id } of lignes) {
      try { await this.charger(id); } catch (e) { console.error(`[modules] « ${id} » non chargé : ${e.message}`); }
    }
  }

  async ligne(id) { return (await this.pool.query('SELECT * FROM modules_installes WHERE id = $1', [id])).rows[0] || null; }
  async config(id) {
    const l = await this.ligne(id);
    let sauvee = {};
    try { sauvee = l && l.config ? JSON.parse(l.config) : {}; } catch { /* config illisible : valeurs par défaut */ }
    const m = this.actifs.get(id)?.manifeste || lireManifeste(this.dossier(id));
    const r = {};
    for (const c of m.config || []) r[c.cle] = sauvee[c.cle] !== undefined ? sauvee[c.cle] : c.defaut;
    return r;
  }
  async droitsSauves(id) {
    return new Map((await this.pool.query('SELECT user_id, role FROM modules_droits WHERE module_id = $1', [id])).rows.map(r => [r.user_id, r.role]));
  }

  // Rôle de l'utilisateur dans le module : choix du gérant sinon rôle par défaut selon son rôle TinOR ; null = pas d'accès.
  roleDans(manifeste, utilisateurTinor, surcharges) {
    if (!manifeste.roles) return utilisateurTinor.role; // module sans rôles propres : droits TinOR
    const choisi = surcharges.get(utilisateurTinor.id);
    if (choisi) return choisi === 'AUCUN' ? null : choisi;
    return (manifeste.roles.parDefaut || {})[utilisateurTinor.role] || null;
  }

  async charger(id) {
    const dossier = this.dossier(id);
    const manifeste = lireManifeste(dossier);
    this.decharger(id);
    const mod = require(path.join(dossier, manifeste.main));
    if (!mod || typeof mod.installer !== 'function') throw erreur(`« ${manifeste.main} » doit exporter { installer(ctx) }.`);
    let poolBrut = null;
    const gestionnaire = this;
    const ctx = {
      id, dossier, version: versionTinor(), pool: this.pool,
      poolBrut: async () => poolBrut || (poolBrut = this.creerPoolBrut()),
      config: () => this._configCache.get(id) || {},
      utilisateur: (req) => req.moduleUtilisateur || null,
      journaliser: (action, detail) => gestionnaire.journal(`module:${id}:${action}`, detail),
    };
    this._configCache.set(id, await this.config(id));
    let routeur;
    try { routeur = await mod.installer(ctx); }
    catch (e) { this.decharger(id); if (poolBrut) await poolBrut.end().catch(() => {}); throw erreur(`Le module « ${manifeste.nom} » n'a pas pu démarrer : ${e.message}`, 500); }
    if (typeof routeur !== 'function') throw erreur('installer(ctx) doit renvoyer un routeur Express.');
    this.actifs.set(id, { manifeste, routeur, get poolBrut() { return poolBrut; }, dossier });
    return manifeste;
  }

  decharger(id) {
    const actif = this.actifs.get(id);
    this.actifs.delete(id);
    const dossier = this.dossier(id);
    for (const k of Object.keys(require.cache)) if (k.startsWith(dossier + path.sep)) delete require.cache[k];
    if (actif && actif.poolBrut) actif.poolBrut.end().catch(() => {});
  }

  // ---------- Installation ----------
  async installerDepuisZip(buffer, { par, activer = true } = {}) {
    const sha = crypto.createHash('sha256').update(buffer).digest('hex');
    const tmp = path.join(DOSSIER, `.tmp-${crypto.randomBytes(6).toString('hex')}`);
    try {
      await extraireZip(buffer, tmp);
      const manifeste = lireManifeste(tmp);
      const id = manifeste.id;
      const ancienne = await this.ligne(id);
      if (ancienne && comparer(manifeste.version, ancienne.version) < 0) throw erreur(`Une version plus récente (${ancienne.version}) est déjà installée.`, 409);
      const etaitActif = this.actifs.has(id);
      if (etaitActif) this.decharger(id);
      const cible = this.dossier(id), sauvegarde = `${cible}.precedent`;
      supprimerDossier(sauvegarde);
      if (fs.existsSync(cible)) fs.renameSync(cible, sauvegarde);
      fs.renameSync(tmp, cible);
      await this.pool.query(
        `INSERT INTO modules_installes (id, nom, version, actif, sha256, installe_par) VALUES ($1,$2,$3,0,$4,$5)
         ON DUPLICATE KEY UPDATE nom = VALUES(nom), version = VALUES(version), sha256 = VALUES(sha256), installe_par = VALUES(installe_par), installe_le = NOW()`,
        [id, manifeste.nom, manifeste.version, sha, par || null]);
      this.journal('module:installe', `${id} ${manifeste.version} (sha256 ${sha.slice(0, 12)}…)`);
      if (activer || etaitActif) {
        try { await this.activer(id); }
        catch (e) { // la nouvelle version ne démarre pas : retour à la précédente
          this.decharger(id); supprimerDossier(cible);
          if (fs.existsSync(sauvegarde)) { fs.renameSync(sauvegarde, cible); if (ancienne) await this.pool.query('UPDATE modules_installes SET version = $1, nom = $2 WHERE id = $3', [ancienne.version, ancienne.nom, id]); if (etaitActif) await this.activer(id).catch(() => {}); }
          else await this.pool.query('DELETE FROM modules_installes WHERE id = $1', [id]);
          throw e;
        }
      }
      supprimerDossier(sauvegarde);
      return { ...manifeste, actif: this.actifs.has(id), mise_a_jour: !!ancienne };
    } finally { supprimerDossier(tmp); }
  }

  async activer(id) {
    if (!(await this.ligne(id))) throw erreur('Module non installé.', 404);
    const m = await this.charger(id);
    await this.pool.query('UPDATE modules_installes SET actif = 1 WHERE id = $1', [id]);
    this.journal('module:active', id);
    return m;
  }
  async desactiver(id) {
    if (!(await this.ligne(id))) throw erreur('Module non installé.', 404);
    this.decharger(id);
    await this.pool.query('UPDATE modules_installes SET actif = 0 WHERE id = $1', [id]);
    this.journal('module:desactive', id);
  }
  // Retire le module (code et réglages). Les tables de données créées par le module ne sont jamais supprimées.
  async retirer(id) {
    if (!(await this.ligne(id))) throw erreur('Module non installé.', 404);
    this.decharger(id);
    await this.pool.query('DELETE FROM modules_droits WHERE module_id = $1', [id]);
    await this.pool.query('DELETE FROM modules_installes WHERE id = $1', [id]);
    supprimerDossier(this.dossier(id));
    this.journal('module:retire', id);
  }
  async enregistrerConfig(id, valeurs) {
    const m = lireManifeste(this.dossier(id));
    const propre = {};
    for (const c of m.config || []) {
      if (valeurs[c.cle] === undefined) continue;
      const v = valeurs[c.cle];
      if (c.type === 'booleen') propre[c.cle] = v === true || v === 'true' || v === 1;
      else if (c.type === 'nombre') { if (Number.isNaN(Number(v))) throw erreur(`${c.libelle || c.cle} : nombre attendu.`); propre[c.cle] = Number(v); }
      else propre[c.cle] = String(v).slice(0, 500);
    }
    const actuelle = await this.config(id);
    await this.pool.query('UPDATE modules_installes SET config = $1 WHERE id = $2', [JSON.stringify({ ...actuelle, ...propre }), id]);
    if (this.actifs.has(id)) await this.charger(id); // le module redémarre avec ses nouveaux réglages
    this.journal('module:config', id);
  }
  async enregistrerDroits(id, liste) {
    const m = lireManifeste(this.dossier(id));
    if (!m.roles) throw erreur('Ce module n\'a pas de rôles propres.');
    for (const d of liste) {
      const uid = Number(d.user_id);
      if (!Number.isInteger(uid)) throw erreur('user_id invalide.');
      if (d.role === null || d.role === '' || d.role === undefined) await this.pool.query('DELETE FROM modules_droits WHERE module_id = $1 AND user_id = $2', [id, uid]);
      else if (d.role === 'AUCUN' || m.roles.liste.includes(d.role)) await this.pool.query(
        'INSERT INTO modules_droits (module_id, user_id, role) VALUES ($1,$2,$3) ON DUPLICATE KEY UPDATE role = VALUES(role)', [id, uid, d.role]);
      else throw erreur(`Rôle inconnu : ${d.role}`);
    }
    this.journal('module:droits', id);
  }

  // ---------- Listes ----------
  async installes() {
    const lignes = (await this.pool.query('SELECT * FROM modules_installes ORDER BY nom')).rows;
    return lignes.map(l => {
      let manifeste = null, probleme = null;
      try { manifeste = lireManifeste(this.dossier(l.id)); } catch (e) { probleme = e.message; }
      return { id: l.id, nom: l.nom, version: l.version, actif: !!l.actif && this.actifs.has(l.id), souhaite_actif: !!l.actif, installe_le: l.installe_le, installe_par: l.installe_par, sha256: l.sha256,
        description: manifeste && manifeste.description, auteur: manifeste && manifeste.auteur, roles: manifeste && manifeste.roles, config_def: manifeste && manifeste.config, donnees: manifeste && manifeste.donnees,
        ecran: !!(manifeste && manifeste.ecran), probleme };
    });
  }
  // Catalogue : zips fournis avec TinOR (modules-catalogue/*.zip) avec leur état d'installation.
  async catalogue() {
    const sortie = [];
    if (!fs.existsSync(CATALOGUE)) return sortie;
    const installes = new Map((await this.installes()).map(m => [m.id, m]));
    for (const f of fs.readdirSync(CATALOGUE).filter(x => x.endsWith('.zip')).sort()) {
      try {
        const zip = await JSZip.loadAsync(fs.readFileSync(path.join(CATALOGUE, f)));
        const entree = Object.values(zip.files).find(e => !e.dir && /(^|\/)module\.json$/.test(e.name) && e.name.split('/').length <= 2);
        const m = JSON.parse(await entree.async('string'));
        const inst = installes.get(m.id);
        sortie.push({ fichier: f, id: m.id, nom: m.nom, version: m.version, description: m.description, auteur: m.auteur,
          installe: inst ? inst.version : null, a_jour: inst ? comparer(inst.version, m.version) >= 0 : false });
      } catch { /* zip du catalogue illisible : ignoré */ }
    }
    return sortie;
  }
  cheminCatalogue(fichier) {
    const nom = path.basename(String(fichier || ''));
    const chemin = path.join(CATALOGUE, nom);
    if (!nom.endsWith('.zip') || !fs.existsSync(chemin)) throw erreur('Module du catalogue introuvable.', 404);
    return chemin;
  }
}

module.exports = { Modules, validerManifeste, lireManifeste, extraireZip, DOSSIER, CATALOGUE, LIMITES, comparer };
