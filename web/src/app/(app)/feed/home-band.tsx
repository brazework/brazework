import { ArrowRight, BadgeCheck, Eye, Flame, FolderGit2, GraduationCap, Users } from "lucide-react";
import Link from "next/link";
import { Ember } from "@/components/ember/ember";
import { dbFeatures } from "@/lib/db-features";
import { requestTime, cn } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";
import { ComposeLink } from "./compose-link";
import { pageTitleCls } from "@/components/app/page-ui";

// The top of Home (redesign 2026-11-26): the first thing anyone sees after signing in.
// - One glass panel with your name, where your record
//   stands (verified, waiting, your streak, who looked), and the one thing most worth doing now.
// - Then the places you go most, as tiles with what's live in each. A student (anyone placed at a
//   school by their email) leads with School and their classes; anyone else leads with Projects, and
//   Torch, the assistant, takes the fourth tile.
// The next step used to be its own strip under the greeting; it's the band's button now.
// `quiet`: no button, when the box right under the band already asks for the first project.
export async function HomeBand({ first, quiet = false }: { first: string; quiet?: boolean }) {
  const { supabase, user, profile } = await getViewer();
  if (!user) return null;
  const now = requestTime();
  const f = await dbFeatures();
  const professional = profile?.account_type === "professional";
  const [loop, projects, waiting, clubs, school, classes] = await Promise.all([
    loadLoop(supabase, user.id, now, professional),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    f.milestones ? supabase.from("milestones").select("id", { count: "exact", head: true }).eq("owner_id", user.id).in("status", ["pending", "disputed"]) : Promise.resolve({ count: 0 }),
    supabase.from("community_members").select("community_id, communities!inner(type)", { count: "exact", head: true }).eq("uid", user.id).neq("communities.type", "class"),
    supabase.rpc("my_school"),
    f.schoolPortal ? supabase.rpc("my_classes") : Promise.resolve({ data: [] }),
  ]);
  const s = school.data as { domain?: string; school?: string } | null;
  const atSchool = !!s?.domain;
  const schoolName = s?.school || s?.domain || "";
  const myClasses = (classes.data ?? []) as { id: string; course: string; term: string }[];
  const terms = [...new Set(myClasses.map((c) => c.term))];
  const thisTerm = terms[0] ? myClasses.filter((c) => c.term === terms[0]) : [];
  const nProjects = projects.count ?? 0, nWaiting = waiting.count ?? 0, nClubs = clubs.count ?? 0;
  const { goal, streak, viewers, verified } = loop;
  // The one thing to do: the weekly goal, or (when it's done) logging the next thing.
  // (The goal's text is already an instruction: "Verify 2 milestones for your club", "Add what you're building".)
  const cta = goal.done ? { text: "Log what you built", href: "/feed#composer" } : { text: goal.text, href: goal.href };

  const stats = [
    { icon: BadgeCheck, label: "verified", value: verified, tone: "text-ok" },
    { icon: null, label: "waiting", value: nWaiting, tone: "text-[#e2ad4f]" },
    { icon: Flame, label: "week streak", value: streak.weeks, tone: "text-[var(--brand)]" },
    { icon: Eye, label: "looked this week", value: viewers?.total ?? 0, tone: "text-text-2" },
  ];
  const tiles = atSchool
    ? [
        { href: "/school", icon: GraduationCap, label: "School", line: thisTerm.length ? `${thisTerm.length} ${thisTerm.length === 1 ? "class" : "classes"}` : schoolName, sub: thisTerm.length ? `${terms[0]} · ${thisTerm.map((c) => c.course).join(" · ")}` : "Your classes and verified clubs" },
        { href: "/projects", icon: FolderGit2, label: "Projects", line: `${nProjects} ${nProjects === 1 ? "project" : "projects"}`, sub: nWaiting ? `${nWaiting} waiting for a signature` : "Log what you finished" },
        { href: "/communities", icon: Users, label: "Clubs", line: `${nClubs} ${nClubs === 1 ? "club" : "clubs"}`, sub: nClubs ? "Events, chat and verification" : "Find your club" },
        { href: "/profile", icon: BadgeCheck, label: "Record", line: `${verified} verified`, sub: "What recruiters and your school see" },
      ]
    : [
        { href: "/projects", icon: FolderGit2, label: "Projects", line: `${nProjects} ${nProjects === 1 ? "project" : "projects"}`, sub: nWaiting ? `${nWaiting} waiting for a signature` : "Log what you finished" },
        { href: "/profile", icon: BadgeCheck, label: "Record", line: `${verified} verified`, sub: viewers?.total ? `${viewers.total} looked this week` : "Your signed work, in one place" },
        { href: "/communities", icon: Users, label: "Clubs and teams", line: `${nClubs} ${nClubs === 1 ? "group" : "groups"}`, sub: nClubs ? "Where your work gets signed" : "Find your club or team" },
        { href: "/copilot", icon: null, label: "Torch", line: "Ask Torch", sub: "Log work, draft updates, find people" },
      ];

  return (
    // One clean glass panel (2026-11-26, the founders' call: glass, no tiles): who you are and where
    // your record stands, the one next thing, then your places as a quiet row inside the same panel.
    <section aria-label="Where you stand" className="home-glass relative overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-7">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{atSchool ? [schoolName, terms[0]].filter(Boolean).join(" · ") : professional ? "Your record" : "Your work"}</p>
          <h1 className={cn(pageTitleCls, "mt-1.5")}>Welcome back, {first}</h1>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {stats.map((x) => (
              <div key={x.label} className="flex items-center gap-1.5">
                {x.icon ? <x.icon className={`size-4 ${x.tone}`} aria-hidden="true" /> : <span aria-hidden="true" className="block size-3.5 rounded-full border-2 border-dashed border-wait" />}
                <dd className="font-semibold text-text tabular-nums">{x.value}</dd>
                <dt className="text-muted">{x.label}</dt>
              </div>
            ))}
          </dl>
        </div>
        {!quiet && <ComposeLink href={cta.href} className="inline-flex h-11 max-w-full shrink-0 items-center gap-2 self-start rounded-xl bg-text px-4 text-sm font-semibold text-bg shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--text)_70%,transparent)] transition hover:opacity-90 active:scale-[0.98] sm:self-auto">
          <span className="truncate">{cta.text}</span> <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </ComposeLink>}
      </div>
      <nav aria-label="Your places" className="grid grid-cols-2 border-t border-[color-mix(in_oklab,var(--border)_70%,transparent)] lg:grid-cols-4">
        {tiles.map((t, i) => (
          <Link key={t.href} href={t.href} className={`group flex min-w-0 items-center gap-3 px-5 py-3.5 transition hover:bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] sm:px-6 ${i % 2 ? "border-l border-[color-mix(in_oklab,var(--border)_70%,transparent)]" : ""} ${i > 1 ? "border-t border-[color-mix(in_oklab,var(--border)_70%,transparent)] lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:border-[color-mix(in_oklab,var(--border)_70%,transparent)]" : ""}`}>
            <span className="grid size-8 shrink-0 place-items-center text-text-2 transition group-hover:text-text">
              {t.icon ? <t.icon className="icon-duo size-[18px]" aria-hidden="true" /> : <Ember size={20} />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted">{t.label}</span>
              <span className="block truncate text-sm font-semibold tracking-tight">{t.line}</span>
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
