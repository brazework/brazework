// Proof without revealing confidential work (supabase/redacted-proof.sql): a private milestone's public
// line, as other members see it, with who stood behind it in general terms and the month. The data
// comes from redacted_proof(), which never returns the title, project, signer, domain or club. Pure,
// so the wording is tested (tests/redacted.test.ts).

export type Redacted = {
  id: string; line: string; month: string; pro: boolean;
  // org: "work" is a work address at a company that wasn't verified on Brazework when it signed
  // (supabase/work-email-signers.sql): never called verified. "personal" is a personal address
  // (Gmail and the like, supabase/personal-email-signers.sql): never called a company's.
  signer: { kind: "club" } | { kind: "vouch"; role: string; org: "university" | "company" | "work" | "personal" };
};

const ROLE: Record<string, string> = { professor: "a professor", ta: "a TA", pi: "a lab PI", manager: "a manager", mentor: "a mentor", other: "someone who saw it" };

/** "signed by a manager at a verified company", "verified by a club's officers". */
export function redactedSigner(r: Pick<Redacted, "signer" | "pro">): string {
  const base = r.signer.kind === "club" ? "verified by a club's officers"
    : r.signer.org === "personal"
      ? `signed by ${ROLE[r.signer.role] ?? "someone who saw it"} (from a personal email)`
      : `signed by ${ROLE[r.signer.role] ?? "someone who saw it"} at ${r.signer.org === "university" ? "a university" : r.signer.org === "work" ? "a company (not verified)" : "a verified company"}`;
  return r.pro ? `${base}, and signed off by a professional at a verified company` : base;
}

export const redactedMonth = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** The whole public line: "Shipped a payments migration · signed by a manager at a verified company · Nov 2026". */
export const redactedText = (r: Redacted) => [r.line, redactedSigner(r), redactedMonth(r.month)].filter(Boolean).join(" · ");
