<script>
  // Échappement HTML de toute valeur saisie par un utilisateur avant insertion dans une page (noms, notes, numéros…).
  // Texte inséré dans un onclick="f('…')" : d'abord protégé pour JavaScript (apostrophe, barre oblique), puis pour HTML.
  function attrJs(v) { return esc(String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // ============================================================================
  // COUCHE API — connexion à tinor-api-v3 (Express + MariaDB), plus de données
  // fictives : tout ce qui suit vient réellement de la base.
  // ============================================================================
