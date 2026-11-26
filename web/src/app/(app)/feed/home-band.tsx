import { ArrowRight, BadgeCheck, Eye, Flame, FolderGit2, GraduationCap, Users } from "lucide-react";
import Link from "next/link";
import { Ember } from "@/components/ember/ember";
import { Schematic } from "@/components/landing/schematics";
import { dbFeatures } from "@/lib/db-features";
import { requestTime } from "@/lib/forge";
import { schematicFor } from "@/lib/schematic-field";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";
import { ComposeLink } from "./compose-link";

// The top of Home (redesign 2026-11-26): the first thing anyone sees after signing in.
// - A dark drafting sheet (the same as profile and project banners) with your name, where your record
//   stands (verified, waiting, your streak, who looked), and the one thing most worth doing now.
// - Then the places you go most, as tiles with what's live in each. A student (anyone placed at a
//   school by their email) leads with School and their classes; anyone else leads with Projects, and
//   Torch, the assistant, takes the fourth tile.
// The next step used to be its own strip under the greeting; it's the band's button now.
export async function HomeBand({ first, field, interests }: { first: string; field: string; interests: string[] }) {
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
    { icon: BadgeCheck, label: "verified", value: verified, tone: "text-[#4ccb82]" },
    { icon: null, label: "waiting", value: nWaiting, tone: "text-[#e2ad4f]" },
    { icon: Flame, label: streak.weeks === 1 ? "week streak" : "week streak", value: streak.weeks, tone: "text-[#f0a57e]" },
    { icon: Eye, label: "looked this week", value: viewers?.total ?? 0, tone: "text-white/70" },
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
    <section aria-label="Where you stand" className="flex flex-col gap-3">
      <div className="theme-dark cover-blueprint relative isolate overflow-hidden rounded-2xl border border-white/10 text-text">
        <Schematic id={schematicFor([field, ...interests], [])} className="sch-draw pointer-events-none absolute top-1/2 right-[-4%] -z-10 hidden h-[120%] w-auto -translate-y-1/2 text-[#f0a57e] opacity-35 sm:block" />
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div>
            <p className="font-mono text-[11px] tracking-[0.12em] text-white/55 uppercase">{atSchool ? [schoolName, terms[0]].filter(Boolean).join(" · ") : professional ? "Your record" : "Your work"}</p>
            <h1 className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] sm:text-[2.25rem]">Welcome back, {first}</h1>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {stats.map((x) => (
              <div key={x.label} className="flex items-center gap-1.5">
                {x.icon ? <x.icon className={`size-4 ${x.tone}`} aria-hidden="true" /> : <span aria-hidden="true" className="block size-3.5 rounded-full border-2 border-dashed border-[#e2ad4f]" />}
                <dd className="font-semibold text-white tabular-nums">{x.value}</dd>
                <dt className="text-white/65">{x.label}</dt>
              </div>
            ))}
          </dl>
          <ComposeLink href={cta.href} className="inline-flex h-11 max-w-full items-center gap-2 self-start rounded-xl bg-white px-4 text-sm font-semibold text-[#0b0c0e] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)] transition hover:bg-white/90 active:scale-[0.98]">
            <span className="truncate">{cta.text}</span> <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </ComposeLink>
        </div>
      </div>

      <nav aria-label="Your places" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="glass-card group flex min-w-0 flex-col rounded-2xl p-3.5 transition sm:p-4">
            <span className="nav-icon grid size-8 place-items-center rounded-lg text-text-2 transition group-hover:text-text sm:size-9">
              {t.icon ? <t.icon className="icon-duo size-[18px]" aria-hidden="true" /> : <Ember size={22} />}
            </span>
            <span className="mt-2.5 text-xs text-muted sm:mt-3">{t.label}</span>
            <span className="mt-0.5 truncate font-semibold tracking-tight">{t.line}</span>
            <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">{t.sub}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
