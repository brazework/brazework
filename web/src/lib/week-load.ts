import type { SupabaseClient } from "@supabase/supabase-js";
import { rank } from "@/lib/communities";
import { dbFeatures } from "@/lib/db-features";
import type { HostedEvent } from "@/lib/events";
import { buildWeek, type WeekInput, type WeekItem } from "@/lib/week";

// The data behind "Your week": counts from the last seven days in your clubs, what's waiting on you,
// and your quietest active project. Row-level security limits every count to what you can see.
export async function loadWeek(
  supabase: SupabaseClient, me: string,
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

// The same, for code that doesn't already have the member's clubs and RSVPs at hand (the weekly
// email digest).
export async function loadWeekFor(supabase: SupabaseClient, me: string, now: number): Promise<WeekItem[]> {
  const [mine, rsvps] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name)").eq("uid", me).limit(50),
    supabase.from("event_rsvps").select("event_id").eq("user_id", me).limit(200),
  ]);
  const going = new Set(((rsvps.data ?? []) as { event_id: string }[]).map((r) => r.event_id));
  const { data: evs } = going.size
    ? await supabase.from("events").select("id, title, starts_at, ends_at").in("id", [...going]).gt("starts_at", new Date(now).toISOString()).order("starts_at").limit(5)
    : { data: [] };
  return loadWeek(supabase, me, (mine.data ?? []) as unknown as { role: string; communities: { id: string; name: string } | null }[], (evs ?? []) as unknown as HostedEvent[], going, now);
}
