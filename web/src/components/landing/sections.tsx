import { ArrowRight, BadgeCheck, BarChart3, Briefcase, ClipboardCheck, GraduationCap, Landmark, Users } from "lucide-react";
import Link from "next/link";

// The landing page's short sections (redesign 2026-11; schools first since 2026-11-26, see
// docs/strategy.md). The hero does the showing for students; ForSchools is the one band that speaks to
// the school that pays, and /schools says the rest. Audiences says who it's for and where each starts.

export const H2 = "text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance";

// What a school gets, by the office that buys it. `soon` marks what's being built with the pilot
// schools, so the page never sells what isn't there (lib/pricing.ts SCHOOL_SOON says the same).
export const SCHOOL_OUTCOMES = [
  { icon: ClipboardCheck, office: "Engineering dean", title: "Accreditation evidence", body: "ABET outcomes from real class and club projects: design, teamwork, results, each verified by the faculty who saw it.", soon: true },
  { icon: Users, office: "Student life", title: "Club engagement", body: "Which clubs are active, how many students build with them and what they made this semester, in one report.", soon: false },
  { icon: Briefcase, office: "Career center", title: "Placement data", body: "Which employers looked at your students' work, who they contacted and who they hired.", soon: true },
  { icon: Landmark, office: "Admissions", title: "A public showcase", body: "Your verified clubs and what your students are building right now, for prospective students and donors.", soon: false },
];

export function ForSchools() {
  return (
    <section id="schools" aria-labelledby="schools-h" className="theme-dark relative isolate scroll-mt-20 overflow-hidden bg-bg py-14 text-text md:py-24">
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="inline-flex items-center gap-2 font-mono text-xs text-faint"><GraduationCap className="size-3.5" aria-hidden="true" /> For schools</p>
        <h2 id="schools-h" className={`${H2} mt-4 max-w-[22ch]`}>Your students&apos; project work, verified by the people who saw it.</h2>
        <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-muted">Brazework is your school&apos;s portal for project work, in class and in clubs. Faculty verify what they saw, and each office gets the evidence it&apos;s measured on. Students and clubs never pay.</p>
        <ul className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:mt-10 lg:grid-cols-4">
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
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/schools" className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">See what schools get <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <Link href="#pilot" className="inline-flex h-11 items-center rounded-lg border border-line-strong px-5 text-[15px] transition hover:bg-hover">Start a pilot</Link>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted"><BarChart3 className="size-4" aria-hidden="true" /> A one-semester pilot for one department</span>
        </div>
      </div>
    </section>
  );
}

const FOR = [
  { icon: BadgeCheck, who: "Students", body: "Log your class and club projects. Your professor or club signs. Free with your school email, and yours after you graduate.", cta: "Start your record", href: "/signup" },
  { icon: Users, who: "Clubs", body: "Officers verify what members build, and your school sees what the club does. Free for every club and member.", cta: "Bring your club", href: "#pilot" },
  { icon: GraduationCap, who: "Schools", body: "Faculty verify project work, and your offices get the reports: accreditation, engagement, placement, showcase.", cta: "What schools get", href: "/schools" },
];

export function Audiences() {
  return (
    <section id="for" aria-labelledby="for-h" className="scroll-mt-20 py-14 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="for-h" className={H2}>Who it&apos;s for</h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-3">
          {FOR.map((f) => (
            <li key={f.who} className="flex flex-col rounded-2xl border border-line bg-surface p-5 md:p-6">
              <span className="flex items-center gap-3 md:block">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2"><f.icon className="size-5" aria-hidden="true" /></span>
                <h3 className="text-xl font-semibold tracking-tight md:mt-5">{f.who}</h3>
              </span>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{f.body}</p>
              <Link href={f.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-text underline-offset-4 hover:underline">{f.cta} <ArrowRight className="size-3.5" /></Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">Hiring? <Link href="/pricing#pricing-companies" className="font-medium text-text underline-offset-4 hover:underline">Find students by signed work</Link>. Already use Claude or ChatGPT? <Link href="/ai" className="font-medium text-text underline-offset-4 hover:underline">Connect your AI</Link>.</p>
      </div>
    </section>
  );
}
