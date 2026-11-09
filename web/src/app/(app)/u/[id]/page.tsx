import type { Metadata } from "next";
import { BarChart3, FolderGit2, Lock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyLink } from "@/components/app/copy-link";
import { CountUp } from "@/components/app/count-up";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { SwitchTabs } from "@/components/app/switch-tabs";
import { ConnectButtons } from "@/components/network/connect-buttons";
import { getNetworkCounts, getRelationship } from "@/components/network/queries";
import { type Post, type Profile } from "@/lib/forge";
import { recordProfileView } from "@/lib/network";
import { dbFeatures, postSelect } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { copilotEnabled } from "@/lib/copilot";
import { PostCard } from "../../feed/post-card";
import { PeopleStrip } from "../../feed/discover";
import { StripSkeleton } from "@/components/app/discover-cards";
import { CoverBanner, ProfilePhoto } from "@/components/media/profile-media";
import { OnlineLabel, WithPresence } from "@/components/presence/presence";
import { EditBasics, ProjectEditor, ProjectGrid, type ProjectView } from "./profile-client";
import type { Club, Milestone } from "./milestones";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage({ params }: PageProps<"/u/[id]">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
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

  // Photo and cover paths exist once supabase/media.sql has run.
  const base = "id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at";
  let pr = await supabase.from("profiles").select(`${base}, avatar_path, cover_path`).eq("id", id).maybeSingle();
  if (pr.error?.code === "42703") pr = await supabase.from("profiles").select(base).eq("id", id).maybeSingle();
  const profileRow = pr.data;
  const mediaOn = !pr.error && pr.data ? "avatar_path" in pr.data : false;
  if (!profileRow) notFound();
  const p = profileRow as unknown as Profile;

  const [rel, counts, postsRes, projectsRes] = await Promise.all([
    own ? Promise.resolve(null) : getRelationship(id),
    getNetworkCounts(id),
    supabase
      .from("posts")
      .select(await postSelect())
      .eq("author_id", id)
      .is("community_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("projects").select("id, title, summary, status, year, tags, private, updated_at").eq("owner_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!own) await recordProfileView(id);
  const copilotOn = own && (await copilotEnabled());

  const posts = (postsRes.data ?? []) as unknown as Post[];
  const projectRows = (projectsRes.data ?? []) as Omit<ProjectView, "details" | "link">[];
  const [likesRes, detailsRes] = await Promise.all([
    posts.length ? supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", posts.map((x) => x.id)) : Promise.resolve({ data: [] }),
    projectRows.length ? supabase.from("project_details").select("project_id, details, link").in("project_id", projectRows.map((x) => x.id)) : Promise.resolve({ data: [] }),
  ]);
  const liked = new Set(((likesRes.data ?? []) as { post_id: string }[]).map((l) => l.post_id));
  const details = new Map(((detailsRes.data ?? []) as { project_id: string; details: string; link: string }[]).map((d) => [d.project_id, d]));
  // This profile's own projects double as the boxes on its project posts.
  const byId = Object.fromEntries(projectRows.map((r) => [r.id, r]));
  // Milestones (supabase/milestones.sql): others only get verified ones back, the owner gets all of theirs.
  const { milestones: msOn } = await dbFeatures();
  const [msRes, clubRes] = await Promise.all([
    msOn ? supabase.from("milestones").select("id, project_id, community_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, review_note").eq("owner_id", id).order("achieved_on", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    msOn && own ? supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const ms = (msRes.data ?? []) as Milestone[];
  const myClubs: Club[] = ((clubRes.data ?? []) as unknown as { communities: Club | Club[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
  const verifiedCount = ms.filter((m) => m.status === "verified").length;
  const projects: ProjectView[] = projectRows.map((r) => ({ ...r, details: details.get(r.id)?.details ?? null, link: details.get(r.id)?.link ?? null, milestones: msOn ? ms.filter((m) => m.project_id === r.id) : undefined }));

  const name = `${p.first_name} ${p.last_name}`.trim();
  const joined = new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const stats: { n: number | null; label: string; href?: string }[] = [
    ...(msOn ? [{ n: verifiedCount, label: "Verified", href: "#projects" }] : []),
    { n: projects.length, label: projects.length === 1 ? "Project" : "Projects", href: "#projects" },
    { n: posts.length, label: posts.length === 1 ? "Post" : "Posts", href: "#posts" },
    { n: counts.connections, label: "Connections", href: own ? "/network?tab=connections" : undefined },
    { n: counts.followers, label: "Followers", href: own ? "/network?tab=followers" : undefined },
    { n: counts.following, label: "Following", href: own ? "/network?tab=following" : undefined },
  ];

  return (
    <>
      <Panel className="relative overflow-hidden p-0">
        <CoverBanner path={p.cover_path} editable={own && mediaOn} userId={user.id} />
        <div className="px-6 pb-6">
          <div className="pointer-events-none relative z-10 -mt-14 flex flex-wrap items-end justify-between gap-4 *:pointer-events-auto">
            <div className="inline-flex rounded-full bg-accent-grad p-[3px] shadow-[var(--shadow)]">
              <WithPresence id={p.id} dot="size-5 ring-4"><ProfilePhoto path={p.avatar_path} first={p.first_name} last={p.last_name} editable={own && mediaOn} userId={user.id} size={104} /></WithPresence>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyLink path={`/u/${p.id}`} label="Share" />
              {own ? (
                <Link href="/dashboard" data-tour="analytics" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm transition hover:bg-hover active:scale-95">
                  <BarChart3 className="size-4" /> Dashboard
                </Link>
              ) : (
                rel && <ConnectButtons personId={p.id} firstName={p.first_name} relationship={rel} />
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{name || "Forge member"}</h1><OnlineLabel id={p.id} /></div>
          {p.headline && <p className="mt-1 text-lg text-text-2">{p.headline}</p>}
          <p className="mt-2 text-sm text-muted">
            {p.account_type === "student" ? "Student" : "Professional"}
            {p.field && ` · ${p.field}`} · Joined {joined}
          </p>

          <ul className={`mt-5 grid grid-cols-3 gap-2 ${msOn ? "sm:grid-cols-6" : "sm:grid-cols-5"}`}>
            {stats.map((st) => {
              const inner = (
                <>
                  <span className="block text-2xl font-semibold tracking-tight">{st.n === null ? "—" : <CountUp to={st.n} />}</span>
                  <span className="block text-xs text-muted">{st.label}</span>
                </>
              );
              const cls = "block rounded-2xl border border-line bg-surface-2/60 px-3 py-3 text-center transition";
              const lift = "hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface hover:shadow-[var(--shadow)] active:scale-95";
              return (
                <li key={st.label}>
                  {st.href ? (
                    // In-page tabs (#projects) need a plain anchor so the hashchange reaches the tabs.
                    st.href.startsWith("#") ? <a href={st.href} className={`${cls} ${lift}`}>{inner}</a> : <Link href={st.href} className={`${cls} ${lift}`}>{inner}</Link>
                  ) : <div className={cls}>{inner}</div>}
                </li>
              );
            })}
          </ul>

          {own ? (
            <EditBasics headline={p.headline} bio={p.bio} />
          ) : (
            p.bio && <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{p.bio}</p>
          )}
          {p.interests?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {p.interests.map((t) => <Link key={t} href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-text-2 transition hover:border-transparent hover:bg-accent-grad hover:text-on-accent active:scale-95">#{t}</Link>)}
            </div>
          )}
        </div>
      </Panel>

      <section id="projects" data-tour="projects-tab" className="mt-8 scroll-mt-24">
        <SwitchTabs
          name="Profile"
          items={[
            {
              id: "projects", label: "Projects", count: projects.length,
              content: (
                <>
                  {own && <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl border border-dashed border-line-strong bg-surface/60 p-4"><p className="text-sm text-muted">Show what you&apos;ve built: a summary everyone sees, and a write-up you can keep private.</p><ProjectEditor interests={p.interests ?? []} copilot={copilotOn} /></div>}
                  <ProjectGrid projects={projects} own={own} interests={p.interests ?? []} copilot={copilotOn} clubs={msOn && own ? myClubs : undefined} />
                  {!projects.length && (
                    <EmptyState
                      icon={<FolderGit2 className="size-6" />}
                      title={own ? "Show what you've built" : "No projects yet"}
                      body={own ? "Add a project with a summary, what you did and a link. Keep the write-up private and share only the card if you like." : undefined}
                    />
                  )}
                  {projects.some((x) => x.private) && !own && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Lock className="size-3" /> Private projects show their card only.</p>
                  )}
                </>
              ),
            },
            {
              id: "posts", label: "Posts", count: posts.length,
              content: (
                <div className="flex flex-col gap-4">
                  {posts.map((post, i) => <PostCard key={post.id} post={post} liked={liked.has(post.id)} own={own} index={i} project={post.project_id ? byId[post.project_id] ?? null : null} />)}
                  {!posts.length && <EmptyState icon={<MessageSquare className="size-6" />} title={own ? "You haven't posted yet" : "No posts yet"} body={own ? "Share an update, a question or a result from the feed." : undefined} action={own ? <Link href="/feed" className="text-sm underline underline-offset-4">Go to the feed</Link> : undefined} />}
                </div>
              ),
            },
            {
              id: "about", label: "About",
              content: (
                <Panel className="p-6">
                  <dl className="grid gap-5 sm:grid-cols-2">
                    <div><dt className="text-xs font-medium text-faint">Role</dt><dd className="mt-1">{p.account_type === "student" ? "Student" : "Professional"}</dd></div>
                    <div><dt className="text-xs font-medium text-faint">Field</dt><dd className="mt-1">{p.field || "—"}</dd></div>
                    <div><dt className="text-xs font-medium text-faint">On Forge since</dt><dd className="mt-1">{joined}</dd></div>
                    <div><dt className="text-xs font-medium text-faint">Interests</dt><dd className="mt-1">{p.interests?.length ? p.interests.map((t) => `#${t}`).join("  ") : "—"}</dd></div>
                  </dl>
                  {p.bio && <><div className="mt-6 text-xs font-medium text-faint">Bio</div><p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{p.bio}</p></>}
                </Panel>
              ),
            },
          ]}
        />
      </section>

      <div className="mt-12">
        <Suspense fallback={<StripSkeleton w={200} h={250} />}>
          <PeopleStrip field={p.field} interests={p.interests ?? []} exclude={[p.id]} title={p.field ? `More builders in ${p.field}` : "More builders like this"} />
        </Suspense>
      </div>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-[440px]" />
      <Skeleton className="mt-8 h-12" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );
}
