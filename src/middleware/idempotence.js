// Anti-doublon des opérations envoyées par un téléphone revenu en ligne.
//
// Chaque opération saisie hors ligne porte un identifiant unique (en-tête
// X-Operation-Id). Si la connexion coupe après l'enregistrement mais avant la
// réponse, le téléphone renvoie la même opération : on rejoue la réponse déjà
// donnée au lieu d'enregistrer la commande (ou la réception…) une 2e fois.
// Une opération refusée (stock insuffisant…) n'est pas mémorisée : une fois
// corrigée, elle peut être renvoyée avec le même identifiant.

const EN_COURS_MAX_MS = 2 * 60 * 1000; // au-delà, l'envoi précédent a échoué (serveur arrêté…) : on le relance

function idempotence(pool) {
  return async (req, res, next) => {
    const id = req.get('X-Operation-Id');
    if (!id || req.method !== 'POST') return next();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return res.status(400).json({ error: 'En-tête X-Operation-Id invalide.' });
    try {
      for (let essai = 0; ; essai++) {
        try {
          await pool.query(
            `INSERT INTO operations_sync (id, methode, chemin, statut) VALUES ($1,$2,$3,'EN_COURS')`,
            [id, req.method, req.originalUrl.slice(0, 200)]);
          break;
        } catch (err) {
          if (err.code !== 'ER_DUP_ENTRY' || essai > 0) throw err;
          const prec = (await pool.query('SELECT * FROM operations_sync WHERE id = $1', [id])).rows[0];
          if (prec && prec.statut === 'TERMINEE') {
            res.set('X-Operation-Rejouee', '1');
            return res.status(prec.code_http || 200).json(prec.reponse ? JSON.parse(prec.reponse) : {});
          }
          if (prec && Date.now() - new Date(prec.cree_le).getTime() < EN_COURS_MAX_MS) {
            return res.status(409).json({ error: 'Cette opération est déjà en cours d\'envoi : réessayez dans un instant.', en_cours: true });
          }
          await pool.query('DELETE FROM operations_sync WHERE id = $1', [id]); // envoi précédent interrompu
        }
      }
    } catch (err) { return next(err); }

    let corps;
    const jsonOrigine = res.json.bind(res);
    res.json = (body) => { corps = body; return jsonOrigine(body); };
    let fini = false;
    const conclure = () => {
      if (fini) return;
      fini = true;
      const requete = res.statusCode < 300
        ? pool.query(`UPDATE operations_sync SET statut = 'TERMINEE', code_http = $1, reponse = $2, termine_le = NOW() WHERE id = $3`,
          [res.statusCode, JSON.stringify(corps ?? {}), id])
        : pool.query('DELETE FROM operations_sync WHERE id = $1', [id]);
      requete.catch(err => console.error('operations_sync :', err.message));
    };
    res.on('finish', conclure);
    res.on('close', conclure);
    next();
  };
}

module.exports = { idempotence };
