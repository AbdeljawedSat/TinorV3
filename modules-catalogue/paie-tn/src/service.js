'use strict';
/**
 * Service de paie : droits, contrôles, appel du moteur, persistance et audit.
 * Même workflow que l'application Java (PaieService) : OUVERTE -> CALCULEE -> VALIDEE -> CLOTUREE.
 */
const { MoteurPaie, MOTEUR, finDeMois } = require('./engine/moteur');
const { d } = require('./engine/dec');
const { isDeepStrictEqual } = require('node:util');

class RegleMetier extends Error { constructor(m) { super(m); this.name = 'RegleMetier'; this.status = 400; } }
class AccesRefuse extends Error { constructor(m) { super(m); this.name = 'AccesRefuse'; this.status = 403; } }

const DROITS = {
  ADMIN: ['CONSULTER', 'GERER_SALARIES', 'SAISIR_VARIABLES', 'SIMULER', 'VALIDER_PAIE', 'VALIDER_PARAMETRES', 'CLOTURER', 'ROUVRIR', 'EXPORTER', 'ADMINISTRER', 'MODIFIER_PARAMETRES'],
  GESTIONNAIRE: ['CONSULTER', 'GERER_SALARIES', 'SAISIR_VARIABLES', 'SIMULER', 'EXPORTER'],
  VALIDEUR: ['CONSULTER', 'VALIDER_PAIE', 'VALIDER_PARAMETRES', 'EXPORTER'],
  CONSULTATION: ['CONSULTER'],
};
const droits = (u) => (u && DROITS[u.role]) || [];
const peut = (u, droit) => droits(u).includes(droit);
function exiger(u, droit) {
  if (!u) throw new AccesRefuse('Utilisateur non identifié');
  if (!peut(u, droit)) throw new AccesRefuse(`Action non autorisée pour votre rôle (${u.role}) : ${droit}`);
}

const DATE = (c) => `DATE_FORMAT(${c},'%Y-%m-%d')`;
const DT = (c) => `DATE_FORMAT(${c},'%Y-%m-%d %H:%i:%s')`;
const SQL_SAL = `SELECT id, matricule, nom, prenom, fonction, categorie, num_cnss AS numCnss, ${DATE('date_entree')} AS dateEntree,
  ${DATE('date_sortie')} AS dateSortie, regime, chef_famille AS chefFamille, nb_enfants AS nbEnfants, nb_enfants_etudiants AS nbEnfantsEtudiants,
  nb_enfants_handicapes AS nbEnfantsHandicapes, mode_paiement AS modePaiement, rib, actif FROM paie_salaries`;
const SQL_PER = `SELECT id, annee, mois, statut, calcule_par AS calculePar, ${DT('calcule_le')} AS calculeLe, validee_par AS valideePar,
  ${DT('validee_le')} AS valideeLe, cloturee_par AS clotureePar, ${DT('cloturee_le')} AS clotureeLe FROM paie_periodes`;
const SQL_CALC = `SELECT id, periode_id AS periodeId, salarie_id AS salarieId, version, statut, brut, cnss_sal AS cnssSal, irpp, css, net,
  charges_pat AS chargesPat, cout_employeur AS coutEmployeur, certifiable, moteur, params_version AS paramsVersion, resultat_json AS json,
  calcule_par AS calculePar, ${DT('calcule_le')} AS calculeLe FROM paie_calculs`;

/** Égalité de deux résultats, hors champ « moteur » (un calcul Java peut être contrôlé par le moteur JS). */
function memeResultat(a, b) {
  const { moteur: _a, ...x } = a;
  const { moteur: _b, ...y } = b;
  return isDeepStrictEqual(x, y);
}
const premierDuMoisSuivant = (iso) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
const bool = (v) => v === true || v === 1 || v === '1';
const libelle = (p) => `${p.annee}-${String(p.mois).padStart(2, '0')}`;
const modifiable = (p) => p.statut === 'OUVERTE' || p.statut === 'CALCULEE';
const txt = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const dateOuNull = (v, champ) => {
  const t = txt(v);
  if (t === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t + 'T00:00:00Z'))) throw new RegleMetier(`Date invalide pour « ${champ} » (AAAA-MM-JJ)`);
  return t;
};
const decOuNull = (v, champ) => {
  try { const x = d(v); return x === null ? null : x; } catch (e) { throw new RegleMetier(`Valeur numérique invalide pour « ${champ} »`); }
};
const entier = (v, champ) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RegleMetier(`Nombre invalide pour « ${champ} »`);
  return n;
};

class PaieService {
  /**
   * @param {object} db adaptateur (creerDb)
   * @param {Referentiel} referentiel
   * @param {{controleDeuxNiveaux?: boolean}} options
   */
  constructor(db, referentiel, options = {}) {
    this.db = db;
    this.base = referentiel;   // fichier de paramètres, sans les versions saisies
    this.ref = referentiel;    // référentiel effectif = fichier + versions saisies (rechargerReferentiel)
    this.moteur = new MoteurPaie(referentiel);
    this.controleDeuxNiveaux = options.controleDeuxNiveaux !== false;
  }

  audit(q, u, action, entite, entiteId, details) {
    return q.query('INSERT INTO paie_audit (utilisateur, action, entite, entite_id, details) VALUES (?,?,?,?,?)',
      [u ? u.login : '?', action, entite, entiteId == null ? null : String(entiteId), details ?? null]);
  }

  // ---------------- Entreprise ----------------
  async entreprise() {
    const r = await this.db.query('SELECT id, raison_sociale AS raisonSociale, matricule_fiscal AS matriculeFiscal, num_employeur_cnss AS numEmployeurCnss, adresse, taux_at AS tauxAT, taux_tfp AS tauxTFP FROM paie_entreprise ORDER BY id LIMIT 1');
    return r[0] || { id: 0, raisonSociale: '', matriculeFiscal: null, numEmployeurCnss: null, adresse: null, tauxAT: null, tauxTFP: null };
  }

  async enregistrerEntreprise(u, b) {
    exiger(u, 'ADMINISTRER');
    if (!txt(b.raisonSociale)) throw new RegleMetier('La raison sociale est obligatoire');
    const at = decOuNull(b.tauxAT, 'Taux AT'), tfp = decOuNull(b.tauxTFP, 'Taux TFP');
    if (at && (at.isNeg() || at.gt('0.1'))) throw new RegleMetier('Taux AT attendu sous forme décimale (ex. 0.004 pour 0,4 %)');
    if (tfp && (tfp.isNeg() || tfp.gt('0.05'))) throw new RegleMetier('Taux TFP attendu sous forme décimale (ex. 0.01 pour 1 %)');
    const e = await this.entreprise();
    const v = [txt(b.raisonSociale), txt(b.matriculeFiscal), txt(b.numEmployeurCnss), txt(b.adresse), at && at.toFixed(), tfp && tfp.toFixed()];
    if (e.id) await this.db.query('UPDATE paie_entreprise SET raison_sociale=?, matricule_fiscal=?, num_employeur_cnss=?, adresse=?, taux_at=?, taux_tfp=? WHERE id=?', [...v, e.id]);
    else await this.db.query('INSERT INTO paie_entreprise (raison_sociale, matricule_fiscal, num_employeur_cnss, adresse, taux_at, taux_tfp) VALUES (?,?,?,?,?,?)', v);
    await this.audit(this.db, u, 'MODIFICATION', 'ENTREPRISE', e.id || null, `AT=${v[4]} TFP=${v[5]}`);
    return this.entreprise();
  }

  // ---------------- Salariés & contrats ----------------
  async salaries({ q, inactifs } = {}) {
    let sql = SQL_SAL + ' WHERE 1=1';
    const p = [];
    if (!inactifs) sql += ' AND actif=1';
    if (txt(q)) { sql += ' AND (matricule LIKE ? OR nom LIKE ? OR prenom LIKE ? OR fonction LIKE ?)'; const l = `%${q.trim()}%`; p.push(l, l, l, l); }
    const rows = await this.db.query(sql + ' ORDER BY nom, prenom', p);
    return rows.map((s) => ({ ...s, chefFamille: bool(s.chefFamille), actif: bool(s.actif) }));
  }

  async salarie(id) {
    const r = await this.db.query(SQL_SAL + ' WHERE id=?', [id]);
    if (!r[0]) throw new RegleMetier('Salarié introuvable');
    return { ...r[0], chefFamille: bool(r[0].chefFamille), actif: bool(r[0].actif) };
  }

  async enregistrerSalarie(u, b, id = null) {
    exiger(u, 'GERER_SALARIES');
    const creation = !id;
    const s = {
      matricule: txt(b.matricule), nom: txt(b.nom), prenom: txt(b.prenom), fonction: txt(b.fonction), categorie: txt(b.categorie),
      numCnss: txt(b.numCnss), dateEntree: dateOuNull(b.dateEntree, "Date d'entrée"), dateSortie: dateOuNull(b.dateSortie, 'Date de sortie'),
      regime: txt(b.regime) || 'CNSS_RSNA', chefFamille: bool(b.chefFamille), nbEnfants: entier(b.nbEnfants, 'Enfants'),
      nbEnfantsEtudiants: entier(b.nbEnfantsEtudiants, 'Enfants étudiants'), nbEnfantsHandicapes: entier(b.nbEnfantsHandicapes, 'Enfants handicapés'),
      modePaiement: txt(b.modePaiement) || 'VIREMENT', rib: txt(b.rib), actif: b.actif === undefined ? true : bool(b.actif),
    };
    if (!s.matricule) throw new RegleMetier('Le matricule est obligatoire');
    if (!s.nom || !s.prenom) throw new RegleMetier('Nom et prénom obligatoires');
    if (!s.dateEntree) throw new RegleMetier("La date d'entrée est obligatoire");
    if (s.dateSortie && s.dateSortie < s.dateEntree) throw new RegleMetier("La date de sortie précède la date d'entrée");
    if (!['VIREMENT', 'CHEQUE', 'ESPECES'].includes(s.modePaiement)) throw new RegleMetier('Mode de paiement invalide');
    const v = [s.matricule, s.nom.toUpperCase(), s.prenom, s.fonction, s.categorie, s.numCnss, s.dateEntree, s.dateSortie, s.regime,
      s.chefFamille ? 1 : 0, s.nbEnfants, s.nbEnfantsEtudiants, s.nbEnfantsHandicapes, s.modePaiement, s.rib, s.actif ? 1 : 0];
    try {
      if (id) {
        await this.salarie(id);
        await this.db.query(`UPDATE paie_salaries SET matricule=?, nom=?, prenom=?, fonction=?, categorie=?, num_cnss=?, date_entree=?, date_sortie=?,
          regime=?, chef_famille=?, nb_enfants=?, nb_enfants_etudiants=?, nb_enfants_handicapes=?, mode_paiement=?, rib=?, actif=? WHERE id=?`, [...v, id]);
      } else {
        id = (await this.db.query(`INSERT INTO paie_salaries (matricule, nom, prenom, fonction, categorie, num_cnss, date_entree, date_sortie, regime,
          chef_famille, nb_enfants, nb_enfants_etudiants, nb_enfants_handicapes, mode_paiement, rib, actif) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, v)).insertId;
      }
    } catch (e) {
      if (String(e.message).includes('uk_paie_sal_matricule')) throw new RegleMetier(`Le matricule ${s.matricule} existe déjà`);
      throw e;
    }
    await this.audit(this.db, u, creation ? 'CREATION' : 'MODIFICATION', 'SALARIE', id,
      `matricule=${s.matricule} chefFamille=${s.chefFamille} enfants=${s.nbEnfants}/${s.nbEnfantsEtudiants}/${s.nbEnfantsHandicapes} actif=${s.actif}`);
    return this.salarie(id);
  }

  async contrats(salarieId) {
    return this.db.query(`SELECT id, salarie_id AS salarieId, type_contrat AS typeContrat, ${DATE('date_debut')} AS dateDebut, ${DATE('date_fin')} AS dateFin,
      salaire_base AS salaireBase, horaire_mensuel AS horaireMensuel, taux_horaire AS tauxHoraire FROM paie_contrats WHERE salarie_id=? ORDER BY date_debut DESC, id DESC`, [salarieId]);
  }

  async ajouterContrat(u, salarieId, b) {
    exiger(u, 'GERER_SALARIES');
    await this.salarie(salarieId);
    const debut = dateOuNull(b.dateDebut, 'Début'), fin = dateOuNull(b.dateFin, 'Fin');
    const base = decOuNull(b.salaireBase, 'Salaire de base'), horaire = decOuNull(b.horaireMensuel ?? '208', 'Horaire mensuel');
    const th = decOuNull(b.tauxHoraire, 'Taux horaire');
    const type = txt(b.typeContrat) || 'CDI';
    if (!debut) throw new RegleMetier('Date de début obligatoire');
    if (!base || base.lte(0)) throw new RegleMetier('Le salaire de base doit être positif');
    if (!horaire || horaire.lte(0)) throw new RegleMetier("L'horaire mensuel doit être positif");
    if (th && th.lte(0)) throw new RegleMetier('Le taux horaire doit être positif');
    if (fin && fin < debut) throw new RegleMetier('La date de fin précède la date de début');
    const r = await this.db.query('INSERT INTO paie_contrats (salarie_id, type_contrat, date_debut, date_fin, salaire_base, horaire_mensuel, taux_horaire) VALUES (?,?,?,?,?,?,?)',
      [salarieId, type, debut, fin, base.toFixed(), horaire.toFixed(), th && th.toFixed()]);
    await this.audit(this.db, u, 'CREATION', 'CONTRAT', r.insertId, `salarie=${salarieId} type=${type} debut=${debut} salaireBase=${base.toFixed()} horaire=${horaire.toFixed()}`);
    return this.contrats(salarieId);
  }

  // ---------------- Périodes ----------------
  async periodes() { return this.db.query(SQL_PER + ' ORDER BY annee DESC, mois DESC'); }

  async periode(id) {
    const r = await this.db.query(SQL_PER + ' WHERE id=?', [id]);
    if (!r[0]) throw new RegleMetier('Période introuvable');
    return r[0];
  }

  async creerPeriode(u, annee, mois) {
    exiger(u, 'SIMULER');
    annee = Number(annee); mois = Number(mois);
    if (!Number.isInteger(annee) || !Number.isInteger(mois) || mois < 1 || mois > 12 || annee < 2017 || annee > 2100) throw new RegleMetier('Période invalide');
    try {
      const r = await this.db.query('INSERT INTO paie_periodes (annee, mois) VALUES (?,?)', [annee, mois]);
      await this.audit(this.db, u, 'CREATION', 'PERIODE', r.insertId, libelle({ annee, mois }));
      return this.periode(r.insertId);
    } catch (e) {
      if (String(e.message).includes('uk_paie_per')) throw new RegleMetier('La période existe déjà');
      throw e;
    }
  }

  async changerStatut(q, periodeId, attendu, nouveau, champ, u) {
    const extra = { calcule: ', calcule_par=?, calcule_le=NOW()', validee: ', validee_par=?, validee_le=NOW()', cloturee: ', cloturee_par=?, cloturee_le=NOW()',
      reouverture: ', validee_par=NULL, validee_le=NULL, cloturee_par=NULL, cloturee_le=NULL' }[champ] || '';
    const p = [nouveau];
    if (extra.includes('?')) p.push(u.login);
    p.push(periodeId, attendu);
    const r = await q.query(`UPDATE paie_periodes SET statut=?${extra} WHERE id=? AND statut=?`, p);
    return r.affectedRows === 1;
  }

  // ---------------- Variables ----------------
  async variables(periodeId, salarieId) {
    let sql = `SELECT id, periode_id AS periodeId, salarie_id AS salarieId, rubrique_code AS rubrique, quantite, taux, montant, commentaire,
      created_by AS creePar, ${DT('created_at')} AS creeLe FROM paie_variables WHERE periode_id=?`;
    const p = [periodeId];
    if (salarieId) { sql += ' AND salarie_id=?'; p.push(salarieId); }
    return this.db.query(sql + ' ORDER BY salarie_id, id', p);
  }

  async ajouterVariable(u, periodeId, b) {
    exiger(u, 'SAISIR_VARIABLES');
    const p = await this.periode(periodeId);
    if (!modifiable(p)) throw new RegleMetier(`Période ${p.statut} : saisie impossible`);
    const salarieId = Number(b.salarieId);
    await this.salarie(salarieId);
    const rub = this.ref.rubriques.get(b.rubrique);
    if (!rub) throw new RegleMetier('Rubrique inconnue : ' + b.rubrique);
    if (rub.code === 'SAL_BASE') throw new RegleMetier('Le salaire de base provient du contrat');
    const quantite = decOuNull(b.quantite, 'Quantité'), taux = decOuNull(b.taux, 'Taux'), montant = decOuNull(b.montant, 'Montant');
    const qte = rub.mode !== 'MONTANT';
    if (qte && (!quantite || quantite.lte(0))) throw new RegleMetier('Quantité positive obligatoire pour ' + rub.libelle);
    if (!qte && (!montant || montant.lte(0))) throw new RegleMetier('Montant positif obligatoire pour ' + rub.libelle);
    if (rub.mode === 'QTE_TAUX' && !taux) throw new RegleMetier('Taux obligatoire pour ' + rub.libelle);
    const r = await this.db.query('INSERT INTO paie_variables (periode_id, salarie_id, rubrique_code, quantite, taux, montant, commentaire, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [periodeId, salarieId, rub.code, qte ? quantite.toFixed() : null, rub.mode === 'QTE_TAUX' ? taux.toFixed() : null, qte ? null : montant.toFixed(), txt(b.commentaire), u.login]);
    await this.audit(this.db, u, 'CREATION', 'VARIABLE', r.insertId, `periode=${libelle(p)} salarie=${salarieId} ${rub.code} qte=${quantite && quantite.toFixed()} montant=${montant && montant.toFixed()}`);
    return this.variables(periodeId, salarieId);
  }

  async supprimerVariable(u, id) {
    exiger(u, 'SAISIR_VARIABLES');
    const v = (await this.db.query('SELECT id, periode_id AS periodeId, salarie_id AS salarieId, rubrique_code AS rubrique FROM paie_variables WHERE id=?', [id]))[0];
    if (!v) throw new RegleMetier('Élément introuvable');
    const p = await this.periode(v.periodeId);
    if (!modifiable(p)) throw new RegleMetier(`Période ${p.statut} : modification impossible`);
    await this.db.query('DELETE FROM paie_variables WHERE id=?', [id]);
    await this.audit(this.db, u, 'SUPPRESSION', 'VARIABLE', id, `periode=${libelle(p)} salarie=${v.salarieId} ${v.rubrique}`);
  }

  // ---------------- Calcul ----------------
  async validations() {
    return this.db.query(`SELECT code, ${DATE('debut')} AS debut, valeur, valide_par AS validePar, ${DT('valide_le')} AS valideLe, reference FROM paie_validations_param ORDER BY code, debut`);
  }

  async salariesDeLaPeriode(p) {
    const per = libelle(p), debut = per + '-01', fin = finDeMois(per);
    return (await this.salaries({})).filter((s) => !(s.dateEntree && s.dateEntree > fin) && !(s.dateSortie && s.dateSortie < debut));
  }

  /** Entrée moteur depuis la base ; null si aucun contrat applicable. */
  async entree(p, s, ent, vals) {
    const per = libelle(p), debut = per + '-01', fin = finDeMois(per);
    const k = (await this.db.query(`SELECT salaire_base AS salaireBase, horaire_mensuel AS horaireMensuel, taux_horaire AS tauxHoraire FROM paie_contrats
      WHERE salarie_id=? AND date_debut<=? AND (date_fin IS NULL OR date_fin>=?) ORDER BY date_debut DESC, id DESC LIMIT 1`, [s.id, fin, debut]))[0];
    if (!k) return null;
    const vars = await this.variables(p.id, s.id);
    return {
      periode: per,
      entreprise: { tauxAT: ent.tauxAT, tauxTFP: ent.tauxTFP },
      salarie: { matricule: s.matricule, nom: s.nom, prenom: s.prenom, regime: s.regime, dateEntree: s.dateEntree, dateSortie: s.dateSortie,
        chefFamille: s.chefFamille, nbEnfants: s.nbEnfants, nbEnfantsEtudiants: s.nbEnfantsEtudiants, nbEnfantsHandicapes: s.nbEnfantsHandicapes },
      contrat: { salaireBase: k.salaireBase, horaireMensuel: k.horaireMensuel, tauxHoraire: k.tauxHoraire },
      variables: vars.map((v) => ({ rubrique: v.rubrique, quantite: v.quantite, taux: v.taux, montant: v.montant, commentaire: v.commentaire })),
      validations: vals.map((v) => ({ code: v.code, debut: v.debut, valeur: v.valeur })),
    };
  }

  /** Calcul sans état (aucun enregistrement) — ex. simulateur dans d'autres écrans TinOR. */
  calculer(u, entree) {
    exiger(u, 'CONSULTER');
    return this.moteur.calculer(entree);
  }

  async apercu(u, periodeId, salarieId) {
    exiger(u, 'CONSULTER');
    const p = await this.periode(periodeId);
    const s = await this.salarie(salarieId);
    const e = await this.entree(p, s, await this.entreprise(), await this.validations());
    if (!e) throw new RegleMetier(`Aucun contrat applicable pour ${s.nom} ${s.prenom} sur ${libelle(p)}`);
    return this.moteur.calculer(e);
  }

  async simuler(u, periodeId) {
    exiger(u, 'SIMULER');
    const p = await this.periode(periodeId);
    if (!modifiable(p)) throw new RegleMetier(`Période ${p.statut} : rouvrir la période pour recalculer`);
    const ent = await this.entreprise();
    const vals = await this.validations();
    const anomalies = [];
    if (!ent.id) anomalies.push('Fiche entreprise non renseignée');
    // préparation hors transaction (lecture), écriture atomique ensuite
    const aCalculer = [];
    for (const s of await this.salariesDeLaPeriode(p)) {
      const e = await this.entree(p, s, ent, vals);
      if (!e) { anomalies.push(`${s.matricule} – ${s.nom} ${s.prenom} : aucun contrat applicable sur la période`); continue; }
      aCalculer.push({ s, r: this.moteur.calculer(e) });
    }
    if (!aCalculer.length) throw new RegleMetier('Aucun salarié calculable sur la période' + (anomalies.length ? ' : ' + anomalies.join(' ; ') : ''));
    const calculs = await this.db.transaction(async (tx) => {
      await tx.query("UPDATE paie_calculs SET statut='REMPLACE' WHERE periode_id=? AND statut='SIMULATION'", [p.id]);
      const res = [];
      for (const { s, r } of aCalculer) {
        const version = Number((await tx.query('SELECT COALESCE(MAX(version),0)+1 AS v FROM paie_calculs WHERE periode_id=? AND salarie_id=?', [p.id, s.id]))[0].v);
        const sy = r.synthese;
        const ins = await tx.query(`INSERT INTO paie_calculs (periode_id, salarie_id, version, statut, brut, cnss_sal, irpp, css, net, charges_pat, cout_employeur,
          certifiable, moteur, params_version, resultat_json, calcule_par) VALUES (?,?,?,'SIMULATION',?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.id, s.id, version, sy.brut, sy.cnssSalarial, sy.irpp, sy.css, sy.netAPayer, sy.chargesPatronales, sy.coutEmployeur,
          r.certifiable ? 1 : 0, MOTEUR, r.paramsVersion, JSON.stringify(r), u.login]);
        res.push({ id: ins.insertId, salarieId: s.id, matricule: s.matricule, version, certifiable: r.certifiable, bloquant: r.bloquant, net: sy.netAPayer });
      }
      if (!(await this.changerStatut(tx, p.id, p.statut, 'CALCULEE', 'calcule', u))) throw new RegleMetier('La période a été modifiée par un autre utilisateur, réessayer');
      await this.audit(tx, u, 'SIMULATION', 'PERIODE', p.id,
        `${libelle(p)} : ${res.length} calcul(s), ${res.filter((x) => x.bloquant).length} bloquant(s), ${anomalies.length} anomalie(s)`);
      return res;
    });
    return { calculs, anomalies };
  }

  /** Derniers calculs (hors versions remplacées) de chaque salarié de la période, avec la fiche salarié. */
  async calculs(periodeId) {
    const rows = await this.db.query(`${SQL_CALC} k WHERE k.periode_id=? AND k.version=(SELECT MAX(version) FROM paie_calculs x WHERE x.periode_id=k.periode_id AND x.salarie_id=k.salarie_id)
      ORDER BY k.salarie_id`, [periodeId]);
    const sal = new Map((await this.salaries({ inactifs: true })).map((s) => [s.id, s]));
    return rows.filter((k) => k.statut !== 'REMPLACE' && sal.has(k.salarieId)).map((k) => ({
      ...k, certifiable: bool(k.certifiable), salarie: sal.get(k.salarieId), resultat: JSON.parse(k.json), json: undefined,
    }));
  }

  async controlerAvantValidation(u, periodeId) {
    exiger(u, 'VALIDER_PAIE');
    const p = await this.periode(periodeId);
    if (p.statut !== 'CALCULEE') throw new RegleMetier(`Seule une période CALCULEE peut être validée (statut : ${p.statut})`);
    if (this.controleDeuxNiveaux && u.login === p.calculePar)
      throw new RegleMetier(`Contrôle à deux niveaux : la validation doit être faite par une autre personne que celle qui a lancé le calcul (${p.calculePar})`);
    const ent = await this.entreprise();
    const vals = await this.validations();
    const avert = [];
    const calcules = new Set();
    for (const k of await this.calculs(p.id)) {
      if (k.statut !== 'SIMULATION') continue;
      calcules.add(k.salarieId);
      const nom = `${k.salarie.matricule} – ${k.salarie.nom} ${k.salarie.prenom}`;
      if (k.resultat.bloquant) throw new RegleMetier(`${nom} : le calcul comporte des erreurs bloquantes, corriger puis relancer la simulation`);
      const e = await this.entree(p, k.salarie, ent, vals);
      const recalc = e ? this.moteur.calculer(e) : null;
      if (!recalc || !memeResultat(recalc, k.resultat))
        throw new RegleMetier(`${nom} : données ou paramètres modifiés depuis la simulation. Relancer la simulation avant de valider.`);
      if (!k.resultat.certifiable) avert.push(`${nom} : NON CERTIFIÉ (paramètres non validés)`);
    }
    if (!calcules.size) throw new RegleMetier('Aucun calcul en simulation à valider');
    for (const s of await this.salariesDeLaPeriode(p))
      if (!calcules.has(s.id)) throw new RegleMetier(`${s.matricule} – ${s.nom} ${s.prenom} n'a pas de calcul pour la période : relancer la simulation`);
    return avert;
  }

  async valider(u, periodeId) {
    const avert = await this.controlerAvantValidation(u, periodeId);
    const p = await this.periode(periodeId);
    await this.db.transaction(async (tx) => {
      const n = (await tx.query("UPDATE paie_calculs SET statut='VALIDE' WHERE periode_id=? AND statut='SIMULATION'", [p.id])).affectedRows;
      if (!(await this.changerStatut(tx, p.id, 'CALCULEE', 'VALIDEE', 'validee', u))) throw new RegleMetier('La période a changé de statut entre-temps');
      await this.audit(tx, u, 'VALIDATION', 'PERIODE', p.id, `${libelle(p)} : ${n} bulletin(s) validé(s), ${avert.length} non certifié(s)`);
    });
    return { avertissements: avert };
  }

  async cloturer(u, periodeId) {
    exiger(u, 'CLOTURER');
    const p = await this.periode(periodeId);
    if (p.statut !== 'VALIDEE') throw new RegleMetier('Seule une période VALIDEE peut être clôturée');
    if (!(await this.changerStatut(this.db, p.id, 'VALIDEE', 'CLOTUREE', 'cloturee', u))) throw new RegleMetier('La période a changé de statut entre-temps');
    await this.audit(this.db, u, 'CLOTURE', 'PERIODE', p.id, libelle(p));
  }

  async rouvrir(u, periodeId, motif) {
    exiger(u, 'ROUVRIR');
    if (!motif || String(motif).trim().length < 5) throw new RegleMetier('Un motif de réouverture explicite est obligatoire');
    const p = await this.periode(periodeId);
    if (p.statut !== 'VALIDEE' && p.statut !== 'CLOTUREE') throw new RegleMetier('Seule une période validée ou clôturée peut être rouverte');
    await this.db.transaction(async (tx) => {
      await tx.query("UPDATE paie_calculs SET statut='SIMULATION' WHERE periode_id=? AND statut='VALIDE'", [p.id]);
      if (!(await this.changerStatut(tx, p.id, p.statut, 'CALCULEE', 'reouverture', u))) throw new RegleMetier('La période a changé de statut entre-temps');
      await this.audit(tx, u, 'REOUVERTURE', 'PERIODE', p.id, `${libelle(p)} (était ${p.statut}) motif : ${String(motif).trim()}`);
    });
  }

  async comparer(periodeId, salarieId) {
    const h = await this.db.query(SQL_CALC + ' WHERE periode_id=? AND salarie_id=? ORDER BY version DESC LIMIT 2', [periodeId, salarieId]);
    if (h.length < 2) return [];
    const apres = JSON.parse(h[0].json).synthese, avant = JSON.parse(h[1].json).synthese;
    return Object.keys(apres).filter((k) => apres[k] !== avant[k]).map((k) => {
      const delta = d(apres[k]).minus(d(avant[k]));
      return { element: k, avant: avant[k], apres: apres[k], ecart: (delta.gt(0) ? '+' : '') + delta.toFixed(3) };
    });
  }

  // ---------------- Paramètres modifiables (versions datées) ----------------
  async versionsParametres() {
    return this.db.query(`SELECT id, code, ${DATE('debut')} AS debut, ${DATE('fin')} AS fin, valeur, tranches_json AS tranchesJson, source, note,
      cree_par AS creePar, ${DT('cree_le')} AS creeLe FROM paie_parametres_versions ORDER BY code, debut`);
  }

  /** Recharge le référentiel effectif : fichier + versions saisies (au démarrage et après chaque modification). */
  async rechargerReferentiel() {
    const vs = await this.versionsParametres();
    const ajouts = vs.map((v) => ({ code: v.code, debut: v.debut, fin: v.fin, valeur: v.valeur, tranches: v.tranchesJson ? JSON.parse(v.tranchesJson) : null, source: v.source, note: v.note }));
    const maxId = vs.reduce((m, v) => Math.max(m, v.id), 0);
    this.ref = this.base.avecAjouts(ajouts, ajouts.length ? `+p${ajouts.length}.${maxId}` : null);
    this.moteur = new MoteurPaie(this.ref);
  }

  async finDernierePeriodeFigee() {
    const r = (await this.db.query("SELECT annee, mois FROM paie_periodes WHERE statut IN ('VALIDEE','CLOTUREE') ORDER BY annee DESC, mois DESC LIMIT 1"))[0];
    return r ? finDeMois(libelle(r)) : null;
  }

  async controlerDateEffet(code, debut) {
    if (!debut) throw new RegleMetier("La date d'effet est obligatoire");
    if (!debut.endsWith('-01')) throw new RegleMetier("La date d'effet doit être le 1er jour d'un mois (paie mensuelle)");
    const fige = await this.finDernierePeriodeFigee();
    if (fige && debut <= fige)
      throw new RegleMetier(`La date d'effet doit être postérieure à la dernière période validée ou clôturée (${fige}) : les bulletins validés ne peuvent pas changer. Rouvrir la période si une correction est nécessaire.`);
    const liste = code.startsWith('BAREME:') ? this.ref.baremes.filter((b) => b.code === code.slice(7)) : this.ref.parametres.filter((p) => p.code === code);
    const dernier = liste.reduce((m, x) => (m == null || x.debut > m ? x.debut : m), null);
    if (dernier && debut <= dernier) throw new RegleMetier(`Une version de ${code} existe déjà à partir du ${dernier} : choisir une date d'effet postérieure`);
  }

  /**
   * Nouvelle version datée d'un paramètre ({code, debut, fin?, valeur, source, note?} ; taux en fraction : 9,68 % = "0.0968")
   * ou d'un barème ({code: 'BAREME:IRPP', debut, fin?, tranches: [{de, a, taux}], source, note?}).
   */
  async ajouterVersion(u, b) {
    exiger(u, 'MODIFIER_PARAMETRES');
    const code = txt(b.code) || '';
    const debut = dateOuNull(b.debut, "Date d'effet"), fin = dateOuNull(b.fin, 'Date de fin');
    const source = txt(b.source), note = txt(b.note);
    if (!source) throw new RegleMetier('Indiquer le texte officiel de référence (loi de finances, décret, note commune…)');
    if (fin && debut && fin < debut) throw new RegleMetier("La date de fin précède la date d'effet");
    let valeur = null, tranchesJson = null, detail;
    if (code.startsWith('BAREME:')) {
      if (!this.ref.baremes.some((x) => x.code === code.slice(7))) throw new RegleMetier('Barème inconnu : ' + code);
      const tr = Array.isArray(b.tranches) ? b.tranches : [];
      if (!tr.length) throw new RegleMetier('Le barème doit contenir au moins une tranche');
      let attendu = d('0');
      const propres = tr.map((t, i) => {
        const de = decOuNull(t.de, `De (tranche ${i + 1})`), a = decOuNull(t.a, `À (tranche ${i + 1})`), taux = decOuNull(t.taux, `Taux (tranche ${i + 1})`);
        if (!de || !de.eq(attendu)) throw new RegleMetier(`Tranche ${i + 1} : doit commencer à ${attendu.toFixed()}`);
        if (!taux || taux.isNeg() || taux.gt(1)) throw new RegleMetier(`Tranche ${i + 1} : taux entre 0 et 100 %`);
        const derniere = i === tr.length - 1;
        if (derniere && a) throw new RegleMetier('La dernière tranche doit être ouverte (borne haute vide)');
        if (!derniere && (!a || a.lte(de))) throw new RegleMetier(`Tranche ${i + 1} : borne haute invalide`);
        attendu = a;
        return { de: de.toFixed(), a: a ? a.toFixed() : null, taux: taux.toFixed() };
      });
      tranchesJson = JSON.stringify(propres);
      detail = 'tranches=' + tranchesJson;
    } else {
      const modele = this.ref.parametres.filter((p) => p.code === code).sort((x, y) => (x.debut < y.debut ? 1 : -1))[0];
      if (!modele) throw new RegleMetier('Paramètre inconnu : ' + code);
      const v = txt(b.valeur) || '';
      if (modele.type === 'TEXTE') {
        if (!v) throw new RegleMetier('Valeur obligatoire');
        if (code === 'CSS_MODE' && !['TOUTES', 'HORS_TRANCHE_ZERO'].includes(v)) throw new RegleMetier('Valeur attendue : TOUTES ou HORS_TRANCHE_ZERO');
        valeur = v;
      } else {
        const x = decOuNull(v, 'Valeur');
        if (!x) throw new RegleMetier('Valeur numérique obligatoire');
        if (modele.type === 'TAUX' && (x.isNeg() || x.gt(1))) throw new RegleMetier('Un taux doit être compris entre 0 et 100 %');
        if (modele.type === 'MONTANT' && x.isNeg()) throw new RegleMetier('Le montant doit être positif ou nul');
        if (modele.type === 'NOMBRE' && (x.isNeg() || !x.isInteger())) throw new RegleMetier('Nombre entier positif attendu');
        if (modele.type === 'COEF' && (x.lte(0) || x.gt(10))) throw new RegleMetier('Coefficient attendu entre 0 et 10');
        valeur = x.isZero() ? '0' : x.toFixed();
      }
      detail = 'valeur=' + valeur;
    }
    await this.controlerDateEffet(code, debut);
    let id;
    try {
      id = (await this.db.query('INSERT INTO paie_parametres_versions (code, debut, fin, valeur, tranches_json, source, note, cree_par) VALUES (?,?,?,?,?,?,?,?)',
        [code, debut, fin, valeur, tranchesJson, source, note, u.login])).insertId;
      await this.rechargerReferentiel();
    } catch (e) {
      if (id) { await this.db.query('DELETE FROM paie_parametres_versions WHERE id=?', [id]); await this.rechargerReferentiel(); }
      if (e instanceof RegleMetier) throw e;
      if (String(e.message).includes('uk_paie_pv')) throw new RegleMetier('Une version existe déjà à cette date');
      throw new RegleMetier('Version refusée : ' + e.message);
    }
    await this.audit(this.db, u, 'MODIFICATION_PARAM', 'PARAMETRE', `${code}@${debut}`, `${detail} fin=${fin} source=${source}`);
    return { id, version: this.ref.version };
  }

  async supprimerVersion(u, id) {
    exiger(u, 'MODIFIER_PARAMETRES');
    const v = (await this.versionsParametres()).find((x) => x.id === id);
    if (!v) throw new RegleMetier('Version introuvable');
    const fige = await this.finDernierePeriodeFigee();
    if (fige && v.debut <= fige) throw new RegleMetier("Cette version s'applique à des périodes déjà validées ou clôturées : suppression impossible");
    await this.db.query('DELETE FROM paie_parametres_versions WHERE id=?', [id]);
    await this.rechargerReferentiel();
    await this.audit(this.db, u, 'SUPPRESSION_PARAM', 'PARAMETRE', `${v.code}@${v.debut}`, v.valeur != null ? 'valeur=' + v.valeur : 'tranches=' + v.tranchesJson);
    return { version: this.ref.version };
  }

  // ---------------- Paramètres réglementaires ----------------
  async elementsReglementaires() {
    const vals = new Map((await this.validations()).map((v) => [`${v.code}@${v.debut}`, v]));
    const canonV = (s) => { try { return d(s).isZero() ? '0' : d(s).toFixed(); } catch (e) { return String(s).trim(); } };
    const avecValidation = (el) => {
      const v = vals.get(`${el.code}@${el.debut}`);
      return { ...el, validation: v && canonV(v.valeur) === canonV(el.valeur) ? v : null };
    };
    const l = [];
    const saisies = new Map((await this.versionsParametres()).map((v) => [`${v.code}@${v.debut}`, v]));
    const origine = (code, debut) => { const v = saisies.get(`${code}@${debut}`); return v ? { id: v.id, creePar: v.creePar, creeLe: v.creeLe } : null; };
    for (const p of this.ref.parametres) l.push(avecValidation({ code: p.code, libelle: p.libelle, type: p.type, valeur: p.valeurCanonique, debut: p.debut, fin: p.fin,
      statut: p.statut, source: p.source, note: p.note, saisie: origine(p.code, p.debut) }));
    for (const b of this.ref.baremes) l.push(avecValidation({ code: 'BAREME:' + b.code, libelle: b.libelle, type: 'BAREME', valeur: b.valeurCanonique, debut: b.debut, fin: b.fin,
      statut: b.statut, source: b.source, note: null, saisie: origine('BAREME:' + b.code, b.debut),
      tranches: b.tranches.map((t) => ({ de: t.de.toFixed(), a: t.a == null ? null : t.a.toFixed(), taux: t.taux.toFixed() })) }));
    for (const r of this.ref.rubriques.values()) l.push(avecValidation({ code: 'RUB:' + r.code, libelle: 'Rubrique : ' + r.libelle, type: 'RUBRIQUE', valeur: r.valeurCanonique, debut: '1900-01-01', fin: null, statut: r.statut, source: 'Catalogue des rubriques (type|mode|soumis CNSS|soumis IRPP|coefficient)', note: null, saisie: null }));
    const fige = await this.finDernierePeriodeFigee();
    return { version: this.ref.version, elements: l, dateMinEffet: fige ? premierDuMoisSuivant(fige) : null };
  }

  async validerParametre(u, b) {
    exiger(u, 'VALIDER_PARAMETRES');
    if (!txt(b.validePar)) throw new RegleMetier('Indiquer le nom du professionnel qui valide');
    if (!txt(b.reference)) throw new RegleMetier('Indiquer la référence officielle consultée (JORT, note commune...)');
    const el = (await this.elementsReglementaires()).elements.find((x) => x.code === b.code && x.debut === b.debut);
    if (!el) throw new RegleMetier('Élément réglementaire inconnu : ' + b.code + ' @ ' + b.debut);
    if (b.valeur !== undefined && String(b.valeur) !== el.valeur) throw new RegleMetier("La valeur validée ne correspond pas à la valeur actuelle du fichier de paramètres");
    await this.db.query('REPLACE INTO paie_validations_param (code, debut, valeur, valide_par, reference) VALUES (?,?,?,?,?)', [el.code, el.debut, el.valeur, txt(b.validePar), txt(b.reference)]);
    await this.audit(this.db, u, 'VALIDATION_PARAM', 'PARAMETRE', `${el.code}@${el.debut}`, `valeur=${el.valeur} par=${txt(b.validePar)} ref=${txt(b.reference)}`);
  }

  async retirerValidation(u, code, debut) {
    exiger(u, 'VALIDER_PARAMETRES');
    await this.db.query('DELETE FROM paie_validations_param WHERE code=? AND debut=?', [code, debut]);
    await this.audit(this.db, u, 'RETRAIT_VALIDATION', 'PARAMETRE', `${code}@${debut}`, null);
  }

  // ---------------- Journal & documents ----------------
  async journal(u, q) {
    exiger(u, 'ADMINISTRER');
    let sql = `SELECT id, ${DT('horodatage')} AS horodatage, utilisateur, action, entite, entite_id AS entiteId, details FROM paie_audit`;
    const p = [];
    if (txt(q)) { sql += ' WHERE utilisateur LIKE ? OR action LIKE ? OR entite LIKE ? OR details LIKE ?'; const l = `%${q.trim()}%`; p.push(l, l, l, l); }
    return this.db.query(sql + ' ORDER BY id DESC LIMIT 500', p);
  }

  async tracerExport(u, periodeId, salarieId, type, calculId, nom, sha256) {
    await this.db.query('INSERT INTO paie_documents (periode_id, salarie_id, type_doc, calcul_id, fichier, sha256, cree_par) VALUES (?,?,?,?,?,?,?)',
      [periodeId, salarieId, type, calculId, nom, sha256, u.login]);
    await this.audit(this.db, u, 'EXPORT', type, periodeId, nom);
  }
}

module.exports = { PaieService, RegleMetier, AccesRefuse, DROITS, droits, peut, exiger, libelle };
