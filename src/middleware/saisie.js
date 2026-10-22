// Défense en profondeur contre l'injection de code dans les textes saisis (nom de client, notes…) : une balise HTML
// (« <script », « <img »…) est refusée à l'enregistrement. L'interface échappe de toute façon l'affichage ; ceci
// empêche aussi qu'un texte piégé n'atteigne une autre page ou un export.
const BALISE = /<\s*\/?\s*[a-zA-Z!?]/;
const EXEMPTES = [/^\/api\/exports/, /^\/api\/auth\/login/, /^\/api\/sync\/conflits/]; // conflits : texte déjà nettoyé par la route

function contientBalise(v, profondeur = 0) {
  if (typeof v === 'string') return BALISE.test(v);
  if (profondeur > 6 || v === null || typeof v !== 'object') return false;
  return Object.values(v).some(x => contientBalise(x, profondeur + 1));
}

function refuserBalises(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || EXEMPTES.some(r => r.test(req.originalUrl))) return next();
  if (contientBalise(req.body)) return res.status(400).json({ error: 'Le texte contient une balise HTML (« < » suivi d\'une lettre) : retirez-la.' });
  next();
}

module.exports = { refuserBalises, contientBalise };
