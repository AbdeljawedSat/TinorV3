// ============================================================================
// Import des registres Excel des Jardins de Jerba dans TinOR, avec l'historique :
//   graines (lot fournisseur) → presse → filtration → mélange (lot fini yy x1x1 x2x2)
//   → flacons 10 / 30 ml → ventes ; pertes notées au registre.
// N° de lot et dates d'origine conservés ; traçabilité complète dans TinOR.
//
//   npm run importer:registres -- "C:\chemin\BD_tinorexel.xlsx"              → VÉRIFICATION seule
//   npm run importer:registres -- "C:\chemin\BD_tinorexel.xlsx" --appliquer  → écrit dans la base
//   (ajoutez --test pour la version TEST)
//
// La vérification n'écrit rien : elle produit un rapport Excel (même dossier que le
// fichier, « …_rapport_import.xlsx ») avec les anomalies corrigées, le plan
// d'import et le stock calculé. L'import est fait en une seule transaction (tout
// ou rien). Un lot déjà présent dans TinOR (même n°) n'est ni recréé ni modifié :
// les étapes suivantes s'y rattachent sans toucher à sa quantité.
// ============================================================================
const path = require('path');
const fs = require('fs');
const env = require('../src/env');
const ExcelJS = require('exceljs');
const { analyserRegistres } = require('../src/services/registresJJ');
const { nextNumero, recalerCompteursJJ } = require('../src/services/lotService');
const { cleGraine, cleHuile, estGraine, estHuileVrac, estHuileFiltree } = require('../src/services/graines');
const { codeProduitSuivant } = require('../src/services/produitCode');

const HUILE = 'figue de barbarie';
const NOMS = {
  mp: 'Pépins de figue de barbarie',
  vrac: 'Huile de pépins de figue de barbarie — Vrac',
  filtre: 'Huile de pépins de figue de barbarie — Filtrée',
  flacon: (ml) => `Huile de pépins de figue de barbarie — Flacon ${ml}ml`,
};
const arr = (n) => Math.round(Number(n) * 1000) / 1000;
const plusAns = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;

async function main() {
  const fichier = process.argv.slice(2).find(a => !a.startsWith('--'));
  const appliquer = process.argv.includes('--appliquer');
  if (!fichier || !fs.existsSync(fichier)) {
    console.error('Usage : npm run importer:registres -- "chemin\\du\\fichier.xlsx" [--appliquer] [--test]');
    process.exit(1);
  }
  const fichierCorrections = (process.argv.find(x => x.startsWith('--corrections=')) || '').slice(14) || path.join(__dirname, 'registres', 'corrections.json');
  const corrections = fs.existsSync(fichierCorrections) ? JSON.parse(fs.readFileSync(fichierCorrections, 'utf8')) : {};
  const a = await analyserRegistres(fichier, corrections);
  a.fournisseurs = corrections.fournisseurs || [];
  const pool = require('../src/db/pool');
  const base = process.env.DB_NAME;
  console.log(`\nRegistres : ${path.basename(fichier)}  →  base ${base} (${env.test ? 'TEST' : 'RÉEL'})`);
  console.log(`  ${a.lotsMP.length} lots de graines · ${a.presse.length} pressages · ${a.filtration.length} filtrations · ${a.melanges.length} mélanges (lots finis) · ${a.conditionnements.length} conditionnements · ${a.ventes.length} lignes de vente · ${a.pertes.length} pertes`);
  console.log(`  ${a.anomalies.length} anomalie(s) corrigée(s) — détail dans le rapport`);

  const conn = await pool.connect();
  const journal = []; // ce qui est (ou serait) fait
  const deja = [];
  try {
    await conn.query('START TRANSACTION');
    const q = async (sql, p) => (await conn.query(sql, p)).rows;
    const un = async (sql, p) => (await q(sql, p))[0];

    // ---- Référentiels : unités, catégorie, formats, produits (trouvés ou créés)
    const unite = async (code) => (await un('SELECT id FROM unites WHERE code = $1 OR symbole = $1 ORDER BY id LIMIT 1', [code]))?.id;
    const [uKg, uL, uU] = [await unite('kg'), await unite('L') || await unite('litre'), await unite('u') || await unite('unite')];
    const cat = (await un("SELECT id FROM categories WHERE code = 'HUILE' OR nom LIKE 'Huile%' ORDER BY id LIMIT 1"))?.id;
    if (!uKg || !uL || !uU || !cat) throw new Error('Unités (kg, L, u) ou catégorie « Huiles » absentes de la base.');
    const produits = await q('SELECT * FROM produits');
    const creer = async (nom, champs) => {
      const code = await codeProduitSuivant(conn);
      const r = await conn.query(
        `INSERT INTO produits (code, nom, categorie_id, unite_id, format_id, type_article, produit_source_id, vendable, fabriquable, stockable, actif, bio_eligible, tva)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,TRUE,FALSE,19)`,
        [code, nom, cat, champs.unite, champs.format || null, champs.type, champs.source || null, !!champs.vendable, champs.type !== 'MATIERE_PREMIERE']);
      journal.push(['Produit créé', nom]);
      const p = { id: r.insertId, nom, format_id: champs.format || null, type_article: champs.type };
      produits.push(p); return p;
    };
    const pMP = produits.find(p => estGraine(p) && cleGraine(p.nom) === HUILE) || await creer(NOMS.mp, { unite: uKg, type: 'MATIERE_PREMIERE' });
    const pVrac = produits.find(p => estHuileVrac(p) && cleHuile(p.nom) === HUILE) || await creer(NOMS.vrac, { unite: uL, type: 'PRODUIT_FABRIQUE' });
    const pFiltre = produits.find(p => estHuileFiltree(p) && cleHuile(p.nom) === HUILE) || await creer(NOMS.filtre, { unite: uL, type: 'PRODUIT_FABRIQUE', source: pVrac.id });
    const pFlacon = {};
    for (const ml of [...new Set(a.conditionnements.map(c => c.ml))]) {
      let f = await un('SELECT id FROM formats WHERE volume = $1 ORDER BY id LIMIT 1', [ml]);
      if (!f) {
        const r = await conn.query('INSERT INTO formats (code, nom, volume, unite_id, actif) VALUES ($1,$2,$3,$4,1)', [`${ml}ml`, `${ml} ml`, ml, await unite('ml')]);
        f = { id: r.insertId }; journal.push(['Format créé', `${ml} ml`]);
      }
      pFlacon[ml] = produits.find(p => p.format_id === f.id && cleHuile(p.nom) === HUILE && !/m[ée]lange/i.test(p.nom))
        || await creer(NOMS.flacon(ml), { unite: uU, type: 'PRODUIT_FABRIQUE', format: f.id, source: pFiltre.id, vendable: true });
    }

    // ---- Écritures de stock datées
    const lots = new Map(); // numéro → { id, existant }
    const lotExistant = async (numero) => {
      if (lots.has(numero)) return lots.get(numero);
      const l = await un('SELECT id FROM lots WHERE numero_lot = $1', [numero]);
      if (l) { const x = { id: l.id, existant: true }; lots.set(numero, x); deja.push(numero); return x; }
      return null;
    };
    const mvt = async ({ type, sens, produit, lot, quantite, date, source, note }) => conn.query(
      `INSERT INTO stock_mouvements (numero, date_mouvement, type_mouvement, sens, produit_id, lot_id, quantite, source_type, source_id, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$2)`,
      [await nextNumero(conn, 'mouvement_seq', 'MVT'), `${date} 12:00:00`, type, sens, produit, lot, arr(quantite), source?.[0] || 'import_registres', source?.[1] || null, note || null]);
    const nouveauLot = async ({ numero, produit, origine, quantite, date, expiration, champs, lotFournisseur, note }) => {
      const ex = await lotExistant(numero);
      if (ex) return ex;
      const r = await conn.query(
        `INSERT INTO lots (produit_id, numero_lot, origine, lot_fournisseur, bio_status, local_id, date_production, date_expiration,
           quantite_initiale, quantite_actuelle, notes, champs_perso, created_at)
         VALUES ($1,$2,$3,$4,'A_VERIFIER',(SELECT MIN(id) FROM locaux),$5,$6,$7,$7,$8,$9,$10)`,
        [produit, numero, origine, lotFournisseur || null, date, expiration || null, arr(quantite), note || null,
         JSON.stringify({ import_registres: true, ...(champs || {}) }), `${date} 12:00:00`]);
      await conn.query(`INSERT INTO lot_statuts_historique (lot_id, statut, motif, date_debut) VALUES ($1,'LIBERE',$2,$3)`, [r.insertId, 'Import des registres Excel', `${date} 12:00:00`]);
      const x = { id: r.insertId, existant: false, produit };
      lots.set(numero, x);
      return x;
    };
    // Consommation d'un lot source : jamais en dessous de zéro ; un lot déjà présent avant l'import n'est pas modifié.
    const consommer = async ({ source, fils, quantite, date, type, note, ref }) => {
      const s = lots.get(source);
      if (!s) throw new Error(`Lot source ${source} introuvable.`);
      await conn.query('INSERT INTO lot_origines (lot_fils_id, lot_source_id, quantite_utilisee) VALUES ($1,$2,$3)', [fils.id, s.id, arr(quantite)]);
      if (s.existant) return;
      const l = await un('SELECT quantite_actuelle, produit_id FROM lots WHERE id = $1', [s.id]);
      const q2 = Math.min(arr(quantite), Number(l.quantite_actuelle));
      if (arr(quantite) - q2 > 0.0005) journal.push(['Écart', `${source} : ${arr(quantite)} demandé, ${Number(l.quantite_actuelle)} disponible — ramené au disponible`]);
      if (q2 <= 0) return;
      await conn.query('UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2', [q2, s.id]);
      await mvt({ type, sens: 'SORTIE', produit: l.produit_id, lot: s.id, quantite: q2, date, source: ref, note });
    };
    const entree = (lot, produit, quantite, date, type, ref, note) => (lot.existant ? null : mvt({ type, sens: 'ENTREE', produit, lot: lot.id, quantite, date, source: ref, note }));

    // 1. Fournisseurs et lots de graines (n° du lot fournisseur), avec leur réception.
    //    Quantité reçue : corrections.json (quantites_recues_kg), sinon quantité pressée.
    const fournisseurDuLot = new Map();
    for (const f of corrections.fournisseurs || []) {
      let four = await un('SELECT id FROM fournisseurs WHERE LOWER(nom) = LOWER($1)', [f.nom]);
      if (!four) {
        const r = await conn.query(`INSERT INTO fournisseurs (nom, type, localisation, notes) VALUES ($1,'fournisseur_externe',$2,$3)`, [f.nom, f.localisation || null, 'Créé par l\'import des registres']);
        four = { id: r.insertId }; journal.push(['Fournisseur créé', `${f.nom} — ${f.localisation || ''}`]);
      }
      for (const lot of f.lots || []) fournisseurDuLot.set(String(lot).toUpperCase(), { id: four.id, nom: f.nom });
    }
    const recues = corrections.quantites_recues_kg || {};
    const local = (await un('SELECT MIN(id) AS id FROM locaux')).id;
    for (const m of a.lotsMP) {
      const four = fournisseurDuLot.get(m.numero.toUpperCase());
      if (!four) journal.push(['Écart', `lot de graines ${m.numero} : fournisseur non indiqué (corrections.json → fournisseurs)`]);
      const recu = Number(recues[m.numero]) > 0 ? Number(recues[m.numero]) : m.kg;
      if (recu < m.kg) throw new Error(`Lot ${m.numero} : ${recu} kg reçus mais ${m.kg} kg pressés.`);
      const ex = await lotExistant(m.numero);
      if (ex) { // lot déjà saisi : on complète seulement son fournisseur s'il manque
        if (four) await conn.query('UPDATE lots SET fournisseur_id = COALESCE(fournisseur_id, $1), lot_fournisseur = COALESCE(lot_fournisseur, $2) WHERE id = $3', [four.id, m.numero, ex.id]);
        continue;
      }
      const l = await nouveauLot({ numero: m.numero, produit: pMP.id, origine: 'RECEPTION_MP', quantite: recu, date: m.date, lotFournisseur: m.numero,
        note: recues[m.numero] ? 'Reçu avant TinOR (import des registres).' : 'Reçu avant TinOR (import des registres) : quantité reçue inconnue = quantité pressée ; à corriger si du stock reste.' });
      if (four) {
        await conn.query('UPDATE lots SET fournisseur_id = $1 WHERE id = $2', [four.id, l.id]);
        const rec = await conn.query(`INSERT INTO receptions (numero, fournisseur_id, date_reception, local_id, statut, notes) VALUES ($1,$2,$3,$4,'liberee',$5)`,
          [await nextNumero(conn, 'reception_seq', 'REC'), four.id, m.date, local, `Lot ${m.numero} — import des registres`]);
        await conn.query('INSERT INTO reception_lignes (reception_id, produit_id, lot_id, quantite, lot_fournisseur) VALUES ($1,$2,$3,$4,$5)', [rec.insertId, pMP.id, l.id, recu, m.numero]);
        l.reception = ['receptions', rec.insertId];
      }
      await entree(l, pMP.id, recu, m.date, 'RECEPTION', l.reception, `Import registres — réception ${four ? four.nom : ''}`);
      journal.push(['Graines', `${m.numero} (${four ? four.nom : 'fournisseur ?'}) : ${recu} kg reçus, ${m.kg} kg pressés → reste ${arr(recu - m.kg)} kg`]);
    }
    // 2. Presse
    for (const p of a.presse) {
      const ex = await lotExistant(p.numero);
      const l = ex || await nouveauLot({ numero: p.numero, produit: pVrac.id, origine: 'PRESSE', quantite: p.litres, date: p.date, champs: { outil: p.outil } });
      if (ex) continue;
      const lp = await conn.query(
        `INSERT INTO lots_presse (date, produit_id, lot_id, quantite_matiere_utilisee, quantite_produite, rendement_reel, numero_lot, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [p.date, pVrac.id, l.id, p.kg, p.litres, p.kg ? p.litres / p.kg : null, p.numero, `Registre de presse ligne ${p.n} — outil ${p.outil ?? '—'}`, `${p.date} 12:00:00`]);
      l.presse_id = lp.insertId;
      await consommer({ source: p.lot_mp, fils: l, quantite: p.kg, date: p.date, type: 'CONSOMMATION', ref: ['lots_presse', l.id] });
      await entree(l, pVrac.id, p.litres, p.date, 'PRODUCTION', ['lots_presse', l.id], 'Import registres — pressage');
      await recalerCompteursJJ(conn, { numero: p.numero, etape: 'PRESSE', date: p.date });
      journal.push(['Presse', `${p.numero} : ${p.kg} kg → ${p.litres} L`]);
    }
    // 3. Filtration
    for (const f of a.filtration) {
      const ex = await lotExistant(f.numero);
      if (ex) continue;
      const src = await lotExistant(f.presse);
      const l = await nouveauLot({ numero: f.numero, produit: pFiltre.id, origine: 'FILTRATION', quantite: f.obtenu, date: f.date, champs: { filtre: f.filtre } });
      const lf = await conn.query(
        `INSERT INTO lots_filtration (date, produit_id, lot_id, filtre_utilise, quantite_dechet, quantite_produite, rendement_reel, numero_lot, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [f.date, pFiltre.id, l.id, f.filtre, arr(f.litres - f.obtenu), f.obtenu, f.litres ? f.obtenu / f.litres : null, f.numero,
         `Registre de filtration n° ${f.n}${f.numero_ecrit ? ` (écrit ${f.numero_ecrit})` : ''}`, `${f.date} 12:00:00`]);
      const lp = await un('SELECT id FROM lots_presse WHERE lot_id = $1', [src.id]);
      if (lp) await conn.query('INSERT INTO lots_filtration_sources (lot_filtration_id, lot_presse_id, quantite_utilisee) VALUES ($1,$2,$3)', [lf.insertId, lp.id, f.litres]);
      await consommer({ source: f.presse, fils: l, quantite: f.litres, date: f.date, type: 'CONSOMMATION', ref: ['lots_filtration', l.id] });
      await entree(l, pFiltre.id, f.obtenu, f.date, 'PRODUCTION', ['lots_filtration', l.id], 'Import registres — filtration');
      await recalerCompteursJJ(conn, { numero: f.numero, etape: 'FILTRATION', date: f.date });
      journal.push(['Filtration', `${f.presse} → ${f.numero} : ${f.litres} L → ${f.obtenu} L`]);
    }
    // 4. Mélanges = lots finis en vrac (huile filtrée), avant mise en flacons
    for (const m of a.melanges) {
      const ex = await lotExistant(m.numero);
      if (ex) continue;
      const premier = a.conditionnements.find(c => c.lot === m.numero);
      const l = await nouveauLot({ numero: m.numero, produit: pFiltre.id, origine: 'AUTRE', quantite: m.ml / 1000, date: m.date,
        expiration: premier?.duree_ans ? plusAns(m.date, premier.duree_ans) : null,
        champs: { etape: 'MELANGE', huiles: m.sources.map(s => `${s.lot} (${s.ml} ml)`) }, note: `Lot fini — mélange n° ${m.n} du registre` });
      for (const s of m.sources) await consommer({ source: s.lot, fils: l, quantite: s.ml / 1000, date: m.date, type: 'CONSOMMATION', ref: ['melange', l.id], note: `Mélange ${m.numero}` });
      await entree(l, pFiltre.id, m.ml / 1000, m.date, 'PRODUCTION', ['melange', l.id], 'Import registres — mélange');
      await recalerCompteursJJ(conn, { numero: m.numero, etape: 'CONDITIONNEMENT', date: m.date });
      journal.push(['Mélange', `${m.numero} : ${m.sources.map(s => `${s.lot} ${s.ml} ml`).join(' + ')} = ${m.ml} ml`]);
    }
    // 5. Conditionnements : un lot de flacons par lot fini et par format (« 082415-10ML »)
    for (const c of a.conditionnements) {
      const numero = `${c.lot}-${c.ml}ML`;
      const melange = lots.get(c.lot) || await lotExistant(c.lot);
      let l = await lotExistant(numero);
      if (l?.existant) continue;
      const produit = pFlacon[c.ml].id;
      if (!l) l = await nouveauLot({ numero, produit, origine: 'CONDITIONNEMENT', quantite: 0, date: c.date,
        expiration: c.duree_ans ? plusAns(c.date, c.duree_ans) : null, champs: { lot_fini: c.lot, format_ml: c.ml }, note: `Flacons ${c.ml} ml du lot fini ${c.lot}` });
      await conn.query('UPDATE lots SET quantite_initiale = quantite_initiale + $1, quantite_actuelle = quantite_actuelle + $1 WHERE id = $2', [c.unites, l.id]);
      const cd = await conn.query(
        `INSERT INTO conditionnements (date, produit_id, format_id, lot_id, qty, quantite_source_utilisee, note, created_at)
         VALUES ($1,$2,(SELECT format_id FROM produits WHERE id = $2),$3,$4,$5,$6,$7)`,
        [c.date, produit, l.id, c.unites, arr(c.unites * c.ml / 1000), `Registre produit fini ligne ${c.ligne} — lot fini ${c.lot}`, `${c.date} 12:00:00`]);
      await conn.query('INSERT INTO conditionnement_sources (conditionnement_id, lot_id, quantite_utilisee) VALUES ($1,$2,$3)', [cd.insertId, melange.id, arr(c.unites * c.ml / 1000)]);
      await consommer({ source: c.lot, fils: l, quantite: c.unites * c.ml / 1000, date: c.date, type: 'CONDITIONNEMENT', ref: ['conditionnements', cd.insertId], note: `${c.unites} × ${c.ml} ml` });
      await entree(l, produit, c.unites, c.date, 'CONDITIONNEMENT', ['conditionnements', cd.insertId], `Import registres — ${c.unites} × ${c.ml} ml`);
      journal.push(['Conditionnement', `${c.date} · ${numero} : ${c.unites} × ${c.ml} ml`]);
    }
    // 6. Pertes notées au registre (sur le reste du mélange)
    for (const p of a.pertes) {
      const l = lots.get(p.lot); if (!l || l.existant) continue;
      const reste = Number((await un('SELECT quantite_actuelle FROM lots WHERE id = $1', [l.id])).quantite_actuelle);
      const qte = Math.min(reste, p.ml / 1000); if (qte <= 0) continue;
      await conn.query('UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2', [qte, l.id]);
      await mvt({ type: 'PERTE', sens: 'SORTIE', produit: pFiltre.id, lot: l.id, quantite: qte, date: p.date, note: `Perte notée au registre : « ${p.remarque} »` });
      journal.push(['Perte', `${p.lot} : ${p.ml} ml le ${p.date}`]);
    }
    // 7. Ventes (sorties de stock datées ; sans facture : prix non notés dans le registre)
    for (const v of a.ventes) {
      const l = lots.get(`${v.lot}-${v.ml}ML`) || await lotExistant(`${v.lot}-${v.ml}ML`);
      if (!l) { journal.push(['Écart', `vente du ${v.date} : lot ${v.lot} en ${v.ml} ml introuvable — ignorée`]); continue; }
      if (l.existant) continue;
      const reste = Number((await un('SELECT quantite_actuelle FROM lots WHERE id = $1', [l.id])).quantite_actuelle);
      const qte = Math.min(reste, v.unites);
      if (qte < v.unites) journal.push(['Écart', `vente du ${v.date} (${v.client}) : ${v.unites} × ${v.ml} ml demandés, ${reste} en stock`]);
      if (qte <= 0) continue;
      await conn.query('UPDATE lots SET quantite_actuelle = quantite_actuelle - $1 WHERE id = $2', [qte, l.id]);
      await mvt({ type: 'VENTE', sens: 'SORTIE', produit: l.produit || pFlacon[v.ml].id, lot: l.id, quantite: qte, date: v.date,
        note: `Vente${v.n ? ` n° ${v.n}` : ''} — ${v.client || 'client'}${v.paiement ? ` · ${v.paiement}` : ''}` });
      journal.push(['Vente', `${v.date} · ${v.client} : ${qte} × ${v.ml} ml (${v.lot})`]);
    }
    // Lots à zéro → épuisés
    const nouveaux = [...lots.values()].filter(l => !l.existant).map(l => l.id);
    if (nouveaux.length) {
      const vides = (await q(`SELECT id FROM lots WHERE id IN (${nouveaux.join(',')}) AND quantite_actuelle <= 0 AND statut = 'LIBERE'`)).map(r => r.id);
      for (const id of vides) {
        await conn.query(`UPDATE lots SET statut = 'EPUISE' WHERE id = $1`, [id]);
        await conn.query(`INSERT INTO lot_statuts_historique (lot_id, statut, motif) VALUES ($1,'EPUISE','Stock épuisé (import des registres)')`, [id]);
      }
    }

    // Stock obtenu dans TinOR (lots de l'import)
    const ids = [...lots.values()].filter(l => !l.existant).map(l => l.id);
    const restant = ids.length ? await q(`SELECT l.numero_lot, p.nom, l.quantite_actuelle, u.symbole FROM lots l JOIN produits p ON p.id = l.produit_id LEFT JOIN unites u ON u.id = p.unite_id
      WHERE l.id IN (${ids.join(',')}) AND l.quantite_actuelle > 0 ORDER BY p.nom, l.numero_lot`) : [];

    await rapport(fichier, a, journal, deja, restant, appliquer);
    if (appliquer) { await conn.query('COMMIT'); console.log(`\n✓ Import terminé dans la base ${base}.`); }
    else { await conn.query('ROLLBACK'); console.log('\n• VÉRIFICATION seulement : rien n\'a été écrit. Relancez avec --appliquer pour importer.'); }
    const tot = (re) => restant.filter(r => re.test(r.nom)).reduce((t, r) => t + Number(r.quantite_actuelle), 0);
    if (!journal.length) console.log('  Rien de nouveau à importer : tout le contenu du fichier est déjà dans TinOR.');
    else console.log(`  Stock après import : vrac ${arr(tot(/vrac/i))} L · filtré ${arr(tot(/filtr/i))} L · flacons ${tot(/flacon/i)} u · graines ${arr(tot(/^p[ée]pins|^graines/i))} kg`);
    if (deja.length) console.log(`  ${deja.length} lot(s) déjà dans TinOR, gardés tels quels : ${deja.slice(0, 8).join(', ')}${deja.length > 8 ? '…' : ''}`);
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {});
    console.error('\n✗ Import annulé (rien n\'a été écrit) :', e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end?.().catch?.(() => {});
    process.exit(process.exitCode || 0);
  }
}

async function rapport(fichier, a, journal, deja, restant, applique) {
  const wb = new ExcelJS.Workbook();
  const ajout = (nom, entetes, lignes, largeurs) => {
    const s = wb.addWorksheet(nom);
    const h = s.addRow(entetes); h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB07A1E' } }; });
    lignes.forEach(l => s.addRow(l));
    largeurs.forEach((w, i) => { s.getColumn(i + 1).width = w; });
    s.views = [{ state: 'frozen', ySplit: 1 }];
  };
  ajout('Résumé', ['', ''], [
    ['Fichier', path.basename(fichier)], ['Mode', applique ? 'IMPORT FAIT' : 'VÉRIFICATION (rien écrit)'], ['Date', new Date().toLocaleString('fr-FR')],
    ['Lots de graines', a.lotsMP.length], ['Pressages', a.presse.length], ['Filtrations', a.filtration.length], ['Mélanges (lots finis)', a.melanges.length],
    ['Conditionnements', a.conditionnements.length], ['Lignes de vente', a.ventes.length], ['Anomalies corrigées', a.anomalies.length], ['Lots déjà dans TinOR (gardés)', deja.length],
  ], [32, 40]);
  ajout('Anomalies', ['Registre', 'Où', 'Constat → correction appliquée'], a.anomalies.map(x => [x.registre, x.ou, x.texte]), [16, 26, 120]);
  ajout('Plan d\'import', ['Étape', 'Détail'], journal, [18, 100]);
  ajout('Matière première', ['Lot fournisseur', 'Fournisseur', 'Pressé (kg)', 'Pressages'], a.lotsMP.map(m => [m.numero,
    ((a.fournisseurs || []).find(f => (f.lots || []).map(String).includes(m.numero)) || {}).nom || '?', m.kg,
    a.presse.filter(p => p.lot_mp === m.numero).map(p => `${p.numero} (${p.kg} kg)`).join(' · ')]), [16, 16, 12, 140]);
  ajout('Stock après import', ['N° de lot', 'Produit', 'Quantité', 'Unité'], restant.map(r => [r.numero_lot, r.nom, Number(r.quantite_actuelle), r.symbole]), [28, 48, 12, 8]);
  const sortie = fichier.replace(/\.xlsx$/i, '') + '_rapport_import.xlsx';
  await wb.xlsx.writeFile(sortie);
  console.log(`  Rapport : ${sortie}`);
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1); });
