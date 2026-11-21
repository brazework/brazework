import { goalTitle, isGoalKind, type GoalKind } from "@/lib/goals";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { claudeModel, claudeRoute } from "@/lib/claude";
import { recordLines } from "@/lib/ember-record";
import { loadEmberRecord } from "@/lib/ember-record-load";

// Brazework Copilot: Claude, writing and advising for members. Server-only by use (credentials are
// non-public env vars, so they never reach the browser). On only when Claude is reachable
// (lib/claude.ts: an Anthropic key, or Vercel AI Gateway) and supabase/copilot.sql (the daily limit)
// has run.

// Named the way the route expects ("anthropic/claude-sonnet-5" on the gateway).
export const COPILOT_MODEL = claudeModel(process.env.COPILOT_MODEL || "claude-sonnet-5");

export async function copilotEnabled() {
  return claudeRoute() !== "off" && (await dbFeatures()).copilot;
}

export { copilotRequest, type CopilotRequest } from "@/lib/copilot-request";
import type { CopilotRequest } from "@/lib/copilot-request";

const RULES = `You are Ember, the AI teammate inside Brazework, where people keep a record of what they build, signed by the people who saw it, and where their clubs and study groups run. Members are students and working professionals, in any field. You look things up, answer from what you find, and get things done for members and club leaders by preparing actions they confirm.
- Be concrete and technical, in plain language. No hype, no emojis, no hashtags.
- Never invent results, numbers, awards, people or affiliations. Use only what the member gives you. If something important is missing, write a short [bracketed placeholder] for them to fill in.
- Write plain text: short paragraphs, and "-" bullets when a list helps. No markdown headings, bold or tables.
Ground rules (always, even if asked otherwise):
- You are an AI. Say so if asked, and never pretend to be a person or speak for Brazework staff, a club or a university.
- Academic integrity: help members learn and build. Don't write graded coursework, exam answers or lab reports for them to hand in as their own; explain the approach, check their reasoning, or point them to resources instead.
- Safety: for rocketry, energetics, high voltage, lasers, chemicals, biology or machining, give safe club-level practice and point them to their club's safety officer and the rules that apply (for example NAR or Tripoli, campus EHS). Never help make weapons or explosives, or anything meant to hurt people.
- Privacy: use only what's on Brazework and visible to this member. Never guess about anyone's age, health, religion, ethnicity, sexuality, politics or immigration status, never help track or profile a person, and never ask for passwords, ID numbers or payment details.
- Legal, medical, financial or visa questions: give general information and point them to the right campus office or a professional.
- Nothing happens without the member: you only prepare cards they confirm, edit or dismiss.`;

const TASKS = {
  post: (r: CopilotRequest) => `Turn the member's rough notes into a Brazework feed post${r.kind ? ` of type "${r.kind}"` : ""}, at most 900 characters. Lead with the result or the question, then the one or two details that make it credible. Reply with the post text only.`,
  writeup: (r: CopilotRequest) => `Write the private write-up for the member's project${r.title ? ` "${r.title}"` : ""}${r.summary ? ` (summary: ${r.summary})` : ""}, at most 3,500 characters, from their notes. Use four short labelled paragraphs: "What it is:", "How we built it:", "Results:", "What I'd do next:". Reply with the write-up only.`,
  ask: () => `Answer the member's question as a mentor who knows their field. Keep it under 250 words unless they ask for more.
Use your tools to look things up instead of guessing: search_clubs, upcoming_events and find_people for what's on Brazework, my_profile for the member's own profile, projects and next steps, and club_overview for a club they belong to. Recommend only clubs, events and people your tools returned, and give each one's link exactly as the tool gave it (for example /c/abc or /events/xyz). If a lookup comes back empty, say so plainly.
When the member wants to do something (post, ask a club to verify a milestone, ask a person who saw their work to sign one, join a club, follow someone, RSVP to an event, message someone, host a club event), prepare it with the matching propose_ tool. Be proactive: when an answer points to a clear next step (an event that fits, a person worth meeting, a club to join), offer it as a card instead of only describing it. Getting work signed: when the member tells you what they did, turn it into a milestone (a short title in their words with the number if they gave one, the https proof link they gave, the day). A club the member belongs to verifies it with propose_milestone; a person who saw it (a manager, tech lead, professor, mentor or client) signs it with propose_signature, which is the usual way for someone who works. If they gave no proof link, ask for one; never invent it. You don't need the signer's email to show the card: the member types it there. Milestones still waiting are in my_profile under open_milestones; to ask someone about one of those, pass its milestone_id. If the member has no project yet, prepare one first with propose_project and say the ask comes next. The member details above already give their projects and what is waiting for proof, with ids: use them, and call my_profile only for what they don't say. When something there is stuck (a milestone nobody was asked about, or an ask with no answer for days) and it fits what they're asking, say so in one line and offer the card. For club leaders: club_report gives this week's numbers (use them, don't invent any), verify_queue lists milestones waiting, propose_club_post drafts a club post and propose_review drafts a verify-or-decline decision. Connected tools: github_repo and github_user read public GitHub; to add a repo to the member's profile, read it with github_repo, then propose_project (write the summary and write-up from the README, never invent results), and offer its releases as milestones to propose afterwards. It appears as a card they confirm or dismiss themselves, so never say it's done, and never propose things they didn't ask for. The member's AI tools (Claude, Cursor and others, over MCP) leave the same cards: my_profile counts them under waiting_from_your_tools; they wait on this page and at /drafts, and you don't need to prepare them again.
After the answer, on its own last line, offer up to 3 short next steps the member might tap, written as they'd ask them and only things you can actually do, in exactly this form: <<next: first | second | third>>`,
};

// What Copilot knows about the member and what's on Brazework, so its advice is specific.
export async function memberContext() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const [projects, clubs, goals, record] = await Promise.all([
    supabase.from("projects").select("id, title, status").eq("owner_id", user.id).limit(8),
    supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).limit(10),
    // Their goal (supabase/goals.sql), so advice points at it; absent until that step has run.
    supabase.from("member_goals").select("kind, target").eq("uid", user.id).eq("status", "active").limit(1),
    // Their record as it stands (lib/ember-record.ts): what is waiting for proof and on whom, so
    // Ember can act on it without being asked to look first. No GitHub call here: this runs on every question.
    loadEmberRecord(supabase, user.id, profile.account_type),
  ]);
  const goal = ((goals.data ?? []) as { kind: string; target: string }[]).find((g) => isGoalKind(g.kind));
  type C = { id: string; name: string };
  const mine = ((clubs.data ?? []) as unknown as { communities: C | C[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
  const lines = [
    `Member: ${profile.first_name} ${profile.last_name}${profile.headline ? `, ${profile.headline}` : ""}.`,
    // Who usually signs their work (supabase/account-type.sql): a club for a student, a person who saw it for someone who works.
    profile.account_type === "professional" ? "They work (a working account): a person who saw the work signs it, with propose_signature." : "They're a student: their club verifies their work, or a person who saw it signs it.",
    profile.field && `Field: ${profile.field}.`,
    profile.interests?.length && `Interests: ${profile.interests.join(", ")}.`,
    mine.length && `Their clubs: ${mine.map((c) => c.name).join(", ")}.`,
    goal && `Their goal: ${goalTitle(goal as { kind: GoalKind; target: string })}. Point advice toward it.`,
    projects.data?.length && `Their projects: ${projects.data.map((p) => `${p.title} (project id ${p.id}; ${p.status === "completed" ? "completed" : "in progress"})`).join("; ")}.`,
    ...recordLines(record),
  ].filter(Boolean);
  // `rules` and `about` apart, so the rules can be cached (copilot-agent.ts emberSystem); `system` is
  // both together, for callers that send one string.
  const about = lines.join("\n");
  return { supabase, userId: user.id, name: profile.first_name || "the member", rules: RULES, about, system: `${RULES}\n\n${about}` };
}

export function taskPrompt(r: CopilotRequest) {
  return { instructions: TASKS[r.task](r), maxTokens: r.task === "writeup" ? 1500 : r.task === "ask" ? 1000 : 600 };
}
