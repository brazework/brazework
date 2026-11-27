import { ArrowRight, BarChart3, Briefcase, ClipboardCheck, GraduationCap, Landmark, Plus, Users } from "lucide-react";
import Link from "next/link";
import { PLUS } from "@/lib/pricing";
import { Tilt } from "./tilt";

// The landing page's short sections (redesign 2026-11; schools first since 2026-11-26, see
// docs/strategy.md; Brazework Courses since 2026-11-26). The hero does the showing; ForSchools is the
// one band that speaks to the school that pays; /schools says the rest and /pricing has the prices
// (no price on this page: the founders, 2026-11-27). Audiences says who it's for and where each starts.
// The whole page tells one story (2026-11-26, Ian and Josh: "include professionals", "tie it all
// together"): what it is (the hero), how it works in three steps that are the same for everyone (How),
// who it's for, students and professionals alike (Audiences), what a school gets (ForSchools, Compare),
// plain answers (Faq), and the pilot form.

export const H2 = "text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance";

// What a school gets, by the office that buys it. `soon` marks what's being built with the pilot
// schools, so the page never sells what isn't there (lib/pricing.ts SCHOOL_SOON says the same).
export const SCHOOL_OUTCOMES = [
  { icon: ClipboardCheck, office: "Engineering dean", title: "Accreditation evidence", body: "ABET outcomes from real class and club projects: design, teamwork, results, each verified by the faculty who saw it.", soon: true },
  { icon: Users, office: "Student life", title: "Club engagement", body: "Which clubs are active, how many students build with them and what they made this semester, in one report.", soon: false },
  { icon: Briefcase, office: "Career center", title: "Placement data", body: "Which employers looked at your students' work, who they contacted and who they hired.", soon: true },
  { icon: Landmark, office: "Admissions", title: "A public showcase", body: "Your verified clubs and what your students are building right now, for prospective students and donors.", soon: false },
];

// How it works lives in how.tsx (it plays as you scroll).

export function ForSchools() {
  return (
    <section id="schools" aria-labelledby="schools-h" className="schools-band relative isolate scroll-mt-20 overflow-hidden border-y border-line py-16 text-text md:py-24">
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="inline-flex items-center gap-2 font-mono text-xs text-faint"><GraduationCap className="size-3.5" aria-hidden="true" /> For schools</p>
        <h2 id="schools-h" className={`${H2} mt-4 max-w-[22ch]`}>Your students&apos; project work, verified by the people who saw it.</h2>
        <p className="mt-5 max-w-[40rem] text-lg leading-relaxed text-muted">Brazework is where your project courses run and your clubs build. Faculty grade and verify in one step, each office gets the evidence it&apos;s measured on, and students and clubs never pay.</p>
        <ul className="reveal mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:mt-10 lg:grid-cols-4">
          {SCHOOL_OUTCOMES.map((o) => (
            <li key={o.title} className="flex flex-col bg-surface p-4 sm:p-6">
              <span className="flex items-center justify-between gap-3">
                <o.icon className="size-5 text-brand" aria-hidden="true" />
                {o.soon && <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-faint"><span className="max-sm:hidden">With pilot schools</span><span className="sm:hidden" aria-hidden="true">Soon</span></span>}
              </span>
              <p className="mt-4 font-mono text-[11px] text-faint sm:mt-5">{o.office}</p>
              <h3 className="mt-1 text-[15px] leading-snug font-semibold tracking-tight sm:text-lg">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted max-sm:hidden">{o.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/schools" className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">See what schools get <ArrowRight className="size-4" aria-hidden="true" /></Link>
            <Link href="#pilot" className="inline-flex h-11 items-center rounded-lg border border-line-strong px-5 text-[15px] transition hover:bg-hover">Start a pilot</Link>
          </div>
          <p className="text-sm text-muted"><BarChart3 className="mr-1.5 inline size-4 align-[-3px]" aria-hidden="true" />Priced per school, never per student or club. <Link href="/pricing" className="font-medium text-text underline-offset-4 hover:underline">See pricing</Link></p>
        </div>
      </div>
    </section>
  );
}

const FOR: { icon: typeof Users; who: string; body: string; cta: string; href: string; more?: string }[] = [
  { icon: GraduationCap, who: "Students", body: "Your classes, clubs and projects in one place. Your professor or club signs what you built, and it stays yours after you graduate. Free with your school email.", cta: "Start your record", href: "/signup" , more: "/for/students"},
  { icon: Briefcase, who: "Professionals", body: "Log what you ship at work. A coworker, tech lead or client signs it from their work email. Nothing is public until you choose, and your record moves with you when you change jobs. Free to start.", cta: "Start as a professional", href: "/signup?goal=job" , more: "/for/professionals"},
  { icon: Users, who: "Clubs", body: "Officers sign what members build, and your school sees what the club does. Free for every club and member.", cta: "Bring your club", href: "#pilot" , more: "/for/clubs"},
  { icon: Landmark, who: "Schools", body: "Run your project courses on it. Faculty grade and verify in one step, and each office gets the evidence it's measured on.", cta: "What schools get", href: "/schools" },
];

export function Audiences() {
  return (
    <section id="for" aria-labelledby="for-h" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="for-h" className={H2}>Who it&apos;s for</h2>
        <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-muted">One record for everyone who builds things, in any field: engineering, software, research, design and more.</p>
        <ul className="reveal mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-10 lg:grid-cols-4">
          {FOR.map((f) => (
            <Tilt as="li" key={f.who} className="flex flex-col rounded-2xl border border-line bg-surface p-5 hover:border-line-strong md:p-6">
              <span className="flex items-center gap-3 md:block">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2"><f.icon className="size-5" aria-hidden="true" /></span>
                <h3 className="text-xl font-semibold tracking-tight md:mt-5">{f.who}</h3>
              </span>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{f.body}</p>
              <span className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href={f.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-text underline-offset-4 hover:underline">{f.cta} <ArrowRight className="size-3.5" /></Link>
                {f.more && <Link href={f.more} className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">How it works for {f.who.toLowerCase()}</Link>}
              </span>
            </Tilt>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">Hiring? <Link href="/pricing#pricing-companies" className="font-medium text-text underline-offset-4 hover:underline">Find people by signed work</Link>, students and professionals alike. Already use Claude or ChatGPT? <Link href="/ai" className="font-medium text-text underline-offset-4 hover:underline">Connect your AI</Link>.</p>
      </div>
    </section>
  );
}

// Plain answers to what people ask first. Short on purpose: the details live on /schools, /pricing and /ai.
const FAQ: [string, React.ReactNode][] = [
  ["What is Brazework, in one line?", "A record of the work you've really done, each piece signed by someone who saw it happen."],
  ["I already have a job. Is this for me?", "Yes. Log what you ship, and your coworker, tech lead or client signs it from their work email, with no account needed. Nothing shows on your profile until you choose, so work for your employer is never public by accident. Leave out numbers your employer hasn't published: the person who signs still knows what you did."],
  ["Who can sign my work?", "Someone who saw it happen: a professor, TA, lab lead, club officer, coworker, manager or client. A work or university email carries the most weight, and the signature says which kind it came from. You can't sign your own work."],
  ["What does Torch do?", "Torch is the AI built into Brazework. It drafts your write-ups, finds who should sign, plans your week and can set up a club or study group for you. It never signs anything, and nothing is saved until you say yes."],
  ["How is this different from LinkedIn or a résumé?", "Those show what you say about yourself. Brazework shows what someone who was there says about your work, with their name on it. You can still put it on LinkedIn or your résumé: every signed piece has a link anyone can check."],
  ["What does it cost?", <>Free for students, clubs and the people who sign, always. Professionals start free, and {PLUS.name} adds more Torch and every company that looked at your work. Schools pay per school, never per student: <Link href="#pilot" className="font-medium text-text underline-offset-4 hover:underline">talk to us</Link>. Every price is on <Link href="/pricing" className="font-medium text-text underline-offset-4 hover:underline">the pricing page</Link>.</>],
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <div>
          <h2 id="faq-h" className={H2}>Questions, answered</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">Something else? <Link href="#pilot" className="font-medium text-text underline-offset-4 hover:underline">Ask the founders</Link>.</p>
        </div>
        <div className="reveal divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4 md:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">{q}<Plus className="size-4 shrink-0 text-faint transition group-open:rotate-45" aria-hidden="true" /></summary>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
