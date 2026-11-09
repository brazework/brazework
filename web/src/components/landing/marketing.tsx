import { BadgeCheck, BarChart3, CalendarDays, Images, MessageSquareLock, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/forge";
import { HowItWorks } from "./how-it-works";
import { CountUp } from "./interactive";
import { AudienceTabs, Faq } from "./marketing-client";
import { ProfessionGrid } from "./profession-grid";
import { Reveal } from "./reveal";

// The landing page's sections. Clean surfaces, one idea per section, and something to touch in
// most of them (profession cards, the how-it-works stepper, audience tabs, the FAQ).

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
      {body && <p className="mt-5 text-lg leading-relaxed text-muted">{body}</p>}
    </Reveal>
  );
}

const CLUB_TYPES = ["Robotics teams", "ACM chapters", "IEEE branches", "Hackathon clubs", "AI societies", "Cyber defense teams", "Rocketry", "Formula SAE", "Data science clubs", "Design clubs", "Women in Tech", "Game dev clubs", "Cloud clubs", "Maker spaces"];

// A slow strip of the kinds of clubs Forge is built for (types, not partners).
export function ClubStrip() {
  const row = (k: string) => CLUB_TYPES.map((c) => <span key={k + c} className="mx-6 shrink-0 text-sm font-medium whitespace-nowrap text-faint">{c}</span>);
  return (
    <div className="border-y border-line py-5">
      <p className="sr-only">Built for clubs like: {CLUB_TYPES.join(", ")}.</p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" aria-hidden="true">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">{row("a")}{row("b")}</div>
      </div>
    </div>
  );
}

export function Builders() {
  return (
    <section id="builders" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Every kind of builder" title="Whatever you build in tech," accent="there's a place for it here." body="Flip a card to see what you'd post, which clubs it fits and who's looking for it." />
        <div className="mt-12"><ProfessionGrid /></div>
      </div>
    </section>
  );
}

const FACTS = [
  { n: <CountUp to={3} suffix="×" />, label: "applications per job compared with 2021, and 91% of recruiters have caught candidates misrepresenting themselves.", src: "Greenhouse, 2025", href: "https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair" },
  { n: <>1 in <CountUp to={4} /></>, label: "candidate profiles expected to be fake by 2028, as AI makes polished résumés free.", src: "Gartner via HR Dive", href: "https://www.hrdive.com/news/fake-job-candidates-ai/757126/" },
  { n: <CountUp to={54} suffix="%" />, label: "of long-form posts from top LinkedIn profiles in 2025 were likely written by AI.", src: "Originality.ai", href: "https://ppc.land/over-half-of-linkedin-posts-are-now-likely-ai-but-authenticity-still-wins/" },
];

export function Problem() {
  return (
    <section className="bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Why now" title="Hiring stopped trusting résumés." accent="Builders are paying for it." body="Anyone can generate a perfect résumé now. What still cuts through is real work that someone saw happen, and today that work is buried in Discord threads and group chats." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
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
    <section id="how" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="How it works" title="One club is enough" accent="to start the loop." />
        <div className="mt-12"><HowItWorks /></div>
      </div>
    </section>
  );
}

export function Audiences() {
  return (
    <section id="who" className="scroll-mt-24 bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Who it's for" title="Built for the people" accent="who build." />
        <div className="mt-10"><AudienceTabs /></div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Users, title: "Club operating system", body: "Five roles, join approvals, word filters, link holds for new members, held-post review, bans and invite links.", span: "md:col-span-2" },
  { icon: Images, title: "Photos and video", body: "Post build videos, test runs and demo-day photos right in the feed." },
  { icon: BadgeCheck, title: "Proof-of-work profiles", body: "Projects with a public summary, a private write-up and milestones your club verified." },
  { icon: CalendarDays, title: "Club and company events", body: "Build nights and demo days next to career events from verified companies, with RSVPs and calendar files.", span: "md:col-span-2" },
  { icon: MessageSquareLock, title: "Respectful messaging", body: "Strangers land in Requests. Accept, decline, or block and report. Read status is never shown." },
  { icon: ShieldCheck, title: "Verified members", body: "Students verify with a university email; companies and schools with their own domain." },
  { icon: BarChart3, title: "Private analytics", body: "Profile views and engagement that only you can see." },
];

export function Features() {
  return (
    <section id="product" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="The product" title="Everything a club runs on." accent="Everything a member needs to get noticed." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
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
  ["Start with clubs", "A club of 30 to 100 people is useful on day one. We win one club, then one campus, at a time."],
  ["Make real work the signal", "Projects and milestones a club vouched for should matter more than a polished résumé."],
  ["Keep it trustworthy", "Verified members, no recruiter spam, private by default."],
  ["Earn it from companies, not students", "Free for students and clubs. Companies sponsor club events and challenges to meet the people building."],
];

export function Mission() {
  return (
    <section id="mission" className="scroll-mt-24 bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Reveal>
          <Eyebrow>Our mission</Eyebrow>
          <h2 className={cn("mt-5", H2)}>Make what you build <span className="text-grad">the way you get found.</span></h2>
          {/* Draft copy: the founders should rewrite this in their own words. */}
          <p className="mt-6 text-lg leading-relaxed text-muted">Some of the most capable engineers and scientists get overlooked because their best work lives in club Discords and lab notebooks, while hiring runs on keywords. We&apos;re starting with clubs because that&apos;s where the building already happens.</p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
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
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-24 sm:py-32">
      <Head eyebrow="FAQ" title="Questions, answered." center />
      <div className="mt-10"><Faq /></div>
    </section>
  );
}
