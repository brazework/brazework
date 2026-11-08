import { ArrowRight, BadgeCheck, BarChart3, CalendarDays, Check, FolderGit2, Inbox, ShieldCheck, Users, Wrench } from "lucide-react";
import { Button, Kicker } from "@/components/ui";
import { SparkField } from "./spark-field";
import { Reveal } from "./reveal";
import { AudienceTabs, Faq } from "./marketing-client";

// The marketing landing page, section by section. Server components; the two interactive bits
// (audience tabs, FAQ) live in marketing-client.tsx. No invented numbers: every figure is sourced.

const H2 = "text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.035em]";

export function MarketingHero() {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="bg-blueprint absolute inset-0 -z-20" />
      <div className="absolute top-[-25%] left-1/2 -z-20 h-[640px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
      <SparkField className="absolute inset-0 -z-10 size-full opacity-70" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <div>
          <a href="#founding" className="rise-in group glass inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-xs text-text-2">
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] tracking-wider whitespace-nowrap text-on-accent uppercase">Founding clubs</span>
            <span className="truncate">Now onboarding university STEM clubs</span>
            <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
          </a>
          <h1 className="focus-in mt-7 text-[clamp(2.5rem,5.4vw,4.4rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
            Run your club.
            <br />
            Show your work.
            <br />
            <span className="text-shine">Get hired for it.</span>
          </h1>
          <p className="focus-in mt-7 max-w-xl text-lg leading-relaxed text-muted" style={{ ["--delay" as string]: "0.1s" }}>
            Forge is the professional network for STEM, built around clubs. Your club runs its posts, roles and events in one place, every member&apos;s projects become proof of what they can do, and the companies that care can finally see it.
          </p>
          <div className="rise-in mt-9 flex flex-wrap items-center gap-3" style={{ ["--delay" as string]: "0.25s" }}>
            <Button href="#founding" size="lg">Bring your club <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Button>
            <Button href="/signup" variant="outline" size="lg">Join as a student</Button>
          </div>
          <p className="rise-in mt-5 font-mono text-xs text-faint" style={{ ["--delay" as string]: "0.35s" }}>Free for students and clubs · Verified with your university email</p>
        </div>
        <div className="rise-in" style={{ ["--delay" as string]: "0.2s" }}><ClubMock /></div>
      </div>
    </section>
  );
}

// A static picture of a club on Forge: what a club leader is signing up for.
function ClubMock() {
  return (
    <div className="relative">
      <div className="glass overflow-hidden rounded-[22px] shadow-[var(--shadow)]">
        <div className="bg-blueprint relative h-24 border-b border-line">
          <span className="absolute right-3 bottom-2 rounded-full border border-line bg-surface/80 px-2 py-0.5 font-mono text-[10px] text-faint">Sample</span>
        </div>
        <div className="p-5">
          <div className="-mt-12 flex items-end gap-3">
            <span className="grid size-16 place-items-center rounded-2xl border-4 border-surface bg-accent text-xl font-semibold text-on-accent">RC</span>
            <div className="pb-1">
              <div className="font-semibold">State Rocketry Club</div>
              <div className="text-xs text-faint">48 members · Engineering · Project team</div>
            </div>
          </div>
          <div className="mt-4 flex gap-1 text-xs">
            {["Posts", "Events", "About"].map((t, i) => <span key={t} className={i === 0 ? "rounded-full bg-accent px-3 py-1 text-on-accent" : "rounded-full px-3 py-1 text-muted"}>{t}</span>)}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
            <span className="flex w-11 flex-col items-center rounded-lg bg-raised py-1"><span className="font-mono text-[9px] text-muted uppercase">Sat</span><span className="text-base leading-none font-semibold">14</span></span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">Static fire test #4</div><div className="text-xs text-faint">Club event · 23 going</div></div>
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-on-accent">RSVP</span>
          </div>
          <div className="mt-3 rounded-2xl border border-line p-3">
            <div className="flex items-center gap-2 text-sm"><span className="grid size-7 place-items-center rounded-full bg-raised text-[10px] font-semibold">MO</span><span className="font-medium">Maya O.</span><span className="text-xs text-faint">· Propulsion lead</span></div>
            <p className="mt-2 text-sm text-text-2">Regen-cooled chamber held for 30 s. Thermal data says the next throat can go thinner.</p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="size-3.5" /> Milestone attested by the club</div>
          </div>
        </div>
      </div>
      <div className="glass absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl px-3 py-2 text-xs shadow-[var(--shadow)] sm:flex">
        <BadgeCheck className="size-4" /> A verified company followed Maya
      </div>
    </div>
  );
}

// Three sourced facts. Sources open in a new tab; full brief in docs/positioning.md.
const FACTS = [
  { n: "3×", label: "more applications per job than in 2021, and 91% of recruiters have caught candidates misrepresenting themselves.", src: "Greenhouse, 2025", href: "https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair" },
  { n: "1 in 4", label: "candidate profiles are expected to be fake by 2028, as AI makes polished résumés free.", src: "Gartner via HR Dive", href: "https://www.hrdive.com/news/fake-job-candidates-ai/757126/" },
  { n: "54%", label: "of long-form posts from top LinkedIn profiles in 2025 were likely written by AI.", src: "Originality.ai", href: "https://ppc.land/over-half-of-linkedin-posts-are-now-likely-ai-but-authenticity-still-wins/" },
];

export function Problem() {
  return (
    <section className="border-y border-line bg-surface/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <Kicker>The problem</Kicker>
          <h2 className={`mt-4 ${H2}`}>Hiring stopped trusting résumés. <span className="text-shine">Students are paying for it.</span></h2>
          <p className="mt-5 text-lg text-muted">Anyone can generate a perfect résumé now. What still cuts through is real work that someone saw happen, and today that work lives in Discord threads and group chats where no one can find it.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {FACTS.map((f, i) => (
            <Reveal key={f.n} delay={i * 0.06} className="flex flex-col rounded-3xl border border-line bg-surface/70 p-7">
              <div className="text-5xl font-semibold tracking-tight tabular-nums">{f.n}</div>
              <p className="mt-3 flex-1 text-text-2">{f.label}</p>
              <a href={f.href} target="_blank" rel="noopener noreferrer" className="mt-5 font-mono text-[11px] text-faint underline-offset-4 hover:text-text hover:underline">Source: {f.src} ↗</a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Users, title: "Your club runs on Forge", body: "Posts, roles from owner to helper, join requests, moderation, events and invite links. One place instead of a Discord server, a Google Form and a group chat." },
  { icon: FolderGit2, title: "Members show the work", body: "Projects with write-ups, results with data, questions with answers. The club vouches for milestones it saw happen, so profiles carry proof, not adjectives." },
  { icon: BadgeCheck, title: "The right people find it", body: "Verified companies and schools follow builders, host events and reach out through a request inbox. Members land roles, and bring the next club." },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 sm:py-28">
      <Reveal className="max-w-3xl">
        <Kicker>How it works</Kicker>
        <h2 className={`mt-4 ${H2}`}>One club is enough <span className="text-shine">to start the loop.</span></h2>
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06} className="relative rounded-3xl border border-line bg-surface/70 p-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent text-on-accent"><s.icon className="size-5" /></span>
                <span className="font-mono text-sm text-faint">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Audiences() {
  return (
    <section id="who" className="scroll-mt-24 border-y border-line bg-surface/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <Kicker>Who it&apos;s for</Kicker>
          <h2 className={`mt-4 ${H2}`}>Built for the people <span className="text-shine">who build.</span></h2>
        </Reveal>
        <div className="mt-10"><AudienceTabs /></div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Wrench, title: "Club operating system", body: "Five roles, approvals, word filters, link holds for new members, held-post review, bans and invite links." },
  { icon: FolderGit2, title: "Proof-of-work profiles", body: "Projects with a public summary and a private write-up. Photos, video and build logs." },
  { icon: CalendarDays, title: "Events that matter", body: "Club build nights and demo days next to career fairs from verified companies. RSVP and add to calendar." },
  { icon: Inbox, title: "An inbox that respects you", body: "Strangers land in Requests. Accept, decline, or block and report. Read status is never shown." },
  { icon: ShieldCheck, title: "Verified, end to end", body: "Students verify with a university email; companies and schools with their own domain." },
  { icon: BarChart3, title: "See who's noticing", body: "Private analytics on profile views and engagement. Only you see them." },
];

export function Features() {
  return (
    <section id="product" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 sm:py-28">
      <Reveal className="max-w-3xl">
        <Kicker>The product</Kicker>
        <h2 className={`mt-4 ${H2}`}>Everything a club needs. <span className="text-shine">Everything a member needs to get noticed.</span></h2>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-surface p-7">
            <f.icon className="size-6" />
            <h3 className="mt-5 font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const GOALS = [
  ["Start with clubs", "A club of 30 to 100 people is useful on day one. We win one club, then one campus, at a time."],
  ["Make real work the signal", "Projects, results and milestones a club vouched for should matter more than a polished résumé."],
  ["Keep it trustworthy", "Verified members, no recruiter spam, private by default. The network stays worth being on."],
  ["Earn it from companies, not students", "Free for students and clubs. Companies sponsor club events and challenges to meet the people building."],
];

export function Mission() {
  return (
    <section id="mission" className="scroll-mt-24 border-y border-line bg-surface/30 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <Kicker>Our mission</Kicker>
          <h2 className={`mt-4 ${H2}`}>Make what you build <span className="text-shine">the way you get found.</span></h2>
          {/* Draft copy: the founders should rewrite this in their own words. */}
          <div className="mt-8 rounded-3xl border border-line bg-surface/70 p-7">
            <div className="text-sm font-semibold">Why we&apos;re building Forge</div>
            <p className="mt-2 text-[15px] leading-relaxed text-text-2">Some of the most capable engineers and scientists get overlooked because their best work lives in club Discords and lab notebooks, while hiring runs on keywords. We&apos;re starting with clubs because that&apos;s where the building already happens.</p>
          </div>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {GOALS.map(([t, b], i) => (
            <Reveal key={t} delay={i * 0.05} className="rounded-3xl border border-line bg-surface/70 p-6">
              <div>
                <span className="grid size-8 place-items-center rounded-full bg-accent text-on-accent"><Check className="size-4" /></span>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-muted">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-20 sm:py-28">
      <Reveal>
        <Kicker>Questions</Kicker>
        <h2 className={`mt-4 ${H2}`}>Good questions.</h2>
      </Reveal>
      <div className="mt-10"><Faq /></div>
    </section>
  );
}

