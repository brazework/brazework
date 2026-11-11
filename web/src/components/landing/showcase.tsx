import { ArrowUpRight, BadgeCheck, CalendarDays, Check, Clock3, Eye, FileText, GitCommitHorizontal, Hash, Link2, MessageSquare, Play, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/forge";
import { Eyebrow, H2 } from "./marketing";
import { Reveal } from "./reveal";
import { Schematic } from "./schematics";

// The two things people come back for: a project page that is your proof, and a club that runs
// itself. Both are drawn as the real product would show them (example data, labelled).

const Avatar = ({ i, className }: { i: string; className?: string }) => (
  <span className={cn("grid size-7 place-items-center rounded-full border-2 border-surface bg-raised text-[10px] font-semibold text-text-2", className)}>{i}</span>
);

function Point({ icon: Icon, title, body }: { icon: typeof Check; title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-text"><Icon className="size-4" /></span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="m-hide mt-0.5 block text-sm leading-relaxed text-muted">{body}</span>
      </span>
    </li>
  );
}

const MILESTONES = [
  { title: "Measured lift on 3 airfoils", note: "Within 4% of the XFOIL prediction", by: "Maya Patel, President · Rocketry Club", when: "Nov 1", state: "verified" as const },
  { title: "Load cell calibrated to ±0.5%", note: "Evidence: commit 3f2a9c1 + calibration sheet", by: "Rachel Kim, Vice president · Rocketry Club", when: "Oct 18", state: "verified" as const },
  { title: "Full sweep from 0° to 12°", note: "Video attached · waiting on the club", by: "", when: "Today", state: "pending" as const },
];

export function ProjectShowcase() {
  return (
    <section id="projects" data-story="Projects" className="story-sec relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(60%_50%_at_70%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent)]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <Reveal>
          <Eyebrow>Projects</Eyebrow>
          <h2 className={cn("mt-5", H2)}>Your project page is <span className="text-grad">your proof.</span></h2>
          <p className="m-hide mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Every build gets a living page: photos and video with callouts, the specs, what it&apos;s built with, the team, and a timeline of milestones your club has signed. It&apos;s the link you send instead of a résumé, and it gets stronger every week you build.
          </p>
          <ul className="m-hide mt-8 grid gap-5">
            <Point icon={Play} title="Show it, don't claim it" body="Photos and video with callouts, before-and-after, specs like a peak L/D of 14.2. Anyone can see what you made." />
            <Point icon={ShieldCheck} title="Signed by the people who were there" body="Your club's officers verify each milestone with its evidence, and their name stays on it. Recruiters trust that more than any bullet point." />
            <Point icon={Eye} title="Get found by the work" body="Companies search verified projects by tool, field and spec, and you see who looked." />
          </ul>
        </Reveal>

        {/* The project page, as it looks in the product. */}
        <Reveal delay={0.1} className="relative">
          <div className="glass-card overflow-hidden rounded-[28px] shadow-[0_40px_120px_-40px_rgb(0_0_0/0.45)]">
            <div className="relative aspect-[16/8] overflow-hidden bg-[linear-gradient(135deg,#09090b,#1f1f22_55%,#09090b)] text-white/80 sm:aspect-[16/7]">
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:22px_22px]" />
              <Schematic id="aerospace" className="absolute top-1/2 left-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 text-white/70" />
              {/* Callouts pinned on the photo. */}
              <span className="absolute top-[22%] left-[14%] flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-black shadow-lg"><span className="grid size-4 place-items-center rounded-full bg-black text-[9px] text-white">1</span> Pitot tube</span>
              <span className="absolute right-[12%] bottom-[24%] flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-black shadow-lg"><span className="grid size-4 place-items-center rounded-full bg-black text-[9px] text-white">2</span> Load cell ±0.5%</span>
              <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur"><Play className="size-3 fill-current" /> 0:42 tunnel run</span>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold tracking-tight">Airfoil wind tunnel study</h3>
                  <p className="mt-0.5 text-xs text-faint">In progress · updated today · Rocketry Club</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-ok"><BadgeCheck className="size-3.5" /> 2 club-verified</span>
              </div>
              <div className="m-hide mt-4 grid grid-cols-3 gap-2">
                {[["Peak L/D", "14.2"], ["Angle of attack", "0–12°"], ["Load cell", "±0.5%"]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-surface-2/70 px-3 py-2"><div className="text-[11px] text-faint">{l}</div><div className="text-sm font-semibold">{v}</div></div>
                ))}
              </div>
              <div className="m-hide mt-4 flex flex-wrap items-center gap-1.5">
                {["SolidWorks", "ANSYS", "Python", "Arduino"].map((t) => <span key={t} className="rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-muted">{t}</span>)}
                <span className="ml-auto flex -space-x-2"><Avatar i="BC" /><Avatar i="MP" /><Avatar i="JM" /></span>
              </div>
              {/* The proof timeline: every milestone signed by a club officer. */}
              <ol className="relative mt-5 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line">
                {MILESTONES.map((m, i) => (
                  <li key={m.title} className={cn("relative flex gap-3 pl-0", i > 0 && "m-hide")}>
                    <span className={cn("relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", m.state === "verified" ? "bg-ok text-white" : "border border-dashed border-amber-500 bg-surface text-amber-600")}>
                      {m.state === "verified" ? <Check className="size-3.5" /> : <Clock3 className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{m.title}</span><span className="shrink-0 text-[11px] text-faint">{m.when}</span></div>
                      <p className="mt-0.5 truncate text-xs text-muted">{m.note}</p>
                      {m.state === "verified"
                        ? <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-ok"><BadgeCheck className="size-3" /> Verified by {m.by}</p>
                        : <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"><Clock3 className="size-3" /> Waiting on 1 officer</p>}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted"><Link2 className="size-3.5" /> Share link · in your résumé</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-text"><Eye className="size-3.5" /> 24 profile views this week</span>
              </div>
            </div>
          </div>
          {/* The moment it pays off. */}
          <div className="m-hide absolute -bottom-6 -left-6 hidden w-64 rotate-[-2deg] rounded-2xl border border-line bg-surface p-3.5 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.4)] sm:block">
            <div className="flex items-center gap-2 text-xs font-medium"><span className="grid size-6 place-items-center rounded-lg bg-accent-grad text-on-accent"><Sparkles className="size-3.5" /></span> Acme Aerospace</div>
            <p className="mt-2 text-sm leading-snug">&ldquo;Saw your verified wind tunnel results. Want to talk about a summer internship?&rdquo;</p>
          </div>
        </Reveal>
      </div>
      <p className="relative mt-10 text-center text-xs text-faint">Example data</p>
    </section>
  );
}

export function ClubShowcase() {
  return (
    <section id="clubs" data-story="Clubs" className="story-sec relative overflow-hidden bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        {/* The club, as its officers see it every week. */}
        <Reveal delay={0.1} className="order-2 lg:order-1">
          <div className="glass-card overflow-hidden rounded-[28px] p-5 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.45)] sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#ef4444,#f97316)] text-base font-bold text-white">R</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold">Rocketry Club <BadgeCheck className="size-4 text-ok" /></div>
                <div className="text-xs text-faint">48 members · 12 verified this term · UHart</div>
              </div>
              <span className="m-hide flex -space-x-2"><Avatar i="MP" /><Avatar i="BC" /><Avatar i="JM" /><Avatar i="+45" className="text-[9px]" /></span>
            </div>
            {/* Ember's Monday brief: what needs you, ready to approve. */}
            <div className="ai-border mt-5 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-accent" /> Your week, from Ember</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">3 milestones waiting for you to verify</span><span className="shrink-0 rounded-full bg-accent-grad px-2.5 py-1 text-xs font-medium text-on-accent">Review</span></li>
                <li className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">Weekly update drafted for Discord</span><span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium">Approve</span></li>
                <li className="m-hide flex items-center justify-between gap-3"><span className="min-w-0 truncate">Launch day Saturday: 18 going</span><span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium">Message</span></li>
              </ul>
            </div>
            {/* One tap verification, with the evidence right there. */}
            <div className="mt-4 rounded-2xl border border-line bg-surface/80 p-4">
              <div className="flex items-start gap-3">
                <Avatar i="JM" className="size-8 border-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm"><span className="font-medium">Josh Menzies</span> <span className="text-muted">asks the club to verify</span></div>
                  <div className="mt-0.5 font-medium">Measured lift on 3 fin shapes</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted"><GitCommitHorizontal className="size-3.5" /> commit 3f2a9c1 · <FileText className="size-3.5" /> wind-tunnel.csv</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-ok text-sm font-medium text-white"><Check className="size-4" /> Verify</span>
                <span className="inline-flex h-9 items-center justify-center rounded-full border border-line px-4 text-sm">Ask for more</span>
              </div>
            </div>
            <div className="m-hide mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-2/70 px-2 py-2.5"><CalendarDays className="mx-auto size-4 text-muted" /><div className="mt-1 text-sm font-semibold">Thu 7pm</div><div className="text-[11px] text-faint">Static fire night</div></div>
              <div className="rounded-xl bg-surface-2/70 px-2 py-2.5"><MessageSquare className="mx-auto size-4 text-muted" /><div className="mt-1 text-sm font-semibold">#general</div><div className="text-[11px] text-faint">Club chat</div></div>
              <div className="rounded-xl bg-surface-2/70 px-2 py-2.5"><Hash className="mx-auto size-4 text-muted" /><div className="mt-1 text-sm font-semibold">Discord</div><div className="text-[11px] text-faint">Connected</div></div>
            </div>
            {/* The record the club builds up, term after term. */}
            <div className="m-hide mt-4 rounded-2xl border border-line bg-surface/80 p-4">
              <div className="flex items-center justify-between text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><Trophy className="size-4 text-amber-500" /> Recently verified</span><span className="text-xs font-normal text-faint">by your officers</span></div>
              {[["Ben Cho", "Static fire at 1.2 kN", "Maya Patel"], ["Maya Patel", "Flight computer passed vibration test", "Ben Cho"], ["Josh Menzies", "Wind tunnel rig sealed", "Maya Patel"]].map(([who, what, by]) => (
                <div key={what} className="mt-2.5 flex items-center gap-2.5 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok text-white"><Check className="size-3" /></span>
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium">{who}</span> <span className="text-muted">· {what}</span></span>
                  <span className="m-hide shrink-0 text-[11px] text-faint">by {by}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <Eyebrow>Clubs</Eyebrow>
          <h2 className={cn("mt-5", H2)}>The club runs itself. <span className="text-grad">Members get results.</span></h2>
          <p className="m-hide mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Officers get one place for members, events, chat and announcements, with Ember doing the busywork every Monday. Members get the thing a club never had: proof of what they built, signed by the club, that follows them into every application.
          </p>
          <ul className="m-hide mt-8 grid gap-5">
            <Point icon={ShieldCheck} title="Verify in one tap" body="The evidence is right there: a commit, a dataset, a video. Verified milestones carry the officer's name, and they can be revoked with a reason." />
            <Point icon={Sparkles} title="Ember does the busywork" body="It drafts the weekly update, plans the meeting and nudges the members who need it. Officers approve every action." />
            <Point icon={Users} title="A term that keeps its momentum" body="Events with RSVPs and chats, Discord and GitHub connected, officer handoff at the end of term, and a sponsor report you can send." />
          </ul>
          <a href="#founding" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">Bring your club as a founding club <ArrowUpRight className="size-4" /></a>
        </Reveal>
      </div>
      <p className="mt-10 text-center text-xs text-faint">Example data</p>
    </section>
  );
}
