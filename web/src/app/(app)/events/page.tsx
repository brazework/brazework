import { eventWithHost } from "@/lib/db-features";
import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { DROP_AFTER_MS, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { EventCard } from "./event-card";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <div className="mx-auto max-w-3xl">
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

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Career fairs, talks, build nights and hackathons from verified organizations and clubs."
        actions={<Link href="/org" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm transition hover:bg-hover">{isAdmin ? "Your organization" : "Host an event"}</Link>}
      />
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
        {list.map((e) => <EventCard key={e.id} event={e} going={going.has(e.id)} saved={saved.has(e.id)} now={requestTime()} />)}
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
