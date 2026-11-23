import { dbFeatures } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";

export type Conv = {
  id: string;
  status: "active" | "request";
  startedByMe: boolean;
  other: { id: string; firstName: string; lastName: string; headline: string; avatar?: string | null };
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
    // cleared_at: chats you deleted (supabase/chat-delete.sql); before that step, just the read markers.
    supabase.from("conversation_reads").select("conversation_id, read_at, cleared_at").eq("user_id", me).then(async (r) => (r.error ? await supabase.from("conversation_reads").select("conversation_id, read_at").eq("user_id", me) : r)),
    supabase.from("message_settings").select("requests_on").eq("user_id", me).maybeSingle(),
  ]);
  const readAt = new Map((reads.data ?? []).map((r) => [r.conversation_id as string, r.read_at as string]));
  const clearedAt = new Map(((reads.data ?? []) as { conversation_id: string; cleared_at?: string | null }[]).filter((r) => r.cleared_at).map((r) => [r.conversation_id, Date.parse(r.cleared_at!)]));
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
    .filter((c) => c.lastAt || c.startedByMe)
    .filter((c) => { const cleared = clearedAt.get(c.id); return !cleared || (!!c.lastAt && Date.parse(c.lastAt) > cleared); });
  // Their profile photos, in one read (the names come with the conversation; photos change, so they're read fresh).
  const ids = [...new Set(convs.map((c) => c.other.id))];
  const { data: pics } = ids.length ? await supabase.from("profiles").select("id, avatar_path").in("id", ids) : { data: [] };
  const pic = new Map(((pics ?? []) as { id: string; avatar_path?: string | null }[]).map((p) => [p.id, avatarSrc(p)]));
  for (const c of convs) c.other.avatar = pic.get(c.other.id) ?? null;
  return { me, convs, requestsOn: settings.data ? Boolean(settings.data.requests_on) : true };
}

// Your group chats (club, event, team), newest first, once supabase/group-chats.sql is applied.
export type GroupChat = { id: string; kind: "club" | "event" | "team"; community_id: string | null; event_id: string | null; title: string; subtitle: string; lastAt: string | null; lastBody: string; lastSenderName: string; lastFromMe: boolean; unread: boolean; logo?: string | null };

export async function loadGroups(): Promise<{ on: boolean; groups: GroupChat[] }> {
  if (!(await dbFeatures()).groupChats) return { on: false, groups: [] };
  const { supabase, user } = await getViewer();
  if (!user) return { on: true, groups: [] };
  const [{ data }, { clubProfile }] = await Promise.all([supabase.rpc("my_chats"), dbFeatures()]);
  const groups = (data ?? []) as GroupChat[];
  // Each club or team chat wears its club's picture (supabase/club-profile.sql), in one read.
  const clubs = clubProfile ? [...new Set(groups.filter((g) => g.kind !== "event" && g.community_id).map((g) => g.community_id as string))] : [];
  const { data: logoRows } = clubs.length ? await supabase.from("communities").select("id, logo_path").in("id", clubs) : { data: [] };
  const logos = new Map(((logoRows ?? []) as { id: string; logo_path?: string | null }[]).map((c) => [c.id, c.logo_path || null]));
  return { on: true, groups: groups.map((g) => (g.kind !== "event" && g.community_id ? { ...g, logo: logos.get(g.community_id) ?? null } : g)) };
}

export const isRequestToMe = (c: Conv) => c.status === "request" && !c.startedByMe;
