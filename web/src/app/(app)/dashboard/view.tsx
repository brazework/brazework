import { ArrowRight, BarChart3, Lock, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, Tabs } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { Ember } from "@/components/ember/ember";
import type { ClubReport } from "@/lib/club-report";
import { cn, timeAgo } from "@/lib/forge";
import { Bars, Sparkline, type Point, type Unit } from "./charts";

export const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["1y", "12 months"]] as const;
export type Range = (typeof RANGES)[number][0];

export type Figures = { views: number; viewers: number; likes: number; comments: number; followers: number; connections: number };
export type Result = {
  unit: Unit;
  start: string;
  current: Figures;
  previous: Figures;
  series: { bucket: string; views: number }[];
  breakdown: { accountTypes: Record<string, number>; fields: { field: string; count: number }[] } | null;
  topPosts: { id: string; body: string; created_at: string; communityName: string | null; likes: number; comments: number }[];
};

// The dashboard itself, from loaded data (also renders sample data in previews).
export function DashboardView({ r, range, likes, comments, follows, views, reports, userId }: { r: Result; range: Range; likes: Point[]; comments: Point[]; follows: Point[]; views: Point[]; reports: { id: string; report: ClubReport }[]; userId: string }) {
  const tabs = <Tabs active={range} tabs={RANGES.map(([id, label]) => ({ id, label, href: `/dashboard?range=${id}` }))} />;
  const label = RANGES.find(([k]) => k === range)?.[1] ?? "";
  const delta = (k: keyof Figures) => {
    const now = r.current?.[k] ?? 0, before = r.previous?.[k] ?? 0;
    if (!before) return { text: now ? "New" : "No change", tone: "flat" as const };
    const pct = Math.round(((now - before) / before) * 100);
    return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const) };
  };
  const tiles: { k: keyof Figures; name: string; trend: number[] }[] = [
    { k: "views", name: "Profile views", trend: views.map((p) => p.value) },
    { k: "likes", name: "Likes on your posts", trend: likes.map((p) => p.value) },
    { k: "comments", name: "Comments", trend: comments.map((p) => p.value) },
    { k: "followers", name: "New followers", trend: follows.map((p) => p.value) },
  ];
  const quiet = tiles.every((t) => !(r.current?.[t.k] ?? 0));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={<span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" /> Only you can see this. How your work is landing on Brazework.</span>}
        actions={<Link href={`/u/${userId}`} className="text-sm text-muted hover:text-text">Your profile</Link>}
      />
      <div className="mt-6">{tabs}</div>

      <ul className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => {
          const d = delta(t.k);
          return (
            <li key={t.k}>
              <Panel className="h-full p-4">
                <div className="text-xs text-muted">{t.name}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{(r.current?.[t.k] ?? 0).toLocaleString("en-US")}</span>
                  <span className={cn("rounded-full px-1.5 py-px font-mono text-[11px]", d.tone === "up" ? "bg-ok/10 text-ok" : d.tone === "down" ? "bg-danger/10 text-danger" : "text-faint")}>{d.text}</span>
                </div>
                <Sparkline values={t.trend} label={t.name} />
                <div className="mt-1 text-[11px] text-faint">vs previous {label}</div>
              </Panel>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-faint">Also: {(r.current?.viewers ?? 0).toLocaleString("en-US")} unique viewers and {(r.current?.connections ?? 0).toLocaleString("en-US")} new connections in the last {label}.</p>

      {quiet && (
        <Panel className="mt-4 flex flex-wrap items-center gap-4 p-5">
          <Ember size={52} mood="idle" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Quiet {label}. Let&apos;s change that.</div>
            <p className="mt-0.5 text-sm text-muted">Posts with a result or a photo get the most replies. Ember can find a club to join or turn your notes into a post.</p>
          </div>
          <Link href={`/copilot?q=${encodeURIComponent("How can I get more people to see my work on Brazework? Look at my profile and suggest three concrete next steps.")}`} className="bg-accent-grad inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent">Ask Ember <ArrowRight className="size-4" /></Link>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel><Kicker>Likes per {r.unit}</Kicker><Bars series={likes} unit={r.unit} label="Likes" /></Panel>
        <Panel><Kicker>Comments per {r.unit}</Kicker><Bars series={comments} unit={r.unit} label="Comments" /></Panel>
        <Panel><Kicker>Profile views per {r.unit}</Kicker><Bars series={views} unit={r.unit} label="Profile views" /></Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <Kicker>Top posts</Kicker>
          {r.topPosts?.length ? (
            <ul className="mt-4 space-y-3">
              {r.topPosts.slice(0, 5).map((p) => {
                const best = Math.max(1, ...r.topPosts.map((x) => x.likes + x.comments));
                return (
                  <li key={p.id}>
                    <Link href={`/post/${p.id}`} className="group block rounded-xl p-2 -m-2 transition hover:bg-hover/60">
                      <span className="line-clamp-2 text-sm text-text-2 group-hover:text-text">{p.body}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 rounded-full bg-text/80" style={{ width: `${Math.max(4, ((p.likes + p.comments) / best) * 60)}%` }} aria-hidden="true" />
                        <span className="font-mono text-[11px] whitespace-nowrap text-faint">{p.likes} likes · {p.comments} comments · {timeAgo(p.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<BarChart3 className="size-5" />} title="No engagement yet" body="Likes and comments from others in this period show up here." />
          )}
        </Panel>
        <Panel>
          <Kicker>Who viewed you</Kicker>
          {r.breakdown ? (
            <dl className="mt-4 space-y-2.5 text-sm">
              {[...Object.entries(r.breakdown.accountTypes).map(([t, c]) => [t === "student" ? "Students" : "Professionals", c] as const), ...r.breakdown.fields.map((f) => [f.field, f.count] as const)].map(([name, c]) => {
                const all = Object.values(r.breakdown!.accountTypes).reduce((n, v) => n + v, 0) || 1;
                return (
                  <div key={name}>
                    <div className="flex justify-between"><dt className="text-muted">{name}</dt><dd className="tabular-nums">{c}</dd></div>
                    <div className="mt-1 h-1.5 rounded-full bg-raised"><div className="h-full rounded-full bg-text/80" style={{ width: `${Math.min(100, (c / all) * 100)}%` }} /></div>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">Shown once at least 3 different people have viewed your profile in this period, so it can never point to one person.</p>
          )}
        </Panel>
      </div>

      {reports.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Users className="size-5" /> Your clubs this week</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {reports.map(({ id, report: c }) => {
              const max = Math.max(1, c.posts.thisWeek, c.posts.lastWeek);
              return (
                <Panel key={id} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/c/${id}`} className="truncate font-semibold hover:underline">{c.name}</Link>
                    <span className="shrink-0 text-xs text-muted">{c.members} members</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-surface-2/70 p-2"><dt className="text-[11px] text-muted">New members</dt><dd className="text-xl font-semibold tabular-nums">{c.newMembers}</dd></div>
                    <div className="rounded-xl bg-surface-2/70 p-2"><dt className="text-[11px] text-muted">Join requests</dt><dd className="text-xl font-semibold tabular-nums">{c.joinRequests}</dd></div>
                    <div className="rounded-xl bg-surface-2/70 p-2"><dt className="text-[11px] text-muted">To verify</dt><dd className="text-xl font-semibold tabular-nums">{c.milestones?.waiting ?? "–"}</dd></div>
                  </dl>
                  <div className="mt-4 space-y-1.5 text-xs" role="img" aria-label={`Posts: ${c.posts.thisWeek} this week, ${c.posts.lastWeek} last week`}>
                    {[["This week", c.posts.thisWeek], ["Last week", c.posts.lastWeek]].map(([name, n]) => (
                      <div key={name as string} className="flex items-center gap-2">
                        <span className="w-16 text-muted">{name}</span>
                        <span className="h-2 rounded-full bg-text/80" style={{ width: `${Math.max(2, ((n as number) / max) * 70)}%`, opacity: name === "This week" ? 1 : 0.45 }} />
                        <span className="whitespace-nowrap tabular-nums text-text-2">{n} posts</span>
                      </div>
                    ))}
                  </div>
                  {c.upcoming[0] && <p className="mt-3 truncate text-xs text-muted">Next: <span className="text-text-2">{c.upcoming[0].title}</span> · {c.upcoming[0].going} going</p>}
                  <div className="mt-auto flex gap-3 pt-4 text-sm">
                    <Link href={`/c/${id}/manage?tab=report`} className="font-medium hover:underline">Full report</Link>
                    <Link href={`/copilot?q=${encodeURIComponent(`Use club_report for club ${id}, then draft this week's update for ${c.name} with propose_club_post. Use only the report's numbers.`)}`} className="inline-flex items-center gap-1 text-muted hover:text-text">Draft the update with Ember <ArrowRight className="size-3.5" /></Link>
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
