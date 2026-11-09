import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

export type Conv = {
  id: string;
  status: "active" | "request";
  startedByMe: boolean;
  other: { id: string; firstName: string; lastName: string; headline: string };
  lastBody: string;
  lastAt: string | null;
  lastFromMe: boolean;
  unread: boolean;
};

// Your conversations, newest activity first; empty ones you didn't start are left out (conversations() in messages.js).
export async function loadConversations() {
  const { supabase, user } = await getViewer();
  if (!user) return { me: null, convs: [] as Conv[], requestsOn: true };
  const me = user.id;
  const [list, reads, settings] = await Promise.all([
    supabase.from("conversations").select("*").or(`user_a.eq.${me},user_b.eq.${me}`).order("last_message_at", { ascending: false, nullsFirst: false }).limit(200),
    supabase.from("conversation_reads").select("conversation_id, read_at").eq("user_id", me),
    supabase.from("message_settings").select("requests_on").eq("user_id", me).maybeSingle(),
  ]);
  const readAt = new Map((reads.data ?? []).map((r) => [r.conversation_id as string, r.read_at as string]));
  type Row = { id: string; user_a: string; user_b: string; started_by: string; status: "active" | "request"; people: Record<string, { firstName?: string; lastName?: string; headline?: string }>; last_message_at: string | null; last_body: string; last_sender: string | null };
  const convs = ((list.data ?? []) as Row[])
    .map((c): Conv => {
      const otherId = c.user_a === me ? c.user_b : c.user_a;
      const info = c.people?.[otherId] ?? {};
      const lastAt = c.last_message_at ? Date.parse(c.last_message_at) : 0;
      return {
        id: c.id,
        status: c.status,
        startedByMe: c.started_by === me,
        other: { id: otherId, firstName: info.firstName ?? "", lastName: info.lastName ?? "", headline: info.headline ?? "" },
        lastBody: c.last_body ?? "",
        lastAt: c.last_message_at,
        lastFromMe: c.last_sender === me,
        unread: !!lastAt && c.last_sender !== me && lastAt > (Date.parse(readAt.get(c.id) ?? "") || 0),
      };
    })
    .filter((c) => c.lastAt || c.startedByMe);
  return { me, convs, requestsOn: settings.data ? Boolean(settings.data.requests_on) : true };
}

// Your group chats (club, event, team), newest first, once supabase/group-chats.sql is applied.
export type GroupChat = { id: string; kind: "club" | "event" | "team"; community_id: string | null; event_id: string | null; title: string; subtitle: string; lastAt: string | null; lastBody: string; lastSenderName: string; lastFromMe: boolean; unread: boolean };

export async function loadGroups(): Promise<{ on: boolean; groups: GroupChat[] }> {
  if (!(await dbFeatures()).groupChats) return { on: false, groups: [] };
  const { supabase, user } = await getViewer();
  if (!user) return { on: true, groups: [] };
  const { data } = await supabase.rpc("my_chats");
  return { on: true, groups: (data ?? []) as GroupChat[] };
}

export const isRequestToMe = (c: Conv) => c.status === "request" && !c.startedByMe;
