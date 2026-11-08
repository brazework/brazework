import type { Metadata } from "next";
import { BarChart3, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton, Tabs } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { cn, friendlyError, timeAgo } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { ViewsChart } from "./views-chart";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["1y", "12 months"]] as const;
type Range = (typeof RANGES)[number][0];

type Figures = { views: number; viewers: number; likes: number; comments: number; followers: number; connections: number };
type Result = {
  unit: "day" | "week" | "month";
  current: Figures;
  previous: Figures;
  series: { bucket: string; views: number }[];
  breakdown: { accountTypes: Record<string, number>; fields: { field: string; count: number }[] } | null;
  topPosts: { id: string; body: string; created_at: string; communityName: string | null; likes: number; comments: number }[];
};

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<><PageHeader title="Analytics" /><Skeleton className="mt-6 h-[520px]" /></>}>
        <Analytics searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Analytics({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }) {
  const sp = await searchParams;
  const range: Range = RANGES.find(([k]) => k === sp.range)?.[0] ?? "30d";
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  // The browser's zone isn't known on the server; UTC keeps buckets consistent.
  const { data, error } = await supabase.rpc("my_analytics", { p_range: range, p_tz: "UTC" });
  const tabs = <Tabs active={range} tabs={RANGES.map(([id, label]) => ({ id, label, href: `/analytics?range=${id}` }))} />;
  if (error || !data)
    return (
      <>
        <PageHeader title="Analytics" />
        <div className="mt-6">{tabs}</div>
        <p role="alert" className="mt-6 text-sm text-danger">{friendlyError(error)}</p>
      </>
    );
  const r = data as Result;

  const tiles: [keyof Figures, string][] = [["views", "Profile views"], ["viewers", "Unique viewers"], ["likes", "Likes on your posts"], ["comments", "Comments"], ["followers", "New followers"], ["connections", "New connections"]];
  const delta = (k: keyof Figures) => {
    const now = r.current?.[k] ?? 0, before = r.previous?.[k] ?? 0;
    if (!before) return now ? "New" : "—";
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct > 0 ? "+" : ""}${pct}%`;
  };
  const label = RANGES.find(([k]) => k === range)?.[1] ?? "";

  return (
    <>
      <PageHeader title="Analytics" subtitle={<span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" /> Only you can see this.</span>} actions={<Link href={`/u/${user.id}`} className="text-sm text-muted hover:text-text">Back to profile</Link>} />
      <div className="mt-6">{tabs}</div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([k, name]) => (
          <Panel key={k} className="p-4">
            <div className="text-xs text-muted">{name}</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{(r.current?.[k] ?? 0).toLocaleString("en-US")}</div>
            <div className={cn("mt-1 font-mono text-[11px]", delta(k).startsWith("-") ? "text-danger" : "text-faint")}>{delta(k)} vs previous {label}</div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4">
        <Kicker>Profile views per {r.unit}</Kicker>
        <ViewsChart series={r.series ?? []} unit={r.unit} />
      </Panel>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Panel>
          <Kicker>Who viewed you</Kicker>
          {r.breakdown ? (
            <dl className="mt-4 space-y-2 text-sm">
              {Object.entries(r.breakdown.accountTypes).map(([t, c]) => (
                <div key={t} className="flex justify-between"><dt className="text-muted">{t === "student" ? "Students" : "Professionals"}</dt><dd className="tabular-nums">{c}</dd></div>
              ))}
              {r.breakdown.fields.map((f) => (
                <div key={f.field} className="flex justify-between"><dt className="text-muted">{f.field}</dt><dd className="tabular-nums">{f.count}</dd></div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">Shown once at least 3 different people have viewed your profile in this period, so it can never point to one person.</p>
          )}
        </Panel>
        <Panel>
          <Kicker>Top posts</Kicker>
          {r.topPosts?.length ? (
            <ul className="mt-4 space-y-3">
              {r.topPosts.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/post/${p.id}`} className="block text-sm text-text-2 hover:text-text">
                    <span className="line-clamp-2">{p.body}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-faint">{p.likes} likes · {p.comments} comments · {timeAgo(p.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<BarChart3 className="size-5" />} title="No engagement yet" body="Likes and comments from others in this period show up here." />
          )}
        </Panel>
      </div>
    </>
  );
}
