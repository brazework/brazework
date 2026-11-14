import type { Metadata } from "next";
import { ReportLink } from "@/components/report/report-dialog";
import { BadgeCheck, BarChart3, Eye, FileText, FolderGit2, Lock, MapPin, MessageSquare, Trophy } from "lucide-react";
import { CommunityBadge } from "../../communities/_components/badge";
import { ActivityGrid } from "@/components/profile/activity";
import { cn, requestTime } from "@/lib/forge";
import { ProjectIcon } from "../../projects/project-card";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyLink } from "@/components/app/copy-link";
import { signersFor, type MemberRow } from "@/lib/signers";
import { PlaceTabsRow } from "@/components/app/place-tabs";
import { OwnProofTabs } from "@/components/app/place-tabs-counted";
import { GoalCard, GoalLine } from "@/components/app/goal-card";
import { loadGoal, loadRecord } from "@/lib/goal-load";
import { CountUp } from "@/components/app/count-up";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { MemberFaces } from "@/components/network/member-faces";
import { classOf, openToLabel, type ProfileLink } from "@/lib/profile-meta";
import { ExtrasCard } from "./extras-client";
import { ProfileStrength, ProofTimeline, SharedContext, SideCard, type ProofItem, type Step } from "./profile-parts";
import { SwitchTabs } from "@/components/app/switch-tabs";
import { ConnectButtons } from "@/components/network/connect-buttons";
import { getNetworkCounts, getRelationship } from "@/components/network/queries";
import { type Post, type Profile } from "@/lib/forge";
import { recordProfileView } from "@/lib/network";
import { dbFeatures, postSelect, milestoneCols } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { cardReplies } from "@/lib/card-replies";
import { cookies } from "next/headers";
import { DISMISS_PREFIX } from "@/lib/dismiss";
import { copilotEnabled } from "@/lib/copilot";
import { PostCard } from "../../feed/post-card";
import { PeopleStrip } from "../../feed/discover";
import { StripSkeleton } from "@/components/app/discover-cards";
import { CoverBanner, ProfilePhoto } from "@/components/media/profile-media";
import { OnlineLabel, WithPresence } from "@/components/presence/presence";
import { EditBasics, ProjectEditor, ProjectGrid, type ProjectView } from "./profile-client";
import type { Club, Milestone } from "./milestones";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage({ params, searchParams }: PageProps<"/u/[id]">) {
  return (
    <div className="mx-auto max-w-3xl lg:max-w-6xl">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type ClubRow = { role: string; communities: (Club & { logo_path?: string; accent?: string }) | null };

async function ProfileView({ params, searchParams }: { params: PageProps<"/u/[id]">["params"]; searchParams: PageProps<"/u/[id]">["searchParams"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user, profile: me } = await getViewer();
  if (!user) redirect("/login");
  const own = user.id === id;
  // "Preview" (?view=visitor, Linear FIX-21): your own profile the way another member sees it, without
  // the owner's tools and with private or unverified work left out. Nothing is recorded as a view.
  const preview = own && (await searchParams).view === "visitor";
  const mine = own && !preview;
  const hideStrength = mine && (await cookies()).has(`${DISMISS_PREFIX}profile-strength`);
  const f = await dbFeatures();
  const { milestones: msOn, projectTools: stackOn, profileExtras: extrasOn } = f;
  const clubCols = `id, name${f.clubProfile ? ", logo_path, accent" : ""}`;

  // Goals (supabase/goals.sql): theirs if it's visible (row-level security decides), and, on your own
  // profile, the record your path is built from.
  const goalP = f.goals ? loadGoal(supabase, id) : Promise.resolve(null);
  const recordP = f.goals && mine ? loadRecord(supabase, id) : Promise.resolve(null);

  // Everything that only needs the profile's id, at once (one round of requests, not seven).
  const [pr, rel, counts, postsRes, projectsRes, msRes, theirClubs, followRows, myClubRows, myFollows, , copilotOn] = await Promise.all([
    supabase.from("profiles").select(`id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at${f.media ? ", avatar_path, cover_path" : ""}${extrasOn ? ", open_to, links, location" : ""}${f.gradYear ? ", grad_year" : ""}`).eq("id", id).maybeSingle(),
    own ? Promise.resolve(null) : getRelationship(id),
    getNetworkCounts(id),
    supabase.from("posts").select(await postSelect()).eq("author_id", id).is("community_id", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("projects").select(stackOn ? "id, title, summary, status, year, tags, private, updated_at, tools" : "id, title, summary, status, year, tags, private, updated_at").eq("owner_id", id).order("created_at", { ascending: false }).limit(100),
    // Milestones (supabase/milestones.sql): others only get verified ones back, the owner gets all of theirs.
    msOn ? supabase.from("milestones").select(await milestoneCols()).eq("owner_id", id).order("achieved_on", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    supabase.from("community_members").select(`role, communities(${clubCols})`).eq("uid", id).limit(12),
    supabase.from("follows").select("follower, follower_info").eq("target", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).limit(50),
    own ? Promise.resolve({ data: [] }) : supabase.from("follows").select("target").eq("follower", user.id).limit(500),
    own ? Promise.resolve() : recordProfileView(id),
    own ? copilotEnabled() : Promise.resolve(false),
  ]);
  if (!pr.data) notFound();
  const p = pr.data as unknown as Profile & { open_to?: string[]; links?: ProfileLink[]; location?: string; grad_year?: number | null };
  const mediaOn = f.media;

  const posts = (postsRes.data ?? []) as unknown as Post[];
  const projectRows = ((projectsRes.data ?? []) as unknown as (Omit<ProjectView, "details" | "link"> & { tools?: string[] })[]).filter((r) => !preview || !r.private);
  const following = ((myFollows.data ?? []) as { target: string }[]).map((r) => r.target).filter((t) => t !== id);
  // Second round: what depends on the first (your likes on these posts, project write-ups, mutual follows).
  const [likesRes, detailsRes, mutualRes, winsRes, replies] = await Promise.all([
    posts.length ? supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", posts.map((x) => x.id)) : Promise.resolve({ data: [] }),
    projectRows.length ? supabase.from("project_details").select(f.projectSpecs ? "project_id, details, link, specs" : "project_id, details, link").in("project_id", projectRows.map((x) => x.id)) : Promise.resolve({ data: [] }),
    following.length ? supabase.from("follows").select("follower, follower_info", { count: "exact" }).eq("target", id).in("follower", following.slice(0, 300)).limit(2) : Promise.resolve({ data: [], count: 0 }),
    // Challenge placements (supabase/challenges.sql): public once the sponsor announces winners.
    f.challenges ? supabase.from("challenge_entries").select("challenge_id, placement, challenges(title, status, organizations(name))").eq("uid", id).not("placement", "is", null).limit(20) : Promise.resolve({ data: [] }),
    // The latest comments under each post, so they can be liked, replied to, edited and deleted here too.
    cardReplies(supabase, user.id, posts.map((x) => x.id)),
  ]);
  const viewer = { id: user.id, first: me?.first_name ?? "", last: me?.last_name ?? "" };
  type Win = { challenge_id: string; placement: number; challenges: { title: string; status: string; organizations: { name: string } | null } | null };
  const wins = ((winsRes.data ?? []) as unknown as Win[]).filter((w) => w.challenges?.status === "closed").sort((a, b) => a.placement - b.placement);
  const [goal, record] = await Promise.all([goalP, recordP]);
  const liked = new Set(((likesRes.data ?? []) as { post_id: string }[]).map((l) => l.post_id));
  const details = new Map(((detailsRes.data ?? []) as unknown as { project_id: string; details: string; link: string; specs?: { label: string; value: string }[] }[]).map((d) => [d.project_id, d]));
  const byId = Object.fromEntries(projectRows.map((r) => [r.id, r]));
  const ms = ((msRes.data ?? []) as unknown as Milestone[]).filter((m) => !preview || (m.status === "verified" && !m.private));
  const flat = <T,>(rows: { communities: T | T[] | null }[]) => rows.flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
  const myClubsBare: Club[] = flat((myClubRows.data ?? []) as unknown as { communities: Club | Club[] | null }[]);
  // On your own profile: who could sign your work in each club (its officers, not you), so the ask
  // form can say so up front (lib/signers.ts).
  const officers = mine && myClubsBare.length
    ? await supabase.from("community_members").select("community_id, uid, role, first_name, last_name").in("community_id", myClubsBare.map((c) => c.id)).in("role", ["moderator", "admin", "owner"]).limit(500)
    : { data: [] };
  const signers = signersFor((officers.data ?? []) as MemberRow[], user.id);
  const myClubs: Club[] = mine ? myClubsBare.map((c) => ({ ...c, signers: signers.get(c.id) ?? [] })) : myClubsBare;
  const clubs = ((theirClubs.data ?? []) as unknown as ClubRow[]).filter((r) => r.communities).map((r) => ({ ...r.communities!, role: r.role }));
  const projects: ProjectView[] = projectRows.map((r) => ({ ...r, details: details.get(r.id)?.details ?? null, link: details.get(r.id)?.link ?? null, specs: details.get(r.id)?.specs ?? [], milestones: msOn && (own || !r.private) ? ms.filter((m) => m.project_id === r.id) : undefined }));
  // Proof shows work on public projects (and your own private ones, to you), like the feed and résumé.
  const titles = new Map(projectRows.filter((r) => mine || !r.private).map((r) => [r.id, r.title]));
  const proofBase: ProofItem[] = ms.filter((m) => m.status === "verified" && titles.has(m.project_id)).map((m) => ({ id: m.id, title: m.title, detail: m.detail, achieved_on: m.achieved_on, community_id: m.community_id, community_name: m.community_name, reviewer_name: m.reviewer_name, vouched_by: m.vouched_by, project: { id: m.project_id, title: titles.get(m.project_id)! } }));
  // Pro sign-offs (supabase/pro-verification.sql): an engineer's name, title, employer and note. Work
  // they signed comes first: Pro-verified, then club-verified (Linear FIX-72).
  type ProRow = { milestone_id: string; reviewer_name: string; reviewer_title: string; employer_name: string; note: string; created_at: string };
  const { data: proRows } = f.proVerification && proofBase.length ? await supabase.from("pro_reviews").select("milestone_id, reviewer_name, reviewer_title, employer_name, note, created_at").in("milestone_id", proofBase.map((m) => m.id)).order("created_at", { ascending: true }).limit(200) : { data: [] };
  const proBy = new Map<string, ProofItem["pro"]>();
  for (const r of (proRows ?? []) as ProRow[]) proBy.set(r.milestone_id, [...(proBy.get(r.milestone_id) ?? []), { name: r.reviewer_name, title: r.reviewer_title, employer: r.employer_name, note: r.note, at: r.created_at }]);
  const proof: ProofItem[] = proofBase.map((m) => ({ ...m, pro: proBy.get(m.id) })).sort((a, b) => Number(Boolean(b.pro?.length)) - Number(Boolean(a.pro?.length)));
  // The clubs behind the proof (vouched-for milestones have no club, so they're not counted here).
  const verifiedBy = [...proof.filter((m): m is ProofItem & { community_id: string } => !!m.community_id).reduce((acc, m) => acc.set(m.community_id, { name: m.community_name, n: (acc.get(m.community_id)?.n ?? 0) + 1 }), new Map<string, { name: string; n: number }>())].sort((a, b) => b[1].n - a[1].n);

  const name = `${p.first_name} ${p.last_name}`.trim();
  const joined = new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const openTo = p.open_to ?? [];
  const links = p.links ?? [];
  const stats: { n: number; label: string; href: string }[] = [
    ...(msOn ? [{ n: proof.length, label: "Signed results", href: "#proof" }] : []),
    { n: projects.length, label: projects.length === 1 ? "Project" : "Projects", href: "#projects" },
    { n: posts.length, label: posts.length === 1 ? "Post" : "Posts", href: "#posts" },
  ];
  const followers = ((followRows.data ?? []) as { follower: string; follower_info: { firstName?: string; lastName?: string } }[]).map((x) => ({ id: x.follower, first: x.follower_info?.firstName ?? "", last: x.follower_info?.lastName ?? "" }));
  const mutual = ((mutualRes.data ?? []) as { follower_info: { firstName?: string; lastName?: string } }[]).map((x) => `${x.follower_info?.firstName ?? ""} ${x.follower_info?.lastName ?? ""}`.trim());
  const mutualCount = (mutualRes as { count?: number | null }).count ?? mutual.length;
  const sharedClubs = own ? [] : clubs.filter((c) => myClubs.some((m) => m.id === c.id));
  // Now building: their most recently updated project that's still in progress (public, unless it's you).
  const nowBuilding = projectRows.filter((x) => x.status === "in_progress" && (mine || !x.private)).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  // Skills from their work: the tools across their projects, most used first.
  const skills = [...projectRows.flatMap((x) => x.tools ?? []).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const steps: Step[] = [
    ...(mediaOn ? [{ done: !!p.avatar_path, label: "Add a profile photo", href: "#top" }] : []),
    { done: !!p.headline, label: "Write a headline", href: "#about" },
    { done: !!p.bio, label: "Add a short bio", href: "#about" },
    { done: projects.length > 0, label: "Add a project", href: "#projects" },
    ...(stackOn ? [{ done: projectRows.some((x) => (x.tools ?? []).length > 0), label: "Say what you built with", href: "#projects" }] : []),
    ...(msOn ? [{ done: proof.length > 0, label: "Get a milestone verified", href: "#proof" }] : []),
    ...(extrasOn ? [{ done: openTo.length > 0, label: "Say what you're open to", href: "#open-to" }, { done: links.length > 0, label: "Add your GitHub or a link", href: "#open-to" }] : []),
    { done: clubs.length > 0, label: "Join a club", href: "/communities?tab=discover" },
    { done: posts.length > 0, label: "Share your first post", href: "/feed#composer" },
  ];

  return (
    <div id="top" className="scroll-mt-24">
      {/* Your own profile is the first page of Proof: its other pages are a click away (lib/places.ts). */}
      {mine && <Suspense fallback={<PlaceTabsRow place="proof" active="profile" />}><OwnProofTabs /></Suspense>}
      {preview && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl border border-line bg-surface-2/70 px-4 py-3 text-sm text-text-2">
          <Eye className="mt-0.5 size-4 shrink-0" /> This is how other members see your profile. Private projects, private milestones and anything not yet verified are left out.
        </p>
      )}
      <Panel className="relative overflow-hidden p-0">
        <CoverBanner path={p.cover_path} editable={mine && mediaOn} userId={user.id} />
        <div className="px-6 pb-6">
          <div className="pointer-events-none relative z-10 -mt-14 flex flex-wrap items-end justify-between gap-4 *:pointer-events-auto">
            <div className="inline-flex rounded-full">
              <WithPresence id={p.id} dot="size-5 ring-4 top-[4%] bottom-auto"><ProfilePhoto path={p.avatar_path} first={p.first_name} last={p.last_name} editable={mine && mediaOn} userId={user.id} size={104} /></WithPresence>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyLink path={`/u/${p.id}`} label="Share" />
              <Link href={`/u/${p.id}/resume`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm transition hover:bg-hover active:scale-95"><FileText className="size-4" /> Résumé</Link>
              {mine && (
                <Link href={`/u/${p.id}?view=visitor`} title="Preview as a visitor" className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-sm transition hover:bg-hover active:scale-95 sm:w-auto sm:px-4"><Eye className="size-4" /> <span className="sr-only sm:not-sr-only">Preview</span></Link>
              )}
              {mine ? (
                <Link href="/dashboard" data-tour="analytics" title="Dashboard" className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-sm transition hover:bg-hover active:scale-95 sm:w-auto sm:px-4">
                  <BarChart3 className="size-4" /> <span className="sr-only sm:not-sr-only">Dashboard</span>
                </Link>
              ) : preview ? (
                <Link href={`/u/${p.id}`} className="bg-accent-grad inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent transition active:scale-95">Done previewing</Link>
              ) : (
                rel && <ConnectButtons personId={p.id} firstName={p.first_name} relationship={rel} />
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{name || "Brazework member"}</h1><OnlineLabel id={p.id} /></div>
          {p.headline && <p className="mt-1 text-lg text-text-2">{p.headline}</p>}
          {goal && !mine && <div className="mt-2.5"><GoalLine goal={goal} /></div>}
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            {p.account_type === "student" ? "Student" : "Professional"}
            {p.grad_year && <> · {classOf(p.grad_year)}</>}
            {p.field && <> · {p.field}</>}
            {p.location && <> · <MapPin className="size-3.5" /> {p.location}</>}
            <> · Joined {joined}</>
            {!own && <ReportLink kind="person" id={p.id} label={name || "this member"} className="ml-2" />}
          </p>
          {openTo.length > 0 && (
            <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-3 py-1 text-xs font-medium text-ok">
              <span className="size-1.5 rounded-full bg-ok" /> Open to {openTo.map(openToLabel).join(", ").toLowerCase()}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <ul className="grid grid-cols-3 gap-2 sm:w-96">
              {stats.map((st) => (
                <li key={st.label}>
                  {/* In-page tabs (#projects) need a plain anchor so the hashchange reaches the tabs. */}
                  {/* The signed count is the number that matters here, so it stands out once there is one. */}
                  <a href={st.href} className={cn("block rounded-2xl border px-3 py-3 text-center transition active:scale-95", st.href === "#proof" && st.n > 0 ? "border-transparent bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] hover:bg-[color-mix(in_oklab,var(--ok)_18%,transparent)]" : "border-line bg-surface-2/60 hover:border-line-strong hover:bg-surface")}>
                    <span className={cn("block text-2xl font-semibold tracking-tight", st.href === "#proof" && st.n > 0 && "text-ok")}><CountUp to={st.n} /></span>
                    <span className="block text-xs text-muted">{st.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            {wins.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Challenge wins">
                {wins.slice(0, 3).map((w) => (
                  <Link key={w.challenge_id} href={`/challenges/${w.challenge_id}`} title={w.challenges?.title} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium transition hover:bg-hover">
                    <Trophy className="size-3.5 shrink-0" /> <span className="truncate">{["1st", "2nd", "3rd"][w.placement - 1]} · {w.challenges?.organizations?.name ?? "Sponsor"} challenge</span>
                  </Link>
                ))}
              </div>
            )}
            {verifiedBy.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Work verified by clubs">
                {verifiedBy.slice(0, 3).map(([cid, v]) => (
                  <Link key={cid} href={`/c/${cid}`} className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-3 py-1 text-xs font-medium text-ok transition hover:bg-[color-mix(in_oklab,var(--ok)_20%,transparent)]">
                    <BadgeCheck className="size-3.5" /> {v.n} verified by {v.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div id="about" className="scroll-mt-24">
            {mine ? <EditBasics headline={p.headline} bio={p.bio} /> : p.bio && <p className="mt-5 max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{p.bio}</p>}
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Proof leads: the work someone signed comes before everything else on the page. */}
          {msOn && <div id="proof" className="scroll-mt-24"><ProofTimeline items={proof} own={mine} /></div>}
          {mine ? (hideStrength ? null : <ProfileStrength steps={steps} />) : <SharedContext clubs={sharedClubs} mutual={mutual} mutualCount={mutualCount} />}
          {nowBuilding && (
            <Link href={`/projects/${nowBuilding.id}`} className="glass-card group flex flex-col rounded-3xl p-5 transition">
              <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-faint uppercase"><span className="size-1.5 animate-pulse rounded-full bg-text" /> Now building</span>
              <span className="mt-3 flex items-start gap-3">
                <span className="nav-tile grid size-10 shrink-0 place-items-center rounded-xl text-text-2"><ProjectIcon tools={nowBuilding.tools} className="size-5" /></span>
                <span className="min-w-0"><span className="block text-lg font-semibold tracking-tight group-hover:underline">{nowBuilding.title}</span><span className="mt-0.5 line-clamp-2 block text-sm text-text-2">{nowBuilding.summary}</span></span>
              </span>
            </Link>
          )}
          {mine && f.goals && record && <GoalCard goal={goal} record={record} profileId={p.id} />}

          <section id="projects" data-tour="projects-tab" className="scroll-mt-24">
            <SwitchTabs
              name="Profile"
              items={[
                {
                  id: "projects", label: "Projects", count: projects.length,
                  content: (
                    <>
                      {mine && <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl border border-dashed border-line-strong bg-surface/60 p-4"><p className="text-sm text-muted">Show what you&apos;ve built: a summary everyone sees, and a write-up you can keep private.</p><ProjectEditor interests={p.interests ?? []} copilot={copilotOn} stack={stackOn} specsOn={f.projectSpecs} /></div>}
                      <ProjectGrid projects={projects} own={mine} interests={p.interests ?? []} copilot={copilotOn} clubs={msOn && mine ? myClubs : undefined} vouches={f.vouches} stack={stackOn} specsOn={f.projectSpecs} />
                      {!projects.length && <EmptyState icon={<FolderGit2 className="size-6" />} title={mine ? "Show what you've built" : "No projects yet"} body={mine ? "Add a project with a summary, what you did and a link. Keep the write-up private and share only the card if you like." : undefined} />}
                      {projects.some((x) => x.private) && !mine && <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Lock className="size-3" /> Private projects show their card only.</p>}
                    </>
                  ),
                },
                {
                  id: "posts", label: "Posts", count: posts.length,
                  content: (
                    <div className="flex flex-col gap-4">
                      {posts.map((post, i) => <PostCard key={post.id} post={post} liked={liked.has(post.id)} own={mine} index={i} project={post.project_id ? byId[post.project_id] ?? null : null} replies={replies.get(post.id) ?? []} viewer={viewer} />)}
                      {!posts.length && <EmptyState icon={<MessageSquare className="size-6" />} title={mine ? "You haven't posted yet" : "No posts yet"} body={mine ? "Share an update, a question or a result from the feed." : undefined} action={mine ? <Link href="/feed" className="text-sm underline underline-offset-4">Go to the feed</Link> : undefined} />}
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </div>

        {/* The sidebar: who they are at a glance. Sticky on wide screens, after the work on phones. */}
        <aside aria-label={`About ${p.first_name || "this member"}`} className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {extrasOn && <div id="open-to" className="scroll-mt-24"><ExtrasCard openTo={openTo} location={p.location ?? ""} links={links} own={mine} /></div>}
          {skills.length > 0 && (
            <SideCard title={`Skills from ${mine ? "your" : "their"} work`}>
              <div className="flex flex-wrap gap-1.5">{skills.map(([t, n]) => <Link key={t} href={`/projects?tool=${encodeURIComponent(t)}`} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-2 transition hover:text-text">{t}{n > 1 && <span className="text-faint"> ×{n}</span>}</Link>)}</div>
            </SideCard>
          )}
          {clubs.length > 0 && (
            <SideCard title="Clubs">
              <ul className="space-y-1">
                {clubs.map((c) => (
                  <li key={c.id}>
                    <Link href={`/c/${c.id}`} className="-mx-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-hover">
                      <CommunityBadge id={c.id} name={c.name} size={28} logo={c.logo_path || null} accent={c.accent || null} />
                      <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                      {c.role !== "member" && <span className="text-[11px] text-faint capitalize">{c.role}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </SideCard>
          )}
          <SideCard title="Network">
            {followers.length > 0 && <MemberFaces faces={followers.map((x) => ({ uid: x.id, first: x.first, last: x.last }))} ids={followers.map((x) => x.id)} total={counts.followers ?? followers.length} size={28} />}
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {([["followers", counts.followers, "Followers"], ["following", counts.following, "Following"], ["connections", counts.connections, "Connections"]] as const).map(([tab, n, label]) => {
                const inner = <><span className="block text-lg font-semibold tabular-nums">{n ?? "—"}</span><span className="block text-[11px] text-muted">{label}</span></>;
                return mine ? <Link key={tab} href={`/network?tab=${tab}`} className="rounded-xl py-1.5 transition hover:bg-hover">{inner}</Link> : <div key={tab} className="py-1.5">{inner}</div>;
              })}
            </div>
          </SideCard>
          <SideCard title="Activity">
            <ActivityGrid dates={posts.map((x) => x.created_at)} now={requestTime()} />
          </SideCard>
          {p.interests?.length > 0 && (
            <SideCard title="Interests">
              <div className="flex flex-wrap gap-1.5">{p.interests.map((t) => <Link key={t} href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-text-2 transition hover:border-transparent hover:bg-accent-grad hover:text-on-accent">#{t}</Link>)}</div>
            </SideCard>
          )}
        </aside>
      </div>

      <div className="mt-12">
        <Suspense fallback={<StripSkeleton w={200} h={250} />}>
          <PeopleStrip field={p.field} interests={p.interests ?? []} exclude={[p.id]} title={p.field ? `More builders in ${p.field}` : "More builders like this"} />
        </Suspense>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-[440px]" />
      <Skeleton className="mt-8 h-12" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );
}
