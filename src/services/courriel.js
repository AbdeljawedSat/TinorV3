// Envoi de courriels (factures). Réglages dans .env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
// SMTP_HOST=json : n'envoie rien, renvoie le message construit (tests).
const nodemailer = require('nodemailer');

const ADRESSE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;
const configure = () => !!process.env.SMTP_HOST;

function transport() {
  if (process.env.SMTP_HOST === 'json') return nodemailer.createTransport({ jsonTransport: true });
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } : undefined,
  });
}

function destinataires(a) {
  const liste = (Array.isArray(a) ? a : String(a || '').split(/[;,]/)).map(x => String(x).trim()).filter(Boolean);
  if (!liste.length) throw Object.assign(new Error('Adresse e-mail du destinataire requise.'), { status: 400 });
  if (liste.length > 3) throw Object.assign(new Error('3 destinataires au maximum.'), { status: 400 });
  const mauvaise = liste.find(x => !ADRESSE.test(x));
  if (mauvaise) throw Object.assign(new Error(`Adresse e-mail invalide : ${mauvaise}`), { status: 400 });
  return liste;
}

async function envoyer({ a, sujet, texte, html, pieces }) {
  const liste = destinataires(a);
  if (!configure()) throw Object.assign(new Error('L\'envoi d\'e-mails n\'est pas configuré sur le serveur (SMTP_HOST, SMTP_USER… dans .env : voir DEPLOIEMENT.md).'), { status: 503 });
  const info = await transport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'tinor@localhost', to: liste.join(', '), subject: sujet, text: texte, html, attachments: pieces,
  });
  return { destinataires: liste, id: info.messageId, apercu: process.env.SMTP_HOST === 'json' ? info.message : undefined };
}

module.exports = { destinataires, envoyer, configure, ADRESSE };
