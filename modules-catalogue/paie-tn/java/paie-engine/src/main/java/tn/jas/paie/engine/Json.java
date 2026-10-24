package tn.jas.paie.engine;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lecteur/écrivain JSON minimal, sans dépendance externe.
 * Les nombres sont lus en BigDecimal (jamais en double) pour préserver l'exactitude des montants.
 */
public final class Json {
    private final String s;
    private int i;

    private Json(String s) { this.s = s; }

    public static Object parse(String text) {
        Json p = new Json(text);
        p.ws();
        Object v = p.value();
        p.ws();
        if (p.i != p.s.length()) throw p.err("Caractères inattendus après la fin du JSON");
        return v;
    }

    private IllegalArgumentException err(String m) {
        return new IllegalArgumentException("JSON invalide (position " + i + ") : " + m);
    }

    private void ws() {
        while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
    }

    private Object value() {
        if (i >= s.length()) throw err("fin inattendue");
        char c = s.charAt(i);
        switch (c) {
            case '{': return object();
            case '[': return array();
            case '"': return string();
            case 't': lit("true"); return Boolean.TRUE;
            case 'f': lit("false"); return Boolean.FALSE;
            case 'n': lit("null"); return null;
            default:
                if (c == '-' || (c >= '0' && c <= '9')) return number();
                throw err("valeur inattendue '" + c + "'");
        }
    }

    private void lit(String w) {
        if (!s.startsWith(w, i)) throw err("attendu " + w);
        i += w.length();
    }

    private Map<String, Object> object() {
        Map<String, Object> m = new LinkedHashMap<>();
        i++; ws();
        if (s.charAt(i) == '}') { i++; return m; }
        while (true) {
            ws();
            if (s.charAt(i) != '"') throw err("clé attendue");
            String k = string();
            ws();
            if (s.charAt(i) != ':') throw err("':' attendu");
            i++; ws();
            m.put(k, value());
            ws();
            char c = s.charAt(i++);
            if (c == '}') return m;
            if (c != ',') throw err("',' ou '}' attendu");
        }
    }

    private List<Object> array() {
        List<Object> l = new ArrayList<>();
        i++; ws();
        if (s.charAt(i) == ']') { i++; return l; }
        while (true) {
            ws();
            l.add(value());
            ws();
            char c = s.charAt(i++);
            if (c == ']') return l;
            if (c != ',') throw err("',' ou ']' attendu");
        }
    }

    private String string() {
        StringBuilder b = new StringBuilder();
        i++;
        while (true) {
            if (i >= s.length()) throw err("chaîne non terminée");
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c == '\\') {
                char e = s.charAt(i++);
                switch (e) {
                    case '"': b.append('"'); break;
                    case '\\': b.append('\\'); break;
                    case '/': b.append('/'); break;
                    case 'b': b.append('\b'); break;
                    case 'f': b.append('\f'); break;
                    case 'n': b.append('\n'); break;
                    case 'r': b.append('\r'); break;
                    case 't': b.append('\t'); break;
                    case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                    default: throw err("échappement invalide");
                }
            } else b.append(c);
        }
    }

    private BigDecimal number() {
        int st = i;
        while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        return new BigDecimal(s.substring(st, i));
    }

    // ---------- écriture ----------

    public static String write(Object v) {
        StringBuilder b = new StringBuilder();
        write(b, v, 0, true);
        return b.toString();
    }

    public static String writeCompact(Object v) {
        StringBuilder b = new StringBuilder();
        write(b, v, 0, false);
        return b.toString();
    }

    @SuppressWarnings("unchecked")
    private static void write(StringBuilder b, Object v, int ind, boolean pretty) {
        if (v == null) b.append("null");
        else if (v instanceof String str) quote(b, str);
        else if (v instanceof BigDecimal bd) b.append(bd.toPlainString());
        else if (v instanceof Number || v instanceof Boolean) b.append(v);
        else if (v instanceof Map<?, ?> m) {
            if (m.isEmpty()) { b.append("{}"); return; }
            b.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!first) b.append(',');
                first = false;
                nl(b, ind + 1, pretty);
                quote(b, String.valueOf(e.getKey()));
                b.append(pretty ? ": " : ":");
                write(b, e.getValue(), ind + 1, pretty);
            }
            nl(b, ind, pretty);
            b.append('}');
        } else if (v instanceof List<?> l) {
            if (l.isEmpty()) { b.append("[]"); return; }
            b.append('[');
            for (int k = 0; k < l.size(); k++) {
                if (k > 0) b.append(',');
                nl(b, ind + 1, pretty);
                write(b, l.get(k), ind + 1, pretty);
            }
            nl(b, ind, pretty);
            b.append(']');
        } else quote(b, v.toString());
    }

    private static void nl(StringBuilder b, int ind, boolean pretty) {
        if (!pretty) return;
        b.append('\n');
        b.append("  ".repeat(ind));
    }

    private static void quote(StringBuilder b, String s) {
        b.append('"');
        for (int k = 0; k < s.length(); k++) {
            char c = s.charAt(k);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        b.append('"');
    }
}
