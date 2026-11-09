import { dbFeatures } from "@/lib/db-features";
import { requestTime } from "@/lib/forge";
import type { createClient } from "@/lib/supabase/server";

// "This week" for a club: computed on demand from live data (no cron, no cost), for the club's
// moderators and up. Shared by the Manage → Report tab and Copilot's club_report tool.

type DB = Awaited<ReturnType<typeof createClient>>;
const DAY = 864e5;

export type ClubReport = {
  name: string;
  members: number;
  newMembers: number;
  newMemberNames: string[];
  posts: { thisWeek: number; lastWeek: number };
  topPost: { id: string; body: string; author: string; likes: number; comments: number } | null;
  topPosters: { name: string; posts: number }[];
  upcoming: { id: string; title: string; starts_at: string; going: number }[];
  milestones: { verifiedThisWeek: number; waiting: number; oldestWaitingDays: number | null } | null;
  joinRequests: number;
};

type Features = { clubEvents: boolean; milestones: boolean };

export async function loadClubReport(db: DB, clubId: string, features?: Features): Promise<ClubReport | null> {
  const now = requestTime();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const twoWeeksAgo = new Date(now - 14 * DAY).toISOString();
  const f = features ?? (await dbFeatures());
  const [club, newMembers, recentPosts, upcoming, requests, verified, waiting] = await Promise.all([
    db.from("communities").select("name, member_count").eq("id", clubId).maybeSingle(),
    db.from("community_members").select("first_name, last_name").eq("community_id", clubId).gt("joined_at", weekAgo).order("joined_at", { ascending: false }).limit(50),
    db.from("posts").select("id, body, author_first, author_last, like_count, comment_count, created_at").eq("community_id", clubId).eq("status", "visible").gt("created_at", twoWeeksAgo).limit(500),
    f.clubEvents ? db.from("events").select("id, title, starts_at, rsvp_count").eq("community_id", clubId).eq("status", "published").gt("starts_at", new Date(now).toISOString()).lt("starts_at", new Date(now + 14 * DAY).toISOString()).order("starts_at").limit(6) : Promise.resolve({ data: [] }),
    db.from("community_requests").select("uid", { count: "exact", head: true }).eq("community_id", clubId),
    f.milestones ? db.from("milestones").select("id", { count: "exact", head: true }).eq("community_id", clubId).eq("status", "verified").gt("reviewed_at", weekAgo) : Promise.resolve({ count: null }),
    f.milestones ? db.from("milestones").select("created_at").eq("community_id", clubId).eq("status", "pending").order("created_at", { ascending: true }).limit(200) : Promise.resolve({ data: null }),
  ]);
  if (!club.data) return null;

  type P = { id: string; body: string; author_first: string; author_last: string; like_count: number; comment_count: number; created_at: string };
  const posts = (recentPosts.data ?? []) as P[];
  const thisWeek = posts.filter((p) => p.created_at > weekAgo);
  const top = [...thisWeek].sort((a, b) => b.like_count + b.comment_count * 2 - (a.like_count + a.comment_count * 2))[0];
  const byAuthor = new Map<string, number>();
  for (const p of thisWeek) { const n = `${p.author_first} ${p.author_last}`.trim(); byAuthor.set(n, (byAuthor.get(n) ?? 0) + 1); }
  const waitingRows = (waiting.data ?? null) as { created_at: string }[] | null;

  return {
    name: club.data.name,
    members: club.data.member_count,
    newMembers: (newMembers.data ?? []).length,
    newMemberNames: (newMembers.data ?? []).slice(0, 6).map((m) => `${m.first_name} ${m.last_name}`.trim()),
    posts: { thisWeek: thisWeek.length, lastWeek: posts.length - thisWeek.length },
    topPost: top ? { id: top.id, body: top.body.replace(/\s+/g, " ").slice(0, 160), author: `${top.author_first} ${top.author_last}`.trim(), likes: top.like_count, comments: top.comment_count } : null,
    topPosters: [...byAuthor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, posts: n })),
    upcoming: ((upcoming.data ?? []) as { id: string; title: string; starts_at: string; rsvp_count: number }[]).map((e) => ({ id: e.id, title: e.title, starts_at: e.starts_at, going: e.rsvp_count })),
    milestones: f.milestones ? {
      verifiedThisWeek: verified.count ?? 0,
      waiting: waitingRows?.length ?? 0,
      oldestWaitingDays: waitingRows?.length ? Math.floor((now - Date.parse(waitingRows[0].created_at)) / DAY) : null,
    } : null,
    joinRequests: requests.count ?? 0,
  };
}
