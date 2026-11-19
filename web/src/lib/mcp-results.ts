// What an MCP tool says back, beyond its data (docs/mcp-workflows.md): every write ends with a
// plain next step and the link to open it in Brazework, and every refusal says how to fix it. The
// assistant shows these to the member as they are. Pure, and tested (tests/mcp-results.test.ts).

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const site = (origin: string, path: string) => `${origin.replace(/\/$/, "")}${path}`;

/** The next step after a write, and where to see it. Null for reads (their data already has links). */
export function nextStep(tool: string, data: unknown, origin: string): { next: string; open?: string } | null {
  const d = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Data;
  switch (tool) {
    case "post_update": {
      const url = str(d.url) || (str(d.id) ? site(origin, `/post/${str(d.id)}`) : "");
      return { next: "Posted on the member's Brazework feed. Share the link if they'd like it seen.", open: url || undefined };
    }
    case "log_milestone": {
      const project = str(d.project_url) ? (str(d.project_url).startsWith("http") ? str(d.project_url) : site(origin, str(d.project_url))) : undefined;
      if (str(d.status) === "pending" && str(d.club))
        return { next: `Sent to ${str(d.club)}. Its officers verify it; the member is notified when they do, and can then share it as a card.`, open: project };
      return { next: `It's on the member's record, waiting for a signature. Offer to ask whoever saw it: request_signature with milestone_id "${str(d.id)}" and their school or company email.`, open: project };
    }
    case "draft_post":
    case "draft_milestone":
      return d.duplicate === true
        ? { next: "This was drafted before (same source_key), so nothing new was added. It's still in the member's Brazework drafts.", open: site(origin, "/drafts") }
        : { next: "Waiting in the member's Brazework drafts. They can edit it there, then post it or dismiss it. Nothing goes out before that.", open: site(origin, "/drafts") };
    case "request_signature":
      return null; // Says its own next step (the email went out, and to whom).
  }
  // Actions shared with Ember (supabase/tool-actions.sql): drafted, or done with the member's yes.
  if ((tool === "draft_event" || tool === "draft_announcement") && d.drafted === true && d.duplicate !== true)
    return { next: "Waiting as a card in the member's Brazework drafts. They check it there and publish it to the club; nothing goes out before that.", open: site(origin, "/drafts") };
  if (tool === "draft_reply" && d.drafted === true && d.duplicate !== true)
    return { next: "Waiting as a card in the member's Brazework drafts. They read it, edit it if they like, and press Confirm to send it. Nothing is sent before that.", open: site(origin, "/drafts") };
  if (d.drafted === true) {
    return d.duplicate === true
      ? { next: "This was drafted before (same source_key), so nothing new was added. It's still in the member's Brazework drafts.", open: site(origin, "/drafts") }
      : { next: "Waiting as a card in the member's Brazework drafts (and on Ember's page). They can edit it there, then confirm or dismiss it. Nothing happens before that.", open: site(origin, "/drafts") };
  }
  const url = str(d.url) ? (str(d.url).startsWith("http") ? str(d.url) : site(origin, str(d.url))) : undefined;
  switch (tool) {
    case "create_project":
      return { next: `"${str(d.title)}" is on the member's profile. Next: when something on it works, log a milestone (log_milestone with project_id "${str(d.id)}"), or add a teammate from their clubs (add_teammate).`, open: url };
    case "update_project": {
      const changed = Array.isArray(d.changed) ? (d.changed as string[]).join(", ") : "";
      return { next: `Saved${changed ? ` (${changed})` : ""} on "${str(d.title)}". Open it to check how it reads.`, open: url };
    }
    case "add_teammate":
      return { next: `${str(d.person)} is on "${str(d.title)}" as ${str(d.role) === "viewer" ? "a viewer" : "a teammate"}. Teammates can post updates and log milestones on it, but can't sign its milestones.`, open: url };
    case "rsvp_event": {
      const when = str(d.starts_at) ? new Date(str(d.starts_at)).toUTCString().replace(/:00 GMT$/, " UTC") : "";
      return str(d.status) === "not going"
        ? { next: `The member's spot at "${str(d.title)}" is given back. The host's count goes down by one.`, open: url }
        : { next: `The member is going to "${str(d.title)}"${when ? ` (${when})` : ""}${str(d.host) ? `, hosted by ${str(d.host)}` : ""}. The event page has its chat and a calendar file.`, open: url };
    }
    case "join_club":
      return str(d.status) === "requested"
        ? { next: `Asked to join ${str(d.title)}. Its moderators approve new members; the member is notified when they do.`, open: url }
        : { next: `The member is in ${str(d.title)}. Next: its events (upcoming_events), or share work with it (post_update with club_id "${str(d.id)}").`, open: url };
    case "follow_person":
      return { next: `The member follows ${str(d.title)}: their posts and signed work show in the member's feed.`, open: url };
    case "accept_invite":
      return { next: `The member is in ${str(d.title)}. Next: its events (upcoming_events), or say hello in it (post_update with club_id "${str(d.id)}").`, open: url };
    default:
      return null;
  }
}

// Refusals the database explains already ("That isn't one of your projects. my_projects lists them…")
// get one more line where the member or the assistant has a choice to make.
const HINTS: [RegExp, string][] = [
  [/university or company address/i, "Ask the member for that person's school or work address. If they only have a personal address, keep the milestone waiting and ask someone else who saw it, or send it to a club the member is in (my_clubs)."],
  [/isn'?t on the project/i, "Teammates can't sign each other's work. Ask a professor, PI, manager or mentor who saw it."],
  [/asked 3 people|already asked them/i, "Wait for an answer: the member is notified. my_projects shows what's still open."],
  [/asks this week|drafts this hour|milestones waiting for review/i, "This is a limit, not an error. Tell the member, and try again later."],
  [/30 drafts waiting/i, "The member has drafts to review first. Point them to Brazework → Drafts."],
  [/evidence/i, "Evidence is 1 to 8 https links: the commit, pull request, CI run, video, doc or report."],
  [/isn'?t waiting for proof|no longer exists/i, "Call my_projects: open_milestones lists the ones still waiting, with their ids."],
  [/aren'?t in any of your clubs/i, "Use search to find someone in one of the member's clubs (my_clubs)."],
  [/always left as a draft/i, "Call it again with draft: true; the member confirms it in Brazework."],
  [/admins of a verified company or school/i, "Company search is for verified organizations. The member can register theirs at brazework.com/org with a work email."],
  [/admins and owner can host/i, "A moderator can still draft an announcement (draft_announcement) and ask an admin to publish the event."],
  [/moderators, admins and owner/i, "my_clubs shows the member's role in each club."],
  [/invite link has expired/i, "Or ask to join the club instead (join_club)."],
  [/already asked to join/i, "Nothing to do: the member is notified."],
];

// What a hint points the assistant to: a tool (my_clubs, join_club) or a page (/org).
const POINTERS = /\b[a-z]+(?:_[a-z]+)+\b|\/org\b/g;

/** The refusal, plus how to fix it when there's a choice to make. A hint only adds what the refusal
 *  doesn't already say: one pointing where the message already points (the database's own refusals
 *  often name my_clubs or /org) is left off, so the assistant never reads the same advice twice. */
export function withFix(message: string): string {
  const hint = HINTS.find(([re]) => re.test(message))?.[1];
  if (!hint) return message;
  const pointers = hint.match(POINTERS) ?? [];
  if (pointers.some((p) => message.includes(p))) return message;
  return `${message} ${hint}`;
}
