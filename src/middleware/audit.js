// Journal d'audit : qui a fait quoi, quand, depuis quelle adresse. Toute écriture (POST, PUT, PATCH, DELETE) de l'API,
// réussie ou refusée pour droits insuffisants, et chaque connexion (réussie ou échouée) sont consignées.
// Écrit après la réponse : une panne du journal ne bloque jamais l'opération.
const SECRETS = /pass|mdp|mot_de_passe|ancien|nouveau|token|secret|logo|authorization/i;
const IGNORES = [/^\/api\/numerotation\/apercu/, /^\/api\/health/];

function nettoyer(valeur, profondeur = 0) {
  if (valeur === null || typeof valeur !== 'object') return typeof valeur === 'string' && valeur.length > 200 ? valeur.slice(0, 200) + '…' : valeur;
  if (profondeur > 3) return '…';
  if (Array.isArray(valeur)) return valeur.slice(0, 10).map(v => nettoyer(v, profondeur + 1)).concat(valeur.length > 10 ? [`… (${valeur.length} éléments)`] : []);
  const sortie = {};
  for (const [k, v] of Object.entries(valeur)) sortie[k] = SECRETS.test(k) ? '***' : nettoyer(v, profondeur + 1);
  return sortie;
}

function audit(pool) {
  return (req, res, next) => {
    const ecriture = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const connexion = req.originalUrl.startsWith('/api/auth/login');
    if (!ecriture || IGNORES.some(r => r.test(req.originalUrl))) return next();
    res.on('finish', () => {
      const ok = res.statusCode < 400;
      if (!ok && !connexion && res.statusCode !== 403) return; // erreurs de saisie : sans intérêt pour l'audit
      const chemin = req.originalUrl.split('?')[0].slice(0, 200);
      const segments = chemin.replace(/^\/api\//, '').split('/');
      const user = req.user || {};
      const identifiant = user.username || (connexion && req.body ? String(req.body.username || '') : '') || null;
      let resume = '';
      if (Buffer.isBuffer(req.body)) resume = `(fichier de ${req.body.length} octets)`;
      else if (!chemin.startsWith('/api/m/')) { try { resume = JSON.stringify(nettoyer(req.body || {})).slice(0, 1500); } catch { /* corps illisible */ } } // les modules tiennent leur propre journal (pas de salaires ni de RIB ici)
      pool.query(
        `INSERT INTO journal_audit (user_id, username, role, methode, chemin, rubrique, entite_id, statut_http, ip, resume)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [user.id || null, identifiant && identifiant.slice(0, 40), user.role || null, req.method, chemin, (segments[0] || '').slice(0, 40),
          (segments.find((x, i) => i > 0 && /^\d+$/.test(x)) || null), res.statusCode, String(req.ip || '').slice(0, 45), resume]
      ).catch(() => { /* table absente (migration pas encore lancée) : tant pis */ });
    });
    next();
  };
}

module.exports = { audit, nettoyer };
