// Daily triage of drafts (supabase/daily-triage.sql): Today shows "Your tools noticed N things" with a
// button for each way a draft can go, and an optional once-a-day reminder email. Pure, so the wording
// and the choices are unit-tested (tests/draft-triage.test.ts).

export type TriageAction = "keep" | "club" | "sign" | "dismiss";
export type TriageClub = { id: string; name: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The heading on Today. */
export const triageHeading = (n: number) => `Your tools noticed ${plural(n, "thing")}`;

/**
 * The buttons a draft gets, in order. A milestone can be kept on the project (it waits for proof),
 * sent to a club's officers, or kept with a signature asked for; a post is posted, or posted in a club.
 * Send to club shows only when the member is in a club; dismissing is always there.
 */
export function triageActions(kind: "post" | "milestone", clubs: TriageClub[]): { action: TriageAction; label: string }[] {
  const club = clubs.length ? [{ action: "club" as const, label: kind === "post" ? "Post to club" : "Send to club" }] : [];
  if (kind === "post") return [{ action: "keep", label: "Post" }, ...club, { action: "dismiss", label: "Dismiss" }];
  return [{ action: "keep", label: "Keep" }, ...club, { action: "sign", label: "Ask to sign" }, { action: "dismiss", label: "Dismiss" }];
}

/** Which club "Send to club" picks first: the one the tool drafted it for, if the member is in it, else their first. */
export function defaultClub(drafted: string | null | undefined, clubs: TriageClub[]): string | null {
  if (drafted && clubs.some((c) => c.id === drafted)) return drafted;
  return clubs[0]?.id ?? null;
}

/** What happened, in a line, after a tap. */
export function triageDone(action: Exclude<TriageAction, "sign">, kind: "post" | "milestone", club?: string): string {
  if (action === "dismiss") return "Dismissed.";
  if (kind === "post") return club ? `Posted in ${club}.` : "Posted.";
  return action === "club" ? `Sent to ${club ?? "your club"} to verify.` : "Kept on your project. Ask someone to sign it when you're ready.";
}

// Drafts Today can't decide in a tap (a project, a teammate, an RSVP… from Jig or a connected
// assistant): one line that says what's waiting and links to Drafts, so nothing a tool left is hidden.
const OTHER: Record<string, string> = {
  project: "a new project", project_edit: "a change to a project", teammate: "a teammate to add", rsvp: "an RSVP",
  join: "a club to join", invite: "an invite to accept", message: "a reply", event: "a club event",
  club_post: "a club announcement", follow: "someone to follow",
};
/** What the newest of the other drafts is, in words: "a new project". */
export const otherDraftLabel = (kind: string) => OTHER[kind] ?? "a draft";
/** The line on Today for `n` other drafts, newest first: "A new project: “Brazework”" or "3 more in Drafts, newest a new project". */
export function waitingElsewhere(n: number, newest: { kind: string; title?: string | null } | null): string {
  if (n < 1) return "";
  const label = otherDraftLabel(newest?.kind ?? "");
  const title = newest?.title?.trim() ? `: \u201c${newest.title.trim().slice(0, 80)}\u201d` : "";
  return n === 1 ? `${label.charAt(0).toUpperCase()}${label.slice(1)}${title}` : `${n} more in Drafts, newest ${label}${title}`;
}

// ---------- The once-a-day reminder ----------
export type ReminderRow = { first_name: string; waiting: number; fresh: number; tools: { via: string; n: number }[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "2 from GitHub Actions and 1 from Claude Code". Only tool names and counts, never what a draft says. */
export function reminderSources(tools: { via: string; n: number }[]): string {
  const parts = tools.filter((t) => t.n > 0).map((t) => `${t.n} from ${t.via}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function buildDraftReminder(row: ReminderRow, site: string): { subject: string; text: string; html: string } | null {
  if (row.fresh < 1) return null;
  const subject = `Your tools noticed ${plural(row.fresh, "new thing")} for your record`;
  const hi = row.first_name ? `Hi ${row.first_name},` : "Hi,";
  const from = reminderSources(row.tools);
  const older = row.waiting - row.fresh;
  const line = `${plural(row.fresh, "new draft")}${from ? ` (${from})` : ""}${older > 0 ? `, and ${older} from before` : ""}. Keep, send to a club, ask for a signature or dismiss each one in a tap. Nothing is posted until you do.`;
  const open = `${site}/feed#triage`;
  const settings = `${site}/settings#email`;
  const text = [hi, "", line, "", `Open Today: ${open}`, "", `You turned on this daily reminder. Turn it off in Settings: ${settings}`].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">
<p>${esc(hi)}</p><p>${esc(line)}</p>
<p><a href="${esc(open)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Today</a></p>
<p style="font-size:12px;color:#666">You turned on this daily reminder. <a href="${esc(settings)}" style="color:#666">Turn it off in Settings</a>.</p></div>`;
  return { subject, text, html };
}
