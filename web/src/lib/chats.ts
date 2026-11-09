"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Group chats (supabase/group-chats.sql): one per club, one per event, and team chats inside a club.
// Who's in each follows Forge itself; the database decides it (can_read_chat) and stamps every message.
type R = { ok: boolean; message: string };
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

const touch = (id?: string) => {
  revalidatePath("/messages");
  if (id) revalidatePath(`/messages/g/${id}`);
};

async function open(rpc: "open_club_chat" | "open_event_chat", arg: Record<string, string>, back: string) {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc(rpc, arg);
  if (error || !data) redirect(`${back}${back.includes("?") ? "&" : "?"}chat_error=${encodeURIComponent(friendlyError(error))}`);
  redirect(`/messages/g/${encodeURIComponent(String(data))}`);
}

// Buttons on a club page and an event page: open (or start) its chat and go there.
export async function openClubChat(communityId: string) {
  if (!ID_RE.test(communityId)) redirect("/messages");
  await open("open_club_chat", { p_community: communityId }, `/c/${communityId}`);
}

export async function openEventChat(eventId: string) {
  if (!ID_RE.test(eventId)) redirect("/messages");
  await open("open_event_chat", { p_event: eventId }, `/events/${eventId}`);
}

export async function createTeamChat(communityId: string, name: string, members: string[]): Promise<R & { id?: string }> {
  if (!ID_RE.test(communityId)) return { ok: false, message: "That club wasn't found." };
  const n = name.trim();
  if (!n || n.length > 60) return { ok: false, message: "Give the chat a name (up to 60 characters)." };
  const ids = [...new Set(members)].filter((m) => /^[0-9a-f-]{36}$/i.test(m)).slice(0, 49);
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("create_team_chat", { p_community: communityId, p_name: n, p_members: ids });
  if (error || !data) return { ok: false, message: friendlyError(error) };
  touch(String(data));
  return { ok: true, message: "", id: String(data) };
}

export async function sendChatMessage(chatId: string, body: string, announcement = false): Promise<R> {
  const text = body.trim();
  if (!ID_RE.test(chatId)) return { ok: false, message: "That chat couldn't be found." };
  if (!text) return { ok: false, message: "Write a message first." };
  if (text.length > 2000) return { ok: false, message: "Messages can be up to 2,000 characters." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("chat_messages").insert({ chat_id: chatId, body: text, announcement });
  if (error) return { ok: false, message: friendlyError(error) };
  touch(chatId);
  return { ok: true, message: "" };
}

export async function markChatRead(chatId: string): Promise<void> {
  if (!ID_RE.test(chatId)) return;
  const { supabase, user } = await getViewer();
  if (!user) return;
  await supabase.rpc("mark_chat_read", { p_chat: chatId });
  revalidatePath("/messages");
}

export async function leaveTeamChat(chatId: string): Promise<void> {
  if (!ID_RE.test(chatId)) return;
  const { supabase, user } = await getViewer();
  if (!user) return;
  await supabase.rpc("leave_chat", { p_chat: chatId });
  touch();
  redirect("/messages?tab=groups");
}
