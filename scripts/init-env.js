// Crée .env à partir de .env.example s'il n'existe pas encore, avec une clé
// JWT aléatoire. Ne touche jamais un .env existant. Utilisé par `npm run setup`.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cible = path.join(__dirname, '..', '.env');
if (fs.existsSync(cible)) {
  console.log('✓ .env déjà présent, conservé tel quel.');
} else {
  const modele = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  fs.writeFileSync(cible, modele.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`));
  console.log('✓ .env créé à partir de .env.example (clé JWT générée).');
}
