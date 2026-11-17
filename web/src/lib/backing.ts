// "Backed by GitHub": the middle level of proof, between logged and signed (Linear FIX-121; design in
// docs/superpowers/specs/2026-11-17-backed-by-github-design.md). Which evidence links can be checked,
// and when GitHub's answer backs the member's claim. The member's own GitHub account is the one they
// proved at GitHub sign-in, compared by id because usernames can change. Pure, so the rules are
// tested on their own (tests/backing.test.ts); lib/backing-check.ts asks GitHub.

export type BackingKind = "commit" | "pull_request" | "release";
export type GitHubEvidence = { fullName: string; kind: BackingKind; ref: string };

const NAME = "[A-Za-z0-9_.-]{1,100}";
const PATTERNS: [BackingKind, RegExp][] = [
  ["commit", new RegExp(`^https://github\\.com/(${NAME}/${NAME})/commit/([0-9a-f]{7,40})(?:[/?#].*)?$`, "i")],
  ["pull_request", new RegExp(`^https://github\\.com/(${NAME}/${NAME})/pull/([1-9][0-9]{0,8})(?:[/?#].*)?$`)],
  ["release", new RegExp(`^https://github\\.com/(${NAME}/${NAME})/releases/tag/([^/?#\\s]{1,200})(?:[?#].*)?$`)],
];

/** The repo and the thing an evidence link points at, when it's a GitHub commit, pull request or
 *  release on github.com; null for anything else (a repo's front page, an issue, another host). */
export function parseGitHubEvidence(url: string): GitHubEvidence | null {
  const u = url.trim();
  for (const [kind, re] of PATTERNS) {
    const m = re.exec(u);
    if (m) return { fullName: m[1], kind, ref: kind === "release" ? decodeURIComponent(m[2]) : m[2] };
  }
  return null;
}

/** What GitHub said about it: who made it, and for a pull request or release whether it's final. */
export type GitHubFacts = { authorId: number | null; merged?: boolean; draft?: boolean; landed?: boolean };
export type BackingReason = "not_github" | "not_linked" | "no_account" | "other_author" | "not_merged" | "not_landed" | "draft" | "unreachable" | "off" | "already_used";

export function judgeBacking(kind: BackingKind, facts: GitHubFacts, memberGithubId: number | null): { ok: true } | { ok: false; reason: BackingReason } {
  if (memberGithubId == null) return { ok: false, reason: "no_account" };
  if (kind === "commit" && facts.landed === false) return { ok: false, reason: "not_landed" };
  if (facts.authorId == null || facts.authorId !== memberGithubId) return { ok: false, reason: "other_author" };
  if (kind === "pull_request" && !facts.merged) return { ok: false, reason: "not_merged" };
  if (kind === "release" && facts.draft) return { ok: false, reason: "draft" };
  return { ok: true };
}

/** Why it couldn't be backed, as the member reads it. */
export function backingMessage(r: BackingReason): string {
  switch (r) {
    case "not_github": return "This link isn't a GitHub commit, pull request or release, so it can't be backed. Ask someone who saw it instead.";
    case "not_linked": return "Link this repo to the project first: open the project, then Connect GitHub.";
    case "no_account": return "Connect your GitHub account on this project first, so we know which commits are yours.";
    case "other_author": return "GitHub says someone else made this. Only your own work can be backed.";
    case "not_merged": return "This pull request isn't merged yet. Back it once it's merged.";
    case "not_landed": return "This commit isn't on the repo's main branch yet. Back it once it's merged.";
    case "draft": return "This release is still a draft. Back it once it's published.";
    case "unreachable": return "Couldn't reach GitHub right now. Try again, or ask someone who saw it.";
    case "off": return "Backing with GitHub isn't switched on yet. Ask someone who saw it instead.";
    case "already_used": return "This already backs another milestone. One piece of work backs one milestone.";
  }
}
