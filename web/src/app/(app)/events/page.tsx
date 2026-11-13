import { eventWithHost } from "@/lib/db-features";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, CalendarDays, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { DROP_AFTER_MS, isOver, timeBucket, whenBadge, whereLabel, withHost, type HostedEvent } from "@/lib/events";
import { LocalTime } from "./local-time";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { can } from "@/lib/communities";
import { EventCard } from "./event-card";
import { HostMenu } from "./host-menu";
import { WeekStrip } from "./week-strip";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <LiveRefresh tables={["events", "event_rsvps"]} />
      <Suspense fallback={<><PageHeader title="Events" /><Skeleton className="mt-6 h-96" /></>}>
        <Events searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Events({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const tab = sp.tab === "going" || sp.tab === "saved" ? sp.tab : "upcoming";
  const topic = typeof sp.topic === "string" ? sp.topic : "";
  const fromClubs = sp.from === "clubs";
  const cutoff = new Date(requestTime() - DROP_AFTER_MS).toISOString();

  const [ev, mine, saves, admin, mem] = await Promise.all([
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(200),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("event_saves").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("organization_admins").select("org_id").eq("uid", user.id).limit(1),
    supabase.from("community_members").select("community_id, role, communities(name)").eq("uid", user.id).limit(50),
  ]);
  type Mem = { community_id: string; role: string; communities: { name: string } | null };
  const memberships = (mem.data ?? []) as unknown as Mem[];
  const myClubs = new Set(memberships.map((m) => m.community_id));
  const hostClubs = memberships.filter((m) => can(m.role, "hostEvents")).map((m) => ({ id: m.community_id, name: m.communities?.name ?? "your club" }));
  const all = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const going = new Set((mine.data ?? []).map((r) => r.event_id as string));
  const saved = new Set((saves.data ?? []).map((r) => r.event_id as string));
  let list = tab === "going" ? all.filter((e) => going.has(e.id)) : tab === "saved" ? all.filter((e) => saved.has(e.id)) : all;
  const topics = [...new Set(all.map((e) => e.topic))].sort();
  if (topic) list = list.filter((e) => e.topic === topic);
  if (fromClubs) list = list.filter((e) => e.community_id && myClubs.has(e.community_id));
  const interests = new Set<string>(profile.interests ?? []);
  const isAdmin = !!admin.data?.length;
  const q = (t: string, clubs = false) => `/events?tab=${tab}${t ? `&topic=${encodeURIComponent(t)}` : ""}${clubs ? "&from=clubs" : ""}`;
  // Connections going (the RSVP policy only shows yours and your connections').
  const ids = list.map((e) => e.id).slice(0, 100);
  const others = ids.length ? (await supabase.from("event_rsvps").select("event_id, user_id").in("event_id", ids).neq("user_id", user.id).limit(500)).data ?? [] : [];
  const uids = [...new Set(others.map((r) => r.user_id as string))];
  const people = uids.length ? (await supabase.from("profiles").select("id, first_name, last_name").in("id", uids)).data ?? [] : [];
  const who = new Map(people.map((p) => [p.id as string, { id: p.id as string, first: (p.first_name as string) ?? "", last: (p.last_name as string) ?? "" }]));
  const friendsAt = (id: string) => others.filter((r) => r.event_id === id).map((r) => who.get(r.user_id as string)).filter((x) => !!x);
  const now = requestTime();
  // Your next event (the soonest you're going to that hasn't ended), shown up top.
  const next = all.filter((e) => going.has(e.id) && !isOver(e, now)).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const nextBadge = next ? whenBadge(next, now) : null;
  // Upcoming events in time sections; Going and Saved stay one list.
  const SECTIONS = [["now", "Happening now"], ["soon", "Today and tomorrow"], ["week", "This week"], ["later", "Later"]] as const;
  const groups = tab === "upcoming" ? SECTIONS.map(([k, label]) => ({ k, label, items: list.filter((e) => timeBucket(e, now) === k) })).filter((g) => g.items.length) : [{ k: "all", label: "", items: list }];
  const card = (e: HostedEvent) => <EventCard key={e.id} event={e} going={going.has(e.id)} saved={saved.has(e.id)} now={now} match={interests.has(e.topic) ? e.topic : ""} friends={friendsAt(e.id)} mine={!!e.community_id && myClubs.has(e.community_id)} />;

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Career fairs, talks, build nights and hackathons from verified organizations and clubs."
        actions={<HostMenu clubs={hostClubs} orgAdmin={isAdmin} />}
      />
      {next && tab === "upcoming" && !topic && (
        <Link href={`/events/${next.id}`} className="glass-card group mt-6 flex flex-wrap items-center gap-4 rounded-3xl p-5 transition">
          <span className="bg-accent-grad grid size-12 shrink-0 place-items-center rounded-2xl text-on-accent"><CalendarCheck className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium tracking-wide text-faint uppercase">Up next for you{nextBadge ? ` · ${nextBadge.text}` : ""}</span>
            <span className="mt-0.5 block truncate text-lg font-semibold">{next.title}</span>
            <span className="block truncate text-sm text-muted"><LocalTime kind="full" value={next.starts_at} /> · {whereLabel(next)}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium">Details <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
        </Link>
      )}
      {tab === "upcoming" && <WeekStrip now={now} events={all.filter((e) => !isOver(e, now) && (!fromClubs || (e.community_id && myClubs.has(e.community_id)))).map((e) => ({ id: e.id, starts_at: e.starts_at, going: going.has(e.id) }))} />}
      <div className="mt-6">
        <Tabs active={tab} tabs={[
          { id: "upcoming", label: "Upcoming", href: "/events" },
          { id: "going", label: "Going", href: "/events?tab=going", count: all.filter((e) => going.has(e.id)).length },
          { id: "saved", label: "Saved", href: "/events?tab=saved", count: all.filter((e) => saved.has(e.id)).length },
        ]} />
      </div>
      {(topics.length > 1 || myClubs.size > 0) && (
        <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
          <Link href={q("")} className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${!topic && !fromClubs ? "border-text text-text" : "border-line text-muted hover:text-text"}`}>All</Link>
          {myClubs.size > 0 && <Link href={q(topic, !fromClubs)} aria-pressed={fromClubs} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition ${fromClubs ? "border-text text-text" : "border-line text-muted hover:text-text"}`}><UsersRound className="size-3" /> From your clubs</Link>}
          {topics.map((t) => (
            <Link key={t} href={q(t, fromClubs)} className={`shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition ${topic === t ? "border-text text-text" : "border-line text-muted hover:text-text"}`}>
              {interests.has(t) ? "★ " : ""}{t}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3">
        {groups.map((g) => (
          <section key={g.k} aria-label={g.label || undefined} className="flex flex-col gap-3">
            {g.label && <h2 className="mt-2 flex items-center gap-2 text-xs font-medium tracking-wide text-faint uppercase">{g.k === "now" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}{g.label} <span className="font-normal">· {g.items.length}</span></h2>}
            {g.items.map(card)}
          </section>
        ))}
        {!list.length && (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={tab === "going" ? "You haven't RSVP'd to anything yet" : tab === "saved" ? "No saved events" : fromClubs ? "Nothing from your clubs yet" : topic ? `No upcoming ${topic} events` : "No upcoming events yet"}
            body={tab === "upcoming" ? (hostClubs.length ? "You can host one: use Host an event above, or let Ember plan it." : "Verified companies, schools and clubs post events here. Club admins can host from their club's Events tab.") : undefined}
          />
        )}
      </div>
    </>
  );
}
