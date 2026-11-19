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
import { weeklyActivity } from "@/lib/build-step";
import { newestModels, newestOfKind } from "@/lib/project-file-types";
import { signedUrls } from "@/lib/signed-urls";
import { SpotlightStrip } from "../feed/discover";
import { StripSkeleton } from "@/components/app/discover-cards";

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

// What people across Brazework are building: the proof behind every profile, newest progress first.
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
  const { milestones: msOn, projectTools: stackOn, projectSpecs: specsOn, projectFiles: filesOn, projectAccess: accessOn } = await dbFeatures();

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
  // Your builds: every project of yours (private too), with where it stands on the way to proof.
  const [{ data: myRows }, copilot, { data: sharedRows }] = await Promise.all([
    supabase.from("projects").select("id, title, summary, status, private, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(20),
    copilotEnabled(),
    // Projects others added you to (step 55): as an admin, a teammate or a viewer.
    accessOn ? supabase.from("project_members").select("role, projects(id, title, summary, status, private, owner_first:profiles!projects_owner_id_fkey(first_name, last_name))").eq("uid", user.id).order("added_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);
  type SharedRow = { role: "admin" | "member" | "viewer"; projects: { id: string; title: string; summary: string; status: string; private: boolean; owner_first: { first_name: string; last_name: string } | null } | null };
  const shared = ((sharedRows ?? []) as unknown as SharedRow[]).filter((r) => r.projects);
  const myIds = ((myRows ?? []) as unknown as { id: string }[]).map((r) => r.id);
  const [myMs, myUps, myFiles] = myIds.length ? await Promise.all([
    msOn ? supabase.from("milestones").select("project_id, status").in("project_id", myIds).limit(2000) : Promise.resolve({ data: [] }),
    supabase.from("posts").select("id, project_id, body, status, created_at").in("project_id", myIds).order("created_at", { ascending: false }).limit(2000),
    // Each build's newest 3D model, for "View in 3D" on its card. Only a link is made here: the file
    // itself is downloaded when the button is pressed (models are large, FIX-75).
    filesOn ? supabase.from("project_files").select("project_id, name, path").in("project_id", myIds).eq("kind", "file").order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const fileRows = (myFiles.data ?? []) as { project_id: string; name: string; path: string | null }[];
  const models = newestModels(fileRows);
  // Each build's newest photo, as the small picture on its card (a resized copy, through the image optimizer).
  const covers = newestOfKind(fileRows, "image");
  const srcs = models.size || covers.size ? await signedUrls(supabase, "project-files", [...models.values(), ...covers.values()].map((m) => m.path)) : new Map<string, string>();
  const modelSrc = srcs;
  const msRows = (myMs.data ?? []) as { project_id: string; status: string }[];
  const upRows = (myUps.data ?? []) as (BenchProject["log"][number] & { project_id: string })[];
  const bench: BenchProject[] = ((myRows ?? []) as unknown as Omit<BenchProject, "verified" | "waiting" | "updates" | "log" | "model" | "weeks" | "cover">[]).map((r) => {
    const mine = upRows.filter((u) => u.project_id === r.id);
    return {
      ...r,
      verified: msRows.filter((m) => m.project_id === r.id && m.status === "verified").length,
      waiting: msRows.filter((m) => m.project_id === r.id && (m.status === "pending" || m.status === "disputed")).length,
      updates: mine.length,
      // One bar a week for twelve weeks: when you posted on this build.
      weeks: weeklyActivity(mine.map((u) => u.created_at)),
      model: (() => { const m = models.get(r.id), src = m && modelSrc.get(m.path); return m && src ? { name: m.name, src } : null; })(),
      cover: (() => { const m = covers.get(r.id), src = m && srcs.get(m.path); return m && src ? { name: m.name, src } : null; })(),
      // The update log under each card: the newest few, newest first.
      log: mine.slice(0, 8).map(({ id, body, status, created_at }) => ({ id, body, status, created_at })),
    };
  });
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(topic && { topic }), ...(tool && { tool }), ...(status && { status }), ...(verifiedOnly && { verified: "1" }), ...(mine && { mine: "1" }), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/projects${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition", on ? "border-transparent bg-accent-grad text-on-accent" : "border-line bg-surface/70 text-muted hover:text-text");

  return (
    <>
      <PageHeader title="Projects" subtitle="Log what you did today, get it signed, and see what people across Brazework are building." />
      {!q && !topic && !tool && !status && !verifiedOnly && !mine && <Workbench projects={bench} interests={profile.interests ?? []} copilot={copilot} stack={stackOn} specsOn={specsOn} filesOn={filesOn} />}
      {!q && !topic && !tool && !status && !verifiedOnly && !mine && shared.length > 0 && <SharedWithYou rows={shared} />}
      {/* Spotlight moved here from Today (redesign stage 1): standout builds sit with the rest of Explore. */}
      {!q && !topic && !tool && !status && !verifiedOnly && !mine && <div className="mt-6 empty:hidden"><Suspense fallback={<StripSkeleton w={280} h={250} />}><SpotlightStrip /></Suspense></div>}
      <form action="/projects" className="relative mt-6">
        {topic && <input type="hidden" name="topic" value={topic} />}
        {tool && <input type="hidden" name="tool" value={tool} />}
        {status && <input type="hidden" name="status" value={status} />}
        {verifiedOnly && <input type="hidden" name="verified" value="1" />}
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <label htmlFor="pq" className="sr-only">Search projects</label>
        <input id="pq" name="q" defaultValue={q} placeholder="Search projects: rover, PCB, CRISPR, flight computer…" className="glass-card h-12 w-full rounded-lg pr-4 pl-11 text-[15px] outline-none placeholder:text-faint" />
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
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => <ExploreCard key={p.id} p={p} />)}
      </div>
      {!list.length && <EmptyState icon={<FolderGit2 className="size-5" />} title={q || topic || tool || status || verifiedOnly || mine ? "No projects match" : "No projects yet"} body={q || topic || tool || status || verifiedOnly || mine ? <Link href="/projects" className="underline">Clear filters</Link> : "Add yours from your profile, or import one from GitHub."} />}
    </>
  );
}

// Projects you were added to, with what you can do on each.
const SHARED_ROLE = { admin: "Admin", member: "Teammate", viewer: "Viewer" } as const;
function SharedWithYou({ rows }: { rows: { role: "admin" | "member" | "viewer"; projects: { id: string; title: string; summary: string; private: boolean; owner_first: { first_name: string; last_name: string } | null } | null }[] }) {
  return (
    <section aria-labelledby="shared-title" className="mt-8">
      <h2 id="shared-title" className="text-sm font-semibold">Shared with you</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map(({ role, projects: p }) => p && (
          <li key={p.id}>
            <Link href={`/projects/${p.id}`} className="glass-card flex items-start gap-3 rounded-2xl p-4 transition hover:border-line-strong">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{p.summary}</span>
                <span className="mt-2 block text-[11px] text-faint">{`${p.owner_first?.first_name ?? ""} ${p.owner_first?.last_name ?? ""}`.trim() || "A member"}&apos;s project</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">{SHARED_ROLE[role]}</span>
                {p.private && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">Private</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
