"use server";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { COPILOT_MODEL, copilotEnabled, memberContext } from "@/lib/copilot";
import { runAgent } from "@/lib/copilot-agent";
import { TOOLS, makeExec } from "@/lib/copilot-tools";

// Ember in group chats: anyone in a chat can ask it with "@Ember …"; it reads the recent conversation,
// may look things up with its read-only tools, and answers the group (posted by post_ember_reply, shown
// as "Ember · asked by <name>"). "Catch me up" is the same reading, answered privately. Both count
// against the member's daily Copilot limit.

type R = { ok: boolean; message: string; text?: string };
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
// In a group, Ember answers and looks things up; it never prepares actions (cards belong to one person).
const READ_TOOLS = TOOLS.filter((t) => !t.name.startsWith("propose_"));

async function transcript(chatId: string) {
  const ctx = await memberContext();
  if (!ctx) return { error: "Log in again." } as const;
  if (!(await copilotEnabled())) return { error: "Ember isn't switched on yet." } as const;
  const { data: chat } = await ctx.supabase.from("chats").select("kind, name, communities(name), events(title)").eq("id", chatId).maybeSingle();
  if (!chat) return { error: "You're not in this chat." } as const;
  const c = chat as unknown as { kind: string; name: string; communities: { name: string } | null; events: { title: string } | null };
  const title = c.kind === "club" ? `${c.communities?.name ?? "the club"} club chat` : c.kind === "event" ? `the chat for the event "${c.events?.title ?? ""}"` : `the "${c.name}" team chat`;
  const { data: rows } = await ctx.supabase.from("chat_messages").select("sender_first, sender_last, body, ember, announcement, created_at").eq("chat_id", chatId).order("created_at", { ascending: false }).limit(40);
  const lines = ((rows ?? []) as { sender_first: string; sender_last: string; body: string; ember: boolean; announcement: boolean; created_at: string }[])
    .reverse()
    .map((m) => `[${m.created_at.slice(0, 16).replace("T", " ")}] ${m.ember ? "Ember" : `${m.sender_first} ${m.sender_last}`.trim()}${m.announcement ? " (announcement)" : ""}: ${m.body.replace(/\s+/g, " ").slice(0, 400)}`);
  const { data: left, error } = await ctx.supabase.rpc("copilot_take");
  if (error) return { error: "Ember isn't available right now." } as const;
  if (typeof left !== "number" || left < 0) return { error: "You've used today's Ember requests. They reset tomorrow." } as const;
  return { ctx, title, lines } as const;
}

async function answer(system: string, prompt: string, ctx: NonNullable<Awaited<ReturnType<typeof memberContext>>>, tools: boolean) {
  let text = "";
  await runAgent({
    client: new Anthropic(),
    model: COPILOT_MODEL,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: tools ? READ_TOOLS : [],
    exec: makeExec(ctx.supabase, ctx.userId),
    maxTokens: 600,
    emit: (e) => { if (e.type === "text") text += e.text; },
  });
  return text.trim();
}

export async function askEmberInChat(chatId: string, question: string): Promise<R> {
  if (!ID_RE.test(chatId)) return { ok: false, message: "That chat couldn't be found." };
  const q = question.replace(/^@ember\b[,:]?\s*/i, "").trim().slice(0, 1000);
  if (!q) return { ok: false, message: "Ask Ember something after @Ember." };
  const t = await transcript(chatId);
  if ("error" in t) return { ok: false, message: t.error ?? "" };
  const system = `${t.ctx.system}\n\nYou are Ember, answering inside ${t.title} on Forge, where everyone in the chat will read your reply. Answer the question from ${t.ctx.name} for the group: short (under 120 words), friendly, concrete, plain text. Use the conversation for context and your tools for anything on Forge (clubs, events, people, GitHub). Never invent facts; say what you don't know. Don't address only the asker unless the question is personal.`;
  try {
    const text = await answer(system, `Recent messages in the chat:\n${t.lines.join("\n") || "(none yet)"}\n\nQuestion from ${t.ctx.name}: ${q}`, t.ctx, true);
    if (!text) return { ok: false, message: "Ember couldn't answer that. Try rephrasing." };
    const { error } = await t.ctx.supabase.rpc("post_ember_reply", { p_chat: chatId, p_body: text });
    if (error) return { ok: false, message: "Ember's reply couldn't be posted." };
    revalidatePath(`/messages/g/${chatId}`);
    return { ok: true, message: "" };
  } catch {
    return { ok: false, message: "Ember stopped early. Try again." };
  }
}

export async function catchMeUp(chatId: string): Promise<R> {
  if (!ID_RE.test(chatId)) return { ok: false, message: "That chat couldn't be found." };
  const t = await transcript(chatId);
  if ("error" in t) return { ok: false, message: t.error ?? "" };
  if (!t.lines.length) return { ok: true, message: "", text: "Nothing has been said here yet." };
  const system = `${t.ctx.system}\n\nYou are Ember, privately catching ${t.ctx.name} up on ${t.title}. Summarize what matters in 3 to 5 short "-" bullets: decisions, dates and times, asks aimed at ${t.ctx.name}, and anything still open. Plain text. Only what the messages say.`;
  try {
    const text = await answer(system, t.lines.join("\n"), t.ctx, false);
    return text ? { ok: true, message: "", text } : { ok: false, message: "Ember couldn't summarize this chat." };
  } catch {
    return { ok: false, message: "Ember stopped early. Try again." };
  }
}
