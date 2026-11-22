// A school's domain from its website, and whether an email is at it, the same way the database checks
// (supabase/school-links.sql and school-link-email.sql, Linear FIX-237). Used to warn before asking, so
// an officer finds out before the request is refused. Pure, and tested (tests/school-domain.test.ts).

const ACADEMIC = /^([a-z0-9-]+\.)*[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$/;

// "https://www.hartford.edu/student-life" → "hartford.edu"; "" when it isn't an academic domain.
export function schoolDomain(website: string) {
  const host = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  return ACADEMIC.test(host) ? host : "";
}

// ben@hartford.edu and ben@eng.hartford.edu are at hartford.edu; ben@nothartford.edu isn't.
export function emailAtDomain(email: string | null | undefined, domain: string) {
  const host = (email ?? "").toLowerCase().split("@")[1] ?? "";
  const d = domain.toLowerCase();
  return !!host && !!d && (host === d || host.endsWith(`.${d}`));
}
