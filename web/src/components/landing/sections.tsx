import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { AppTour } from "./app-tour";
import { BuildShowcase } from "./build-showcase";
import { ClubSetupDemo } from "./club-setup-demo";
import { CompanySearch } from "./company-search";
import { EmberDemo } from "./ember-demo";
import { Faq } from "./faq";

// The landing page's sections, in the order a cold visitor needs them: the app itself (to try), a
// build in 3D, why
// proof matters now, Ember, what clubs get, what companies get and what it costs, and questions.
// Each one is a heading, a few plain sentences and something to try; the demos are client components.

export const H2 = "text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance";
const WRAP = "mx-auto max-w-6xl px-5 sm:px-6";
const SEC = "scroll-mt-20 py-20 sm:py-28";
const BAND = "border-y border-line bg-surface-2/60";
const LEAD = "mt-5 max-w-[36rem] text-lg leading-relaxed text-muted";

// Three plain points beside a demo: what it is, in the visitor's words.
function Points({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-9 flex flex-col divide-y divide-line border-y border-line">
      {items.map(([t, b]) => <div key={t} className="py-4"><dt className="font-medium">{t}</dt><dd className="mt-1 text-[15px] leading-relaxed text-muted">{b}</dd></div>)}
    </dl>
  );
}

export function Tour() {
  return (
    <section id="app" className={cn(SEC, BAND)}>
      <div className={WRAP}>
        <h2 className={H2}>The whole app is five places.</h2>
        <p className={LEAD}>This is a working copy with example data. Tap around: what you do in one place shows up in the next.</p>
        <div className="mt-10"><AppTour /></div>
      </div>
    </section>
  );
}

// The build itself: pick a field and see an example in the product's own 3D viewer
// (build-showcase.tsx). three.js loads only when this nears the screen.
export function ShowBuild() {
  return (
    <section id="projects" className={SEC}>
      <div className={cn(WRAP, "grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16")}>
        <div className="order-2 min-w-0 lg:order-1"><BuildShowcase /></div>
        <div className="order-1 lg:order-2">
          <h2 className={H2}>Don&apos;t describe it. Show the build.</h2>
          <p className={LEAD}>Whatever you make, post the thing itself. Upload the model, and whoever checks your work can turn it over, look inside and see how big it is.</p>
          <Points items={[
            ["Pick what you do", "A robot, a rocket, a gearbox, a circuit board, a bridge, a lab model. Each is an example of a build and the milestone that goes with it."],
            ["Look closer", "Front, side and top at a tap. See through the surfaces, or pull an assembly apart."],
            ["Blueprint mode", "One tap turns it into a line drawing on blue paper, with its dimensions written on it."],
            ["Your real file", "STL, OBJ, GLB and 3MF open right on your project page. No CAD tool needed."],
          ]} />
        </div>
      </div>
    </section>
  );
}

const FACTS = [
  { n: "91%", label: "of recruiters have spotted candidate deception.", src: "Greenhouse, 2025", href: "https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair" },
  { n: "1 in 4", label: "candidate profiles are expected to be fake by 2028.", src: "Gartner via HR Dive", href: "https://www.hrdive.com/news/fake-job-candidates-ai/757126/" },
  { n: "54%", label: "of long posts from top LinkedIn profiles in 2025 were likely written by AI.", src: "Originality.ai", href: "https://ppc.land/over-half-of-linkedin-posts-are-now-likely-ai-but-authenticity-still-wins/" },
];

export function Why() {
  return (
    <section id="why" className={cn(SEC, BAND)}>
      <div className={cn(WRAP, "grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16")}>
        <div>
          <h2 className={H2}><span className="block">AI made claims free.</span> Proof is what&apos;s scarce now.</h2>
          <p className={LEAD}>Anyone can generate a polished résumé in seconds. What still counts is work someone else saw happen, and today that&apos;s buried in group chats and lab notebooks nobody outside ever sees.</p>
        </div>
        <dl className="flex flex-col divide-y divide-line border-y border-line self-start">
          {FACTS.map((f) => (
            <div key={f.src} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-4 py-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{f.n}</dt>
              <dd className="text-[15px] leading-relaxed text-text-2">{f.label} <a href={f.href} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-muted underline decoration-line-strong underline-offset-4 hover:text-text">{f.src}</a></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function EmberSection() {
  return (
    <section id="ember" className={SEC}>
      <div className={cn(WRAP, "grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16")}>
        <div>
          <h2 className={H2}>Ember does the busywork.</h2>
          <p className={LEAD}>Ember is the assistant inside Brazework. It reads your club&apos;s real numbers, drafts the update, and waits for your OK.</p>
          <Points items={[
            ["It checks before it answers", "Every number in a draft comes from what members posted and what officers verified."],
            ["It asks before it acts", "A post, a request or a milestone sits on a card until you press the button."],
            ["It works with the AI tools you already use", "Connect Claude Code, Cursor or Codex in Settings and they can log your progress while you work. They can never verify anything. Only people do."],
          ]} />
        </div>
        <EmberDemo />
      </div>
    </section>
  );
}

export function Clubs() {
  return (
    <section id="clubs" className={cn(SEC, "border-t border-line bg-surface-2/60")}>
      <div className={cn(WRAP, "grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16")}>
        <div>
          <h2 className={H2}>Run your club here. Its work gets counted.</h2>
          <p className={LEAD}>Members, events, chat and announcements in one place. When officers sign what members build, the club&apos;s name goes with them into every application.</p>
          <Points items={[
            ["Up and running in about five minutes", "A short checklist, starter rules, and one invite link for the group chat your club already uses."],
            ["Study groups work the same way", "Name the course, the term and when you meet. Whoever leads a session gets it on their record."],
            ["A clean handoff", "Next year's officers start where you left off: the members, the history and the rules stay with the club."],
          ]} />
          <Link href="#founding" className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Bring your club</Link>
        </div>
        <ClubSetupDemo />
      </div>
    </section>
  );
}

export function Companies() {
  return (
    <section id="companies" className={SEC}>
      <div className={cn(WRAP, "grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16")}>
        <div>
          <h2 className={H2}>Search the work, not the résumé.</h2>
          <p className={LEAD}>Find students by what they built and who signed it, not by keywords on a résumé anyone can generate.</p>
          <Points items={[
            ["Only signed work shows up", "Every result names the club officer or the person who saw it happen, and when."],
            ["Ask, and they decide", "Your message waits in their Requests. The ones who reply want to talk."],
            ["Sponsor a build challenge", "Clubs opt in, members build, and officers verify the results you meet the winners by."],
          ]} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#founding" className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Sponsor a challenge</Link>
            <Link href="#pricing" className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-5 text-[15px] font-medium transition hover:bg-hover">See pricing</Link>
          </div>
        </div>
        <CompanySearch />
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Students and clubs", price: "Free", note: "Always, with no ads", points: ["A profile built from signed work", "Run your club or study group: events, chat, roles, handoff", "Ember included", "Web and iPhone"], cta: { label: "Create your free account", href: "/signup" } },
  { name: "Companies", price: "Sponsor and recruit", note: "Pilots, set up with the founders", points: ["Sponsor a build challenge that clubs opt into", "Meet the winners, verified by their clubs", "Follow clubs and builders, and host events", "Search signed work (coming with Pro)"], cta: { label: "Talk to us", href: "#founding" } },
];

export function Pricing() {
  return (
    <section id="pricing" className={cn(SEC, BAND)}>
      <div className={WRAP}>
        <h2 className={H2}>Free for the people who build. Paid by the people who hire.</h2>
        <div className="mt-10 grid grid-cols-1 overflow-hidden rounded-[1.25rem] border border-line bg-surface md:grid-cols-2 md:divide-x md:divide-line">
          {PLANS.map((p, i) => (
            <div key={p.name} className={cn("flex flex-col p-6 sm:p-8", i > 0 && "border-t border-line md:border-t-0")}>
              <h3 className="text-sm font-medium text-muted">{p.name}</h3>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{p.price}</p>
              <p className="mt-1 text-sm text-muted">{p.note}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[15px] text-text-2">
                {p.points.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" />{x}</li>)}
              </ul>
              <Link href={p.cta.href} className={cn("mt-8 inline-flex h-11 items-center justify-center self-start rounded-lg px-5 text-[15px] font-medium transition", i === 0 ? "bg-accent text-on-accent hover:opacity-90" : "border border-line-strong hover:bg-hover")}>{p.cta.label}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className={SEC}>
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <h2 className={H2}>Questions</h2>
        <div className="mt-8"><Faq /></div>
      </div>
    </section>
  );
}
