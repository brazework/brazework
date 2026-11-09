import { ArrowLeft, CalendarDays, Hash, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MemberFaces, type Face } from "@/components/network/member-faces";
import { leaveTeamChat } from "@/lib/chats";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { GroupComposer, GroupThread, MarkChatRead, NewTeamChat, type GroupMsg, type Seen } from "./group-client";
import { CatchMeUp, MemberList } from "./details";
import { MessageBody } from "@/components/share/message-body";
import { copilotEnabled } from "@/lib/copilot";
import { requestTime } from "@/lib/forge";

export default function GroupChatPage({ params }: PageProps<"/messages/g/[id]">) {
  return (
    <Suspense fallback={<div data-thread className="flex min-h-0 flex-1"><p className="p-6 text-sm text-muted">Opening chat…</p></div>}>
      <Group params={params} />
    </Suspense>
  );
}

type Chat = { id: string; kind: "club" | "event" | "team"; community_id: string | null; event_id: string | null; name: string; communities: { name: string } | null; events: { title: string } | null };
const ICON = { club: Users, event: CalendarDays, team: Hash } as const;

async function Group({ params }: { params: PageProps<"/messages/g/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  if (!(await dbFeatures()).groupChats) redirect("/messages");
  const { data: chat } = await supabase.from("chats").select("id, kind, community_id, event_id, name, communities(name), events(title)").eq("id", id).maybeSingle();
  if (!chat)
    return <div data-thread className="contents"><div className="grid h-full place-items-center p-8 text-center text-sm text-muted">This chat isn&apos;t available to you.<Link href="/messages?tab=groups" className="mt-3 underline">Back to messages</Link></div></div>;
  const c = chat as unknown as Chat;

  const [msgRes, roleRes, memberRes] = await Promise.all([
    supabase.from("chat_messages").select("id, sender_id, sender_first, sender_last, body, announcement, ember, created_at").eq("chat_id", id).order("created_at", { ascending: false }).limit(300),
    c.community_id ? supabase.from("community_members").select("role").eq("community_id", c.community_id).eq("uid", user.id).maybeSingle() : Promise.resolve({ data: null }),
    c.kind === "team"
      ? supabase.from("chat_members").select("uid, profiles(first_name, last_name)").eq("chat_id", id).limit(50)
      : c.community_id ? supabase.from("community_members").select("uid, first_name, last_name").eq("community_id", c.community_id).order("joined_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
  ]);
  const msgs = ((msgRes.data ?? []) as GroupMsg[]).reverse();
  const role = (roleRes.data as { role?: string } | null)?.role ?? "";
  const officer = ["owner", "admin", "moderator"].includes(role);
  const canAnnounce = c.kind === "club" && officer;
  type MemberRow = { uid: string; first_name?: string; last_name?: string; profiles?: { first_name: string; last_name: string } | null };
  const people: Face[] = ((memberRes.data ?? []) as MemberRow[]).map((m) => ({ uid: m.uid, first: m.first_name ?? m.profiles?.first_name ?? "", last: m.last_name ?? m.profiles?.last_name ?? "" }));

  // Club officers see how many members have seen each announcement.
  let seen: Seen = {};
  if (canAnnounce) {
    const { data } = await supabase.rpc("announcement_seen", { p_chat: id });
    seen = Object.fromEntries(((data ?? []) as { message_id: string; seen: number; total: number }[]).map((r) => [r.message_id, { seen: r.seen, total: r.total }]));
  }

  const title = c.kind === "club" ? c.communities?.name ?? "Club chat" : c.kind === "event" ? c.events?.title ?? "Event chat" : c.name;
  const sub = c.kind === "club" ? "Club chat · everyone in the club" : c.kind === "event" ? "Event chat · everyone going" : `Team chat${c.communities?.name ? ` in ${c.communities.name}` : ""}`;
  const href = c.kind === "event" && c.event_id ? `/events/${c.event_id}` : c.community_id ? `/c/${c.community_id}` : "/messages";
  const Icon = ICON[c.kind];
  const emberOn = await copilotEnabled();
  // The details panel: what's coming up for this club or event, and posts shared in the chat.
  const now = new Date(requestTime()).toISOString();
  const { data: evRows } = c.kind === "event" && c.event_id
    ? await supabase.from("events").select("id, title, starts_at, rsvp_count").eq("id", c.event_id).limit(1)
    : c.community_id ? await supabase.from("events").select("id, title, starts_at, rsvp_count").eq("community_id", c.community_id).eq("status", "published").gt("starts_at", now).order("starts_at").limit(3) : { data: [] };
  const upcoming = (evRows ?? []) as { id: string; title: string; starts_at: string; rsvp_count: number }[];
  const shared = [...new Set(msgs.flatMap((m) => [...m.body.matchAll(/\/post\/([A-Za-z0-9-]{1,64})/g)].map((x) => x[1])))].slice(-4).reverse();

  return (
    <div data-thread className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      <MarkChatRead id={id} count={msgs.length} />
      <header className="relative flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/messages?tab=groups" aria-label="Back to messages" className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-text md:hidden"><ArrowLeft className="size-4" /></Link>
        <span className="nav-tile grid size-9 shrink-0 place-items-center rounded-xl text-text-2"><Icon className="size-4" /></span>
        <Link href={href} className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold hover:underline">{title}</div>
          <div className="truncate text-xs text-faint">{sub}</div>
        </Link>
        <MemberFaces faces={people.slice(0, 4)} ids={people.map((p) => p.uid)} total={people.length} size={24} className="hidden sm:flex" />
        {c.kind === "club" && c.community_id && <NewTeamChat communityId={c.community_id} members={people} me={user.id} />}
        {c.kind === "team" && (
          <form action={async () => { "use server"; await leaveTeamChat(id); }}>
            <button aria-label="Leave this team chat" title="Leave chat" className="grid size-8 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text"><LogOut className="size-4" /></button>
          </form>
        )}
      </header>
      <GroupThread msgs={msgs} me={user.id} myName={profile.first_name} chatId={id} seen={seen} />
      <GroupComposer chatId={id} canAnnounce={canAnnounce} ember={emberOn} placeholder={c.kind === "event" ? "Ask about the event, share logistics" : `Message ${title}`} />
      </div>
      <aside aria-label="Chat details" className="hidden w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line p-5 xl:flex">
        {emberOn && <section><h3 className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">Ember</h3><CatchMeUp chatId={id} /></section>}
        <MemberList people={people} />
        <section>
          <h3 className="text-xs font-medium tracking-wide text-faint uppercase">{c.kind === "event" ? "The event" : "Coming up"}</h3>
          <ul className="mt-2 space-y-2">
            {upcoming.map((e) => (
              <li key={e.id}><Link href={`/events/${e.id}`} className="block rounded-2xl border border-line p-3 transition hover:border-line-strong"><span className="block truncate text-sm font-medium">{e.title}</span><span className="text-xs text-muted">{new Date(e.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {e.rsvp_count} going</span></Link></li>
            ))}
            {!upcoming.length && <li className="text-xs text-muted">No upcoming events.{c.community_id && officer ? <> <Link href={`/c/${c.community_id}?tab=events`} className="underline">Host one</Link></> : null}</li>}
          </ul>
        </section>
        {shared.length > 0 && (
          <section>
            <h3 className="text-xs font-medium tracking-wide text-faint uppercase">Shared in this chat</h3>
            <div className="mt-2 space-y-2">{shared.map((pid) => <MessageBody key={pid} body={`/post/${pid}`} />)}</div>
          </section>
        )}
      </aside>
    </div>
  );
}
