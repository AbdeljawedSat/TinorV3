'use strict';
// Génère N cas aléatoires (graine fixe) au format shared/tests/cas-equivalence.json, pour un contrôle d'équivalence massif.
// Usage : node scripts/cas-aleatoires.js 3000 42 > cas-aleatoires.json
const n = Number(process.argv[2] || 1000);
let graine = Number(process.argv[3] || 42);
const rnd = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const dec = (max, dp = 3) => (rnd() * max).toFixed(dp);
const periodes = ['2024-03', '2024-12', '2025-01', '2025-06', '2026-01', '2026-02', '2026-10', '2026-12', '2027-01'];
const rubs = ['HS_1', 'HS_2', 'PRIME_PRESENCE', 'PRIME_RENDEMENT', 'PRIME_ANCIENNETE', 'IND_TRANSPORT', 'IND_PANIER', 'REMB_FRAIS', 'ABS_JOURS', 'ABS_HEURES', 'AVANCE', 'PRET'];
const cas = [];
for (let i = 0; i < n; i++) {
  const variables = [];
  const nv = Math.floor(rnd() * 5);
  for (let k = 0; k < nv; k++) {
    const r = pick(rubs);
    if (['HS_1', 'HS_2', 'ABS_HEURES'].includes(r)) variables.push({ rubrique: r, quantite: dec(20, 2) });
    else if (r === 'ABS_JOURS') variables.push({ rubrique: r, quantite: String(Math.ceil(rnd() * 8)) });
    else variables.push({ rubrique: r, montant: dec(r === 'AVANCE' || r === 'PRET' ? 300 : 600) });
  }
  const chef = rnd() < 0.6;
  cas.push({
    id: 'R' + i, description: 'aléatoire',
    entree: {
      periode: pick(periodes),
      entreprise: rnd() < 0.5 ? {} : { tauxAT: pick(['0.004', '0.006', '0.0125', '0.02']), tauxTFP: pick(['0.01', '0.02']) },
      salarie: { matricule: 'R' + i, chefFamille: chef, nbEnfants: Math.floor(rnd() * 6), nbEnfantsEtudiants: rnd() < 0.15 ? 1 : 0, nbEnfantsHandicapes: rnd() < 0.05 ? 1 : 0 },
      contrat: { salaireBase: dec(rnd() < 0.8 ? 3500 : 25000) || '1', horaireMensuel: pick(['208', '173.33', '191.1']), tauxHoraire: rnd() < 0.2 ? dec(40) : null },
      variables,
    },
  });
}
process.stdout.write(JSON.stringify({ description: 'Cas aléatoires', cas }, null, 1));
