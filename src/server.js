require('./env'); // .env (RÉEL) ou .env.test (TEST, option --test)
const createApp = require('./app');
const pool = require('./db/pool');

const app = createApp(pool);
const PORT = process.env.PORT || 3001;
// HTTPS direct : TLS_CERT et TLS_KEY (chemins des fichiers) dans .env. Sinon HTTP — et HTTPS assuré par un
// proxy (Caddy, nginx, hébergeur) avec TRUST_PROXY=1 : voir DEPLOIEMENT.md.
if (process.env.TLS_CERT && process.env.TLS_KEY) {
  const fs = require('fs');
  require('https').createServer({ cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) }, app)
    .listen(PORT, () => console.log(`TinOR API V4 (HTTPS) démarrée sur le port ${PORT}`));
} else {
  app.listen(PORT, () => console.log(`TinOR API V4 démarrée sur le port ${PORT}`));
}
