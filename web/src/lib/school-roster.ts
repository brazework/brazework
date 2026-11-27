// Reading the lists a school pastes or uploads (the school portal, supabase/school-portal.sql). A class
// roster is any text with email addresses in it: a CSV export from the registrar or the LMS, or one
// email per line. A faculty list is CSV rows of email, name, title (a header row is skipped). Pure,
// and tested (tests/school-roster.test.ts).

const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Every distinct email in the text, lowercased, in the order they appear. */
export function parseEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(EMAIL)) seen.add(m[0].toLowerCase());
  return [...seen].slice(0, 1000);
}

/** One CSV line split on commas, with quoted fields ("Smith, Jr.") kept whole. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if ((ch === "," || ch === "\t" || ch === ";") && !quoted) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Faculty rows from CSV text: the email is whichever cell has one; then name and title in order. */
export function parseFaculty(text: string): { email: string; name: string; title: string }[] {
  const rows: { email: string; name: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const c = cells(line);
    const at = c.findIndex((x) => /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(x));
    if (at < 0) continue;
    const email = c[at].toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const rest = c.filter((_, i) => i !== at && c[i] !== "");
    rows.push({ email, name: (rest[0] ?? "").slice(0, 80), title: (rest[1] ?? "").slice(0, 80) });
  }
  return rows.slice(0, 2000);
}

/** This term and the next, for the class form: "Fall 2026", "Spring 2027". */
export function termsAround(now: Date): string[] {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const current = m <= 4 ? `Spring ${y}` : m <= 7 ? `Summer ${y}` : `Fall ${y}`;
  const next = m <= 4 ? `Summer ${y}` : m <= 7 ? `Fall ${y}` : `Spring ${y + 1}`;
  const after = m <= 4 ? `Fall ${y}` : m <= 7 ? `Spring ${y + 1}` : `Summer ${y + 1}`;
  return [current, next, after];
}

/** The evidence export as CSV text, quoted for spreadsheets, with a header row. */
export function evidenceCsv(rows: Record<string, string | null>[], columns: [key: string, label: string][]): string {
  const q = (v: string | null | undefined) => {
    const s = String(v ?? "");
    // A leading = + - @ would be read as a formula by a spreadsheet: keep it text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [columns.map(([, label]) => q(label)).join(","), ...rows.map((r) => columns.map(([k]) => q(r[k])).join(","))].join("\r\n") + "\r\n";
}
