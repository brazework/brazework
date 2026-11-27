import { dbFeatures } from "@/lib/db-features";
import { rank } from "@/lib/communities";
import { reusableInvite, type InviteRow } from "@/lib/club-setup";
import { getViewer } from "@/lib/supabase/server";
import { clubPath, describeMember, loopSteps, type GuideStep } from "@/lib/guide-steps";

// The guide's "next best step" engine: plain checks against your real data, so it's instant and
// free. Copilot only comes in when you ask it to explain or draft something.

export type { GuideStep } from "@/lib/guide-steps";
export type ClubGuide = { id: string; name: string; steps: GuideStep[] };
// `loop`: the first five minutes, in the order of Brazework's loop (club → project → update →
// verification → proof). Home shows it until every step is done.
export type Guide = { member: GuideStep[]; clubs: ClubGuide[]; loop: GuideStep[] };

export type Club = { id: string; name: string; about: string; rules: string; member_count: number };

export async function loadGuide(): Promise<Guide | null> {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const f = await dbFeatures();
  const p = profile as typeof profile & { avatar_path?: string | null };

  const [memberships, projects, posts, milestones, projectPosts] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name, about, rules, member_count)").eq("uid", user.id).limit(50),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    f.milestones ? supabase.from("milestones").select("status").eq("owner_id", user.id).limit(200) : Promise.resolve({ data: [] as { status: string }[] }),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id).not("project_id", "is", null),
  ]);
  const rows = (memberships.data ?? []) as unknown as { role: string; communities: Club | Club[] | null }[];
  const mine = rows.flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []).map((c) => ({ ...c, role: r.role })));
  const ms = (milestones.data ?? []) as { status: string }[];
  // Students, and anyone in a club, get the club's steps; someone working with no club starts with the work (lib/guide-steps.ts).
  const student = profile.account_type !== "professional";
  const byClub = clubPath({ student, inClub: mine.length > 0 });

  const member: GuideStep[] = [
    ...(f.media ? [{ id: "photo", label: "Add a profile photo", done: !!p.avatar_path, href: "/profile", why: "People and clubs recognize you faster with a face." }] : []),
    { id: "headline", label: "Write your headline", done: !!p.headline?.trim(), href: "/settings#profile", why: "It's the first line everyone reads about you.", ask: `Suggest three sharp profile headlines for me, ${describeMember(p.field, student)}. Ask me what I'm working on if you need to.` },
    { id: "interests", label: "Pick at least 3 interests", done: (p.interests ?? []).length >= 3, href: "/settings#profile", why: "They decide what For you shows and who finds you." },
    ...(byClub ? [{ id: "club", label: "Join your club", done: mine.length > 0, href: "/communities?tab=discover", why: "Clubs are where your work gets seen and vouched for.", ask: "Which clubs on Brazework fit me best, and why?" }] : []),
    { id: "project", label: "Add a project", done: (projects.count ?? 0) > 0, href: "/profile#projects", why: "Projects are the heart of your profile.", ask: "Help me turn something I've built into a project: ask me a few questions, then draft a title and a one-line summary." },
    { id: "post", label: "Share your first post", done: (posts.count ?? 0) > 0, href: "/feed", why: "A post puts your work in front of your field.", ask: "Give me three ideas for a first post about what I'm building, based on my projects." },
    ...(f.milestones ? [
      { id: "ask-verify", label: byClub ? "Ask your club to verify a milestone" : "Ask someone who saw it to verify a milestone", done: ms.length > 0, href: "/profile#projects", why: byClub ? "A club-verified milestone is proof no résumé can fake." : "A milestone signed by a coworker or mentor is proof no résumé can fake.", ask: "Which of my project milestones would make a strong verified milestone, and how should I describe it?" },
      { id: "verified", label: "Get your first verified milestone", done: ms.some((m) => m.status === "verified"), href: "/profile#projects", why: byClub ? "It shows on your profile with your club's name on it." : "It shows on your profile with their name on it." },
    ] : []),
  ];

  const loop = loopSteps({
    student, inClub: mine.length > 0, hasProject: (projects.count ?? 0) > 0, hasUpdate: (projectPosts.count ?? 0) > 0,
    asked: ms.length > 0, verified: ms.some((m) => m.status === "verified"), milestones: f.milestones,
  });

  // Club setup, for the clubs you run (admin or owner). Bounded to keep the guide fast.
  const led = mine.filter((c) => rank(c.role) >= 4).slice(0, 3);
  const clubs: ClubGuide[] = await Promise.all(led.map(async (c) => ({ id: c.id, name: c.name, steps: await clubSetupSteps(supabase, f, c) })));

  return { member, clubs, loop };
}

// A club's setup checklist: the guide shows it for the clubs you run, and the club page shows it to
// its owner and admins until every step is done (app/(app)/c/[id]/setup.tsx).
type Supa = Awaited<ReturnType<typeof getViewer>>["supabase"];
type Features = Awaited<ReturnType<typeof dbFeatures>>;
export async function clubSetupSteps(supabase: Supa, f: Features, c: Club): Promise<GuideStep[]> {
  const [invites, events, clubPosts, reviewed] = await Promise.all([
    f.invites ? supabase.from("community_invites").select("code, expires_at, max_uses, uses, revoked").eq("community_id", c.id).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    f.clubEvents ? supabase.from("events").select("id", { count: "exact", head: true }).eq("community_id", c.id) : Promise.resolve({ count: 0 }),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("community_id", c.id),
    f.milestones ? supabase.from("milestones").select("id", { count: "exact", head: true }).eq("community_id", c.id).neq("status", "pending") : Promise.resolve({ count: 0 }),
  ]);
  const steps: GuideStep[] = [
    { id: "about", label: "Say what the club builds", done: (c.about ?? "").trim().length >= 40, href: `/c/${c.id}/manage?tab=settings`, why: "Members decide to join from this.", ask: `Write a short, concrete About for ${c.name}: what we build, when we meet, who should join. Ask me for details you don't have.` },
    { id: "rules", label: "Post your rules", done: (c.rules ?? "").trim().length > 0, href: `/c/${c.id}/manage?tab=settings`, why: "Clear rules make moderation easy.", ask: `Draft five short rules for ${c.name}, a university club on Brazework.` },
    ...(f.invites ? [{ id: "invite", label: "Create an invite link", done: !!reusableInvite((invites.data ?? []) as InviteRow[], Date.now()), href: `/c/${c.id}/manage?tab=invite`, why: "Share one link in your group chat and members land in the club." }] : []),
    { id: "members", label: "Reach 5 members", done: c.member_count >= 5, href: `/c/${c.id}/manage?tab=${f.invites ? "invite" : "members"}`, why: "A club feels alive once a few people are posting." },
    { id: "club-post", label: "Make the first club post", done: (clubPosts.count ?? 0) > 0, href: `/c/${c.id}`, why: "Show members what the club feed is for.", ask: `Draft a welcome post for ${c.name} that tells members what to share here.` },
    ...(f.clubEvents ? [{ id: "event", label: "Host your first event", done: (events.count ?? 0) > 0, href: `/c/${c.id}?tab=events`, why: "Build nights and demo days bring members back.", ask: `Draft a short event announcement for a ${c.name} build night.` }] : []),
    ...(f.milestones ? [{ id: "verify", label: "Verify a member's milestone", done: (reviewed.count ?? 0) > 0, href: `/c/${c.id}/manage?tab=verify`, why: "Your club's name on members' work is what makes Brazework different." }] : []),
  ];
  return steps;
}
