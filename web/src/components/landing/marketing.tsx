import { BadgeCheck, BarChart3, Bot, CalendarDays, Check, FileCheck2, Images, KeyRound, MessageSquareLock, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { HowItWorks } from "./how-it-works";
import { CountUp } from "./interactive";
import { AudienceTabs, Faq } from "./marketing-client";
import { Reveal } from "./reveal";

// The landing page's sections. Clean surfaces, one idea per section, and something to touch in
// most of them (the how-it-works stepper, audience tabs, the FAQ).

export const H2 = "text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.04] font-semibold tracking-[-0.035em]";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted", className)}>
      <span className="size-1.5 rounded-full bg-accent-grad" /> {children}
    </div>
  );
}

function Head({ eyebrow, title, accent, body, center }: { eyebrow: string; title: string; accent?: string; body?: string; center?: boolean }) {
  return (
    <Reveal className={cn("max-w-3xl", center && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={cn("mt-5", H2)}>{title}{accent && <> <span className="text-grad">{accent}</span></>}</h2>
      {body && <p className="m-hide mt-5 text-lg leading-relaxed text-muted">{body}</p>}
    </Reveal>
  );
}

const FACTS = [
  { n: <CountUp to={91} suffix="%" />, label: "of recruiters have spotted candidate deception, and a third spend up to half their week filtering junk applications.", src: "Greenhouse, 2025", href: "https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair" },
  { n: <>1 in <CountUp to={4} /></>, label: "candidate profiles expected to be fake by 2028, as AI makes polished résumés free.", src: "Gartner via HR Dive", href: "https://www.hrdive.com/news/fake-job-candidates-ai/757126/" },
  { n: <CountUp to={54} suffix="%" />, label: "of long-form posts from top LinkedIn profiles in 2025 were likely written by AI.", src: "Originality.ai", href: "https://ppc.land/over-half-of-linkedin-posts-are-now-likely-ai-but-authenticity-still-wins/" },
];

export function Problem() {
  return (
    <section id="why" data-story="Why now" className="story-sec bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Why now" title="AI made résumés free." accent="Proof is what's scarce now." body="Anyone can generate a polished résumé or profile in seconds. What still cuts through is work someone else saw happen, and today that proof is buried in group chats, lab notebooks and slide decks nobody outside ever sees." />
        <div className="m-cards mt-12 grid gap-4 md:grid-cols-3">
          {FACTS.map((f, i) => (
            <Reveal key={f.src} delay={i * 0.08} className="spotlight flex flex-col rounded-3xl border border-line bg-surface p-7">
              <div className="text-5xl font-semibold tracking-tight">{f.n}</div>
              <p className="mt-4 flex-1 text-text-2">{f.label}</p>
              <a href={f.href} target="_blank" rel="noopener noreferrer" className="mt-6 text-xs text-faint underline-offset-4 hover:text-text hover:underline">Source: {f.src} ↗</a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function How() {
  return (
    <section id="how" data-story="How it works" className="story-sec scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="How it works" title="One club" accent="starts the loop." />
        <div className="mt-12"><HowItWorks /></div>
      </div>
    </section>
  );
}

export function Audiences() {
  return (
    <section id="who" data-story="Who it's for" className="story-sec scroll-mt-24 bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Who it's for" title="One network," accent="four ways in." />
        <div className="mt-10"><AudienceTabs /></div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Users, title: "Organization operating system", body: "Chapters, clubs, labs and teams: five roles, join approvals, moderation, chat with officer announcements, team chats and invite links.", span: "md:col-span-2" },
  { icon: Images, title: "Photos and video", body: "Post build videos, test runs and demo-day photos right in the feed." },
  { icon: BadgeCheck, title: "Proof-of-work profiles", body: "Projects with a public summary, a private write-up and milestones your club verified." },
  { icon: CalendarDays, title: "Events that fill up", body: "General body meetings, build nights and demo days next to career events from verified companies, with RSVPs, maps and an attendee chat.", span: "md:col-span-2" },
  { icon: MessageSquareLock, title: "Respectful messaging", body: "Strangers land in Requests. Accept, decline, or block and report. Read status is never shown." },
  { icon: ShieldCheck, title: "Verified members", body: "Students verify with a university email; companies with their work domain. Report and block anywhere." },
  { icon: BarChart3, title: "Private analytics", body: "Profile views and engagement that only you can see." },
];

export function Features() {
  return (
    <section id="product" data-story="The product" className="story-sec scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="The product" title="Everything a club runs on." accent="Everything a member needs to get noticed." />
        <div className="m-cards mt-12 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06} className={cn("spotlight group rounded-3xl border border-line bg-surface p-7 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]", f.span)}>
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-grad text-on-accent transition duration-300 group-hover:scale-110"><f.icon className="size-5" /></span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const GOALS = [
  ["Start with clubs", "One chapter of 30 to 100 people is useful on day one. We win one club, then one campus, at a time."],
  ["Make verified work the signal", "Work a club vouched for should matter more than a polished, AI-written résumé."],
  ["AI that works for you", "Ember does the busywork for officers and members, and you approve everything it does."],
  ["Earn it from those who hire", "Free for students and clubs. Companies pay to sponsor challenges and meet the people building."],
];

export function Mission() {
  return (
    <section id="mission" data-story="Mission" className="story-sec scroll-mt-24 bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Reveal>
          <Eyebrow>Our mission</Eyebrow>
          <h2 className={cn("mt-5", H2)}>Make what you build <span className="text-grad">the way you get found.</span></h2>
          {/* Draft copy: the founders should rewrite this in their own words. */}
          <p className="m-hide mt-6 text-lg leading-relaxed text-muted">Some of the most capable engineers, scientists and builders get overlooked because their best work lives in group chats and lab notebooks, while hiring runs on keywords and AI-written résumés. We&apos;re starting with the organizations they already belong to, beginning with our own campus, and making what they build the way they get found.</p>
          <p className="m-only mt-4 text-base leading-relaxed text-muted">The best builders get overlooked because their work lives in group chats while hiring runs on keywords. We start with their organizations and make that work count.</p>
        </Reveal>
        <div className="m-cards grid gap-4 sm:grid-cols-2">
          {GOALS.map(([t, b], i) => (
            <Reveal key={t} delay={i * 0.06} className="spotlight rounded-3xl border border-line bg-surface p-6">
              <div className="text-grad text-sm font-semibold">0{i + 1}</div>
              <h3 className="mt-2 font-semibold">{t}</h3>
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
    <section id="faq" data-story="Questions" className="story-sec mx-auto max-w-3xl scroll-mt-24 px-6 py-24 sm:py-32">
      <Head eyebrow="FAQ" title="Questions, answered." center />
      <div className="mt-10"><Faq /></div>
    </section>
  );
}

const AI_POINTS = [
  { icon: FileCheck2, title: "A trust layer AI can read", body: "Each verified milestone records who vouched for it, when, and the evidence: signal people and their AI tools can trust." },
  { icon: Bot, title: "Ember, the agent inside", body: "Plans meetings, drafts updates and finds the right people. It checks Brazework first, and you approve every action." },
  { icon: KeyRound, title: "Your Brazework in any AI", body: "Connect Claude, Cursor or any MCP client and ask about your clubs, events and projects. Read-only and revocable." },
];

export function AiEra() {
  return (
    <section id="ai" data-story="Built for AI" className="story-sec scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Built for the AI era" title="As AI floods hiring," accent="verified work becomes the signal." body="Brazework is designed so the proof behind a person is something both people and software can trust, and so AI does the busywork instead of the talking." />
        <div className="m-cards mt-12 grid gap-4 md:grid-cols-3">
          {AI_POINTS.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06} className="spotlight group rounded-3xl border border-line bg-surface p-7">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-grad text-on-accent transition duration-300 group-hover:scale-110"><f.icon className="size-5" /></span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Students & clubs", price: "Free", note: "Forever, no ads", points: ["Profiles built from verified work", "Run your club: events, chat, roles, moderation, handoff", "Ember, the AI agent, included", "iPhone and web"], cta: { label: "Create your profile", href: "/signup" } },
  { name: "Companies", price: "Sponsor & recruit", note: "Pilots, set up with the founders", points: ["Sponsor a build challenge; clubs opt in", "Meet the winners, verified by their clubs", "Follow clubs and builders; host events", "Search verified builders (coming with Pro)"], cta: { label: "Sponsor a challenge", href: "#founding" }, featured: true },
];

export function Pricing() {
  return (
    <section id="pricing" data-story="Pricing" className="story-sec scroll-mt-24 bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Pricing" title="Free for the people who build." accent="Paid by the people who hire." />
        <div className="m-cards mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.06} className={cn("spotlight flex flex-col rounded-3xl border bg-surface p-7", p.featured ? "border-transparent ring-2 ring-[var(--accent)]" : "border-line")}>
              <div className="text-sm font-medium text-muted">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-semibold tracking-tight">{p.price}</span><span className="text-xs text-faint">{p.note}</span></div>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-text-2">
                {p.points.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" />{x}</li>)}
              </ul>
              <Link href={p.cta.href} className={cn("mt-6 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition", p.featured ? "bg-accent-grad text-on-accent hover:opacity-90" : "border border-line hover:border-line-strong")}>{p.cta.label}</Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
