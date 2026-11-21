import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { ConnectSlot } from "@/components/connect/connect-live";
import { AppTour } from "./app-tour";
import { BuildShowcase } from "./build-showcase";
import { ClubSetupDemo } from "./club-setup-demo";
import { CompanySearch } from "./company-search";
import { EmberDemo } from "./ember-demo";
import { Faq } from "./faq";
import { LANDING_AUDIENCES, PRICING_LINKS } from "@/lib/pricing";
import { PricingTiers } from "./pricing";

// The landing page's sections, in the order a cold visitor needs them: who it's for (a student,
// someone employed, someone working for themselves), the app itself (to try), a
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

// Who signs, wherever you are. The record is the same for a student, someone employed and someone
// working for themselves; only the person who saw the work changes (a club's officers, or anyone
// asked by email: supabase/vouches.sql). Examples, and the page says so.
const STAGES = [
  { when: "Studying", who: "Your club's officers sign what they saw you build. A professor, a TA or a lab lead can too.", work: "Line-following robot beat the course in 41.2 seconds", by: "Ben C.", as: "officer, Rocketry Club" },
  { when: "Working", who: "A manager or a mentor signs from their work email. They don't need an account.", work: "Cut the pick-and-place cycle from 9.4 to 7.1 seconds", by: "Dana R.", as: "engineering manager, Voltline" },
  { when: "On your own", who: "Whoever you built it for signs it, from their company's address: the person who saw it ship.", work: "Rebuilt a bike shop's checkout: 31% fewer abandoned carts", by: "Sam O.", as: "owner, Northside Bikes" },
];

export function Stages() {
  return (
    <section id="who" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
      <div className={WRAP}>
        <h2 className={H2}>Who signs it? Whoever saw it.</h2>
        <p className={LEAD}>At school that&apos;s your club or a professor. At work, your manager or tech lead. On your own, your client. They sign from their own email (a work or university one carries the most weight), and the record stays yours when you move on.</p>
        <ul className="mt-10 grid grid-cols-1 overflow-hidden rounded-[1.25rem] border border-line bg-surface md:grid-cols-3 md:divide-x md:divide-line">
          {STAGES.map((s, i) => (
            <li key={s.when} className={cn("flex flex-col p-6 sm:p-7", i > 0 && "border-t border-line md:border-t-0")}>
              <h3 className="text-2xl font-semibold tracking-tight">{s.when}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{s.who}</p>
              <figure className="mt-6 rounded-xl bg-surface-2/70 px-4 py-3">
                <p className="text-sm leading-snug font-medium">{s.work}</p>
                <figcaption className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                  <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden="true" />
                  <span>Verified by <span className="font-medium text-text-2">{s.by}</span>, {s.as}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">Examples, to show how signed work reads.</p>
      </div>
    </section>
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
      {/* Phone: the heading, then the picker and the model, then the detail. Laptop: the model on the left, the words beside it. */}
      <div className={cn(WRAP, "grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]")}>
        <div className="lg:col-start-2 lg:row-start-1 lg:self-end">
          <h2 className={H2}>Don&apos;t describe it. Show the build.</h2>
          <p className={LEAD}>Whatever you make, post the thing itself. Upload the model, and whoever checks your work can turn it over, look inside and see how big it is.</p>
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center"><BuildShowcase /></div>
        <div className="lg:col-start-2 lg:row-start-2 lg:self-start [&>dl]:mt-0">
          <Points items={[
            ["Pick what you do", "Twenty fields, from robotics and software to chemistry, business, design and education. Each shows an example build and the milestone that goes with it."],
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
          <h2 className={H2}><span className="block">Anyone can write a great résumé with AI.</span> Proof of the work is rare.</h2>
          <p className={LEAD}>What still counts is work someone else saw you do. Today that lives in pull requests, test logs, lab notebooks and group chats that nobody outside ever sees. Brazework puts it in one place, signed by the people who were there.</p>
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
            ["It works with the AI tools you already use", "Add Brazework to Claude, Cursor or VS Code in a minute (below), and they log your progress while you work. They can never verify anything. Only people do."],
          ]} />
        </div>
        <EmberDemo />
      </div>
    </section>
  );
}

// Connect your AI (the assistant connection, lib/mcp-oauth.ts): the connector address to copy, the
// three steps in Claude, and one tap for the editors, so a visitor goes from here to connected.
export function ConnectSection() {
  return (
    <section id="connect" aria-labelledby="connect-h" className={SEC}>
      <div className={cn(WRAP, "grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16")}>
        <div>
          <h2 id="connect-h" className={H2}>Connect your AI in a minute.</h2>
          <p className={LEAD}>Brazework is a connector for Claude and a server for the editors you code in. Add it once, then say what you did, like &ldquo;put the analysis I finished on my record.&rdquo; It drafts the milestone with its proof and waits for your OK.</p>
          <Link href="/ai" className="mt-6 inline-flex items-center gap-1 text-[15px] font-medium underline-offset-4 hover:underline">Everything it can do, field by field</Link>
        </div>
        <ConnectSlot />
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
          <p className={LEAD}>Find people by what they built and who signed it, students and working professionals alike, not by keywords on a résumé anyone can generate.</p>
          <Points items={[
            ["Only signed work shows up", "Every result names the club officer or the person who saw it happen, and when."],
            ["Ask, and they decide", "Your message waits in their Requests. The ones who reply want to talk."],
            ["Sponsor a build challenge", "Clubs opt in, members build, and officers verify the results you meet the winners by."],
          ]} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#founding" className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Sponsor a challenge</Link>
            <Link href="/pricing#pricing-companies" className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-5 text-[15px] font-medium transition hover:bg-hover">See pricing</Link>
          </div>
        </div>
        <CompanySearch />
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className={cn(SEC, BAND)}>
      <div className={WRAP}>
        <h2 className={H2}>Free for the people who build. Paid by the people who hire.</h2>
        <PricingTiers className="mt-10" only={LANDING_AUDIENCES} />
        {/* Clubs are free; what companies and schools pay is on /pricing, not here (lib/pricing.ts). */}
        <p className="mt-8 text-[15px] text-muted">
          Clubs are free too. Hiring, sponsoring a club or running a school?{" "}
          {PRICING_LINKS.map((l, i) => <span key={l.href}>{i > 0 && " · "}<Link href={l.href} className="font-medium text-text underline-offset-4 hover:underline">{l.label}</Link></span>)}
        </p>
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
