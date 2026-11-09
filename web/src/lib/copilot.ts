import { z } from "zod";
import { dbFeatures } from "@/lib/db-features";
import { requestTime } from "@/lib/forge";
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
  ask: () => `Answer the member's question as a mentor who knows their field. Keep it under 250 words unless they ask for more. When recommending clubs or events, recommend only ones from the lists below, and give each one's link exactly as shown (for example /c/abc or /events/xyz).`,
};

// What Copilot knows about the member and what's on Forge, so its advice is specific.
export async function memberContext(task: CopilotRequest["task"]) {
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
  if (task === "ask") {
    const joined = new Set(mine.map((c) => c.id));
    const [top, ev] = await Promise.all([
      supabase.from("communities").select("id, name, field, member_count").order("member_count", { ascending: false }).limit(40),
      supabase.from("events").select("id, title, starts_at, type").eq("status", "published").gt("starts_at", new Date(requestTime()).toISOString()).order("starts_at", { ascending: true }).limit(15),
    ]);
    const others = (top.data ?? []).filter((c) => !joined.has(c.id)).slice(0, 25);
    if (others.length) lines.push(`Clubs on Forge they haven't joined:\n${others.map((c) => `- ${c.name} (${c.field || "STEM"}, ${c.member_count} members): /c/${c.id}`).join("\n")}`);
    if (ev.data?.length) lines.push(`Upcoming events:\n${ev.data.map((e) => `- ${e.title} (${e.type}, ${e.starts_at.slice(0, 10)}): /events/${e.id}`).join("\n")}`);
  }
  return { supabase, system: `${RULES}\n\n${lines.join("\n")}` };
}

export function taskPrompt(r: CopilotRequest) {
  return { instructions: TASKS[r.task](r), maxTokens: r.task === "writeup" ? 1500 : r.task === "ask" ? 1000 : 600 };
}
