import { BadgeCheck, Flame, Trophy } from "lucide-react";
import Link from "next/link";
import { Seal } from "@/components/app/verified-seal";
import { Avatar } from "@/components/ui";
import { buildStreak } from "@/lib/streak";
import { dbFeatures } from "@/lib/db-features";
import { requestTime, timeAgo } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// "Builders this term" (Linear FIX-67): the club's members ranked by milestones the club verified
// since the term began (August 1 or January 1). Row-level security decides what counts: members see
// verified, public milestones; officers also count the private ones they reviewed. Nothing shows
// until someone has one, so a new club never sees an empty leaderboard.
export function termStart(now: number): Date {
  const d = new Date(now);
  return d.getUTCMonth() >= 7 ? new Date(Date.UTC(d.getUTCFullYear(), 7, 1)) : new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

type Row = { owner_id: string; owner: { first_name: string; last_name: string } | null };
type PostRow = { author_id: string; author_first: string; author_last: string; created_at: string };
type Recent = { id: string; title: string; reviewer_name: string; reviewed_at: string; owner_id: string; owner: { first_name: string; last_name: string } | null };

export async function BuildersThisTerm({ cid }: { cid: string }) {
  const { supabase } = await getViewer();
  const since = termStart(requestTime());
  // The wall is the club's public face: only milestones their owners made public, even for officers.
  const publicOnly = (await dbFeatures()).verification;
  const latestQ = supabase.from("milestones").select("id, title, reviewer_name, reviewed_at, owner_id, owner:profiles!milestones_owner_id_fkey(first_name, last_name)")
    .eq("community_id", cid).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(4);
  const now = requestTime();
  const [{ data }, { data: latest }, { data: postRows }] = await Promise.all([
    supabase.from("milestones").select("owner_id, owner:profiles!milestones_owner_id_fkey(first_name, last_name)")
      .eq("community_id", cid).eq("status", "verified").gte("reviewed_at", since.toISOString()).limit(1000),
    publicOnly ? latestQ.eq("private", false) : latestQ,
    // Who's building this week: the club's posts over the last 9 weeks, for this week and streaks.
    supabase.from("posts").select("author_id, author_first, author_last, created_at").eq("community_id", cid).eq("status", "visible")
      .gte("created_at", new Date(now - 63 * 864e5).toISOString()).order("created_at", { ascending: false }).limit(2000),
  ]);
  const byAuthor = new Map<string, { first: string; last: string; times: number[] }>();
  for (const r of (postRows ?? []) as PostRow[]) {
    const cur = byAuthor.get(r.author_id) ?? { first: r.author_first, last: r.author_last, times: [] };
    cur.times.push(Date.parse(r.created_at));
    byAuthor.set(r.author_id, cur);
  }
  // Streaks follow the same rule as Home (lib/streak.ts): weeks in a row, one missed week forgiven.
  const building = [...byAuthor.entries()].map(([uid, a]) => ({ uid, ...a, streak: buildStreak(a.times, now) }))
    .filter((a) => a.streak.thisWeek).sort((a, b) => b.streak.weeks - a.streak.weeks || a.first.localeCompare(b.first));
  const recent = (latest ?? []) as unknown as Recent[];
  const counts = new Map<string, { first: string; last: string; n: number }>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const cur = counts.get(r.owner_id) ?? { first: r.owner?.first_name ?? "", last: r.owner?.last_name ?? "", n: 0 };
    cur.n++;
    counts.set(r.owner_id, cur);
  }
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first.localeCompare(b[1].first)).slice(0, 5);
  if (!top.length && !recent.length && !byAuthor.size) return null;
  const max = top[0]?.[1].n ?? 1;
  const total = [...counts.values()].reduce((s, x) => s + x.n, 0);
  return (
    <>
      {/* Friendly momentum, not points: who's posted here this week, with their weekly streak. */}
      {byAuthor.size > 0 && (
        <section aria-label="Who's building this week" className="glass-card mt-4 rounded-3xl p-4 sm:p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Flame className="size-4 text-orange-500" /> Who&apos;s building this week</h2>
          {building.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {building.slice(0, 12).map((b) => (
                <li key={b.uid}>
                  <Link href={`/u/${b.uid}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm transition hover:border-line-strong">
                    <Avatar first={b.first} last={b.last} size={24} />
                    <span className="font-medium">{b.first || "A member"}</span>
                    {b.streak.weeks >= 2 && <span className="inline-flex items-center gap-0.5 text-xs text-orange-600 tabular-nums"><Flame className="size-3" />{b.streak.weeks}</span>}
                  </Link>
                </li>
              ))}
              {building.length > 12 && <li className="self-center text-xs text-faint">and {building.length - 12} more</li>}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Nobody has posted here this week yet. Share what you&apos;re building and you&apos;re first.</p>
          )}
        </section>
      )}
      {top.length > 0 && (
        <section aria-label="Builders this term" className="glass-card mt-4 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap"><Trophy className="size-4 text-amber-500" /> Builders this term</h2>
          <span className="inline-flex items-center gap-1 text-xs text-faint"><BadgeCheck className="size-3.5 text-ok" /> {total} verified since {since.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {top.map(([uid, p], i) => (
            <li key={uid}>
              <Link href={`/u/${uid}`} className="group flex items-center gap-3 rounded-xl p-1 transition hover:bg-hover">
                <span className="w-4 text-center font-mono text-xs text-faint tabular-nums">{i + 1}</span>
                <Avatar first={p.first} last={p.last} size={28} />
                <span className="w-28 min-w-0 shrink-0 truncate text-sm font-medium group-hover:underline sm:w-36">{`${p.first} ${p.last}`.trim() || "A member"}</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="bg-accent-grad block h-full rounded-full" style={{ width: `${Math.max(8, (p.n / max) * 100)}%` }} /></span>
                <span className="w-6 text-right font-mono text-xs tabular-nums">{p.n}</span>
              </Link>
            </li>
          ))}
        </ol>
        </section>
      )}
      {/* The club's latest signed-off work: what a visitor should see first. */}
      {recent.length > 0 && (
        <section aria-label="Recently verified" className="mt-4">
          <h2 className="mb-2.5 inline-flex items-center gap-2 text-sm font-semibold"><Seal size={18} /> Recently verified</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/u/${m.owner_id}#proof`} className="group flex h-full gap-3 rounded-2xl border border-line bg-surface/70 p-3.5 transition hover:border-line-strong">
                  <Seal size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium group-hover:underline">{m.title}</span>
                    <span className="block truncate text-xs text-muted">{`${m.owner?.first_name ?? ""} ${m.owner?.last_name ?? ""}`.trim() || "A member"} · signed by {m.reviewer_name || "an officer"}</span>
                    <span className="block text-[11px] text-faint">{timeAgo(m.reviewed_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
