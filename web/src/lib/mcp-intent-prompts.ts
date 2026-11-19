import type { PromptDef, Scopes } from "@/lib/mcp-playbooks";

// Prompts that chain the intent tools (supabase/tool-*.sql, docs/mcp-workflows.md). Each one adapts
// to what the token may do and names only tools that token is offered (tests/mcp-playbooks.test.ts
// checks every prompt × every token).

const READ_ONLY_WRITE = "This Brazework token can only read, so write each piece out for me to paste into Brazework, and tell me I can make a token that leaves drafts in Brazework → Settings → Your tools.";

export const INTENT_PROMPTS: PromptDef[] = [
  { name: "career_fair", title: "Get me ready for a career fair", description: "Get ready for a career fair or employer session: check your projects, get unsigned milestones signed, build your résumé section with a link to each signed result, and RSVP you to the employer session. It asks before every step that writes.", arguments: [
    { name: "event", description: "The fair or session, e.g. “Spring Engineering Career Fair”. Leave it out to pick from what's coming up.", required: false },
  ] },
  { name: "club_week", title: "My club's week (officers)", description: "For club officers: Ember's weekly brief for your club, turned into this week's update, a plan for the next meeting, or a recap of the last one, ready for you to post.", arguments: [
    { name: "club", description: "Which club (name or id). Leave it out if you run just one.", required: false },
    { name: "what", description: "update (default), meeting plan, or recap.", required: false },
  ] },
];

export function intentPromptText(name: string, args: Record<string, string | undefined>, s: Scopes): string | null {
  switch (name) {
    case "club_week": {
      const club = args.club?.trim() ? ` (${args.club.trim().slice(0, 120)})` : "";
      const what = /meeting|plan/i.test(args.what ?? "") ? "meeting plan" : /recap/i.test(args.what ?? "") ? "recap" : "update";
      const piece = what === "meeting plan"
        ? "a plan for the club's next meeting: a short agenda built from what's coming up, who's new, what waits for review, and one ask of members"
        : what === "recap" ? "a recap of the club's last week: the events that happened, what members shipped and got verified, the top post, and a thank-you by name to the most active"
        : "this week's update: welcome new members by name, point to the top post, list what's coming up, and invite members to ask the club to verify their work";
      return [
        `Help me run my club${club} this week: write ${piece}.`,
        "1. Call my_clubs and pick the club where I'm a moderator, admin or owner. If there's more than one and I didn't say which, ask me.",
        "2. Call club_brief for it. Use only its numbers and names; never invent any. If it says I'm not an officer there, tell me and stop.",
        `3. Write it in my voice, short, with the links from the brief. ${s.canDraft ? "Show it to me, then save it with draft_announcement: it waits in my Brazework drafts and I post it from there." : READ_ONLY_WRITE}`,
        ...(what === "meeting plan" && s.canDraft ? ["4. If the next meeting isn't on the calendar yet and the brief says I can host events, offer to draft it too (draft_event), with the time I give you and my timezone. I publish it from my drafts."] : []),
        "Don't verify or decline anyone's milestone: if some are waiting for review, say how many and give me the brief's link to review them in Brazework.",
      ].join("\n");
    }
    case "career_fair": {
      const ev = args.event?.trim() ? `“${args.event.trim().slice(0, 160)}”` : "the next career fair or employer session on Brazework";
      return [
        `Get me ready for ${ev}. Go step by step, and ask me before anything that writes.`,
        "1. Call upcoming_events (90 days) and find it, and the employer session if it has its own event. If more than one could match, ask me which.",
        "2. Call my_projects. List my projects, and for each one the open_milestones still waiting for a club or a signature.",
        s.canPost
          ? "3. For each unsigned milestone, ask me who saw it (their university or company email and how they know my work). Show me the ask and send it with request_signature only after my yes. Skip any I say to skip."
          : "3. For each unsigned milestone, tell me who could sign it and that I can ask them from the milestone in Brazework (“Ask someone to vouch”): this token can't email anyone for me.",
        "4. Call my_resume and write the résumé section: one line per signed result (what was achieved, with numbers), who signed it, and its link. Say which results have no public link yet, and that sharing one from the project gives it a proof card anyone can open.",
        s.canDraft
          ? `5. Offer to RSVP me to the employer session (rsvp_event with its event_id)${s.canPost ? ", and do it only after my yes" : "; it waits as a card in my Brazework drafts"}.`
          : "5. Give me the session's link so I can RSVP in Brazework. This token can only read.",
        "6. End with a short checklist: what's signed, what's still waiting, the résumé section, and when and where the session is.",
      ].join("\n");
    }
    default:
      return null;
  }
}
