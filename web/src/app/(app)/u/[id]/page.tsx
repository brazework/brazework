import type { Metadata } from "next";
import { BarChart3, FolderGit2, Lock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Panel, Skeleton, chipCls } from "@/components/app/page-ui";
import { ConnectButtons } from "@/components/network/connect-buttons";
import { getNetworkCounts, getRelationship } from "@/components/network/queries";
import { Avatar, Kicker } from "@/components/ui";
import { type Post, type Profile } from "@/lib/forge";
import { recordProfileView } from "@/lib/network";
import { getViewer } from "@/lib/supabase/server";
import { PostCard } from "../../feed/post-card";
import { EditBasics, ProjectCard, ProjectEditor, type ProjectView } from "./profile-client";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage({ params }: PageProps<"/u/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileView params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileView({ params }: { params: PageProps<"/u/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const own = user.id === id;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profileRow) notFound();
  const p = profileRow as Profile;

  const [rel, counts, postsRes, projectsRes] = await Promise.all([
    own ? Promise.resolve(null) : getRelationship(id),
    getNetworkCounts(id),
    supabase
      .from("posts")
      .select("id, author_id, author_first, author_last, author_headline, body, kind, tags, like_count, comment_count, created_at")
      .eq("author_id", id)
      .is("community_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("projects").select("id, title, summary, status, year, tags, private, updated_at").eq("owner_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!own) await recordProfileView(id);

  const posts = (postsRes.data ?? []) as Post[];
  const projectRows = (projectsRes.data ?? []) as Omit<ProjectView, "details" | "link">[];
  const [likesRes, detailsRes] = await Promise.all([
    posts.length ? supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", posts.map((x) => x.id)) : Promise.resolve({ data: [] }),
    projectRows.length ? supabase.from("project_details").select("project_id, details, link").in("project_id", projectRows.map((x) => x.id)) : Promise.resolve({ data: [] }),
  ]);
  const liked = new Set(((likesRes.data ?? []) as { post_id: string }[]).map((l) => l.post_id));
  const details = new Map(((detailsRes.data ?? []) as { project_id: string; details: string; link: string }[]).map((d) => [d.project_id, d]));
  const projects: ProjectView[] = projectRows.map((r) => ({ ...r, details: details.get(r.id)?.details ?? null, link: details.get(r.id)?.link ?? null }));

  const name = `${p.first_name} ${p.last_name}`.trim();
  const joined = new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const stat = (n: number | null, label: string, href?: string) => {
    const body = (
      <>
        <span className="font-semibold tabular-nums text-text">{n ?? "—"}</span> <span className="text-muted">{label}</span>
      </>
    );
    return href ? <Link href={href} className="hover:underline">{body}</Link> : <span>{body}</span>;
  };

  return (
    <>
      <Panel className="relative overflow-hidden p-0">
        <div className="bg-blueprint h-28 border-b border-line" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <Avatar first={p.first_name} last={p.last_name} size={84} className="border-4 border-surface text-2xl" />
            {own ? (
              <Link href="/analytics" data-tour="analytics" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-sm transition hover:bg-hover">
                <BarChart3 className="size-4" /> Analytics
              </Link>
            ) : (
              rel && <ConnectButtons personId={p.id} firstName={p.first_name} relationship={rel} />
            )}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{name || "Forge member"}</h1>
          {p.headline && <p className="mt-1 text-text-2">{p.headline}</p>}
          <p className="mt-2 text-sm text-faint">
            {p.account_type === "student" ? "Student" : "Professional"}
            {p.field && ` · ${p.field}`} · Joined {joined}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {stat(counts.connections, "connections", own ? "/network?tab=connections" : undefined)}
            {stat(counts.followers, "followers", own ? "/network?tab=followers" : undefined)}
            {stat(counts.following, "following", own ? "/network?tab=following" : undefined)}
          </div>
          {own ? (
            <EditBasics headline={p.headline} bio={p.bio} />
          ) : (
            p.bio && <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{p.bio}</p>
          )}
          {p.interests?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {p.interests.map((t) => <span key={t} className={chipCls}>#{t}</span>)}
            </div>
          )}
        </div>
      </Panel>

      <section data-tour="projects-tab" className="mt-10">
        <div className="flex items-center justify-between">
          <Kicker>Projects</Kicker>
          {own && <ProjectEditor interests={p.interests ?? []} />}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {projects.map((pr) => <ProjectCard key={pr.id} project={pr} own={own} interests={p.interests ?? []} />)}
        </div>
        {!projects.length && (
          <EmptyState
            icon={<FolderGit2 className="size-5" />}
            title={own ? "Show what you've built" : "No projects yet"}
            body={own ? "Add a project with a summary, what you did and a link. Keep the write-up private and share only the card if you like." : undefined}
          />
        )}
        {projects.some((x) => x.private) && !own && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Lock className="size-3" /> Private projects show their card only.</p>
        )}
      </section>

      <section className="mt-10">
        <Kicker>Posts</Kicker>
        <div className="mt-4 flex flex-col gap-4">
          {posts.map((post, i) => <PostCard key={post.id} post={post} liked={liked.has(post.id)} own={own} index={i} />)}
          {!posts.length && <EmptyState title={own ? "You haven't posted yet" : "No posts yet"} body={own ? "Share an update, a question or a result from the feed." : undefined} />}
        </div>
      </section>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-80" />
      <Skeleton className="mt-10 h-40" />
      <Skeleton className="mt-10 h-56" />
    </div>
  );
}
