import { ArrowUpRight, Flame, BadgeCheck, CalendarDays, Check, Eye, FileText, GitBranch, GitCommitHorizontal, MessageSquare, Play, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/forge";
import { Eyebrow, H2 } from "./marketing";
import { Reveal } from "./reveal";
import { ProjectDeck } from "./project-deck";

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

export function ProjectShowcase() {
  return (
    <section id="projects" data-story="Projects" data-chapters="7" className="story-sec relative overflow-x-clip py-24 sm:py-32 md:h-[480vh] md:py-0">
      {/* Wide screens: pinned while the scroll deals the deck (project-deck.tsx). */}
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:sticky md:top-0 md:h-screen md:content-center md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <Reveal>
          <Eyebrow>Projects</Eyebrow>
          <h2 className={cn("mt-5", H2)}>Don&apos;t describe it. <span className="text-grad">Show the build.</span></h2>
          <p className="m-hide mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Every build gets its own page: the model you can turn, photos and video, the specs, what it&apos;s built with, and each result signed by someone who saw it. It&apos;s the link you send instead of a résumé, and it gets stronger every week you build.
          </p>
          <ul className="m-hide mt-8 grid gap-5">
            <Point icon={Play} title="Show it, don't claim it" body="Turn the model, watch the test, read the numbers: a peak L/D of 14.2, a gearbox that held 1.4 kN. Anyone can see what you made." />
            <Point icon={ShieldCheck} title="Signed by the people who were there" body="Your club's officers, or a professor, PI or manager who saw it, sign each milestone with its evidence, and their name stays on it. Recruiters trust that more than any bullet point." />
            <Point icon={Eye} title="Get found by the work" body="Companies search verified projects by tool, field and spec, and you see who looked." />
          </ul>
        </Reveal>

        {/* Project pages from every kind of builder, as a deck that deals itself. */}
        <Reveal delay={0.1} className="relative min-w-0">
          <ProjectDeck />
        </Reveal>
      </div>
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
              <span className="grid size-11 place-items-center rounded-2xl bg-text text-base font-bold text-bg">R</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold">Rocketry Club <BadgeCheck className="size-4 text-ok" /></div>
                <div className="text-xs text-faint">48 members · 12 verified this term · UHart</div>
              </div>
              <span className="m-hide flex -space-x-2"><Avatar i="MP" /><Avatar i="BC" /><Avatar i="JM" /><Avatar i="+45" className="text-[9px]" /></span>
            </div>
            {/* Ember's Monday brief: what needs you, ready to approve. */}
            <div className="ai-border mt-5 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Flame className="size-4 text-[#f28c28]" /> Your week, from Ember</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">3 milestones waiting for you to verify</span><span className="shrink-0 rounded-full bg-accent-grad px-2.5 py-1 text-xs font-medium text-on-accent">Review</span></li>
                <li className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">Weekly update drafted for the club</span><span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium">Approve</span></li>
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
                <span className="inline-flex h-9 items-center justify-center rounded-lg border border-line px-4 text-sm">Ask for more</span>
              </div>
            </div>
            <div className="m-hide mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-2/70 px-2 py-2.5"><CalendarDays className="mx-auto size-4 text-muted" /><div className="mt-1 text-sm font-semibold">Thu 7pm</div><div className="text-[11px] text-faint">Static fire night</div></div>
              <div className="rounded-xl bg-surface-2/70 px-2 py-2.5"><MessageSquare className="mx-auto size-4 text-muted" /><div className="mt-1 text-sm font-semibold">#general</div><div className="text-[11px] text-faint">Club chat</div></div>
              <div className="rounded-xl bg-surface-2/70 px-2 py-2.5"><GitBranch className="mx-auto size-4 text-muted" /><div className="mt-1 text-sm font-semibold">GitHub</div><div className="text-[11px] text-faint">Repos imported</div></div>
            </div>
            {/* The record the club builds up, term after term. */}
            <div className="m-hide mt-4 rounded-2xl border border-line bg-surface/80 p-4">
              <div className="flex items-center justify-between text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><Trophy className="size-4" /> Recently verified</span><span className="text-xs font-normal text-faint">by your officers</span></div>
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
            <Point icon={Users} title="A term that keeps its momentum" body="Events with RSVPs and chats, members' GitHub and AI tools connected, officer handoff at the end of term, and a sponsor report you can send." />
          </ul>
          <a href="#founding" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">Bring your club as a founding club <ArrowUpRight className="size-4" /></a>
        </Reveal>
      </div>
      <p className="mt-10 text-center text-xs text-faint">Example data</p>
    </section>
  );
}
