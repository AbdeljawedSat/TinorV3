  // ---------- Connexion simplifiée (V3.3) ----------
  // L'adresse du serveur n'est montrée qu'à la demande (« changer ») ou si la
  // connexion échoue.
  function majServeurAffiche() {
    const v = document.getElementById('apiBaseInput').value.trim();
    let hote = v;
    try { hote = new URL(v).host; } catch {}
    document.getElementById('serveurAffiche').textContent = hote || '—';
  }
  function montrerChampServeur() {
    document.getElementById('serveurBloc').classList.remove('periodeCachee');
    document.getElementById('serveurLigne').classList.add('periodeCachee');
  }
  document.getElementById('serveurChanger').addEventListener('click', (e) => { e.preventDefault(); montrerChampServeur(); document.getElementById('apiBaseInput').focus(); });
  document.getElementById('apiBaseInput').addEventListener('input', majServeurAffiche);
  majServeurAffiche();
  setTimeout(majServeurAffiche, 1500); // l'adresse peut être détectée après coup (console servie par l'API)

