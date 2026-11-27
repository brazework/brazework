import { encode } from "uqr";

// Résumé verify links (supabase/verify-links.sql): /v/<id> as a recruiter sees it, and its QR code.
// The data comes from public_verify(), which returns a milestone only while it's public and signed
// (or was signed and since revoked). Pure, so the wording is tested (tests/verify-public.test.ts).

export type VerifyState = "valid" | "revoked" | "disputed";
export type PublicVerify = {
  id: string; title: string; detail: string; achieved_on: string | null; project: string; state: VerifyState;
  member: { id: string; first: string; last: string; headline: string };
  signer: { kind: "club" | "vouch"; name: string; role: string; club: string; vouched_by: string; at: string | null };
  pro: { name: string; title: string; employer: string; at: string }[];
  // after_signing / added_at: a link the member added after it was signed (milestone-late-evidence.sql).
  evidence: ({ type: "link" | "commit"; url: string; after_signing?: boolean; added_at?: string | null } | { type: "image"; path: string })[];
  legacy_evidence: string; kept_private: number; revoked_at: string | null; checked_at: string;
};

const ROLES: Record<string, string> = {
  owner: "club president", admin: "club officer", moderator: "club officer", helper: "club helper",
  professor: "professor", ta: "teaching assistant", pi: "lab PI", manager: "coworker", mentor: "mentor", other: "witness",
};

/** The signer's role in plain words ("professor", "club officer"). */
export const roleLabel = (role: string) => ROLES[role] ?? (role ? role.replace(/_/g, " ") : "");

export const verifyDay = (ts: string | null | undefined) =>
  ts ? new Date(ts.length === 10 ? `${ts}T12:00:00Z` : ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

/** Who signed it: their name, role and where, e.g. "Dr. Priya Lee, Assistant Professor · utexas.edu (professor)". */
export function signerLine(v: Pick<PublicVerify, "signer">): string {
  const s = v.signer;
  const role = roleLabel(s.role);
  if (s.kind === "vouch") return `${s.vouched_by || s.name}${role ? ` (${role})` : ""}`;
  return `${s.name || "A club officer"}${role ? `, ${role}` : ""}${s.club ? ` of ${s.club}` : ""}`;
}

/** The status line at the top of the page. */
export function stateLine(v: Pick<PublicVerify, "state" | "signer" | "revoked_at">): { tone: "ok" | "bad" | "warn"; text: string } {
  if (v.state === "valid") return { tone: "ok", text: `${v.signer.kind === "vouch" ? "Signed" : "Verified"} and still valid` };
  const when = v.revoked_at ? ` on ${verifyDay(v.revoked_at)}` : "";
  if (v.state === "disputed") return { tone: "warn", text: `Revoked${when}. The member disputes it, and it's under review` };
  return { tone: "bad", text: `Revoked${when}. It no longer counts as proof` };
}

export const verifyUrl = (site: string, id: string) => `${site.replace(/\/$/, "")}/v/${encodeURIComponent(id)}`;

// LinkedIn's own "add to profile" link (Licenses & certifications): the milestone as the name,
// Brazework as the issuer, and the verify page as the credential URL, so anyone on LinkedIn can open
// who signed it. The member clicks it and saves on LinkedIn themselves; nothing is posted for them.
export function linkedinAddUrl(site: string, id: string, title: string): string {
  const q = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: title.trim().slice(0, 120), organizationName: "Brazework", certUrl: verifyUrl(site, id), certId: id });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}

type EvidenceLink = { type: "link" | "commit"; url: string; after_signing?: boolean; added_at?: string | null };

/** Which links to show as evidence, in order: the milestone's first link, then the rest, each once.
 *  A link added after it was signed keeps `after_signing` and `added_at`, so the page can say so. */
export function evidenceLinks(v: Pick<PublicVerify, "evidence" | "legacy_evidence">): (EvidenceLink & { label: string })[] {
  const links = v.evidence.filter((e): e is EvidenceLink => e.type !== "image");
  const first: EvidenceLink[] = v.legacy_evidence && !links.some((e) => e.url === v.legacy_evidence) ? [{ type: "link", url: v.legacy_evidence }] : [];
  return [...first, ...links].map((e) => ({ ...e, label: e.url.replace(/^https:\/\//, "").replace(/\/$/, "") }));
}

/**
 * A QR code as one SVG path (dark modules only, so it takes the page's colour), with a quiet zone.
 * Medium error correction: still scans from a printed résumé with a crease.
 */
export function qrSvgPath(text: string): { size: number; d: string } {
  const qr = encode(text, { ecc: "M", border: 2 });
  const parts: string[] = [];
  qr.data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w]) w++;
      parts.push(`M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  });
  return { size: qr.size, d: parts.join("") };
}
