import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { WhoLooked } from "./who-looked";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { loadClubReport, type ClubReport } from "@/lib/club-report";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError, requestTime } from "@/lib/forge";
import { goalTitle, isGoalKind } from "@/lib/goals";
import { buildProgress, type MilestoneRow } from "@/lib/progress";
import { getViewer } from "@/lib/supabase/server";
import type { Point } from "./charts";
import { ProgressView } from "./progress";
import { DashboardView, RANGES, type Range, type Result } from "./view";

export const metadata: Metadata = { title: "Progress" };

// Your dashboard, in two views. Progress (the default): how your work is coming along, from what you
// log (lib/progress.ts), for students and for builders who aren't students alike. Reach: how it's
// landing (views, likes, comments, followers over time), your top posts and, for club leaders, each
// club's week. Who looked, by company, sits under both. Only you can see it.
const VIEWS = [["progress", "Progress"], ["reach", "Reach"]] as const;
type View = (typeof VIEWS)[number][0];

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-6xl">
      <Suspense fallback={<><PageHeader title="Progress" /><Skeleton className="mt-6 h-[620px]" /></>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Put each timestamp in the bucket it falls in: the latest bucket that starts on or before it.
function bucketize(buckets: string[], times: string[]): Point[] {
  const starts = buckets.map((b) => Date.parse(`${b}T00:00:00Z`));
  const counts = buckets.map(() => 0);
  for (const t of times) {
    const ms = Date.parse(t);
    for (let i = starts.length - 1; i >= 0; i--) if (ms >= starts[i]) { counts[i]++; break; }
  }
  return buckets.map((bucket, i) => ({ bucket, value: counts[i] }));
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const sp = await searchParams;
  const range: Range = RANGES.find(([k]) => k === sp.range)?.[0] ?? "30d";
  const view: View = VIEWS.find(([k]) => k === sp.view)?.[0] ?? "progress";
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  // The browser's zone isn't known on the server; UTC keeps buckets consistent.
  const { data, error } = await supabase.rpc("my_analytics", { p_range: range, p_tz: "UTC" });
  const q = (v: View, rg: Range) => `/dashboard?${new URLSearchParams({ ...(v === "progress" ? {} : { view: v }), ...(rg === "30d" ? {} : { range: rg }) })}`.replace(/\?$/, "");
  const head = (
    <>
      <PageHeader
        title="Progress"
        subtitle={<span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" /> Only you can see this. What you&apos;ve built, what&apos;s verified, and who&apos;s looking.</span>}
        actions={<Link href={`/u/${user.id}`} className="text-sm text-muted hover:text-text">Your profile</Link>}
      />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <nav aria-label="Dashboard views"><Tabs active={view} tabs={VIEWS.map(([id, label]) => ({ id, label, href: q(id, range) }))} /></nav>
        <nav aria-label="Period"><Tabs active={range} tabs={RANGES.map(([id, label]) => ({ id, label, href: q(view, id) }))} /></nav>
      </div>
    </>
  );
  if (error || !data)
    return (
      <>
        {head}
        <p role="alert" className="mt-6 text-sm text-danger">{friendlyError(error)}</p>
      </>
    );
  const r = data as Result;
  const buckets = (r.series ?? []).map((s) => s.bucket);
  const since = r.start ?? (buckets[0] ? `${buckets[0]}T00:00:00Z` : new Date(0).toISOString());
  const period = RANGES.find(([k]) => k === range)?.[1] ?? "30 days";
  const features = await dbFeatures();
  const looked = features.money ? <WhoLooked supabase={supabase} /> : null;

  if (view === "progress") {
    // Everything you've logged (row-level security already limits it to yours), the tools of the
    // projects it was logged on, what counts toward the streak, and your goal.
    const [msRes, postsRes, goalRes] = await Promise.all([
      features.milestones ? supabase.from("milestones").select("created_at, status, reviewed_at, reviewer_role, project_id, communities(type)").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
      supabase.from("posts").select("created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(500),
      features.goals ? supabase.from("member_goals").select("kind, target, created_at").eq("uid", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    type Row = { created_at: string; status: string; reviewed_at: string | null; reviewer_role: string | null; project_id: string | null; communities: { type: string } | { type: string }[] | null };
    const milestones: MilestoneRow[] = ((msRes.data ?? []) as Row[]).map((m) => ({
      created_at: m.created_at, status: m.status, reviewed_at: m.reviewed_at, reviewer_role: m.reviewer_role ?? "", project_id: m.project_id,
      community_type: (Array.isArray(m.communities) ? m.communities[0]?.type : m.communities?.type) ?? null,
    }));
    const projectIds = [...new Set(milestones.map((m) => m.project_id).filter((x): x is string => !!x))];
    const { data: stack } = features.projectTools && projectIds.length ? await supabase.from("projects").select("id, tools").in("id", projectIds.slice(0, 300)) : { data: [] };
    const tools = Object.fromEntries(((stack ?? []) as { id: string; tools: string[] | null }[]).map((x) => [x.id, x.tools ?? []]));
    const g = goalRes.data as { kind: string; target: string; created_at: string } | null;
    const p = buildProgress({
      milestones, tools, buckets, period, now: requestTime(), since: Date.parse(since),
      activity: [...((postsRes.data ?? []) as { created_at: string }[]).map((x) => Date.parse(x.created_at)), ...milestones.map((m) => Date.parse(m.created_at))],
      goal: g && isGoalKind(g.kind) ? { title: goalTitle({ kind: g.kind, target: g.target }), created_at: g.created_at } : null,
    });
    return <>{head}<ProgressView p={p} unit={r.unit} period={period} />{looked}</>;
  }

  // Engagement over time, from rows you can already read: likes and comments others left on your
  // posts, and new followers. Same buckets as the views series.
  const { data: mine } = await supabase.from("posts").select("id").eq("author_id", user.id).order("created_at", { ascending: false }).limit(500);
  const ids = (mine ?? []).map((p) => p.id as string);
  const [likeRows, commentRows, followRows, clubRows] = await Promise.all([
    ids.length ? supabase.from("likes").select("created_at").in("post_id", ids).neq("user_id", user.id).gte("created_at", since).limit(5000) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("comments").select("created_at").in("post_id", ids).neq("author_id", user.id).gte("created_at", since).limit(5000) : Promise.resolve({ data: [] }),
    supabase.from("follows").select("created_at").eq("target", user.id).gte("created_at", since).limit(5000),
    supabase.from("community_members").select("community_id, role").eq("uid", user.id).in("role", ["owner", "admin", "moderator"]).limit(3),
  ]);
  const times = (rows: { created_at: string }[] | null) => (rows ?? []).map((x) => x.created_at);
  const likes = bucketize(buckets, times(likeRows.data as { created_at: string }[] | null));
  const comments = bucketize(buckets, times(commentRows.data as { created_at: string }[] | null));
  const follows = bucketize(buckets, times(followRows.data as { created_at: string }[] | null));
  const views: Point[] = (r.series ?? []).map((s) => ({ bucket: s.bucket, value: s.views }));

  // Clubs you help run: each one's week, from the same report as Manage → Report.
  const reports = (await Promise.all(((clubRows.data ?? []) as { community_id: string }[]).map(async (c) => ({ id: c.community_id, report: await loadClubReport(supabase, c.community_id, features) }))))
    .filter((x): x is { id: string; report: ClubReport } => !!x.report);

  // Who looked, by company (supabase/money.sql): 7 days on Free, 90 with Plus.
  return <>{head}<DashboardView bare r={r} range={range} likes={likes} comments={comments} follows={follows} views={views} reports={reports} userId={user.id} />{looked}</>;
}

