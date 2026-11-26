import { githubConfig } from "@/lib/github-app";
import { canUse } from "@/lib/plans";
import type { Metadata } from "next";
import { ReportLink } from "@/components/report/report-dialog";
import { BadgeCheck, BarChart3, ChevronDown, ClipboardList, Eye, FileText, FolderGit2, Lock, MapPin, MessageSquare, Trophy } from "lucide-react";
import { MoreMenu } from "@/components/app/more-menu";
import { RecordCard } from "@/components/profile/record-card";
import { buildTimeline } from "@/lib/record-timeline";
import { buildYears } from "@/lib/record-years";
import { goalTitle } from "@/lib/goals";
import { CommunityBadge } from "../../communities/_components/badge";
import { requestTime } from "@/lib/forge";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ConfidentialWork } from "./confidential-work";
import { CopyLink } from "@/components/app/copy-link";
import { signersFor, type MemberRow } from "@/lib/signers";
import { PlaceTabsRow } from "@/components/app/place-tabs";
import { OwnProofTabs } from "@/components/app/place-tabs-counted";
import { GoalCard, GoalLine } from "@/components/app/goal-card";
import { loadGoal, loadRecord } from "@/lib/goal-load";
import { Seal } from "@/components/app/verified-seal";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { MemberFaces } from "@/components/network/member-faces";
import { classOf, openToLabel, type ProfileLink } from "@/lib/profile-meta";
import { ExtrasCard } from "./extras-client";
import { studyProof } from "@/lib/study";
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
import { EditProfile, ProjectEditor, ProjectGrid, type ProjectView } from "./profile-client";
import type { Club, Milestone } from "./milestones";
import { FirstMilestoneWelcome } from "./welcome";

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
  const sp = await searchParams;
  const preview = own && sp.view === "visitor";
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
    supabase.from("projects").select(`id, title, summary, status, year, tags, private, updated_at${stackOn ? ", tools" : ""}${f.clubProjects ? ", club:communities(id, name)" : ""}`).eq("owner_id", id).order("created_at", { ascending: false }).limit(100),
    // Milestones (supabase/milestones.sql): others only get verified ones back, the owner gets all of theirs.
    msOn ? supabase.from("milestones").select(await milestoneCols()).eq("owner_id", id).order("achieved_on", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    supabase.from("community_members").select(`role, communities!inner(${clubCols})`).eq("uid", id).neq("communities.type", "class").limit(12),
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
  // Club projects they build on (supabase/club-projects.sql): teammates and project admins get them on
  // their own record, marked "with <club>". They don't run them, so no edit controls here.
  type Row = Omit<ProjectView, "details" | "link"> & { tools?: string[] };
  const teamRes = f.clubProjects
    ? await supabase.from("project_members").select(`role, projects!inner(id, title, summary, status, year, tags, private, updated_at, owner_id, community_id${stackOn ? ", tools" : ""}, club:communities(id, name))`).eq("uid", id).in("role", ["admin", "member"]).not("projects.community_id", "is", null).limit(100)
    : { data: [] };
  const teamRows: Row[] = ((teamRes.data ?? []) as unknown as { projects: (Row & { owner_id: string; community_id?: string }) | null }[])
    .flatMap((r) => (r.projects && r.projects.owner_id !== id ? [{ ...r.projects, canEdit: false }] : []));
  const projectRows = [...((projectsRes.data ?? []) as unknown as Row[]), ...teamRows].filter((r) => !preview || !r.private);
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
  // Their LinkedIn, only if they chose to show it (supabase/linkedin-public.sql); an error before that step runs.
  const [goal, record, liRes] = await Promise.all([goalP, recordP, supabase.rpc("profile_linkedin", { p_id: id })]);
  const linkedinUrl = !liRes.error && typeof liRes.data === "string" && liRes.data.startsWith("https://www.linkedin.com/in/") ? liRes.data : null;
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
  // Work verified in a class (supabase/school-portal.sql) says its term too: "ME 410 · Capstone Design · Fall 2026".
  const signedIn = [...new Set(ms.filter((m) => m.status === "verified" && m.community_id).map((m) => m.community_id as string))];
  const { data: classRows } = signedIn.length && f.schoolPortal ? await supabase.from("communities").select("id, term").eq("type", "class").in("id", signedIn) : { data: [] };
  const termOf = new Map(((classRows ?? []) as { id: string; term: string }[]).filter((c) => c.term).map((c) => [c.id, c.term]));
  const where = (m: { community_id: string | null; community_name: string }) => (m.community_id && termOf.has(m.community_id) ? `${m.community_name} · ${termOf.get(m.community_id)}` : m.community_name);
  const proofBase: ProofItem[] = ms.filter((m) => m.status === "verified" && titles.has(m.project_id)).map((m) => ({ id: m.id, title: m.title, detail: m.detail, achieved_on: m.achieved_on, community_id: m.community_id, community_name: where(m), reviewer_name: m.reviewer_name, vouched_by: m.vouched_by, project: { id: m.project_id, title: titles.get(m.project_id)! } }));
  // Pro sign-offs (supabase/pro-verification.sql): an engineer's name, title, employer and note. Work
  // they signed comes first: Pro-verified, then club-verified (Linear FIX-72).
  type ProRow = { milestone_id: string; reviewer_name: string; reviewer_title: string; employer_name: string; note: string; created_at: string };
  const { data: proRows } = f.proVerification && proofBase.length ? await supabase.from("pro_reviews").select("milestone_id, reviewer_name, reviewer_title, employer_name, note, created_at").in("milestone_id", proofBase.map((m) => m.id)).order("created_at", { ascending: true }).limit(200) : { data: [] };
  const proBy = new Map<string, ProofItem["pro"]>();
  for (const r of (proRows ?? []) as ProRow[]) proBy.set(r.milestone_id, [...(proBy.get(r.milestone_id) ?? []), { name: r.reviewer_name, title: r.reviewer_title, employer: r.employer_name, note: r.note, at: r.created_at }]);
  const proof: ProofItem[] = proofBase.map((m) => ({ ...m, pro: proBy.get(m.id) })).sort((a, b) => Number(Boolean(b.pro?.length)) - Number(Boolean(a.pro?.length)));
  // Study groups they led, as the members confirmed it (supabase/study-groups.sql).
  const { data: ledRows } = f.studyGroups ? await supabase.from("study_leads").select("community_id, leader, confirmed_by, created_at, communities(name, course, term)").eq("leader", id).limit(500) : { data: [] };
  const led = studyProof((ledRows ?? []) as unknown as Parameters<typeof studyProof>[0]);
  // The clubs behind the proof (vouched-for milestones have no club, so they're not counted here).
  const verifiedBy = [...proof.filter((m): m is ProofItem & { community_id: string } => !!m.community_id).reduce((acc, m) => acc.set(m.community_id, { name: m.community_name, n: (acc.get(m.community_id)?.n ?? 0) + 1 }), new Map<string, { name: string; n: number }>())].sort((a, b) => b[1].n - a[1].n);

  const name = `${p.first_name} ${p.last_name}`.trim();
  const joined = new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const openTo = p.open_to ?? [];
  const links = p.links ?? [];
  const waiting = ms.filter((m) => m.status === "pending").length;
  // Backed by GitHub with nobody asked to sign (supabase/backed.sql): its own count, in its own colour.
  const isBacked = (m: Milestone) => (Array.isArray(m.milestone_backings) ? m.milestone_backings.length > 0 : !!m.milestone_backings);
  const backedCount = ms.filter((m) => m.status === "logged" && isBacked(m)).length;
  // The record over time (lib/record-timeline.ts): projects as lanes, signed work on its dates. Built
  // from what this viewer may see: visitors get public projects and verified work only.
  const timeline = msOn ? buildTimeline({ now: requestTime(), own: mine, projects: projectRows.filter((r) => mine || !r.private), milestones: ms.map((m) => ({ ...m, backed: isBacked(m) })), posts }) : null;
  // The record by year (lib/record-years.ts), once it reaches past what the 12-month chart draws. The
  // same rows and the same rule on who sees what.
  const recordYears = msOn ? buildYears({ now: requestTime(), own: mine, projects: projectRows.filter((r) => mine || !r.private), milestones: ms.map((m) => ({ ...m, backed: isBacked(m) })) }) : null;
  // Your goal, on your own chart (visitors see it in the header line instead).
  const goalText = goal && goal.status === "active" ? goalTitle(goal) : null;
  const stats: { n: number; label: string; href: string }[] = [
    ...(msOn ? [{ n: proof.length + led.length, label: proof.length + led.length === 1 ? "Signed result" : "Signed results", href: "#proof" }] : []),
    { n: projects.length, label: projects.length === 1 ? "Project" : "Projects", href: "#projects" },
    { n: posts.length, label: posts.length === 1 ? "Post" : "Posts", href: "#posts" },
  ];
  const followers = ((followRows.data ?? []) as { follower: string; follower_info: { firstName?: string; lastName?: string } }[]).map((x) => ({ id: x.follower, first: x.follower_info?.firstName ?? "", last: x.follower_info?.lastName ?? "" }));
  const mutual = ((mutualRes.data ?? []) as { follower_info: { firstName?: string; lastName?: string } }[]).map((x) => `${x.follower_info?.firstName ?? ""} ${x.follower_info?.lastName ?? ""}`.trim());
  const mutualCount = (mutualRes as { count?: number | null }).count ?? mutual.length;
  const sharedClubs = own ? [] : clubs.filter((c) => myClubs.some((m) => m.id === c.id));
  // Now building: their most recently updated project that's still in progress (public, unless it's you).
  // Skills from their work: the tools across their projects, most used first.
  const skills = [...projectRows.flatMap((x) => x.tools ?? []).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const steps: Step[] = [
    ...(mediaOn ? [{ done: !!p.avatar_path, label: "Add a profile photo", href: "#top" }] : []),
    { done: !!p.headline, label: "Write a headline", href: "#edit-profile" },
    { done: !!p.bio, label: "Add a short bio", href: "#edit-profile" },
    { done: projects.length > 0, label: "Add a project", href: "#projects" },
    ...(stackOn ? [{ done: projectRows.some((x) => (x.tools ?? []).length > 0), label: "Say what you built with", href: "#projects" }] : []),
    ...(msOn ? [{ done: proof.length > 0, label: "Get a milestone verified", href: "#proof" }] : []),
    ...(extrasOn ? [{ done: openTo.length > 0, label: "Say what you're open to", href: "#open-to" }, { done: links.length > 0, label: "Add your GitHub or a link", href: "#open-to" }] : []),
    { done: clubs.length > 0, label: "Join a club", href: "/communities?tab=discover" },
    { done: posts.length > 0, label: "Share your first post", href: "/feed#composer" },
  ];

  return (
    <div id="top" className="scroll-mt-24">
      {/* Your own profile is the first page of Record: its other pages are a click away (lib/places.ts). */}
      {mine && <Suspense fallback={<PlaceTabsRow place="record" active="profile" />}><OwnProofTabs /></Suspense>}
      {mine && sp.welcome === "1" && <FirstMilestoneWelcome supabase={supabase} userId={user.id} milestone={typeof sp.result === "string" ? ms.find((m) => m.id === sp.result) : ms[0]} student={p.account_type === "student"} />}
      {preview && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl border border-line bg-surface-2/70 px-4 py-3 text-sm text-text-2">
          <Eye className="mt-0.5 size-4 shrink-0" /> This is how other members see your profile. Private projects, private milestones and anything not yet verified are left out.
        </p>
      )}
      <Panel className="relative overflow-hidden rounded-2xl p-0">
        <CoverBanner path={p.cover_path} editable={mine && mediaOn} userId={user.id} label={[p.field, p.grad_year ? classOf(p.grad_year) : ""].filter(Boolean).join(" · ")} />
        <div className="px-5 pb-5 sm:px-6">
          <div className="pointer-events-none relative z-10 -mt-10 flex flex-wrap items-end justify-between gap-3 *:pointer-events-auto">
            <div className="inline-flex rounded-full shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)] ring-4 ring-surface">
              <WithPresence id={p.id} dot="size-5 ring-4 top-[4%] bottom-auto"><ProfilePhoto path={p.avatar_path} first={p.first_name} last={p.last_name} editable={mine && mediaOn} userId={user.id} size={80} /></WithPresence>
            </div>
            <div data-tour={mine ? "share" : undefined} className="flex flex-wrap items-center gap-2">
              {mine && <EditProfile headline={p.headline} bio={p.bio} />}
              <CopyLink path={`/u/${p.id}`} label="Share" />
              <Link href={`/u/${p.id}/resume`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm transition hover:bg-hover active:scale-95"><FileText className="size-4" /> Résumé</Link>
              {mine ? (
                <MoreMenu tour="analytics" label="More profile actions" items={[
                  { href: "/dashboard", label: "Dashboard", icon: <BarChart3 /> },
                  { href: `/u/${p.id}?view=visitor`, label: "Preview as a visitor", icon: <Eye /> },
                  // The review packet (lib/review-packet.ts): your signed work over a period, for a performance review.
                  ...(canUse("reviewPacket", user) ? [{ href: `/u/${p.id}/review`, label: "Review packet", icon: <ClipboardList /> }] : []),
                ]} />
              ) : preview ? (
                <Link href={`/u/${p.id}`} className="bg-text inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-surface transition active:scale-95">Done previewing</Link>
              ) : (
                rel && <ConnectButtons personId={p.id} firstName={p.first_name} relationship={rel} />
              )}
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-3"><h1 className="text-[1.65rem] leading-tight font-semibold tracking-[-0.03em] sm:text-[2rem]">{name || "Brazework member"}</h1><OnlineLabel id={p.id} /></div>
          {p.headline && <p className="mt-0.5 text-[15px] text-text-2 sm:text-base">{p.headline}</p>}
          {goal && !mine && <div className="mt-2.5"><GoalLine goal={goal} /></div>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
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

          {/* The record in one row (profile redesign, Nov 19): signed results lead in the seal's green, then
              projects and posts; yours also says what's waiting and who looked this month. */}
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-line pt-3.5">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted" aria-label="Record">
              {stats.map((st) => (
                <a key={st.href} href={st.href} className="inline-flex items-center gap-1.5 transition hover:text-text">
                  {st.href === "#proof" && st.n > 0 && <Seal size={15} />}
                  <span className={st.href === "#proof" && st.n > 0 ? "font-semibold text-ok tabular-nums" : "font-semibold text-text tabular-nums"}>{st.n}</span> {st.label.toLowerCase()}
                </a>
              ))}
              {/* One colour per kind of proof (docs/design/app.md): blue for backed, dashed amber for waiting. */}
              {backedCount > 0 && <a href="#projects" className="inline-flex items-center gap-1.5 transition hover:text-text"><span aria-hidden="true" className="block size-2 rotate-45 rounded-[2px] bg-info" /><span className="font-semibold text-info tabular-nums">{backedCount}</span> backed by GitHub</a>}
              {mine && waiting > 0 && <a href="#proof" className="inline-flex items-center gap-1.5 transition hover:text-text"><span aria-hidden="true" className="block size-2.5 rounded-full border-[1.5px] border-dashed border-wait" /><span className="font-semibold text-wait tabular-nums">{waiting}</span> waiting to be signed</a>}
              {mine && record && (record.looked
                ? <Link href="/dashboard" className="inline-flex items-center gap-1.5 transition hover:text-text"><Eye className="size-3.5" /><span className="font-semibold text-text tabular-nums">{record.looked}</span> looked this month</Link>
                : null)}
            </p>
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

          {/* LinkedIn (supabase/linkedin-public.sql): shown only when its owner turned it on in Settings. */}
          {linkedinUrl ? (
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer me" data-linkedin className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-2 transition hover:text-text hover:underline">
              <LinkedinMark /> LinkedIn
            </a>
          ) : mine && !liRes.error ? (
            <Link href="/settings#profile" className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"><LinkedinMark /> Show your LinkedIn here</Link>
          ) : null}

          <div id="about" className="scroll-mt-24">
            {p.bio ? <p className="mt-5 max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{p.bio}</p> : mine && <p className="mt-5 text-sm text-muted">Add a short bio so people know what you work on.</p>}
          </div>
        </div>
      </Panel>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Proof leads: the work someone signed comes before everything else on the page. */}
          {/* The record as one card: the last twelve months, or by year (components/profile/record-card.tsx). */}
          {(timeline || recordYears) && <RecordCard timeline={timeline} years={recordYears} own={mine} goal={mine ? goalText : null} ember={!!copilotOn} />}
          {msOn && <div id="proof" data-tour="proof" className="scroll-mt-24"><ProofTimeline items={proof} own={mine} led={led} /></div>}
          {/* Projects, with their milestones, straight after the proof (they sat below everything else). */}
          <section id="projects" data-tour="projects-tab" className="scroll-mt-24">
            <SwitchTabs
              name="Profile"
              items={[
                {
                  id: "projects", label: "Projects", count: projects.length,
                  content: (
                    <>
                      {mine && <div className="mb-3 flex justify-end"><ProjectEditor interests={p.interests ?? []} copilot={copilotOn} stack={stackOn} specsOn={f.projectSpecs} /></div>}
                      <details open className="group/projects">
                        <summary className="mb-3 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-hover [&::-webkit-details-marker]:hidden">
                          <FolderGit2 aria-hidden="true" className="size-4 text-muted" />
                          Project list
                          <ChevronDown aria-hidden="true" className="ml-auto size-4 text-muted transition-transform group-open/projects:rotate-180" />
                        </summary>
                        <ProjectGrid projects={projects} own={mine} field={p.field} interests={p.interests ?? []} copilot={copilotOn} clubs={msOn && mine ? myClubs : undefined} vouches={f.vouches} backing={f.backed && !!githubConfig()} stack={stackOn} specsOn={f.projectSpecs} />
                        {!projects.length && <EmptyState icon={<FolderGit2 className="size-6" />} title={mine ? "Show what you've built" : "No projects yet"} body={mine ? "Add a project with a summary, what you did and a link. Keep the write-up private and share only the card if you like." : undefined} />}
                        {projects.some((x) => x.private) && !mine && <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Lock className="size-3" /> Private projects show their card only.</p>}
                      </details>
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
          {mine ? (hideStrength ? null : <ProfileStrength steps={steps} />) : <SharedContext clubs={sharedClubs} mutual={mutual} mutualCount={mutualCount} />}
          {mine && f.goals && record && <GoalCard goal={goal} record={record} profileId={p.id} accountType={p.account_type} />}

          {/* Proof without revealing (redacted-proof.sql): private signed work, as one line each. */}
          {f.redactedProof && <Suspense fallback={null}><ConfidentialWork member={p.id} mine={mine} /></Suspense>}
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
          {(followers.length > 0 || (counts.followers ?? 0) + (counts.following ?? 0) + (counts.connections ?? 0) > 0) && <SideCard title="Network">
            {followers.length > 0 && <MemberFaces faces={followers.map((x) => ({ uid: x.id, first: x.first, last: x.last }))} ids={followers.map((x) => x.id)} total={counts.followers ?? followers.length} size={28} />}
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {([["followers", counts.followers, "Followers"], ["following", counts.following, "Following"], ["connections", counts.connections, "Connections"]] as const).map(([tab, n, label]) => {
                const inner = <><span className="block text-lg font-semibold tabular-nums">{n ?? "—"}</span><span className="block text-[11px] text-muted">{label}</span></>;
                return mine ? <Link key={tab} href={`/network?tab=${tab}`} className="rounded-xl py-1.5 transition hover:bg-hover">{inner}</Link> : <div key={tab} className="py-1.5">{inner}</div>;
              })}
            </div>
          </SideCard>}
          {p.interests?.length > 0 && (
            <SideCard title="Interests">
              <div className="flex flex-wrap gap-1.5">{p.interests.map((t) => <Link key={t} href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-text-2 transition hover:border-transparent hover:bg-text hover:text-surface">#{t}</Link>)}</div>
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
      <Skeleton className="h-[340px]" />
      <Skeleton className="mt-8 h-12" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );
}

// LinkedIn's "in" mark, drawn plain in the text colour (the icon set has no brand icons).
function LinkedinMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0" fill="currentColor">
      <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" />
      <rect x="3.5" y="6.5" width="2" height="6" rx="0.4" />
      <circle cx="4.5" cy="4.3" r="1.15" />
      <path d="M7.5 6.5h1.9v.9c.4-.7 1.2-1.1 2.1-1.1 1.6 0 2.1 1 2.1 2.6v3.6h-2V9.3c0-.8-.2-1.3-.9-1.3-.8 0-1.2.6-1.2 1.4v3.1h-2z" />
    </svg>
  );
}
