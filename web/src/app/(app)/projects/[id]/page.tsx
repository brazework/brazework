import type { Metadata } from "next";
import { ReportLink } from "@/components/report/report-dialog";
import { ArrowLeft, BadgeCheck, CheckCircle2, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyLink } from "@/components/app/copy-link";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { Ember } from "@/components/ember/ember";
import { SendPost } from "@/components/share/send-post";
import { Avatar, Kicker } from "@/components/ui";
import { dbFeatures, postSelect, milestoneCols } from "@/lib/db-features";
import { timeAgo, type Post } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { PostCard } from "../../feed/post-card";
import { MilestoneTimeline, type Milestone } from "../../u/[id]/milestones";
import { ProjectIcon } from "../project-card";
import { PostUpdate } from "./post-update";
import { BuiltWith } from "@/components/projects/built-with";
import { TeamList } from "./team";
import { OrganizeWithEmber } from "./organize";
import { copilotEnabled } from "@/lib/copilot";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-6xl">
      <Link href="/projects" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Projects</Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProjectView params={params} />
      </Suspense>
    </div>
  );
}

type Project = { tools?: string[]; id: string; title: string; summary: string; status: "in_progress" | "completed"; year: number | null; tags: string[]; private: boolean; updated_at: string; created_at: string; owner_id: string; profiles: { first_name: string; last_name: string; headline: string; field: string } | null };

// A project's home: what it is, the write-up, what its club has verified, its updates over time,
// and who built it. The owner posts updates here; anyone can send it on or ask Ember about it.
async function ProjectView({ params }: { params: PageProps<"/projects/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { milestones: msOn, projectTools: stackOn } = await dbFeatures();
  const { data } = await supabase.from("projects").select(`id, title, summary, status, year, tags, private, updated_at, created_at, owner_id, profiles!projects_owner_id_fkey(first_name, last_name, headline, field)${stackOn ? ", tools" : ""}`).eq("id", id).maybeSingle();
  const p = data as unknown as Project | null;
  const own = p?.owner_id === user.id;
  if (!p || (p.private && !own)) return <EmptyState title="This project isn't available" body="It may be private, or it was removed." />;

  const [det, ms, ups, more, teamRes, clubRes] = await Promise.all([
    supabase.from("project_details").select("details, link").eq("project_id", id).maybeSingle(),
    msOn ? supabase.from("milestones").select(await milestoneCols()).eq("project_id", id).order("achieved_on", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    supabase.from("posts").select(await postSelect()).eq("project_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(30),
    supabase.from("projects").select("id, title, status").eq("owner_id", p.owner_id).eq("private", false).neq("id", id).order("updated_at", { ascending: false }).limit(4),
    (await dbFeatures()).verification ? supabase.from("project_members").select("uid, profiles(first_name, last_name, headline)").eq("project_id", id).order("added_at", { ascending: true }).limit(20) : Promise.resolve({ data: [] }),
    own ? supabase.from("community_members").select("community_id").eq("uid", user.id).limit(50) : Promise.resolve({ data: [] }),
  ]);
  type TM = { uid: string; profiles: { first_name: string; last_name: string; headline: string } | null };
  const team = ((teamRes.data ?? []) as unknown as TM[]).map((t) => ({ id: t.uid, first: t.profiles?.first_name ?? "", last: t.profiles?.last_name ?? "", headline: t.profiles?.headline ?? "" }));
  // Who the owner can add: people in their clubs.
  const myClubIds = ((clubRes.data ?? []) as { community_id: string }[]).map((r) => r.community_id);
  const { data: clubPeople } = own && myClubIds.length
    ? await supabase.from("community_members").select("uid, first_name, last_name").in("community_id", myClubIds).neq("uid", user.id).limit(200)
    : { data: [] };
  const candidates = [...new Map(((clubPeople ?? []) as { uid: string; first_name: string; last_name: string }[]).map((c) => [c.uid, { id: c.uid, first: c.first_name, last: c.last_name }])).values()];
  const details = (det.data as { details: string; link: string } | null) ?? { details: "", link: "" };
  const link = /^https?:\/\/\S+$/i.test(details.link) ? details.link : "";
  const milestones = (ms.data ?? []) as unknown as unknown as Milestone[];
  const verified = milestones.filter((m) => m.status === "verified");
  const posts = (ups.data ?? []) as unknown as Post[];
  const ids = posts.map((x) => x.id);
  const [likes, saves] = ids.length
    ? await Promise.all([supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", ids), supabase.from("saved").select("post_id").eq("user_id", user.id).in("post_id", ids)])
    : [{ data: [] }, { data: [] }];
  const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l: { post_id: string }) => l.post_id));
  // How many public projects use each tool (for "N other projects use it").
  const tools = p.tools ?? [];
  const useCounts = stackOn && tools.length ? await Promise.all(tools.map((t) => supabase.from("projects").select("id", { count: "exact", head: true }).eq("private", false).contains("tools", [t]))) : [];
  const uses = Object.fromEntries(tools.map((t, i) => [t, useCounts[i]?.count ?? 1]));
  const emberOn = own && stackOn && (await copilotEnabled());
  const owner = p.profiles;
  const ownerName = `${owner?.first_name ?? ""} ${owner?.last_name ?? ""}`.trim() || "Forge member";
  const ask = `Tell me about the project "${p.title}" by ${ownerName} on Forge: what it is in plain words, what's impressive about it, and three good questions to ask the builder.`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel className="p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="nav-tile mr-1 grid size-10 place-items-center rounded-xl text-text-2"><ProjectIcon tools={tools} className="size-5" /></span>
            {p.status === "completed" ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-ok" /> Completed{p.year ? ` ${p.year}` : ""}</span> : <span className="inline-flex items-center gap-1.5"><span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-50" /><span className="relative size-2 rounded-full bg-accent" /></span> In progress · updated {timeAgo(p.updated_at)}</span>}
            {verified.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 font-medium text-ok"><BadgeCheck className="size-3.5" /> {verified.length} club-verified</span>}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{p.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-text-2">{p.summary}</p>
          {p.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{p.tags.map((t) => <Link key={t} href={`/projects?topic=${encodeURIComponent(t)}`} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-text-2 hover:text-text">#{t}</Link>)}</div>}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="bg-accent-grad inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent"><ExternalLink className="size-4" /> {new URL(link).hostname.replace(/^www\./, "")}</a>}
            <SendPost projectId={p.id} compact={false} />
            <CopyLink path={`/projects/${p.id}`} label="Share" />
            {!own && <ReportLink kind="project" id={p.id} label="this project" className="ml-auto" />}
            {own && <Link href={`/u/${user.id}#projects`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm transition hover:bg-hover"><Pencil className="size-4" /> Edit</Link>}
          </div>
        </Panel>

        {(tools.length > 0 || emberOn) && (
          <Panel className="p-6">
            <Kicker>Built with</Kicker>
            {tools.length > 0 ? <BuiltWith tools={tools} uses={uses} /> : <p className="mt-2 text-sm text-muted">No tools listed yet.</p>}
            {emberOn && <OrganizeWithEmber projectId={p.id} />}
          </Panel>
        )}

        {details.details && (
          <Panel className="p-6">
            <Kicker>The write-up</Kicker>
            <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{details.details}</p>
          </Panel>
        )}

        {milestones.length > 0 && (
          <Panel className="p-6">
            <Kicker>Milestones</Kicker>
            <p className="mt-1 text-xs text-muted">{own ? "Verified ones show to everyone; pending and declined ones only to you." : "Each one was verified by a club on Forge."}</p>
            <MilestoneTimeline items={milestones} own={own} />
          </Panel>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Updates</h2>
          {own && <PostUpdate projectId={p.id} title={p.title} />}
          {posts.map((x, i) => <PostCard key={x.id} post={x} liked={liked.has(x.id)} saved={saved.has(x.id)} own={x.author_id === user.id} index={i} />)}
          {!posts.length && !own && <p className="text-sm text-muted">No updates yet.</p>}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Panel>
          <Kicker>{team.length ? "Built by the team" : "Built by"}</Kicker>
          <Link href={`/u/${p.owner_id}`} className="mt-3 flex items-center gap-3">
            <Avatar first={owner?.first_name ?? ""} last={owner?.last_name ?? ""} size={44} />
            <span className="min-w-0"><span className="block truncate font-medium hover:underline">{ownerName}</span><span className="block truncate text-xs text-muted">{owner?.headline || owner?.field || "Forge member"}</span></span>
          </Link>
          {(team.length > 0 || own) && <TeamList projectId={p.id} team={team} candidates={candidates} own={own} me={user.id} />}
          {!own && <Link href={`/messages/new?to=${p.owner_id}`} className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-full border border-line text-sm font-medium transition hover:bg-hover">Message {owner?.first_name || "them"}</Link>}
        </Panel>
        <Link href={`/copilot?q=${encodeURIComponent(ask)}`} className="glass-card flex items-center gap-3 rounded-3xl p-4 transition hover:-translate-y-0.5">
          <Ember size={36} />
          <span className="min-w-0"><span className="block text-sm font-medium">Ask Ember about this project</span><span className="block text-xs text-muted">What it is, what&apos;s impressive, what to ask.</span></span>
        </Link>
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
