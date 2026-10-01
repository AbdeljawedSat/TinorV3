require('dotenv').config();
const createApp = require('./app');
const pool = require('./db/pool');

const app = createApp(pool);
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TinOR API V3 démarrée sur le port ${PORT}`));
