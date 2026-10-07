// Petit client HTTP pour les tests de stock (API démarrée + base initialisée avec npm run seed).
const API = process.env.API_URL || 'http://127.0.0.1:3001/api'; let TOKEN = '';
async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, body: opts.body && JSON.stringify(opts.body),
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...(opts.headers || {}) } });
  const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: res.status, data: d, headers: res.headers };
}
async function login() { TOKEN = (await api('/auth/login', { method: 'POST', body: { username: 'admin', password: 'changeme' } })).data.token; }
function check(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ÉCHEC ') + msg); if (!cond) process.exitCode = 1; }
module.exports = { api, login, check };
