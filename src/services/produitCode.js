// Code produit à 2 chiffres suivant (même séquence que la création de produit).
async function codeProduitSuivant(pool) {
  const seq = await pool.query("UPDATE sequences SET `last_value` = `last_value` + 1 WHERE name = 'produit_code_seq'");
  if (!seq.affectedRows) await pool.query("INSERT INTO sequences (name, `last_value`) VALUES ('produit_code_seq', 1)");
  for (;;) {
    const cur = (await pool.query("SELECT `last_value` AS v FROM sequences WHERE name = 'produit_code_seq'")).rows[0].v;
    const code = String(cur).padStart(2, '0');
    if (!(await pool.query('SELECT 1 FROM produits WHERE code = $1', [code])).rows.length) return code;
    await pool.query("UPDATE sequences SET `last_value` = `last_value` + 1 WHERE name = 'produit_code_seq'");
  }
}

// Crée un produit fini fabriqué (recette, conditionnement) et renvoie son id.
async function creerProduitFini(pool, { nom, categorie_id, unite_id, format_id, produit_source_id, prix_vente, tva, bio_eligible }) {
  nom = String(nom || '').trim();
  if (!nom) { const e = new Error('Le nom du nouveau produit est requis.'); e.status = 400; throw e; }
  if ((await pool.query('SELECT 1 FROM produits WHERE nom = $1', [nom])).rows.length) {
    const e = new Error(`Le produit « ${nom} » existe déjà : choisissez-le dans la liste.`); e.status = 400; throw e;
  }
  const code = await codeProduitSuivant(pool);
  const ins = await pool.query(
    `INSERT INTO produits (code, nom, categorie_id, unite_id, format_id, type_article, produit_source_id, vendable, fabriquable, stockable, actif, bio_eligible, prix_vente, tva)
     VALUES ($1,$2,$3,$4,$5,'PRODUIT_FABRIQUE',$6,TRUE,TRUE,TRUE,TRUE,$7,$8,$9)`,
    [code, nom, categorie_id, unite_id, format_id || null, produit_source_id || null, !!bio_eligible, prix_vente ?? null, tva ?? 19]);
  return ins.insertId;
}

module.exports = { codeProduitSuivant, creerProduitFini };
