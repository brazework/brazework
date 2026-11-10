import type { Metadata } from "next";
import { BadgeCheck, FolderGit2, Search, Wrench } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Skeleton } from "@/components/app/page-ui";
import { dbFeatures } from "@/lib/db-features";
import { cn } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { ExploreCard, type ExploreProject } from "./project-card";
import { Workbench, type BenchProject } from "./workbench";
import { copilotEnabled } from "@/lib/copilot";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-6xl">
      <Suspense fallback={<><PageHeader title="Projects" /><Skeleton className="mt-6 h-96" /></>}>
        <Explore searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// What people across Forge are building: the proof behind every profile, newest progress first.
// Filter by topic, status and club-verified work; search titles and summaries.
async function Explore({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const topic = typeof sp.topic === "string" ? sp.topic : "";
  const status = sp.status === "completed" || sp.status === "in_progress" ? sp.status : "";
  const verifiedOnly = sp.verified === "1";
  const mine = sp.mine === "1";
  const tool = typeof sp.tool === "string" ? sp.tool.slice(0, 40) : "";
  const { milestones: msOn, projectTools: stackOn } = await dbFeatures();

  let req = supabase.from("projects").select(`id, title, summary, status, year, tags, updated_at, owner_id, profiles!projects_owner_id_fkey(first_name, last_name, field)${stackOn ? ", tools" : ""}`).eq("private", false).order("updated_at", { ascending: false }).limit(120);
  if (mine) req = req.eq("owner_id", user.id);
  if (topic) req = req.contains("tags", [topic]);
  if (tool && stackOn) req = req.contains("tools", [tool]);
  if (status) req = req.eq("status", status);
  const clean = q.replace(/[%,()*]/g, " ").trim();
  if (clean) req = req.or(`title.ilike.*${clean}*,summary.ilike.*${clean}*`);
  const { data } = await req;
  type Row = Omit<ExploreProject, "owner" | "verified" | "updates"> & { profiles: ExploreProject["owner"] };
  const rows = (data ?? []) as unknown as Row[];
  const ids = rows.map((r) => r.id);

  // How much of each project a club has verified, and how many updates it has had.
  const [ms, ups] = ids.length
    ? await Promise.all([
        msOn ? supabase.from("milestones").select("project_id").in("project_id", ids).eq("status", "verified").limit(2000) : Promise.resolve({ data: [] }),
        supabase.from("posts").select("project_id").in("project_id", ids).eq("status", "visible").limit(2000),
      ])
    : [{ data: [] }, { data: [] }];
  const count = (rs: { project_id: string }[] | null) => (rs ?? []).reduce((m, r) => m.set(r.project_id, (m.get(r.project_id) ?? 0) + 1), new Map<string, number>());
  const verified = count(ms.data as { project_id: string }[] | null), updates = count(ups.data as { project_id: string }[] | null);
  let list: ExploreProject[] = rows.map((r) => ({ ...r, owner: r.profiles, verified: verified.get(r.id) ?? 0, updates: updates.get(r.id) ?? 0 }));
  if (verifiedOnly) list = list.filter((p) => p.verified > 0);
  // Your interests first among the topic chips.
  const interests = profile.interests ?? [];
  const topics = [...new Set([...interests, ...rows.flatMap((r) => r.tags)])].slice(0, 12);
  // The tools most used across these projects, as quick filters.
  const toolCounts = rows.flatMap((r) => (r as unknown as { tools?: string[] }).tools ?? []).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>());
  const topTools = [...toolCounts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  if (tool && !topTools.includes(tool)) topTools.unshift(tool);
  // Your workbench: every project of yours (private too), with where it stands on the way to proof.
  const [{ data: myRows }, copilot] = await Promise.all([
    supabase.from("projects").select("id, title, summary, status, private, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(20),
    copilotEnabled(),
  ]);
  const myIds = ((myRows ?? []) as { id: string }[]).map((r) => r.id);
  const [myMs, myUps] = myIds.length ? await Promise.all([
    msOn ? supabase.from("milestones").select("project_id, status").in("project_id", myIds).limit(2000) : Promise.resolve({ data: [] }),
    supabase.from("posts").select("project_id").in("project_id", myIds).limit(2000),
  ]) : [{ data: [] }, { data: [] }];
  const msRows = (myMs.data ?? []) as { project_id: string; status: string }[];
  const bench: BenchProject[] = ((myRows ?? []) as Omit<BenchProject, "verified" | "waiting" | "updates">[]).map((r) => ({
    ...r,
    verified: msRows.filter((m) => m.project_id === r.id && m.status === "verified").length,
    waiting: msRows.filter((m) => m.project_id === r.id && (m.status === "pending" || m.status === "disputed")).length,
    updates: ((myUps.data ?? []) as { project_id: string }[]).filter((u) => u.project_id === r.id).length,
  }));
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(topic && { topic }), ...(tool && { tool }), ...(status && { status }), ...(verifiedOnly && { verified: "1" }), ...(mine && { mine: "1" }), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/projects${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition", on ? "border-transparent bg-accent-grad text-on-accent" : "border-line bg-surface/70 text-muted hover:text-text");

  return (
    <>
      <PageHeader title="Projects" subtitle="What you're building, and what people across Forge have built and had verified." />
      {!q && !topic && !tool && !status && !verifiedOnly && !mine && <Workbench projects={bench} interests={profile.interests ?? []} copilot={copilot} stack={stackOn} />}
      <form action="/projects" className="relative mt-6">
        {topic && <input type="hidden" name="topic" value={topic} />}
        {tool && <input type="hidden" name="tool" value={tool} />}
        {status && <input type="hidden" name="status" value={status} />}
        {verifiedOnly && <input type="hidden" name="verified" value="1" />}
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <label htmlFor="pq" className="sr-only">Search projects</label>
        <input id="pq" name="q" defaultValue={q} placeholder="Search projects: rover, PCB, CRISPR, flight computer…" className="glass-card h-12 w-full rounded-full pr-4 pl-11 text-[15px] outline-none placeholder:text-faint" />
      </form>
      <div className="no-scrollbar -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link href={href({ verified: verifiedOnly ? "" : "1" })} className={chip(verifiedOnly)}><span className="inline-flex items-center gap-1"><BadgeCheck className="size-3.5" /> Club-verified</span></Link>
        <Link href={href({ status: status === "in_progress" ? "" : "in_progress" })} className={chip(status === "in_progress")}>In progress</Link>
        <Link href={href({ status: status === "completed" ? "" : "completed" })} className={chip(status === "completed")}>Completed</Link>
        <Link href={href({ mine: mine ? "" : "1" })} className={chip(mine)}>Yours</Link>
        <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
        {topics.map((t) => <Link key={t} href={href({ topic: topic === t ? "" : t })} className={chip(topic === t)}>#{t}</Link>)}
      </div>
      {topTools.length > 0 && (
        <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-faint"><Wrench className="size-3.5" /> Built with</span>
          {topTools.map((t) => <Link key={t} href={href({ tool: tool === t ? "" : t })} className={chip(tool === t)}>{t}</Link>)}
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => <ExploreCard key={p.id} p={p} />)}
      </div>
      {!list.length && <EmptyState icon={<FolderGit2 className="size-5" />} title={q || topic || tool || status || verifiedOnly || mine ? "No projects match" : "No projects yet"} body={q || topic || tool || status || verifiedOnly || mine ? <Link href="/projects" className="underline">Clear filters</Link> : "Add yours from your profile, or import one from GitHub."} />}
    </>
  );
}
