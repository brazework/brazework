import { BadgeCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
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
type Recent = { id: string; title: string; reviewer_name: string; reviewed_at: string; owner_id: string; owner: { first_name: string; last_name: string } | null };

export async function BuildersThisTerm({ cid }: { cid: string }) {
  const { supabase } = await getViewer();
  const since = termStart(requestTime());
  // The wall is the club's public face: only milestones their owners made public, even for officers.
  const publicOnly = (await dbFeatures()).verification;
  const latestQ = supabase.from("milestones").select("id, title, reviewer_name, reviewed_at, owner_id, owner:profiles!milestones_owner_id_fkey(first_name, last_name)")
    .eq("community_id", cid).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(4);
  const [{ data }, { data: latest }] = await Promise.all([
    supabase.from("milestones").select("owner_id, owner:profiles!milestones_owner_id_fkey(first_name, last_name)")
      .eq("community_id", cid).eq("status", "verified").gte("reviewed_at", since.toISOString()).limit(1000),
    publicOnly ? latestQ.eq("private", false) : latestQ,
  ]);
  const recent = (latest ?? []) as unknown as Recent[];
  const counts = new Map<string, { first: string; last: string; n: number }>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const cur = counts.get(r.owner_id) ?? { first: r.owner?.first_name ?? "", last: r.owner?.last_name ?? "", n: 0 };
    cur.n++;
    counts.set(r.owner_id, cur);
  }
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first.localeCompare(b[1].first)).slice(0, 5);
  if (!top.length && !recent.length) return null;
  const max = top[0]?.[1].n ?? 1;
  const total = [...counts.values()].reduce((s, x) => s + x.n, 0);
  return (
    <>
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
          <h2 className="mb-2.5 inline-flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="size-4 text-ok" /> Recently verified</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/u/${m.owner_id}#proof`} className="group flex h-full gap-3 rounded-2xl border border-line bg-surface/70 p-3.5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_14px_40px_-24px_rgb(0_0_0/0.35)]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ok text-white"><BadgeCheck className="size-4" /></span>
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
