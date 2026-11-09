import { eventWithHost } from "@/lib/db-features";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { DROP_AFTER_MS, isOver, timeBucket, whenBadge, whereLabel, withHost, type HostedEvent } from "@/lib/events";
import { LocalTime } from "./local-time";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { EventCard } from "./event-card";

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
  const cutoff = new Date(requestTime() - DROP_AFTER_MS).toISOString();

  const [ev, mine, saves, admin] = await Promise.all([
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(200),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("event_saves").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("organization_admins").select("org_id").eq("uid", user.id).limit(1),
  ]);
  const all = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const going = new Set((mine.data ?? []).map((r) => r.event_id as string));
  const saved = new Set((saves.data ?? []).map((r) => r.event_id as string));
  let list = tab === "going" ? all.filter((e) => going.has(e.id)) : tab === "saved" ? all.filter((e) => saved.has(e.id)) : all;
  const topics = [...new Set(all.map((e) => e.topic))].sort();
  if (topic) list = list.filter((e) => e.topic === topic);
  const interests = new Set<string>(profile.interests ?? []);
  const isAdmin = !!admin.data?.length;
  const q = (t: string) => `/events?tab=${tab}${t ? `&topic=${encodeURIComponent(t)}` : ""}`;
  const now = requestTime();
  // Your next event (the soonest you're going to that hasn't ended), shown up top.
  const next = all.filter((e) => going.has(e.id) && !isOver(e, now)).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const nextBadge = next ? whenBadge(next, now) : null;
  // Upcoming events in time sections; Going and Saved stay one list.
  const SECTIONS = [["now", "Happening now"], ["soon", "Today and tomorrow"], ["week", "This week"], ["later", "Later"]] as const;
  const groups = tab === "upcoming" ? SECTIONS.map(([k, label]) => ({ k, label, items: list.filter((e) => timeBucket(e, now) === k) })).filter((g) => g.items.length) : [{ k: "all", label: "", items: list }];
  const card = (e: HostedEvent) => <EventCard key={e.id} event={e} going={going.has(e.id)} saved={saved.has(e.id)} now={now} match={interests.has(e.topic) ? e.topic : ""} />;

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Career fairs, talks, build nights and hackathons from verified organizations and clubs."
        actions={<Link href="/org" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm transition hover:bg-hover">{isAdmin ? "Your organization" : "Host an event"}</Link>}
      />
      {next && tab === "upcoming" && !topic && (
        <Link href={`/events/${next.id}`} className="glass-card group mt-6 flex flex-wrap items-center gap-4 rounded-3xl p-5 transition hover:-translate-y-0.5">
          <span className="bg-accent-grad grid size-12 shrink-0 place-items-center rounded-2xl text-on-accent"><CalendarCheck className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium tracking-wide text-faint uppercase">Up next for you{nextBadge ? ` · ${nextBadge.text}` : ""}</span>
            <span className="mt-0.5 block truncate text-lg font-semibold">{next.title}</span>
            <span className="block truncate text-sm text-muted"><LocalTime kind="full" value={next.starts_at} /> · {whereLabel(next)}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium">Details <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
        </Link>
      )}
      <div className="mt-6">
        <Tabs active={tab} tabs={[
          { id: "upcoming", label: "Upcoming", href: "/events" },
          { id: "going", label: "Going", href: "/events?tab=going", count: all.filter((e) => going.has(e.id)).length },
          { id: "saved", label: "Saved", href: "/events?tab=saved", count: all.filter((e) => saved.has(e.id)).length },
        ]} />
      </div>
      {topics.length > 1 && (
        <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
          <Link href={q("")} className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${!topic ? "border-text text-text" : "border-line text-muted hover:text-text"}`}>All topics</Link>
          {topics.map((t) => (
            <Link key={t} href={q(t)} className={`shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition ${topic === t ? "border-text text-text" : "border-line text-muted hover:text-text"}`}>
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
            title={tab === "going" ? "You haven't RSVP'd to anything yet" : tab === "saved" ? "No saved events" : topic ? `No upcoming ${topic} events` : "No upcoming events yet"}
            body={tab === "upcoming" ? "Verified companies, schools and clubs post events here. Club admins can host from their club's Events tab." : undefined}
          />
        )}
      </div>
    </>
  );
}
