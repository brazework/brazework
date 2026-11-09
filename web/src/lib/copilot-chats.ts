"use server";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

// Ember chats you can come back to, and answer ratings (supabase/copilot-chats.sql). Every call
// runs as the member, so the database's rules decide: only your own chats, ever. Without the SQL
// file, chats simply aren't kept (the page works as before).

export type SavedMsg = { role: "user" | "assistant"; content: string; tools?: string[]; cards?: string[] };
export type ChatSummary = { id: string; title: string; updated_at: string };

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEEP_DAYS = 180;

function clean(msgs: unknown): SavedMsg[] {
  if (!Array.isArray(msgs)) return [];
  return msgs.slice(-80).flatMap((m): SavedMsg[] => {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) return [];
    const strs = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, n) : []);
    return [{ role: m.role, content: m.content.slice(0, 6000), tools: strs(m.tools, 20), cards: strs(m.cards, 10) }];
  });
}

export async function listChats(): Promise<ChatSummary[]> {
  if (!(await dbFeatures()).copilotChats) return [];
  const { supabase, user } = await getViewer();
  if (!user) return [];
  const { data } = await supabase.from("copilot_chats").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
  return (data ?? []) as ChatSummary[];
}

export async function loadChat(id: string): Promise<{ id: string; title: string; messages: SavedMsg[] } | null> {
  if (!ID_RE.test(id) || !(await dbFeatures()).copilotChats) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { data } = await supabase.from("copilot_chats").select("id, title, messages").eq("id", id).maybeSingle();
  return data ? { id: data.id, title: data.title, messages: clean(data.messages) } : null;
}

// Saves the whole conversation after each answer. Returns the chat's id (new on the first save).
export async function saveChat(id: string | null, messages: SavedMsg[]): Promise<{ id: string | null; title: string }> {
  const msgs = clean(messages);
  const first = msgs.find((m) => m.role === "user")?.content ?? "";
  const title = first.replace(/\s+/g, " ").trim().slice(0, 70) || "New chat";
  if (!msgs.length || !(await dbFeatures()).copilotChats) return { id: null, title };
  const { supabase, user } = await getViewer();
  if (!user) return { id: null, title };
  if (id && ID_RE.test(id)) {
    const { data } = await supabase.from("copilot_chats").update({ messages: msgs }).eq("id", id).select("id, title").maybeSingle();
    if (data) return { id: data.id, title: data.title };
  }
  // A new chat; old ones you haven't touched in 180 days are cleared at the same time.
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
  await supabase.from("copilot_chats").delete().eq("user_id", user.id).lt("updated_at", cutoff);
  const { data } = await supabase.from("copilot_chats").insert({ title, messages: msgs }).select("id, title").single();
  return { id: data?.id ?? null, title };
}

export async function renameChat(id: string, title: string): Promise<{ ok: boolean }> {
  const t = title.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!ID_RE.test(id) || !t) return { ok: false };
  const { supabase } = await getViewer();
  const { error } = await supabase.from("copilot_chats").update({ title: t }).eq("id", id);
  return { ok: !error };
}

export async function deleteChat(id: string): Promise<{ ok: boolean }> {
  if (!ID_RE.test(id)) return { ok: false };
  const { supabase } = await getViewer();
  const { error } = await supabase.from("copilot_chats").delete().eq("id", id);
  return { ok: !error };
}

export async function deleteAllChats(): Promise<{ ok: boolean; message: string }> {
  if (!(await dbFeatures()).copilotChats) return { ok: true, message: "" };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("copilot_chats").delete().eq("user_id", user.id);
  return error ? { ok: false, message: "Couldn't delete your chats. Try again." } : { ok: true, message: "" };
}

// A thumbs up or down on one answer, sent on purpose: only that question and answer go with it.
export async function rateAnswer(rating: "up" | "down", question: string, answer: string, tools: string[], reason = ""): Promise<{ ok: boolean; message: string }> {
  if (rating !== "up" && rating !== "down") return { ok: false, message: "" };
  if (!(await dbFeatures()).copilotChats) return { ok: true, message: "" };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("copilot_ratings").insert({
    rating,
    reason: reason.trim().slice(0, 500),
    question: question.slice(0, 2000),
    answer: answer.slice(0, 6000),
    tools: tools.filter((t) => typeof t === "string").map((t) => t.slice(0, 60)).slice(0, 20),
  });
  return error ? { ok: false, message: "Couldn't send that. Try again." } : { ok: true, message: "" };
}
