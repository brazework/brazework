import { dbFeatures, eventWithHost } from "@/lib/db-features";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { DROP_AFTER_MS, dateParts, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { RailCard } from "@/components/app/rail-card";
import { MessageDock } from "@/components/messages/dock";
import { YourWeekCard } from "./streak";
import { TrendingNews } from "./trending-news";
import { newsPool, pickNews, type NewsPick } from "@/lib/news";
import { ConnectAgentCard } from "./connect-agent";
import { Suspense } from "react";

// The feed's right rail (wide screens), redesign 2026-11: your week, what's coming up, your messages,
// then trending and news. Challenges and Brazework's own updates are a tab away, so Home stays calm.
export async function FeedRail() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const now = requestTime();
  const cutoff = new Date(now - DROP_AFTER_MS).toISOString();
  const f = await dbFeatures();
  const since = new Date(now - 14 * 864e5).toISOString();
  const [ev, going, tokens, recent, pool] = await Promise.all([
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(3),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    // Has this member connected an AI tool yet (supabase/mcp.sql)? If not, Home suggests it.
    f.mcp ? supabase.from("api_tokens").select("id", { count: "exact", head: true }).is("revoked_at", null) : Promise.resolve({ count: 1 }),
    supabase.from("posts").select("tags").is("community_id", null).gt("created_at", since).limit(300),
    newsPool().catch(() => []),
  ]);
  // Trending tags on public posts in the last two weeks, and news on your interests first.
  const counts = new Map<string, number>();
  for (const r of (recent.data ?? []) as { tags: string[] }[]) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const news = pickNews(pool, profile.interests ?? [], profile.field ?? "", 6, now);
  const events = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const goingSet = new Set((going.data ?? []).map((g) => g.event_id as string));
  return <RailView top={<><Suspense fallback={<div className="h-40 shimmer rounded-xl" aria-hidden="true" />}><YourWeekCard /></Suspense>{(tokens.count ?? 1) === 0 && <ConnectAgentCard />}</>} events={events} going={goingSet} trending={trending} news={news} hasInterests={(profile.interests ?? []).length > 0} />;
}


// The rail's markup, separate from its queries so it can be previewed with sample data.
export function RailView({ events, going: goingSet, top, trending = [], news = [], hasInterests = false }: { events: HostedEvent[]; going: Set<string>; top?: React.ReactNode; trending?: [string, number][]; news?: NewsPick[]; hasInterests?: boolean }) {
  return (
    <div className="no-scrollbar sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col gap-3 [&>*]:shrink-0 overflow-y-auto overscroll-contain pb-2">
      {top}
      <ComingUp events={events} going={goingSet} />

      <MessageDock variant="rail" />
      {/* Redesign 2026-11: what's yours first (your week, what's coming up, your messages), then one card
          for what's around: trending and news. Challenges and Brazework's own updates are a tab away. */}
      <TrendingNews trending={trending} news={news} hasInterests={hasInterests} />
    </div>
  );
}

function ComingUp({ events, going }: { events: HostedEvent[]; going: Set<string> }) {
  return (
    <RailCard id="events" title="Coming up" icon={<CalendarDays className="size-3.5" />} href="/events" summary={events[0] ? `Next: ${events[0].title}` : "Nothing scheduled yet"}>
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
                  <span className="block truncate text-xs text-faint">{going.has(e.id) ? "✓ You're going · " : ""}{e.host}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!events.length && <p className="mt-2 text-sm text-muted">Nothing scheduled yet.</p>}
    </RailCard>
  );
}
