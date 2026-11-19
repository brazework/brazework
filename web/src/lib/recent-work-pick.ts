// Your last 90 days, from GitHub (lib/recent-work.ts, the project page): once a repo is linked, the
// build log already holds its merged pull requests (lib/github-actions.ts linkRepo). These rules pick
// the ones the member made themselves and hasn't put on their record yet, so one tap can add them as
// backed milestones, each with who approved it (supabase/approved-by.sql). Pure, so they're tested on
// their own (tests/recent-work.test.ts); nothing here is trusted until GitHub confirms it on the server.

export const RECENT_DAYS = 90;
/** How many are offered at once, and how many one tap adds. */
export const RECENT_MAX = 20;
export const ADD_MAX = 10;

export type MergedEvent = { repo_id: number; title: string; actor: string; ref: string; occurred_at: string };
export type RecentWork = { repoId: number; repo: string; ref: string; title: string; url: string; mergedOn: string };

/** "Merged #12: Fix the telemetry parser" → "Fix the telemetry parser" (a milestone title: 1 to 120 characters). */
export function milestoneTitleFrom(eventTitle: string, ref: string): string {
  const t = eventTitle.replace(/^Merged #\d+:\s*/, "").replace(/\s+/g, " ").trim();
  if (!t) return `Merged pull request #${ref}`;
  return t.length > 120 ? `${t.slice(0, 119)}…` : t;
}

/** The key one pull request has everywhere: the repo (any case) and its number. */
export const workKey = (repo: string, ref: string) => `${repo.toLowerCase()}#${ref}`;

/**
 * The member's own merged pull requests from the last 90 days, newest first, that don't back a
 * milestone yet. `login` is the member's GitHub login; `repos` the project's linked repos; `backed`
 * the keys of pull requests already on a record. The link is built from the repo and the number,
 * never taken from the event.
 */
export function pickRecentWork({ events, login, repos, backed, now = Date.now() }: {
  events: MergedEvent[]; login: string; repos: { repo_id: number; full_name: string }[]; backed: Set<string>; now?: number;
}): RecentWork[] {
  const me = login.trim().toLowerCase();
  if (!me) return [];
  const since = now - RECENT_DAYS * 864e5;
  const name = new Map(repos.map((r) => [r.repo_id, r.full_name]));
  const seen = new Set<string>();
  return events
    .filter((e) => e.actor.toLowerCase() === me && /^[1-9][0-9]{0,8}$/.test(e.ref) && name.has(e.repo_id))
    .map((e) => ({ e, at: Date.parse(e.occurred_at), repo: name.get(e.repo_id)! }))
    .filter(({ at, repo, e }) => Number.isFinite(at) && at > since && at <= now + 864e5 && !backed.has(workKey(repo, e.ref)))
    .sort((a, b) => b.at - a.at)
    .filter(({ repo, e }) => { const k = workKey(repo, e.ref); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, RECENT_MAX)
    .map(({ e, at, repo }) => ({ repoId: e.repo_id, repo, ref: e.ref, title: milestoneTitleFrom(e.title, e.ref), url: `https://github.com/${repo}/pull/${e.ref}`, mergedOn: new Date(at).toISOString().slice(0, 10) }));
}

/** What happened, in a sentence, after a tap. */
export function addedMessage(r: { added: number; hidden: number; skipped: number }): string {
  if (!r.added) return r.skipped ? "None of those could be added: GitHub didn't confirm they're your own merged work. Nothing was saved." : "Pick at least one to add.";
  const base = `Added ${r.added} to your record, backed by GitHub.`;
  const hidden = r.hidden ? ` ${r.hidden === r.added ? (r.added === 1 ? "It's" : "They're") : `${r.hidden} ${r.hidden === 1 ? "is" : "are"}`} from a private repo, so only you see ${r.hidden === 1 ? "it" : "them"} until you choose to show ${r.hidden === 1 ? "it" : "them"}.` : "";
  const skipped = r.skipped ? ` ${r.skipped} couldn't be confirmed and ${r.skipped === 1 ? "was" : "were"} left out.` : "";
  return base + hidden + skipped;
}
