import { dbFeatures, eventWithHost } from "@/lib/db-features";
import { CalendarDays, Trophy } from "lucide-react";
import Link from "next/link";
import { DROP_AFTER_MS, dateParts, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { RailCard } from "@/components/app/rail-card";
import { MessageDock } from "@/components/messages/dock";
import { UpdatesPanel } from "@/components/tour/updates-panel";
import { newsPool, pickNews, type NewsPick } from "@/lib/news";
import { TrendingNews } from "./trending-news";
import { YourWeekCard } from "./streak";
import { ConnectAgentCard } from "./connect-agent";
import { GoalCard } from "@/components/app/goal-card";
import { loadGoal, loadRecord } from "@/lib/goal-load";
import { Suspense } from "react";

// The feed's right rail (wide screens): your week, what's coming up, your clubs and open challenges, then what's trending and Brazework's own updates, so the rest of Brazework is one glance away.
export async function FeedRail() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const now = requestTime();
  const cutoff = new Date(now - DROP_AFTER_MS).toISOString();
  const since = new Date(now - 14 * 864e5).toISOString();
  const f = await dbFeatures();
  const [mine, ev, going, recent, pool, ch, tokens] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name, member_count)").eq("uid", user.id).limit(50),
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(4),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("posts").select("tags").is("community_id", null).gt("created_at", since).limit(300),
    newsPool().catch(() => []),
    // Open sponsored challenges (supabase/challenges.sql), soonest deadline first.
    f.challenges
      ? supabase.from("challenges").select("id, title, prize, deadline, organizations(name)").eq("status", "open").gt("deadline", new Date(now).toISOString()).order("deadline", { ascending: true }).limit(3)
      : Promise.resolve({ data: [] }),
    // Has this member connected an AI tool yet (supabase/mcp.sql)? If not, Home suggests it.
    f.mcp ? supabase.from("api_tokens").select("id", { count: "exact", head: true }).is("revoked_at", null) : Promise.resolve({ count: 1 }),
  ]);
  const challenges: RailChallenge[] = ((ch.data ?? []) as unknown as { id: string; title: string; prize: string; deadline: string; organizations: { name: string } | null }[])
    .map((c) => ({ id: c.id, title: c.title, sponsor: c.organizations?.name ?? "Sponsor", prize: c.prize, days: Math.max(0, Math.ceil((Date.parse(c.deadline) - now) / 864e5)) }));
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

  // Your week tops the rail (FIX-67, FIX-92): streak, proof, views and to-dos in one card.
  // Your goal first (supabase/goals.sql): what you're working toward and the one next step.
  const [goal, record] = f.goals ? await Promise.all([loadGoal(supabase, user.id), loadRecord(supabase, user.id)]) : [null, null];
  return <RailView top={<>{record && <GoalCard compact goal={goal} record={record} profileId={user.id} />}<Suspense fallback={null}><YourWeekCard /></Suspense>{(tokens.count ?? 1) === 0 && <ConnectAgentCard />}</>} trending={trending} news={news} hasInterests={(profile.interests ?? []).length > 0} clubs={clubs} events={events} going={goingSet} challenges={challenges} />;
}

type Club = { id: string; name: string; member_count: number };
type RailChallenge = { id: string; title: string; sponsor: string; prize: string; days: number };

// The rail's markup, separate from its queries so it can be previewed with sample data.
// Order (FIX-92): what's yours first (your week, what's coming up, your clubs, open challenges), then
// what's around (trending), and Brazework's own news last.
export function RailView({ trending, news = [], hasInterests = false, events, going: goingSet, challenges = [], top }: { trending: [string, number][]; news?: NewsPick[]; hasInterests?: boolean; clubs: Club[]; events: HostedEvent[]; going: Set<string>; challenges?: RailChallenge[]; top?: React.ReactNode }) {
  return (
    <div className="no-scrollbar sticky top-8 flex max-h-[calc(100dvh-4rem)] flex-col gap-4 [&>*]:shrink-0 overflow-y-auto overscroll-contain pb-2 min-[137.5rem]:grid min-[137.5rem]:grid-cols-2 min-[137.5rem]:items-start">
      {top}
      <ComingUp events={events} going={goingSet} />

      {/* Your clubs are in the sidebar on every page now (redesign stage 1), so the rail no longer repeats them. */}

      {challenges.length > 0 && (
        <RailCard id="challenges" title="Open challenges" icon={<Trophy className="size-3.5" />} href="/challenges" summary={`${challenges.length} open · next deadline in ${challenges[0]?.days ?? 0} ${challenges[0]?.days === 1 ? "day" : "days"}`}>
          <ul className="mt-3 flex flex-col gap-1">
            {challenges.map((c) => (
              <li key={c.id}>
                <Link href={`/challenges/${c.id}`} className="block rounded-xl p-1.5 transition hover:bg-hover">
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="block truncate text-xs text-faint">{c.sponsor}{c.prize ? ` · ${c.prize}` : ""} · {c.days} {c.days === 1 ? "day" : "days"} left</span>
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      )}

      <TrendingNews trending={trending} news={news} hasInterests={hasInterests} />
      <UpdatesPanel />
      <MessageDock variant="rail" />
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
