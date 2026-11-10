"use server";
import { loadConversations, loadGroups } from "@/app/(app)/messages/data";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

// The messaging dock on the desktop feed: your recent conversations and group chats, and a short
// thread you can read and answer without leaving the page. Same rules as the Messages page.

export type DockItem = { kind: "dm" | "group"; id: string; title: string; preview: string; at: string | null; unread: boolean; request: boolean; first: string; last: string };
export type DockMsg = { id: string; mine: boolean; name: string; body: string; at: string };

export async function dockInbox(): Promise<{ items: DockItem[]; unread: number }> {
  const [{ convs }, { groups }] = await Promise.all([loadConversations(), loadGroups()]);
  const items: DockItem[] = [
    ...convs.map((c) => ({ kind: "dm" as const, id: c.id, title: `${c.other.firstName} ${c.other.lastName}`.trim() || "Brazework member", preview: `${c.lastFromMe ? "You: " : ""}${c.lastBody}`, at: c.lastAt, unread: c.unread, request: c.status === "request" && !c.startedByMe, first: c.other.firstName, last: c.other.lastName })),
    ...groups.map((g) => ({ kind: "group" as const, id: g.id, title: g.title, preview: g.lastBody ? `${g.lastFromMe ? "You" : g.lastSenderName || "Someone"}: ${g.lastBody}` : g.subtitle, at: g.lastAt, unread: g.unread, request: false, first: g.title, last: "" })),
  ].sort((a, b) => Date.parse(b.at ?? "0") - Date.parse(a.at ?? "0"));
  return { items: items.slice(0, 15), unread: items.filter((i) => i.unread).length };
}

export async function dockThread(kind: "dm" | "group", id: string): Promise<{ ok: boolean; msgs: DockMsg[]; canSend: boolean }> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return { ok: false, msgs: [], canSend: false };
  const { supabase, user, profile } = await getViewer();
  if (!user) return { ok: false, msgs: [], canSend: false };
  if (kind === "dm") {
    const [{ data: conv }, { data }] = await Promise.all([
      supabase.from("conversations").select("status, started_by, people, user_a, user_b").eq("id", id).maybeSingle(),
      supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(40),
    ]);
    if (!conv) return { ok: false, msgs: [], canSend: false };
    const people = (conv.people ?? {}) as Record<string, { firstName?: string }>;
    const msgs = ((data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[]).reverse().map((m) => ({ id: m.id, mine: m.sender_id === user.id, name: m.sender_id === user.id ? profile?.first_name ?? "You" : people[m.sender_id]?.firstName ?? "", body: m.body, at: m.created_at }));
    // Requests sent to you are answered on the Messages page (accept, decline or block first).
    return { ok: true, msgs, canSend: conv.status === "active" || conv.started_by === user.id };
  }
  if (!(await dbFeatures()).groupChats) return { ok: false, msgs: [], canSend: false };
  const { data } = await supabase.from("chat_messages").select("id, sender_id, sender_first, body, ember, created_at").eq("chat_id", id).order("created_at", { ascending: false }).limit(40);
  if (!data) return { ok: false, msgs: [], canSend: false };
  const msgs = (data as { id: string; sender_id: string; sender_first: string; body: string; ember: boolean; created_at: string }[]).reverse().map((m) => ({ id: m.id, mine: m.sender_id === user.id && !m.ember, name: m.ember ? "Ember" : m.sender_first, body: m.body, at: m.created_at }));
  return { ok: true, msgs, canSend: true };
}
