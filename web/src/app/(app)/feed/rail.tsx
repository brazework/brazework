import { eventWithHost } from "@/lib/db-features";
import { CalendarDays, Plus, Users } from "lucide-react";
import Link from "next/link";
import { DROP_AFTER_MS, dateParts, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { CommunityBadge } from "../communities/_components/badge";
import { UpdatesPanel } from "@/components/tour/updates-panel";
import { newsPool, pickNews, type NewsPick } from "@/lib/news";
import { TrendingNews } from "./trending-news";

const box = "glass-card rounded-3xl p-4";

function Head({ icon: Icon, title, href }: { icon: typeof Users; title: string; href?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-accent-grad text-on-accent"><Icon className="size-3.5" /></span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {href && <Link href={href} className="ml-auto text-xs text-muted hover:text-text">See all</Link>}
    </div>
  );
}

// The feed's right rail (wide screens): Forge updates (recent and coming next), what's trending, your clubs and what's coming up, so the rest of Forge is one glance away.
export async function FeedRail() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const now = requestTime();
  const cutoff = new Date(now - DROP_AFTER_MS).toISOString();
  const since = new Date(now - 14 * 864e5).toISOString();
  const [mine, ev, going, recent, pool] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name, member_count)").eq("uid", user.id).limit(6),
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(4),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("posts").select("tags").is("community_id", null).gt("created_at", since).limit(300),
    newsPool().catch(() => []),
  ]);
  // STEM news from around the web, on your interests first.
  const news = pickNews(pool, profile.interests ?? [], profile.field ?? "", 6, now);
  type C = { id: string; name: string; member_count: number };
  const clubs = ((mine.data ?? []) as unknown as { communities: C | C[] | null }[])
    .flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []))
    .slice(0, 5);
  const events = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const goingSet = new Set((going.data ?? []).map((g) => g.event_id as string));

  // Trending: the most-used tags on public posts in the last two weeks.
  const counts = new Map<string, number>();
  for (const r of (recent.data ?? []) as { tags: string[] }[]) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return <RailView trending={trending} news={news} hasInterests={(profile.interests ?? []).length > 0} clubs={clubs} events={events} going={goingSet} />;
}

type Club = { id: string; name: string; member_count: number };

// The rail's markup, separate from its queries so it can be previewed with sample data.
export function RailView({ trending, news = [], hasInterests = false, clubs, events, going: goingSet }: { trending: [string, number][]; news?: NewsPick[]; hasInterests?: boolean; clubs: Club[]; events: HostedEvent[]; going: Set<string> }) {
  return (
    <div className="sticky top-8 flex flex-col gap-4 min-[137.5rem]:grid min-[137.5rem]:grid-cols-2 min-[137.5rem]:items-start">
      <UpdatesPanel />
      <TrendingNews trending={trending} news={news} hasInterests={hasInterests} />

      <section className={box}>
        <Head icon={Users} title="Your clubs" href="/communities" />
        <ul className="mt-3 flex flex-col gap-1">
          {clubs.map((cl) => (
            <li key={cl.id}>
              <Link href={`/c/${cl.id}`} className="group flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-hover">
                <CommunityBadge id={cl.id} name={cl.name} size={32} className="transition group-hover:scale-105" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{cl.name}</span>
                  <span className="block text-xs text-faint">{cl.member_count} {cl.member_count === 1 ? "member" : "members"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!clubs.length && <p className="mt-2 text-sm text-muted">Join your club, or start it here.</p>}
        <Link href={clubs.length ? "/communities?tab=discover" : "/communities?tab=create"} className="mt-2 flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-sm text-muted transition hover:bg-hover hover:text-text">
          <Plus className="size-4" /> {clubs.length ? "Find more clubs" : "Start your club"}
        </Link>
      </section>

      <section className={box}>
        <Head icon={CalendarDays} title="Coming up" href="/events" />
        <ul className="mt-3 flex flex-col gap-2">
          {events.map((e) => {
            const d = dateParts(e.starts_at, "UTC");
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="group flex gap-3 rounded-xl p-1.5 transition hover:bg-hover">
                  <span className="flex w-11 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line bg-surface">
                    <span className="bg-accent-grad w-full py-0.5 text-center text-[9px] font-semibold text-on-accent uppercase">{d.mon}</span>
                    <span className="py-1 text-base leading-none font-semibold">{d.day}</span>
                  </span>
                  <span className="min-w-0 self-center">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="block truncate text-xs text-faint">{goingSet.has(e.id) ? "✓ You're going · " : ""}{e.host}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!events.length && <p className="mt-2 text-sm text-muted">Nothing scheduled yet.</p>}
      </section>
    </div>
  );
}
