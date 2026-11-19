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
];

/** The refusal, plus how to fix it when there's a choice to make. */
export function withFix(message: string): string {
  const hint = HINTS.find(([re]) => re.test(message))?.[1];
  return hint ? `${message} ${hint}` : message;
}
