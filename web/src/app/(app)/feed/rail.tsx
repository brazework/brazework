import { dbFeatures, eventWithHost } from "@/lib/db-features";
import { CalendarDays, Plus, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { DROP_AFTER_MS, dateParts, withHost, type HostedEvent } from "@/lib/events";
import { cn, requestTime } from "@/lib/forge";
import { rank } from "@/lib/communities";
import { buildWeek, type WeekInput, type WeekItem } from "@/lib/week";
import { getViewer } from "@/lib/supabase/server";
import { RailCard } from "@/components/app/rail-card";
import { MessageDock } from "@/components/messages/dock";
import { CommunityBadge } from "../communities/_components/badge";
import { UpdatesPanel } from "@/components/tour/updates-panel";
import { newsPool, pickNews, type NewsPick } from "@/lib/news";
import { TrendingNews } from "./trending-news";

// The feed's right rail (wide screens): Forge updates (recent and coming next), what's trending, your clubs and what's coming up, so the rest of Forge is one glance away.
export async function FeedRail() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const now = requestTime();
  const cutoff = new Date(now - DROP_AFTER_MS).toISOString();
  const since = new Date(now - 14 * 864e5).toISOString();
  const [mine, ev, going, recent, pool, ch] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name, member_count)").eq("uid", user.id).limit(50),
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(4),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("posts").select("tags").is("community_id", null).gt("created_at", since).limit(300),
    newsPool().catch(() => []),
    // Open sponsored challenges (supabase/challenges.sql), soonest deadline first.
    (await dbFeatures()).challenges
      ? supabase.from("challenges").select("id, title, prize, deadline, organizations(name)").eq("status", "open").gt("deadline", new Date(now).toISOString()).order("deadline", { ascending: true }).limit(3)
      : Promise.resolve({ data: [] }),
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

  const week = await loadWeek(supabase, user.id, (mine.data ?? []) as unknown as { role: string; communities: C | null }[], events, goingSet, now);

  return <RailView trending={trending} news={news} hasInterests={(profile.interests ?? []).length > 0} clubs={clubs} events={events} going={goingSet} challenges={challenges} week={week} />;
}

type Club = { id: string; name: string; member_count: number };
type RailChallenge = { id: string; title: string; sponsor: string; prize: string; days: number };

// The rail's markup, separate from its queries so it can be previewed with sample data.
export function RailView({ trending, news = [], hasInterests = false, clubs, events, going: goingSet, challenges = [], week = [] }: { trending: [string, number][]; news?: NewsPick[]; hasInterests?: boolean; clubs: Club[]; events: HostedEvent[]; going: Set<string>; challenges?: RailChallenge[]; week?: WeekItem[] }) {
  return (
    <div className="no-scrollbar sticky top-8 flex max-h-[calc(100dvh-4rem)] flex-col gap-4 [&>*]:shrink-0 overflow-y-auto overscroll-contain pb-2 min-[137.5rem]:grid min-[137.5rem]:grid-cols-2 min-[137.5rem]:items-start">
      {week.length > 0 && (
        <RailCard id="week" title="Your week" icon={<Sparkles className="size-3.5" />} summary={week[0].text} badge={week.filter((w) => w.tone === "todo").length || undefined}>
          <ul className="mt-3 flex flex-col gap-1">
            {week.map((w) => (
              <li key={w.id}>
                <Link href={w.href} className={cn("group flex items-center gap-2.5 rounded-xl px-1.5 py-2 text-sm transition hover:bg-hover", w.tone === "nudge" && "bg-surface-2/70")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", w.tone === "todo" ? "bg-accent" : w.tone === "nudge" ? "bg-ok" : "bg-line-strong")} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-text-2 group-hover:text-text">{w.text}</span>
                  {w.action && <span className="shrink-0 text-xs font-medium text-text">{w.action} →</span>}
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      )}
      <UpdatesPanel />
      <TrendingNews trending={trending} news={news} hasInterests={hasInterests} />

      <RailCard id="clubs" title="Your clubs" icon={<Users className="size-3.5" />} href="/communities" summary={clubs.length ? clubs.map((c) => c.name).join(", ") : "Join your club"}>
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
      </RailCard>

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
                    <span className="block truncate text-xs text-faint">{goingSet.has(e.id) ? "✓ You're going · " : ""}{e.host}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!events.length && <p className="mt-2 text-sm text-muted">Nothing scheduled yet.</p>}
      </RailCard>

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

      <MessageDock variant="rail" />
    </div>
  );
}

// The data behind "Your week": counts from the last seven days in your clubs, what's waiting on you,
// and your quietest active project. Row-level security limits every count to what you can see.
async function loadWeek(
  supabase: Awaited<ReturnType<typeof getViewer>>["supabase"], me: string,
  memberships: { role: string; communities: { id: string; name: string } | null }[], events: HostedEvent[], going: Set<string>, now: number,
): Promise<WeekItem[]> {
  const f = await dbFeatures();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const clubIds = memberships.map((m) => m.communities?.id).filter((x): x is string => !!x);
  const officerOf = memberships.filter((m) => rank(m.role) >= 3 && m.communities).map((m) => m.communities!.id);
  const none = Promise.resolve({ data: [] as never[], count: 0 });
  const [posts, verified, pending, toVerify, projects] = await Promise.all([
    clubIds.length ? supabase.from("posts").select("id", { count: "exact", head: true }).in("community_id", clubIds).neq("author_id", me).gt("created_at", weekAgo) : none,
    f.milestones && clubIds.length ? supabase.from("milestones").select("community_id, community_name").eq("status", "verified").in("community_id", clubIds).gt("reviewed_at", weekAgo).limit(200) : none,
    f.milestones ? supabase.from("milestones").select("id", { count: "exact", head: true }).eq("owner_id", me).eq("status", "pending") : none,
    f.milestones && officerOf.length ? supabase.from("milestones").select("community_id").eq("status", "pending").in("community_id", officerOf).neq("owner_id", me).limit(200) : none,
    supabase.from("projects").select("id, title, status, updated_at").eq("owner_id", me).order("updated_at", { ascending: false }).limit(5),
  ]);
  const byClub = new Map<string, number>();
  for (const m of (verified.data ?? []) as { community_name: string }[]) byClub.set(m.community_name, (byClub.get(m.community_name) ?? 0) + 1);
  const waiting = new Map<string, number>();
  for (const m of (toVerify.data ?? []) as { community_id: string }[]) waiting.set(m.community_id, (waiting.get(m.community_id) ?? 0) + 1);
  const topWaiting = [...waiting.entries()].sort((a, b) => b[1] - a[1])[0];
  // Your active project with the longest gap since its last update post (or since it changed).
  const active = ((projects.data ?? []) as { id: string; title: string; status: string; updated_at: string }[]).filter((p) => p.status !== "completed");
  let quietProject: WeekInput["quietProject"] = null;
  if (active.length && f.projectPosts) {
    const { data: last } = await supabase.from("posts").select("project_id, created_at").eq("author_id", me).in("project_id", active.map((p) => p.id)).order("created_at", { ascending: false }).limit(50);
    const lastPost = new Map<string, number>();
    for (const r of (last ?? []) as { project_id: string; created_at: string }[]) if (!lastPost.has(r.project_id)) lastPost.set(r.project_id, Date.parse(r.created_at));
    const gaps = active.map((p) => ({ id: p.id, title: p.title, days: Math.floor((now - Math.max(lastPost.get(p.id) ?? 0, Date.parse(p.updated_at))) / 864e5) }));
    quietProject = gaps.sort((a, b) => b.days - a.days)[0] ?? null;
  }
  const next = events.filter((e) => going.has(e.id) && Date.parse(e.starts_at) > now && Date.parse(e.starts_at) - now < 7 * 864e5)[0];
  return buildWeek({
    clubPosts: posts.count ?? 0,
    verifiedInClubs: [...byClub.entries()].map(([club, n]) => ({ club, n })).sort((a, b) => b.n - a.n),
    myPending: pending.count ?? 0,
    toVerify: topWaiting ? { clubId: topWaiting[0], n: topWaiting[1] } : null,
    quietProject,
    nextEvent: next ? { id: next.id, title: next.title, days: Math.floor((Date.parse(next.starts_at) - now) / 864e5) } : null,
    hasClub: clubIds.length > 0,
    hasProject: ((projects.data ?? []) as unknown[]).length > 0,
  });
}
