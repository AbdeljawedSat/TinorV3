-- ============================================================================
-- Ajout de la table `notifications` (système de commandes en attente de
-- stock, avec résolution automatique une fois le format reconditionné).
-- Absente si votre installation date d'avant ce module.
--
-- Usage :
--   mysql -u tinor -p tinor_v3 < scripts\add_notifications.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type         VARCHAR(40) NOT NULL,   -- ex: 'STOCK_FORMAT_MANQUANT'
  titre        VARCHAR(150) NOT NULL,
  message      TEXT NOT NULL,
  commande_id  INT NULL,
  produit_id   INT NULL,
  statut       VARCHAR(15) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','RESOLUE')),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at  DATETIME NULL,
  FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE SET NULL,
  INDEX idx_notifications_statut (statut, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Table notifications OK' AS info;
