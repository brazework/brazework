// Proof cards (Linear FIX-128): one shared result as the public sees it, on /p/<id>, in its preview
// image and in a post. The data comes from public_proof() (supabase/proof-cards.sql), which returns
// only public-safe fields of results their owner chose to share. Pure, so the wording is tested
// (tests/proof-card.test.ts). A backed result never says "verified": only a person signs.

import { approvedLine } from "@/lib/backing";
export type PublicProof = {
  id: string; title: string; detail: string; achieved_on: string; level: "signed" | "backed" | "waiting"; project: string;
  member: { id: string; first: string; last: string; headline: string; avatar: string };
  witness: { name: string; role: string; club: string; vouched_by: string; at: string | null; signed_count?: number } | null;
  // approvals, approvers: who approved the pull request on GitHub (supabase/approved-by.sql).
  backing: { kind: "commit" | "pull_request" | "release"; repo: string; ref: string; url: string; approvals?: number | null; approvers?: string[] | null } | null;
  image: string | null; shared_at: string;
  // A waiting card (supabase/waiting-cards.sql): who was asked. Never their address.
  waiting_for?: { club: string | null; asked: { relationship: string; domain: string } | null } | null;
};

const ASKED: Record<string, string> = { professor: "a professor", ta: "a TA", pi: "a lab PI", manager: "a coworker", mentor: "a mentor", other: "someone who saw it" };
/** Who a waiting card waits for: "Rocketry Club", or "a professor at utexas.edu". */
export function waitingFor(p: PublicProof): string {
  const w = p.waiting_for;
  if (w?.club) return w.club;
  if (w?.asked) return `${ASKED[w.asked.relationship] ?? "someone who saw it"}${w.asked.domain ? ` at ${w.asked.domain}` : ""}`;
  return "";
}

const day = (ts: string) => new Date(ts.length === 10 ? `${ts}T12:00:00Z` : ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The line under the result: who signed it and when, or what GitHub checked. */
export function proofBadge(p: PublicProof): string {
  if (p.level === "waiting") {
    const who = waitingFor(p);
    return p.waiting_for?.club ? `Not signed yet · waiting for ${who} to verify` : `Not signed yet · waiting for ${who || "the person who saw it"} to sign`;
  }
  if (p.level === "backed" && p.backing) {
    const what = p.backing.kind === "commit" ? `commit ${p.backing.ref.slice(0, 7)}` : p.backing.kind === "pull_request" ? `PR #${p.backing.ref}` : `release ${p.backing.ref}`;
    const approved = approvedLine(p.backing);
    return `Backed by GitHub · ${what} in ${p.backing.repo}${approved ? ` · ${approved}` : ""}`;
  }
  const w = p.witness;
  if (!w) return "Signed";
  const when = w.at ? ` · ${day(w.at)}` : "";
  if (w.vouched_by) return `Signed by ${w.vouched_by}${when}`;
  return `Verified by ${w.name || "an officer"}${w.role ? ` (${w.role})` : ""}${w.club ? `, ${w.club}` : ""}${when}`;
}

export const proofUrl = (site: string, id: string) => `${site.replace(/\/$/, "")}/p/${encodeURIComponent(id)}`;

/** What a post says: the result, and who stands behind it. */
export function proofPostText(p: PublicProof): string {
  if (p.level === "backed") return `${p.title}. Backed by GitHub${approvedLine(p.backing) ? `, ${approvedLine(p.backing)}` : ""}, on Brazework.`;
  if (p.level === "waiting") return `${p.title}. On my Brazework record, waiting for ${waitingFor(p) || "the person who saw it"} to sign.`;
  const w = p.witness;
  const who = w?.vouched_by ? w.vouched_by.split(",")[0] : w?.name;
  return `${p.title}. ${w?.vouched_by ? "Signed" : "Verified"} by ${who || "an officer"}${w?.club && !w.vouched_by ? `, ${w.club}` : ""}, on Brazework.`;
}

export function shareLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${u}`,
  };
}
