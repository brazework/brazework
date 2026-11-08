import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { CornerMarks, FigLabel, FlowArrow, RocketDrawing, TitleBlock } from "./blueprint";
import { Reveal } from "./reveal";
import { AudienceTabs, Faq } from "./marketing-client";

// The landing page as a set of engineering drawings: Forge is where clubs build real things.
// Server components; the audience tabs and FAQ are client components. Every figure is sourced.

const H2 = "text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.035em]";
const square = "rounded-md";

export function MarketingHero() {
  return (
    <section id="top" className="bp-grid relative isolate overflow-hidden border-b border-line pt-32 pb-16 sm:pt-36">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-[1fr_1.05fr] [&>*]:min-w-0">
        <div>
          <a href="#founding" className="rise-in inline-flex max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface/80 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-text-2 uppercase">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
            <span className="truncate">Founding clubs program · open</span>
            <ArrowRight className="size-3.5 shrink-0" />
          </a>
          <h1 className="focus-in mt-7 text-[clamp(2.6rem,5.6vw,4.6rem)] leading-[1] font-semibold tracking-[-0.045em]">
            Built by clubs.
            <br />
            <span className="text-accent">Proven by work.</span>
          </h1>
          {/* A dimension line under the headline, like a drawing annotation. */}
          <div className="rise-in mt-5 flex max-w-md items-center gap-2 font-mono text-[10px] tracking-widest text-faint uppercase" style={{ ["--delay" as string]: "0.15s" }} aria-hidden="true">
            <span className="h-3 w-px bg-accent/60" /><span className="h-px flex-1 bg-accent/40" /><span>The professional network for STEM</span><span className="h-px flex-1 bg-accent/40" /><span className="h-3 w-px bg-accent/60" />
          </div>
          <p className="focus-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ ["--delay" as string]: "0.1s" }}>
            Forge is where university STEM clubs run everything they build: projects, events, members and roles. Every member&apos;s work becomes proof of what they can do, and the companies that care can finally see it.
          </p>
          <div className="rise-in mt-8 flex flex-wrap items-center gap-3" style={{ ["--delay" as string]: "0.25s" }}>
            <Button href="#founding" size="lg" className={square}>Bring your club <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Button>
            <Button href="/signup" variant="outline" size="lg" className={square}>Join as a student</Button>
          </div>
          <p className="rise-in mt-5 font-mono text-[11px] tracking-wide text-faint uppercase" style={{ ["--delay" as string]: "0.35s" }}>Free for students &amp; clubs · University email verified</p>
        </div>
        <div className="relative">
          <div className="relative border border-line-strong bg-surface/60 p-3 sm:p-5">
            <CornerMarks />
            <RocketDrawing />
            <TitleBlock className="absolute right-3 bottom-3 hidden w-56 bg-surface sm:grid" rows={[["Project", "Forge"], ["Dwg no.", "FR-001"], ["Drawn by", "Your club"], ["Rev", "A · 2026"]]} />
          </div>
        </div>
      </div>
    </section>
  );
}

const FACTS = [
  { n: "3×", label: "Applications per job vs 2021. 91% of recruiters have caught candidates misrepresenting themselves.", src: "Greenhouse, 2025", href: "https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair" },
  { n: "1 in 4", label: "Candidate profiles expected to be fake by 2028, as AI makes polished résumés free.", src: "Gartner via HR Dive", href: "https://www.hrdive.com/news/fake-job-candidates-ai/757126/" },
  { n: "54%", label: "Long-form posts from top LinkedIn profiles in 2025 that were likely written by AI.", src: "Originality.ai", href: "https://ppc.land/over-half-of-linkedin-posts-are-now-likely-ai-but-authenticity-still-wins/" },
];

// The problem, as a spec sheet.
export function Problem() {
  return (
    <section className="border-b border-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <FigLabel n="02">The problem</FigLabel>
          <h2 className={`mt-5 ${H2}`}>Hiring stopped trusting résumés. <span className="text-accent">Builders are paying for it.</span></h2>
          <p className="mt-5 text-lg text-muted">Anyone can generate a perfect résumé now. What still cuts through is real work that someone saw happen, and today that work is buried in Discord threads and group chats.</p>
        </Reveal>
        <Reveal className="relative mt-12 border border-line-strong bg-surface/60">
          <CornerMarks />
          <div className="hidden border-b border-line-strong font-mono text-[10px] tracking-widest text-faint uppercase sm:grid sm:grid-cols-[140px_1fr_200px]">
            <div className="px-5 py-2.5">Measure</div><div className="px-5 py-2.5">Spec</div><div className="px-5 py-2.5">Source</div>
          </div>
          {FACTS.map((f) => (
            <div key={f.n} className="grid gap-1 border-b border-line px-5 py-5 last:border-0 sm:grid-cols-[140px_1fr_200px] sm:items-center sm:gap-0 sm:px-0">
              <div className="text-4xl font-semibold tracking-tight tabular-nums sm:px-5">{f.n}</div>
              <p className="text-text-2 sm:px-5">{f.label}</p>
              <a href={f.href} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-faint underline-offset-4 hover:text-text hover:underline sm:px-5">{f.src} ↗</a>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  { k: "A", title: "Your club runs on Forge", body: "Posts, roles from owner to helper, approvals, moderation, events and invite links. One place instead of a Discord server, a Google Form and a group chat." },
  { k: "B", title: "Members show the work", body: "Projects with photos and write-ups, results with data. The club vouches for milestones it saw happen, so profiles carry proof." },
  { k: "C", title: "The right people find it", body: "Verified companies and schools follow builders, host events and reach out. Members land roles and bring the next club." },
];

// How it works, as a flow diagram.
export function HowItWorks() {
  return (
    <section id="how" className="bp-grid scroll-mt-24 border-b border-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <FigLabel n="03">How it works</FigLabel>
          <h2 className={`mt-5 ${H2}`}>One club is enough <span className="text-accent">to start the loop.</span></h2>
        </Reveal>
        <div className="mt-12 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          {STEPS.map((s, i) => (
            <div key={s.k} className="contents">
              <Reveal delay={i * 0.08} className="relative flex-1 border border-line-strong bg-surface/80 p-6">
                <CornerMarks />
                <div className="flex items-center justify-between font-mono text-[11px] tracking-widest text-accent uppercase">
                  <span>Stage {s.k}</span><span className="text-faint">0{i + 1}/03</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </Reveal>
              {i < STEPS.length - 1 && <FlowArrow className="mx-auto rotate-90 lg:rotate-0" />}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center font-mono text-[11px] tracking-widest text-faint uppercase">↻ Loop: hired members bring their next club</p>
      </div>
    </section>
  );
}

export function Audiences() {
  return (
    <section id="who" className="scroll-mt-24 border-b border-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <FigLabel n="04">Who it&apos;s for</FigLabel>
          <h2 className={`mt-5 ${H2}`}>Built for the people <span className="text-accent">who build.</span></h2>
        </Reveal>
        <div className="mt-10"><AudienceTabs /></div>
      </div>
    </section>
  );
}

const PARTS = [
  ["01", "Club operating system", "Five roles, approvals, word filters, link holds for new members, held-post review, bans and invite links."],
  ["02", "Proof-of-work profiles", "Projects with a public summary and a private write-up, plus photos, video and build logs."],
  ["03", "Club and company events", "Build nights and demo days next to career fairs from verified companies. RSVP and add to calendar."],
  ["04", "Respectful messaging", "Strangers land in Requests. Accept, decline, or block and report. Read status is never shown."],
  ["05", "Verified members", "Students verify with a university email; companies and schools with their own domain."],
  ["06", "Private analytics", "Profile views and engagement that only you can see."],
];

// The product, as a parts list.
export function Features() {
  return (
    <section id="product" className="scroll-mt-24 border-b border-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <FigLabel n="05">Parts list</FigLabel>
          <h2 className={`mt-5 ${H2}`}>Everything a club runs on. <span className="text-accent">Everything a member needs to get noticed.</span></h2>
        </Reveal>
        <Reveal className="relative mt-12 border border-line-strong bg-surface/60">
          <CornerMarks />
          <div className="hidden border-b border-line-strong font-mono text-[10px] tracking-widest text-faint uppercase sm:grid sm:grid-cols-[80px_260px_1fr]">
            <div className="px-5 py-2.5">Item</div><div className="px-5 py-2.5">Part</div><div className="px-5 py-2.5">Description</div>
          </div>
          {PARTS.map(([n, part, desc]) => (
            <div key={n} className="grid gap-1 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[80px_260px_1fr] sm:gap-0 sm:px-0">
              <div className="font-mono text-sm text-accent sm:px-5">{n}</div>
              <div className="font-semibold sm:px-5">{part}</div>
              <p className="text-sm text-muted sm:px-5">{desc}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

const GOALS = [
  ["Start with clubs", "A club of 30 to 100 people is useful on day one. We win one club, then one campus, at a time."],
  ["Make real work the signal", "Projects and milestones a club vouched for should matter more than a polished résumé."],
  ["Keep it trustworthy", "Verified members, no recruiter spam, private by default."],
  ["Earn it from companies, not students", "Free for students and clubs. Companies sponsor club events and challenges to meet the people building."],
];

export function Mission() {
  return (
    <section id="mission" className="bp-grid scroll-mt-24 border-b border-line py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <FigLabel n="06">Mission</FigLabel>
          <h2 className={`mt-5 ${H2}`}>Make what you build <span className="text-accent">the way you get found.</span></h2>
          {/* Draft copy: the founders should rewrite this in their own words. */}
          <div className="relative mt-8 border border-line-strong bg-surface/80 p-6">
            <CornerMarks />
            <div className="font-mono text-[11px] tracking-widest text-accent uppercase">Design intent</div>
            <p className="mt-3 text-[15px] leading-relaxed text-text-2">Some of the most capable engineers and scientists get overlooked because their best work lives in club Discords and lab notebooks, while hiring runs on keywords. We&apos;re starting with clubs because that&apos;s where the building already happens.</p>
          </div>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {GOALS.map(([t, b], i) => (
            <Reveal key={t} delay={i * 0.05} className="relative border border-line-strong bg-surface/80 p-5">
              <CornerMarks />
              <div className="font-mono text-[11px] tracking-widest text-accent uppercase">Goal 0{i + 1}</div>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm text-muted">{b}</p>
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
        <FigLabel n="08">Notes</FigLabel>
        <h2 className={`mt-5 ${H2}`}>Questions, answered.</h2>
      </Reveal>
      <div className="mt-10"><Faq /></div>
    </section>
  );
}
