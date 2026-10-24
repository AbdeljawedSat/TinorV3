package tn.jas.paie.app.ui;

import java.awt.Component;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Function;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTable;
import javax.swing.SwingConstants;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.DefaultTableCellRenderer;

import tn.jas.paie.app.service.PaieService.RegleMetier;
import tn.jas.paie.app.service.Securite.AccesRefuse;

/** Utilitaires d'interface : formulaires, tables, saisie de nombres et dates, messages d'erreur. */
public final class Ui {
    private Ui() { }

    /** Affiche une erreur compréhensible : message métier tel quel, erreur technique résumée. */
    public static void erreur(Component parent, Throwable e) {
        String msg;
        if (e instanceof RegleMetier || e instanceof AccesRefuse || e instanceof IllegalArgumentException) msg = e.getMessage();
        else if (e instanceof java.sql.SQLException) msg = "Erreur de base de données : " + e.getMessage();
        else msg = "Erreur inattendue : " + e;
        if (!(e instanceof RegleMetier || e instanceof AccesRefuse)) e.printStackTrace();
        JOptionPane.showMessageDialog(parent, msg, "Opération impossible", JOptionPane.ERROR_MESSAGE);
    }

    public static void info(Component parent, String msg) {
        JOptionPane.showMessageDialog(parent, msg, "Information", JOptionPane.INFORMATION_MESSAGE);
    }

    public static boolean confirmer(Component parent, String msg) {
        return JOptionPane.showConfirmDialog(parent, msg, "Confirmation", JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE)
                == JOptionPane.YES_OPTION;
    }

    /** Action qui peut échouer : les erreurs sont affichées proprement. */
    public interface Action { void run() throws Exception; }

    public static void essayer(Component parent, Action a) {
        try {
            a.run();
        } catch (Exception e) {
            erreur(parent, e);
        }
    }

    // ---------- saisie ----------

    /** Décimal accepté avec virgule ou point, espaces ignorés. Vide => null. */
    public static BigDecimal dec(String s, String champ) {
        if (s == null || s.isBlank()) return null;
        try {
            return new BigDecimal(s.trim().replaceAll("[\\s\\u00A0\\u202F]", "").replace(',', '.'));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Valeur numérique invalide pour « " + champ + " » : " + s);
        }
    }

    public static int entier(String s, String champ) {
        if (s == null || s.isBlank()) return 0;
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Nombre entier invalide pour « " + champ + " » : " + s);
        }
    }

    /** Date au format AAAA-MM-JJ ou JJ/MM/AAAA. Vide => null. */
    public static LocalDate date(String s, String champ) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        try {
            if (t.matches("\\d{2}/\\d{2}/\\d{4}"))
                return LocalDate.of(Integer.parseInt(t.substring(6)), Integer.parseInt(t.substring(3, 5)), Integer.parseInt(t.substring(0, 2)));
            return LocalDate.parse(t);
        } catch (java.time.DateTimeException | NumberFormatException e) {
            throw new IllegalArgumentException("Date invalide pour « " + champ + " » (format JJ/MM/AAAA) : " + s);
        }
    }

    public static String txt(Object o) {
        if (o == null) return "";
        if (o instanceof BigDecimal b) return b.toPlainString();
        if (o instanceof LocalDate d) return String.format("%02d/%02d/%04d", d.getDayOfMonth(), d.getMonthValue(), d.getYear());
        return o.toString();
    }

    // ---------- formulaires ----------

    /** Formulaire en deux colonnes : libellé / champ. */
    public static JPanel formulaire(Object... paires) {
        JPanel p = new JPanel(new GridBagLayout());
        p.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        GridBagConstraints g = new GridBagConstraints();
        g.insets = new Insets(3, 4, 3, 4);
        g.anchor = GridBagConstraints.WEST;
        for (int i = 0; i < paires.length; i += 2) {
            g.gridy = i / 2;
            g.gridx = 0;
            g.weightx = 0;
            g.fill = GridBagConstraints.NONE;
            p.add(new JLabel(String.valueOf(paires[i])), g);
            g.gridx = 1;
            g.weightx = 1;
            g.fill = GridBagConstraints.HORIZONTAL;
            p.add((Component) paires[i + 1], g);
        }
        return p;
    }

    public static JLabel titre(String t) {
        JLabel l = new JLabel(t);
        l.setFont(l.getFont().deriveFont(Font.BOLD, l.getFont().getSize() + 3f));
        l.setBorder(BorderFactory.createEmptyBorder(4, 4, 8, 4));
        return l;
    }

    public static <T extends JComponent> T bordure(T c, String titre) {
        c.setBorder(BorderFactory.createTitledBorder(titre));
        return c;
    }

    // ---------- tables ----------

    /** Modèle de table générique à colonnes calculées. */
    public static final class Modele<T> extends AbstractTableModel {
        private final String[] colonnes;
        private final List<Function<T, Object>> valeurs;
        private List<T> lignes = List.of();

        @SafeVarargs
        public Modele(String[] colonnes, Function<T, Object>... valeurs) {
            this.colonnes = colonnes;
            this.valeurs = List.of(valeurs);
        }

        public void definir(List<T> l) {
            this.lignes = List.copyOf(l);
            fireTableDataChanged();
        }

        public List<T> lignes() { return lignes; }

        public T ligne(int i) { return i < 0 || i >= lignes.size() ? null : lignes.get(i); }

        @Override public int getRowCount() { return lignes.size(); }

        @Override public int getColumnCount() { return colonnes.length; }

        @Override public String getColumnName(int c) { return colonnes[c]; }

        @Override public Object getValueAt(int r, int c) { return valeurs.get(c).apply(lignes.get(r)); }

        @Override public Class<?> getColumnClass(int c) {
            for (T t : lignes) {
                Object v = valeurs.get(c).apply(t);
                if (v != null) return v.getClass();
            }
            return Object.class;
        }
    }

    /** Table triable avec montants alignés à droite au format français. */
    public static JTable table(Modele<?> m) {
        JTable t = new JTable(m);
        t.setAutoCreateRowSorter(true);
        t.setFillsViewportHeight(true);
        t.setRowHeight(22);
        DefaultTableCellRenderer montants = new DefaultTableCellRenderer() {
            @Override protected void setValue(Object v) {
                setHorizontalAlignment(SwingConstants.RIGHT);
                super.setValue(v instanceof BigDecimal b ? tn.jas.paie.app.report.BulletinPdf.m(b) : v);
            }
        };
        t.setDefaultRenderer(BigDecimal.class, montants);
        return t;
    }

    /** Ligne de modèle sélectionnée (tient compte du tri). */
    public static <T> T selection(JTable t, Modele<T> m) {
        int v = t.getSelectedRow();
        return v < 0 ? null : m.ligne(t.convertRowIndexToModel(v));
    }
}
