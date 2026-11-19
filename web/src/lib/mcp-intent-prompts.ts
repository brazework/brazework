import type { PromptDef, Scopes } from "@/lib/mcp-playbooks";

// Prompts that chain the intent tools (supabase/tool-*.sql, docs/mcp-workflows.md). Each one adapts
// to what the token may do and names only tools that token is offered (tests/mcp-playbooks.test.ts
// checks every prompt × every token).

const READ_ONLY_WRITE = "This Brazework token can only read, so write each piece out for me to paste into Brazework, and tell me I can make a token that leaves drafts in Brazework → Settings → Your tools.";

export const INTENT_PROMPTS: PromptDef[] = [
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
    default:
      return null;
  }
}
