"use server";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { COPILOT_MODEL, copilotEnabled } from "@/lib/copilot";
import { ALL_TOPICS } from "@/lib/forge";
import { TOOLS, toolsInText } from "@/lib/stack";
import { getViewer } from "@/lib/supabase/server";

// "Organize with Ember": Ember reads a project (title, summary, write-up) and suggests its "Built with"
// stack from the catalog plus up to 3 topics. Nothing changes until the owner applies the suggestion.
type Suggestion = { ok: boolean; message: string; tools?: string[]; topics?: string[] };
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export async function organizeProject(projectId: string): Promise<Suggestion> {
  if (!ID_RE.test(projectId)) return { ok: false, message: "That project wasn't found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  if (!(await copilotEnabled())) return { ok: false, message: "Ember isn't switched on yet." };
  const [{ data: p }, { data: d }] = await Promise.all([
    supabase.from("projects").select("title, summary, tags, tools").eq("id", projectId).eq("owner_id", user.id).maybeSingle(),
    supabase.from("project_details").select("details, link").eq("project_id", projectId).maybeSingle(),
  ]);
  if (!p) return { ok: false, message: "Only the project's owner can organize it." };
  const { data: left } = await supabase.rpc("copilot_take");
  if (typeof left !== "number" || left < 0) return { ok: false, message: "You've used today's Ember requests. They reset tomorrow." };

  const text = `${p.title}\n${p.summary}\n${d?.details ?? ""}\n${d?.link ?? ""}`.slice(0, 6000);
  const catalog = TOOLS.map((t) => t.name).join(", ");
  try {
    const res = await new Anthropic().messages.create({
      model: COPILOT_MODEL,
      max_tokens: 300,
      system: `You organize STEM projects on Brazework. From the project text, pick the tools it was built with and its topics. Only name tools the text says or clearly implies were used. Prefer names from this catalog: ${catalog}. Topics must come from: ${ALL_TOPICS.join(", ")}. Reply with JSON only: {"tools": [up to 12 strings], "topics": [up to 3 strings]}.`,
      messages: [{ role: "user", content: text }],
    });
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { tools?: unknown; topics?: unknown };
    const tools = (Array.isArray(json.tools) ? json.tools : []).map(String).map((t) => t.trim().slice(0, 40).replace(/[<>]/g, "")).filter(Boolean).slice(0, 12);
    const topics = (Array.isArray(json.topics) ? json.topics : []).map(String).filter((t) => ALL_TOPICS.includes(t)).slice(0, 3);
    return { ok: true, message: "", tools: tools.length ? tools : toolsInText(text), topics };
  } catch {
    return { ok: true, message: "Ember couldn't read it closely, so these come from the tools your text names.", tools: toolsInText(text), topics: [] };
  }
}

export async function applyOrganize(projectId: string, tools: string[], topics: string[]): Promise<{ ok: boolean; message: string }> {
  if (!ID_RE.test(projectId)) return { ok: false, message: "That project wasn't found." };
  const t = [...new Set(tools.map((x) => x.trim().slice(0, 40).replace(/[<>]/g, "")).filter(Boolean))].slice(0, 12);
  const tags = topics.filter((x) => ALL_TOPICS.includes(x)).slice(0, 3);
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("projects").update({ tools: t, ...(tags.length && { tags }) }).eq("id", projectId).eq("owner_id", user.id).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn't save that. Try again." };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Saved." };
}
