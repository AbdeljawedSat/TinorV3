// Exécute un handler Express dans une transaction : toutes ses écritures sont
// validées ensemble, ou annulées ensemble. Sans ça, une erreur au milieu d'une
// opération de stock (ex : 2e mouvement refusé) laissait un lot décrémenté sans
// mouvement correspondant — source d'écarts de stock.
//
// Le handler reçoit la connexion transactionnelle en 4e argument ; en le nommant
// `pool`, le code existant (pool.query, nextNumero(pool, …), consumeLot(pool, …))
// passe par la transaction sans réécriture.
//
// La réponse n'est envoyée qu'APRÈS le COMMIT (le client ne peut pas relire des
// données pas encore validées) ; une réponse ≥ 400 ou une erreur entraîne un ROLLBACK.
function enTransaction(rootPool, handler) {
  return async (req, res, next) => {
    const conn = await rootPool.connect();
    const jsonOrigine = res.json.bind(res);
    const endOrigine = res.end.bind(res);
    let envoiDiffere = null;
    let erreur = null;
    res.json = (body) => { envoiDiffere = () => jsonOrigine(body); return res; };
    res.end = (...args) => { envoiDiffere = () => endOrigine(...args); return res; };
    const restaurer = () => { res.json = jsonOrigine; res.end = endOrigine; };
    try {
      await conn.query('START TRANSACTION');
      await handler(req, res, (err) => { erreur = err || erreur; }, conn);
      if (erreur || res.statusCode >= 400) await conn.query('ROLLBACK');
      else await conn.query('COMMIT');
    } catch (err) {
      erreur = err;
      await conn.query('ROLLBACK').catch(() => {});
    } finally {
      conn.release();
      restaurer();
    }
    if (erreur) return next(erreur);
    if (envoiDiffere) envoiDiffere();
  };
}

// Erreur métier renvoyée en 409 par le gestionnaire d'erreurs d'Express (err.status).
class StockInsuffisant extends Error {
  constructor(message) { super(message); this.status = 409; }
}

module.exports = { enTransaction, StockInsuffisant };
