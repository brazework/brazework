import { z } from "zod";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

// Forge Copilot: Claude, writing and advising for members. Server-only by use (the API key is a
// non-public env var, so it never reaches the browser). On only when both the key is set and
// supabase/copilot.sql (the daily limit) has run.

export const COPILOT_MODEL = process.env.COPILOT_MODEL || "claude-sonnet-5";

export async function copilotEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && (await dbFeatures()).copilot;
}

export const copilotRequest = z.object({
  task: z.enum(["post", "writeup", "ask"]),
  input: z.string().trim().min(1, "Write a few words first.").max(4000, "Keep it under 4,000 characters."),
  kind: z.enum(["update", "question", "result", "project"]).optional(),
  title: z.string().max(120).optional(),
  summary: z.string().max(600).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).max(12).optional(),
});
export type CopilotRequest = z.infer<typeof copilotRequest>;

const RULES = `You are Forge Copilot, the writing and career assistant inside Forge, a professional network for university STEM clubs: engineering, the sciences, math and computing.
- Be concrete and technical, in plain language. No hype, no emojis, no hashtags.
- Never invent results, numbers, awards, people or affiliations. Use only what the member gives you. If something important is missing, write a short [bracketed placeholder] for them to fill in.
- Write plain text: short paragraphs, and "-" bullets when a list helps. No markdown headings, bold or tables.`;

const TASKS = {
  post: (r: CopilotRequest) => `Turn the member's rough notes into a Forge feed post${r.kind ? ` of type "${r.kind}"` : ""}, at most 900 characters. Lead with the result or the question, then the one or two details that make it credible. Reply with the post text only.`,
  writeup: (r: CopilotRequest) => `Write the private write-up for the member's project${r.title ? ` "${r.title}"` : ""}${r.summary ? ` (summary: ${r.summary})` : ""}, at most 3,500 characters, from their notes. Use four short labelled paragraphs: "What it is:", "How we built it:", "Results:", "What I'd do next:". Reply with the write-up only.`,
  ask: () => `Answer the member's question as a mentor who knows their field. Keep it under 250 words unless they ask for more.
Use your tools to look things up instead of guessing: search_clubs, upcoming_events and find_people for what's on Forge, my_profile for the member's own profile, projects and next steps, and club_overview for a club they belong to. Recommend only clubs, events and people your tools returned, and give each one's link exactly as the tool gave it (for example /c/abc or /events/xyz). If a lookup comes back empty, say so plainly.
When the member wants to do something (post, ask a club to verify a milestone, join a club, follow someone, host a club event), prepare it with the matching propose_ tool. For club leaders: club_report gives this week's numbers (use them, don't invent any), verify_queue lists milestones waiting, propose_club_post drafts a club post and propose_review drafts a verify-or-decline decision. Connected tools: github_repo and github_user read public GitHub; to add a repo to the member's profile, read it with github_repo, then propose_project (write the summary and write-up from the README, never invent results), and offer its releases as milestones to propose afterwards. It appears as a card they confirm or dismiss themselves, so never say it's done, and never propose things they didn't ask for.`,
};

// What Copilot knows about the member and what's on Forge, so its advice is specific.
export async function memberContext() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const [projects, clubs] = await Promise.all([
    supabase.from("projects").select("title, status").eq("owner_id", user.id).limit(8),
    supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).limit(10),
  ]);
  type C = { id: string; name: string };
  const mine = ((clubs.data ?? []) as unknown as { communities: C | C[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
  const lines = [
    `Member: ${profile.first_name} ${profile.last_name}${profile.headline ? `, ${profile.headline}` : ""}.`,
    profile.field && `Field: ${profile.field}.`,
    profile.interests?.length && `Interests: ${profile.interests.join(", ")}.`,
    mine.length && `Their clubs: ${mine.map((c) => c.name).join(", ")}.`,
    projects.data?.length && `Their projects: ${projects.data.map((p) => `${p.title} (${p.status === "completed" ? "completed" : "in progress"})`).join("; ")}.`,
  ].filter(Boolean);
  return { supabase, userId: user.id, system: `${RULES}\n\n${lines.join("\n")}` };
}

export function taskPrompt(r: CopilotRequest) {
  return { instructions: TASKS[r.task](r), maxTokens: r.task === "writeup" ? 1500 : r.task === "ask" ? 1000 : 600 };
}
