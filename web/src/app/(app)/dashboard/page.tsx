import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { loadClubReport, type ClubReport } from "@/lib/club-report";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import type { Point } from "./charts";
import { DashboardView, RANGES, type Range, type Result } from "./view";

export const metadata: Metadata = { title: "Dashboard" };

// Your dashboard: how your work is landing (views, likes, comments, followers over time), your top
// posts, who's looking, and, for club leaders, each club's week. Only you can see it.
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-6xl">
      <Suspense fallback={<><PageHeader title="Dashboard" /><Skeleton className="mt-6 h-[620px]" /></>}>
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
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  // The browser's zone isn't known on the server; UTC keeps buckets consistent.
  const { data, error } = await supabase.rpc("my_analytics", { p_range: range, p_tz: "UTC" });
  const tabs = <Tabs active={range} tabs={RANGES.map(([id, label]) => ({ id, label, href: `/dashboard?range=${id}` }))} />;
  if (error || !data)
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="mt-6">{tabs}</div>
        <p role="alert" className="mt-6 text-sm text-danger">{friendlyError(error)}</p>
      </>
    );
  const r = data as Result;
  const buckets = (r.series ?? []).map((s) => s.bucket);
  const since = r.start ?? (buckets[0] ? `${buckets[0]}T00:00:00Z` : new Date(0).toISOString());

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
  const features = await dbFeatures();
  const reports = (await Promise.all(((clubRows.data ?? []) as { community_id: string }[]).map(async (c) => ({ id: c.community_id, report: await loadClubReport(supabase, c.community_id, features) }))))
    .filter((x): x is { id: string; report: ClubReport } => !!x.report);

  return <DashboardView r={r} range={range} likes={likes} comments={comments} follows={follows} views={views} reports={reports} userId={user.id} />;
}

