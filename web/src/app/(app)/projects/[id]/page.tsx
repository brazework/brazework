import { emberCreditCost } from "@/lib/ember-credits";
import { ProjectSignoff } from "./signoff";
import type { Metadata } from "next";
import { ReportLink } from "@/components/report/report-dialog";
import { ArrowLeft, BadgeCheck, ChevronDown, ExternalLink, Images, Megaphone, Pencil, Play } from "lucide-react";
import { schematicFor } from "@/lib/schematic-field";
import { MediaGrid } from "@/components/media/media-grid";
import { signedUrls } from "@/lib/signed-urls";
import { mediaUrl, type MediaItem } from "@/lib/media";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyLink } from "@/components/app/copy-link";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { Ember } from "@/components/ember/ember";
import { SendPost } from "@/components/share/send-post";
import { Avatar, Kicker } from "@/components/ui";
import { dbFeatures, postSelect, milestoneCols } from "@/lib/db-features";
import { requestTime, type Post } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { cardReplies } from "@/lib/card-replies";
import { AddMilestone, MilestoneTimeline, type Milestone } from "../../u/[id]/milestones";
import { PostUpdate } from "./post-update";
import { buildLog, inThirtySeconds, lastActivity, liveStatus, weeklyActivity, type BuildEvent } from "@/lib/build-log";
import { AboutBuild, ActivityStrip, BuildLogTimeline, ThirtySeconds } from "./build-log-view";
import { MakePublic, TeamList } from "./team";
import { GitHubConnect } from "./github-connect";
import { RecentWork } from "./recent-work";
import { loadRecentWork } from "@/lib/recent-work-load";
import { OrganizeWithEmber } from "./organize";
import { copilotEnabled } from "@/lib/copilot";
import { ProjectFiles, type ProjectFileItem } from "@/components/projects/project-files";
import { kindOfFile } from "@/lib/project-file-types";
import { githubConfig } from "@/lib/github-app";
import { loadGoal, loadRecord } from "@/lib/goal-load";
import { nextStep } from "@/lib/next-step";
import { signersFor, type MemberRow } from "@/lib/signers";
import type { ToolDraft } from "@/lib/tool-drafts";
import { ProjectNext } from "./project-next";
import { ProjectCover } from "./project-cover";
import { ProjectDrafts, draftTitle } from "./project-drafts";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-6xl">
      <Link href="/projects" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Projects</Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProjectView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Project = { tools?: string[]; id: string; title: string; summary: string; status: "in_progress" | "completed"; year: number | null; tags: string[]; private: boolean; updated_at: string; created_at: string; owner_id: string; profiles: { first_name: string; last_name: string; headline: string; field: string } | null };

// A project's home: what it is, the write-up, what its club has verified, its updates over time,
// and who built it. The owner posts updates here; anyone can send it on or ask Ember about it.
async function ProjectView({ params, searchParams }: { params: PageProps<"/projects/[id]">["params"]; searchParams: PageProps<"/projects/[id]">["searchParams"] }) {
  const { id } = await params;
  const ghNote = (await searchParams).github;
  const { supabase, user, profile: viewerProfile } = await getViewer();
  if (!user) redirect("/login");
  const { milestones: msOn, projectTools: stackOn, projectSpecs: specsOn, projectFiles: filesOn, updateFiles: updFilesOn, github: ghOn, projectAccess: accessOn } = await dbFeatures();
  const { data } = await supabase.from("projects").select(`id, title, summary, status, year, tags, private, updated_at, created_at, owner_id, profiles!projects_owner_id_fkey(first_name, last_name, headline, field)${stackOn ? ", tools" : ""}`).eq("id", id).maybeSingle();
  const p = data as unknown as Project | null;
  const own = p?.owner_id === user.id;
  // Your role on it (step 55): owner, admin, teammate ("member") or viewer. A private project is for
  // them only; builders (owner, admins, teammates) post on it; the owner and admins manage the team.
  const { data: roleData } = p && !own && accessOn ? await supabase.rpc("project_role", { p_project: id, p_uid: user.id }) : { data: null };
  const role = own ? "owner" : ((roleData as string | null) ?? null);
  const builder = role === "owner" || role === "admin" || role === "member";
  const canManage = role === "owner" || role === "admin";
  if (!p || (p.private && !role)) return <EmptyState title="This project isn't available" body="It may be private, or it was removed." />;

  const [det, ms, ups, more, teamRes, clubRes, filesRes, ghEvents, ghRepos] = await Promise.all([
    supabase.from("project_details").select(specsOn ? "details, link, specs" : "details, link").eq("project_id", id).maybeSingle(),
    msOn ? supabase.from("milestones").select(await milestoneCols()).eq("project_id", id).order("achieved_on", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    supabase.from("posts").select(await postSelect()).eq("project_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(30),
    supabase.from("projects").select("id, title, status").eq("owner_id", p.owner_id).eq("private", false).neq("id", id).order("updated_at", { ascending: false }).limit(4),
    (await dbFeatures()).verification ? supabase.from("project_members").select(accessOn ? "uid, role, profiles(first_name, last_name, headline)" : "uid, profiles(first_name, last_name, headline)").eq("project_id", id).order("added_at", { ascending: true }).limit(20) : Promise.resolve({ data: [] }),
    builder ? supabase.from("community_members").select("community_id, communities(id, name)").eq("uid", user.id).limit(50) : Promise.resolve({ data: [] }),
    filesOn ? supabase.from("project_files").select(updFilesOn ? "id, kind, name, path, size, url, added_by, created_at, post_id" : "id, kind, name, path, size, url, added_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    // Live from GitHub (supabase/github.sql, FIX-92 phase 3): what happened on its linked repos.
    ghOn ? supabase.from("build_events").select("id, kind, title, url, actor, state, occurred_at").eq("project_id", id).order("occurred_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    ghOn ? supabase.from("project_repos").select("repo_id, full_name, html_url").eq("project_id", id).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const events = (ghEvents.data ?? []) as BuildEvent[];
  const repos = (ghRepos.data ?? []) as { repo_id: number; full_name: string; html_url: string }[];
  // The files folder: photos and videos get a signed link up front for their previews (the bucket is
  // private). Documents and 3D models are view-only outside the team (project-files-view-only.sql): the
  // reader and the 3D viewer fetch them through /api/project-files/<id>, and only builders download.
  type FileRow = Omit<ProjectFileItem, "src"> & { path: string | null };
  const fileRows = (filesRes.data ?? []) as unknown as FileRow[];
  const previewPaths = fileRows.filter((f) => f.path && ["image", "video"].includes(kindOfFile(f.name) ?? "")).map((f) => f.path!);
  // Reused between renders (lib/signed-urls.ts), so the browser and the image cache keep their copies.
  const srcByPath = previewPaths.length ? await signedUrls(supabase, "project-files", previewPaths) : new Map<string, string>();
  const files: ProjectFileItem[] = fileRows.map(({ path, ...f }) => ({ ...f, src: path ? srcByPath.get(path) ?? null : null }));
  const filesByPost = files.reduce((m, f) => (f.post_id ? m.set(f.post_id, [...(m.get(f.post_id) ?? []), f]) : m), new Map<string, ProjectFileItem[]>());
  type TM = { uid: string; role?: "admin" | "member" | "viewer"; profiles: { first_name: string; last_name: string; headline: string } | null };
  const everyone = ((teamRes.data ?? []) as unknown as TM[]).map((t) => ({ id: t.uid, role: t.role ?? "member", first: t.profiles?.first_name ?? "", last: t.profiles?.last_name ?? "", headline: t.profiles?.headline ?? "" }));
  // The builders show as the team; viewers only to the people managing it.
  const team = everyone.filter((t) => t.role !== "viewer");
  // Who the owner or an admin can add: people in their clubs. (Your clubs also fill the milestone form.)
  const myClubIds = ((clubRes.data ?? []) as { community_id: string }[]).map((r) => r.community_id);
  const myClubs = ((clubRes.data ?? []) as unknown as { communities: { id: string; name: string } | { id: string; name: string }[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
  const { data: clubPeople } = canManage && myClubIds.length
    ? await supabase.from("community_members").select("uid, first_name, last_name").in("community_id", myClubIds).neq("uid", user.id).limit(200)
    : { data: [] };
  const candidates = [...new Map(((clubPeople ?? []) as { uid: string; first_name: string; last_name: string }[]).map((c) => [c.uid, { id: c.uid, first: c.first_name, last: c.last_name }])).values()];
  const details = (det.data as unknown as { details: string; link: string; specs?: { label: string; value: string }[] } | null) ?? { details: "", link: "" };
  const specs = details.specs ?? [];
  const link = /^https?:\/\/\S+$/i.test(details.link) ? details.link : "";
  const milestones = (ms.data ?? []) as unknown as unknown as Milestone[];
  const verified = milestones.filter((m) => m.status === "verified");
  const signoffResults = milestones.filter((m) => !m.community_id && (m.status === "draft" || m.status === "logged")).map((m) => ({ id: m.id, title: m.title }));
  // The flow redesign (lib/next-step.ts): the one step this project needs next (toward the member's
  // goal when they have one), the drafts Ember or their tools left for it, and who could sign a waiting
  // milestone, by name (lib/signers.ts).
  const f = await dbFeatures();
  const [draftRes, officerRes, goal, record] = builder ? await Promise.all([
    f.mcpWorkflows ? supabase.from("tool_drafts").select("id, kind, via, source, created_at, payload").eq("status", "waiting").eq("payload->>project_id", id).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    myClubIds.length ? supabase.from("community_members").select("community_id, uid, role, first_name, last_name").in("community_id", myClubIds).in("role", ["moderator", "admin", "owner"]).limit(100) : Promise.resolve({ data: [] }),
    f.goals ? loadGoal(supabase, user.id) : Promise.resolve(null),
    f.goals ? loadRecord(supabase, user.id) : Promise.resolve(null),
  ]) : [{ data: [] }, { data: [] }, null, null];
  const drafts = (draftRes.data ?? []) as unknown as ToolDraft[];
  const officers = (officerRes.data ?? []) as unknown as MemberRow[];
  const signers = signersFor(officers, user.id);
  const next = nextStep({ builder, milestones, drafts: drafts.map((d) => ({ id: d.id, title: draftTitle(d) })), signers, goal, record });
  const waitingOn = next?.kind === "ask_sign" ? milestones.find((m) => m.id === next.milestoneId)?.community_id : null;
  const asker = waitingOn ? officers.find((o) => o.community_id === waitingOn && o.uid !== user.id) : undefined;
  // Adding a milestone happens here, for the owner too (it used to send them to their profile).
  const addMilestone = builder && (myClubs.length > 0 || f.vouches)
    ? <AddMilestone projectId={id} projectTitle={p.title} clubs={myClubs.map((c) => ({ ...c, signers: signers.get(c.id) ?? [] }))} vouches={f.vouches} backing={f.backed && !!githubConfig()} field={p.profiles?.field} />
    : null;
  const posts = (ups.data ?? []) as unknown as Post[];
  const ids = posts.map((x) => x.id);
  const [[likes, saves], replies] = await Promise.all([
    ids.length
      ? Promise.all([supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", ids), supabase.from("saved").select("post_id").eq("user_id", user.id).in("post_id", ids)])
      : Promise.resolve([{ data: [] }, { data: [] }] as const),
    // The latest comments under each post, so they can be liked, replied to, edited and deleted here too.
    cardReplies(supabase, user.id, ids),
  ]);
  const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l: { post_id: string }) => l.post_id));
  // How many public projects use each tool (for "N other projects use it").
  const tools = p.tools ?? [];
  const useCounts = stackOn && tools.length ? await Promise.all(tools.map((t) => supabase.from("projects").select("id", { count: "exact", head: true }).eq("private", false).contains("tools", [t]))) : [];
  const uses = Object.fromEntries(tools.map((t, i) => [t, useCounts[i]?.count ?? 1]));
  const emberOn = own && stackOn && (await copilotEnabled());
  // For the owner, once a repo is linked and backing is on: what GitHub already knows they shipped.
  const recent = own && ghOn && f.backed && repos.length > 0 && githubConfig() ? await loadRecentWork(p.id, user.id) : [];
  // The cover is the newest photo from its updates; the gallery is every photo and video.
  const gallery = posts.flatMap((x) => (x.media ?? []) as MediaItem[]).slice(0, 12);
  const cover = gallery.find((m) => m.type === "image");
  const owner = p.profiles;
  const ownerName = `${owner?.first_name ?? ""} ${owner?.last_name ?? ""}`.trim() || "Brazework member";
  const ask = `Tell me about the project "${p.title}" by ${ownerName} on Brazework: what it is in plain words, what's impressive about it, and three good questions to ask the builder.`;

  // The live build log (FIX-92): momentum over 12 weeks, where it stands now, one timeline, and the
  // 30-second version for someone hiring (lib/build-log.ts).
  const now = requestTime();
  const verifiedAt = verified.map((m) => Date.parse(m.reviewed_at || m.achieved_on));
  const postAt = posts.map((x) => Date.parse(x.created_at));
  const githubAt = events.map((e) => Date.parse(e.occurred_at));
  const weeks = weeklyActivity([...postAt, ...verifiedAt, ...githubAt], now, 12);
  const last = lastActivity([...postAt, ...verifiedAt, ...githubAt, Date.parse(p.updated_at)]);
  const live = liveStatus(p.status, last, now);
  const log = buildLog(posts, milestones, events);
  const summary = inThirtySeconds({
    owner: ownerName, title: p.title, summary: p.summary, status: p.status, teamSize: team.length + 1,
    verified: verified.map((m) => ({ title: m.title, reviewer: m.reviewer_name, club: m.community_name })),
    activeWeeks: weeks.filter((n) => n > 0).length, weeks: weeks.length, updates: posts.length, tools,
  });
  const about = <AboutBuild link={link} specs={specs} tools={tools} uses={uses} details={details.details} ember={emberOn ? <OrganizeWithEmber projectId={p.id} /> : undefined} />;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Project" className="glass-card overflow-hidden rounded-2xl">
          {/* The drawing sheet: the work, the title, and the title block with where it stands. */}
          <ProjectCover title={p.title} isPrivate={p.private} live={live} year={p.year} last={last} schematic={schematicFor(p.tags, tools)}
            cover={cover ? { src: mediaUrl(cover.path), alt: cover.alt || "" } : null}
            facts={{ club: milestones.find((m) => m.status === "verified" || m.status === "pending")?.community_name ?? myClubs[0]?.name ?? null, signed: verified.length, waiting: milestones.filter((m) => m.status === "pending").length, builders: team.length + 1, started: new Date(p.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) }} />
          <div className="p-5 sm:p-7">
            {p.summary && <p className="text-lg leading-relaxed text-text-2">{p.summary}</p>}
            {p.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">{p.tags.map((t) => <Link key={t} href={`/projects?topic=${encodeURIComponent(t)}`} className="text-muted transition hover:text-text">#{t}</Link>)}</div>}
            <ActivityStrip weeks={weeks} />
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {builder && <a href="#log" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-text px-4 text-sm font-semibold text-surface transition hover:opacity-90 active:scale-95"><Megaphone className="size-4" /> Post update</a>}
              {/* The reel: this build as a short story, from its real photos, specs and proof. */}
              {/* One primary action: for the owner it's Post update; for everyone else, the reel. */}
              <Link href={`/projects/${p.id}/reel`} className={builder ? "inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-medium transition hover:bg-hover" : "bg-accent-grad inline-flex h-10 items-center gap-2 rounded-lg pr-4 pl-3 text-sm font-semibold text-on-accent transition active:scale-95"}>{builder ? <Play className="size-3.5 fill-current" /> : <span className="grid size-6 place-items-center rounded-full bg-white/20"><Play className="size-3 fill-current" /></span>} Play reel</Link>
              {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-medium transition hover:bg-hover"><ExternalLink className="size-4" /> {new URL(link).host.replace(/^www\./, "")}</a>}
              <SendPost projectId={p.id} compact={false} />
              <CopyLink path={`/projects/${p.id}`} label="Share" />
              {own && p.private && <MakePublic projectId={p.id} />}
              {!role && <ReportLink kind="project" id={p.id} label="this project" className="ml-auto" />}
              {own && <Link href={`/u/${user.id}#projects`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm transition hover:bg-hover"><Pencil className="size-4" /> Edit</Link>}
            </div>
          </div>
        </section>

        {/* Next: the one most useful step for whoever builds it (lib/next-step.ts). */}
        {next && <ProjectNext step={next} add={addMilestone} message={asker ? { id: asker.uid, name: `${asker.first_name} ${asker.last_name ? `${asker.last_name[0]}.` : ""}`.trim() } : null} shared={next.kind === "share_signed" && !!milestones.find((m) => m.id === next.milestoneId)?.shared_at} />}

        {/* Their own merged pull requests from the last 90 days, one tap from the record (lib/recent-work-pick.ts). */}
        {recent.length > 0 && <RecentWork projectId={p.id} items={recent} />}

        {/* A sign-off: several of its results, one person, one email (signoff.tsx). For the owner, once
            there are at least two results nobody has been asked about and no club has. */}
        {own && signoffResults.length >= 2 && <ProjectSignoff projectId={p.id} results={signoffResults} done={p.status === "completed"} />}

        {/* Milestones: what was signed, by whom, and what's waiting; drafts for it right here. */}
        {(milestones.length > 0 || builder) && (
          // #milestones: where the Projects page's cards and the Next strip point; #proof: older links.
          <div id="milestones" className="scroll-mt-24">
          <span id="proof" className="block scroll-mt-24" aria-hidden="true" />
          <Panel className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><BadgeCheck className="size-5 text-ok" /> Milestones</h2>
              <span className="text-xs text-muted">{own ? "Verified ones show to everyone; pending and declined ones only to you." : "Each one signed by someone who saw it happen: a club officer, a professor or a coworker."}</span>
            </div>
            <ProjectDrafts drafts={drafts} projectTitle={p.title} clubName={new Map(myClubs.map((c) => [c.id, c.name]))} />
            {milestones.length > 0 && <MilestoneTimeline items={milestones} own={own} projectPrivate={!!p.private} />}
            {/* Everyone building it adds milestones here (the Next strip has the button when it's the first). */}
            {addMilestone && next?.kind !== "first_milestone" && <div className="mt-4">{addMilestone}</div>}
          </Panel>
          </div>
        )}

        {/* The build log: every update and every verified milestone, newest first, on one line. Posts
            made from a member's AI tool show "via Claude Code" etc. in their card. */}
        <section id="log" aria-label="Build log" className="flex scroll-mt-24 flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Build log</h2>
            {repos.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {repos.map((r) => <a key={r.full_name} href={r.html_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-medium text-text-2 hover:text-text"><span className="size-1.5 rounded-full bg-ok" aria-hidden="true" /> Live from {r.full_name}</a>)}
              </div>
            )}
          </div>
          {builder && <PostUpdate projectId={p.id} title={p.title} attach={filesOn} />}
          {log.length > 0 && <BuildLogTimeline entries={log} liked={liked} saved={saved} me={user.id} projectId={p.id} ownerId={p.owner_id} filesByPost={filesByPost} replies={replies} viewer={{ id: user.id, first: viewerProfile?.first_name ?? "", last: viewerProfile?.last_name ?? "" }} />}
          {!log.length && (own ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-muted">
              Log what you did, what broke and what you learned: a few lines a week adds up to proof. Or let your AI tool do it as you work: <Link href="/settings/tools" className="font-medium text-text underline underline-offset-4">connect Claude Code, Cursor or Codex</Link>.
            </p>
          ) : <p className="text-sm text-muted">No updates yet.</p>)}
        </section>

        {/* Every photo and video from its updates, in one place. */}
        {gallery.length > 0 && (
          <Panel className="p-6">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><Images className="size-5 text-muted" /> Gallery</h2>
            <MediaGrid media={gallery} alt={`From ${p.title}`} />
          </Panel>
        )}

        {/* The project's folder: documents, CAD, 3D models (rotatable), code and links. */}
        {filesOn && <ProjectFiles projectId={p.id} items={files} me={user.id} ownerId={p.owner_id} />}
      </div>

      <aside className="flex flex-col gap-4">
        <Panel>
          <Kicker>{team.length ? "Built by the team" : "Built by"}</Kicker>
          <Link href={`/u/${p.owner_id}`} className="mt-3 flex items-center gap-3">
            <Avatar first={owner?.first_name ?? ""} last={owner?.last_name ?? ""} size={44} />
            <span className="min-w-0"><span className="block truncate font-medium hover:underline">{ownerName}</span><span className="block truncate text-xs text-muted">{owner?.headline || owner?.field || "Brazework member"}</span></span>
          </Link>
          {(team.length > 0 || canManage) && <TeamList projectId={p.id} people={canManage ? everyone : team} candidates={candidates} manage={canManage} isOwner={own} roles={accessOn} me={user.id} />}
          {!own && <Link href={`/messages/new?to=${p.owner_id}`} className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-line text-sm font-medium transition hover:bg-hover">Message {owner?.first_name || "them"}</Link>}
        </Panel>
        {/* For people reading someone else's build (less clutter, Nov 21): you know your own project, and
            Ember is in the bar at the top of every page. */}
        {!own && <ThirtySeconds lines={summary} ownerId={p.owner_id} />}
        {/* Rendered once (no hidden copy for phones): the side column follows the log on a phone. */}
        {about}
        {own && ghOn && githubConfig() && (
          <details open={repos.length > 0 || typeof ghNote === "string"} className="group rounded-2xl border border-line bg-surface p-4">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              GitHub repository <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="pt-3"><GitHubConnect supabase={supabase} projectId={p.id} linked={repos} note={typeof ghNote === "string" ? ghNote : undefined} /></div>
          </details>
        )}
        {!own && <Link href={`/copilot?q=${encodeURIComponent(ask)}`} className="glass-card flex items-center gap-3 rounded-3xl p-4 transition">
          <Ember size={36} />
          <span className="min-w-0"><span className="block text-sm font-medium">Ask Ember about this project</span><span className="block text-xs text-muted">{emberCreditCost("ask")} · What it is, what&apos;s impressive, what to ask.</span></span>
        </Link>}
        {(more.data ?? []).length > 0 && (
          <Panel>
            <Kicker>More from {owner?.first_name || "them"}</Kicker>
            <ul className="mt-3 space-y-1">
              {((more.data ?? []) as { id: string; title: string; status: string }[]).map((m) => (
                <li key={m.id}><Link href={`/projects/${m.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition hover:bg-hover/70"><span className="truncate">{m.title}</span><span className="shrink-0 text-[11px] text-faint">{m.status === "completed" ? "Done" : "Building"}</span></Link></li>
              ))}
            </ul>
          </Panel>
        )}
      </aside>
    </div>
  );
}

