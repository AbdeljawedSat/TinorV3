// ============================================================================
// Génère un jeu de données de test COMPLET sur une base vide, en passant par
// l'API réelle (pas du SQL brut) — garantit une numérotation de lots correcte,
// des mouvements de stock cohérents, et des totaux de facture justes, exactement
// comme si un utilisateur avait rempli l'application à la main.
//
// Pré-requis : l'API doit tourner (npm start) ET avoir déjà été initialisée
// avec `npm run migrate` + `npm run seed` (catégories/unités/formats/admin).
//
// Usage :
//   node scripts/seed_test_complet.js
//   (ou avec une autre URL : API_URL=http://127.0.0.1:3001/api node scripts/seed_test_complet.js)
// ============================================================================

const API = process.env.API_URL || 'http://127.0.0.1:3001/api';
let TOKEN = '';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });

async function main() {
  console.log('=== Connexion ===');
  const login = await post('/auth/login', { username: 'admin', password: 'changeme' });
  TOKEN = login.token;
  console.log('OK, connecté en tant que', login.user?.username || 'admin');

  console.log('\n=== Référentiels ===');
  const categories = await api('/categories');
  const unites = await api('/unites');
  const formats = await api('/formats');
  const catId = (code) => categories.find(c => c.code === code)?.id;
  const uniteId = (code) => unites.find(u => u.code === code)?.id;
  const formatId = (code) => formats.find(f => f.code === code)?.id;

  // Format 80g manquant par défaut — on le crée pour les savons.
  let format80g = formats.find(f => f.code === '80g');
  if (!format80g) {
    format80g = await post('/formats', { code: '80g', nom: '80 g', poids: 80, unite_id: uniteId('kg') });
  }

  console.log('\n=== Identité de facturation ===');
  await put('/settings', {
    entreprise_nom: 'STE JAS — Les Jardins de Jerba',
    entreprise_adresse: 'Djerba Midoun, Tunisie',
    entreprise_telephone: '93 340 008',
    entreprise_email: 'contact@lesjardinsdejerba.com',
    entreprise_matricule_fiscal: '0985207/N/NM',
    facture_couleur: '#A97D2F',
  });

  console.log('\n=== Locaux ===');
  const locaux = await api('/locaux');
  let stock1 = locaux.find(l => l.code === 'STOCK1');
  let atelier = locaux.find(l => l.code === 'ATELIER');
  if (!stock1) stock1 = await post('/locaux', { code: 'STOCK1', nom: 'Entrepôt Principal', type_local: 'STOCK' });
  if (!atelier) atelier = await post('/locaux', { code: 'ATELIER', nom: 'Atelier Djerba', type_local: 'PRODUCTION' });

  console.log('\n=== Employés ===');
  const emp1 = await post('/employes', { matricule: 'EMP-001', nom: 'Ben Salah', prenom: 'Karim', poste: 'Presseur', salaire_jour: 40 });
  const emp2 = await post('/employes', { matricule: 'EMP-002', nom: 'Trabelsi', prenom: 'Sami', poste: 'Conditionneur', salaire_jour: 38 });

  console.log('\n=== Certificat Bio ===');
  const certif = await post('/certificats', {
    numero: 'BIO-2026-014', organisme: 'ECOCERT',
    date_delivrance: '2026-01-01', date_expiration: '2027-01-01',
    portee: 'Huiles vierges — parcelles Djerba Midoun',
  });

  console.log('\n=== Fournisseurs ===');
  const fourParcelle = await post('/fournisseurs', {
    nom: 'Parcelle Sésame Djerba', type: 'parcelle', localisation: 'Midoun, Djerba',
    statut_bio: 'certifie', certificat_id: certif.id, telephone: '98 111 222',
  });
  const fourEmballage = await post('/fournisseurs', {
    nom: 'Emballages du Sud SARL', type: 'emballage', localisation: 'Sfax',
    matricule_fiscal: '1122334/A/M/000', telephone: '74 555 666',
  });
  const fourExterne = await post('/fournisseurs', {
    nom: 'Négoce Huiles Tunisie', type: 'fournisseur_externe', localisation: 'Tunis',
    matricule_fiscal: '5566778/B/M/000',
  });

  console.log('\n=== Produits : matière première ===');
  const mpSesame = await post('/produits', {
    nom: 'Graines de Sésame', categorie_id: catId('HUILE'), unite_id: uniteId('kg'),
    type_article: 'MATIERE_PREMIERE', stockable: true, achetable: true,
  });
  const mpNigelle = await post('/produits', {
    nom: 'Graines de Nigelle', categorie_id: catId('HUILE'), unite_id: uniteId('kg'),
    type_article: 'MATIERE_PREMIERE', stockable: true, achetable: true,
  });

  console.log('\n=== Produits : vrac (issus du pressage) ===');
  const vracSesame = await post('/produits', {
    nom: 'Huile de Sésame — Vrac', categorie_id: catId('HUILE'), unite_id: uniteId('litre'),
    type_article: 'PRODUIT_FABRIQUE', stockable: true, fabriquable: true,
  });
  const vracNigelle = await post('/produits', {
    nom: 'Huile de Nigelle — Vrac', categorie_id: catId('HUILE'), unite_id: uniteId('litre'),
    type_article: 'PRODUIT_FABRIQUE', stockable: true, fabriquable: true,
  });
  const vracSavon = await post('/produits', {
    nom: 'Pâte à Savon Olive — Vrac', categorie_id: catId('SAVON'), unite_id: uniteId('kg'),
    type_article: 'PRODUIT_FABRIQUE', stockable: true, fabriquable: true,
  });

  console.log('\n=== Produits : conditionnés (vendables) ===');
  const sesame30 = await post('/produits', {
    nom: 'Huile de Sésame — Flacon 30ml', categorie_id: catId('HUILE'), unite_id: uniteId('unite'),
    format_id: formatId('30ml'), produit_source_id: vracSesame.id,
    type_article: 'PRODUIT_FABRIQUE', vendable: true, stockable: true, prix_vente: 9.5,
  });
  const sesame10 = await post('/produits', {
    nom: 'Huile de Sésame — Flacon 10ml', categorie_id: catId('HUILE'), unite_id: uniteId('unite'),
    format_id: formatId('10ml'), produit_source_id: vracSesame.id,
    type_article: 'PRODUIT_FABRIQUE', vendable: true, stockable: true, prix_vente: 4.5,
  });
  const nigelle30 = await post('/produits', {
    nom: 'Huile de Nigelle — Flacon 30ml', categorie_id: catId('HUILE'), unite_id: uniteId('unite'),
    format_id: formatId('30ml'), produit_source_id: vracNigelle.id,
    type_article: 'PRODUIT_FABRIQUE', vendable: true, stockable: true, prix_vente: 12.0,
  });
  const savon80 = await post('/produits', {
    nom: 'Savon Olive — 80g', categorie_id: catId('SAVON'), unite_id: uniteId('unite'),
    format_id: format80g.id, produit_source_id: vracSavon.id,
    type_article: 'PRODUIT_FABRIQUE', vendable: true, stockable: true, prix_vente: 4.2,
  });

  console.log('\n=== Produits : emballages & consommables ===');
  const flacon30 = await post('/produits', {
    nom: 'Flacon verre 30ml', categorie_id: catId('EMBALLAGE'), unite_id: uniteId('unite'),
    format_id: formatId('30ml'), type_article: 'EMBALLAGE', achetable: true, stockable: true,
  });
  const etiquette = await post('/produits', {
    nom: 'Étiquette adhésive', categorie_id: catId('CONS'), unite_id: uniteId('unite'),
    type_article: 'CONSOMMABLE', achetable: true, stockable: true,
  });
  // Filtration : produit distinct du vrac de presse (créés en dernier pour garder les codes existants).
  const filtreeSesame = await post('/produits', {
    nom: 'Huile de Sésame — Filtrée', categorie_id: catId('HUILE'), unite_id: uniteId('litre'),
    type_article: 'PRODUIT_FABRIQUE', produit_source_id: vracSesame.id, stockable: true, fabriquable: true,
  });
  await post('/produits', {
    nom: 'Huile de Nigelle — Filtrée', categorie_id: catId('HUILE'), unite_id: uniteId('litre'),
    type_article: 'PRODUIT_FABRIQUE', produit_source_id: vracNigelle.id, stockable: true, fabriquable: true,
  });

  console.log('\n=== Remises ===');
  const remiseGros = await post('/remises', { nom: 'Gros volume', type: 'pourcentage', pourcentage: 10, categorie: 'client' });
  const remiseFidele = await post('/remises', { nom: 'Client fidèle', type: 'pourcentage', pourcentage: 5, categorie: 'client' });

  console.log('\n=== Clients ===');
  const clientPharma = await post('/clients', {
    nom: 'Pharmacie El Menzah', type: 'pharmacie', ville: 'Ariana',
    matricule_fiscal: '9988776/C/M/000', tel: '71 234 567', remise_id: remiseGros.id,
  });
  const clientParticulier = await post('/clients', {
    nom: 'Amira Ben Salah', type: 'particulier', ville: 'Tunis', tel: '22 345 678',
  });
  const clientRevendeur = await post('/clients', {
    nom: 'Boutique Bio Sud', type: 'revendeur', ville: 'Djerba',
    matricule_fiscal: '4433221/D/M/000', remise_id: remiseFidele.id,
  });

  console.log('\n=== Réceptions matière première ===');
  const recSesame = await post('/receptions', {
    fournisseur_id: fourParcelle.id, date_reception: '2026-08-01', local_id: stock1.id,
    lignes: [{ produit_id: mpSesame.id, quantite: 300 }],
  });
  const recNigelle = await post('/receptions', {
    fournisseur_id: fourParcelle.id, date_reception: '2026-08-02', local_id: stock1.id,
    lignes: [{ produit_id: mpNigelle.id, quantite: 150 }],
  });

  console.log('\n=== Achat + réception emballages ===');
  const achatEmb = await post('/achats', {
    fournisseur_id: fourEmballage.id, date_achat: '2026-08-01',
    lignes: [
      { produit_id: flacon30.id, quantite: 1000, prix_unitaire: 0.35 },
      { produit_id: etiquette.id, quantite: 2000, prix_unitaire: 0.05 },
    ],
  });
  await post('/receptions', {
    fournisseur_id: fourEmballage.id, achat_id: achatEmb.id, date_reception: '2026-08-03', local_id: stock1.id,
    lignes: [
      { produit_id: flacon30.id, quantite: 1000 },
      { produit_id: etiquette.id, quantite: 2000 },
    ],
  });

  console.log('\n=== Presse ===');
  const pSesame = await post('/presse', {
    date: '2026-08-04', produit_id: vracSesame.id, lot_source_id: recSesame.lignes[0].lot_id,
    quantite_matiere_utilisee: 200, quantite_produite: 70, employe_id: emp1.id,
  });
  const pNigelle = await post('/presse', {
    date: '2026-08-05', produit_id: vracNigelle.id, lot_source_id: recNigelle.lignes[0].lot_id,
    quantite_matiere_utilisee: 100, quantite_produite: 32, employe_id: emp1.id,
  });

  console.log('\n=== Filtration ===');
  const fSesame = await post('/filtration', {
    date: '2026-08-06', produit_id: filtreeSesame.id,
    sources: [{ lot_presse_id: pSesame.id, quantite_utilisee: 60 }],
    quantite_produite: 55, employe_id: emp1.id,
  });

  console.log('\n=== Conditionnement ===');
  await post('/conditionnement', {
    date: '2026-08-07', produit_id: sesame30.id, format_id: formatId('30ml'), qty: 800,
    sources: [{ lot_filtration_id: fSesame.id, quantite_utilisee: 24 }], employe_id: emp2.id,
  });
  await post('/conditionnement', {
    date: '2026-08-08', produit_id: sesame10.id, format_id: formatId('10ml'), qty: 500,
    sources: [{ lot_filtration_id: fSesame.id, quantite_utilisee: 5 }], employe_id: emp2.id,
  });
  await post('/conditionnement', {
    date: '2026-08-09', produit_id: nigelle30.id, format_id: formatId('30ml'), qty: 400,
    sources: [{ lot_presse_id: pNigelle.id, quantite_utilisee: 12 }], employe_id: emp2.id,
  });

  console.log('\n=== Savon : réception de pâte à savon en vrac + conditionnement direct ===');
  // Le savon en vrac ne passe ni par la presse ni par la filtration (réservées
  // aux graines → huiles) : il entre en stock par réception, puis il est
  // conditionné directement depuis son lot.
  const recSavon = await post('/receptions', {
    fournisseur_id: fourExterne.id, date_reception: '2026-08-05', local_id: stock1.id,
    lignes: [{ produit_id: vracSavon.id, quantite: 76 }],
  });
  await post('/conditionnement', {
    date: '2026-08-11', produit_id: savon80.id, format_id: format80g.id, qty: 900,
    sources: [{ lot_id: recSavon.lignes[0].lot_id, quantite_utilisee: 72 }], employe_id: emp2.id,
  });

  console.log('\n=== Commandes & Factures ===');
  const cmd1 = await post('/commandes', {
    client_id: clientPharma.id,
    lignes: [
      { produit_id: sesame30.id, qty: 20, remise_id: remiseGros.id },
      { produit_id: savon80.id, qty: 50, remise_id: remiseGros.id },
    ],
  });
  const fac1 = await post('/factures', { commande_id: cmd1.id });
  await post(`/factures/${fac1.id}/paiements`, { date_paiement: '2026-08-12', montant: fac1.total_ttc, mode: 'virement', reference: 'VIR-0012' });

  const cmd2 = await post('/commandes', {
    client_id: clientParticulier.id,
    lignes: [
      { produit_id: sesame10.id, qty: 3 },
      { produit_id: nigelle30.id, qty: 1 },
    ],
  });
  const fac2 = await post('/factures', { commande_id: cmd2.id });
  await post(`/factures/${fac2.id}/paiements`, { date_paiement: '2026-08-13', montant: fac2.total_ttc / 2, mode: 'especes' }); // paiement partiel volontaire

  const cmd3 = await post('/commandes', {
    client_id: clientRevendeur.id,
    lignes: [{ produit_id: savon80.id, qty: 100, remise_id: remiseFidele.id }],
  });
  await post('/factures', { commande_id: cmd3.id }); // facture non payée, volontairement

  console.log('\n✅ Terminé. Jeu de données complet créé : matière première, presse, filtration,');
  console.log('   conditionnement (huile ; savon en vrac conditionné directement), achats, réceptions, 3 commandes/factures');
  console.log('   (payée, partiellement payée, non payée), remises, certificat bio.');
}

main().catch(err => { console.error('❌ ERREUR :', err.message); process.exit(1); });
