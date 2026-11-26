import type { Metadata } from "next";
import { ArrowRight, Check, Lock } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/closing";
import { Nav } from "@/components/landing/nav";
import { H2, SCHOOL_OUTCOMES } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { SCHOOL, SCHOOL_SOON, schoolPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "For schools",
  description: "The portal for project work, in class and in clubs. Faculty verify what students build; your offices get accreditation evidence, engagement, placement and a showcase. Students and clubs never pay.",
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

// /schools: the page for the people who buy (the school-first realignment, 2026-11-26,
// docs/strategy.md). An engineering dean, a student life office or a career center reads it in two
// minutes: what each office gets, how the portal works for faculty and students, how a pilot runs,
// privacy, and the price. What's built is said plainly; what's being built with pilot schools says so
// (SCHOOL_OUTCOMES.soon, lib/pricing.ts SCHOOL_SOON). Static.

const HOW = [
  { n: "1", title: "Students join with their school email", body: "Their domain places them at your school automatically. No codes, no invites, no IT ticket. Students already on Brazework are waiting when you sign up." },
  { n: "2", title: "Faculty sign on from your list", body: "Faculty accounts come only from your school's own list, because only faculty verify class projects. Club advisors and officers verify club work." },
  { n: "3", title: "Projects live under a class or a club", body: "A teacher assigns a project group, or students list their project under a class they take. Updates, milestones, files and 3D models, by course and semester." },
  { n: "4", title: "Faculty verify, your offices see it", body: "A professor confirms the work and each student's part. It counts in your reports, and it stays on the student's record after they graduate." },
];

const PILOT = [
  "One department or a few classes, for one semester",
  "Set up with you by the founders, in person where we can",
  "Classes and rosters from a CSV each semester: no integration needed to start",
  "A report at the end: what your students built, who verified it, which clubs were active",
  `${usd(SCHOOL.pilot)} for the semester, credited toward your first year of the portal (${usd(SCHOOL.portal)})`,
];

export default function SchoolsPage() {
  return (
    <div className="landing min-h-dvh">
      <Nav />
      <ThemeChrome landing />
      <main>
        <section id="top" aria-labelledby="schools-h" className="theme-dark relative isolate overflow-hidden bg-bg pt-28 pb-14 text-text sm:pt-32 md:pb-20">
          <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="font-mono text-xs text-faint">Brazework for schools</p>
            <h1 id="schools-h" className="mt-4 max-w-[16ch] text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">The portal for your students&apos; project work.</h1>
            <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-muted">Class projects and club builds in one place, verified by the faculty and officers who saw the work. Your dean gets accreditation evidence, student life sees its clubs, the career center sees who&apos;s hiring your students, and admissions gets a showcase. Students and clubs never pay.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/book?kind=school" className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Start a pilot <ArrowRight className="size-4" aria-hidden="true" /></Link>
              <Link href="#price" className="inline-flex h-12 items-center rounded-xl border border-line-strong px-5 text-[15px] transition hover:bg-hover">See the price</Link>
            </div>
            <p className="mt-4 text-sm text-faint">Works beside Blackboard, Canvas or Moodle: grades stay there, project work lives here.</p>
          </div>
        </section>

        <section aria-labelledby="offices-h" className="py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="offices-h" className={H2}>What each office gets</h2>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-10">
              {SCHOOL_OUTCOMES.map((o) => (
                <li key={o.title} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                  <span className="flex items-center justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-text-2"><o.icon className="size-5" aria-hidden="true" /></span>
                    {o.soon && <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-muted">Building with pilot schools</span>}
                  </span>
                  <p className="mt-5 font-mono text-xs text-faint">{o.office}</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight">{o.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{o.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="how-h" className="border-y border-line bg-surface-2/60 py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="how-h" className={H2}>How it works at your school</h2>
            <ol className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2 lg:grid-cols-4">
              {HOW.map((s) => (
                <li key={s.n} className="rounded-2xl border border-line bg-surface p-5">
                  <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="price" aria-labelledby="price-h" className="scroll-mt-20 py-14 md:py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 sm:px-6 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 id="price-h" className={H2}>Start with one semester.</h2>
              <ul className="mt-8 flex flex-col gap-3 text-[15px] text-text-2">
                {PILOT.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />{x}</li>)}
              </ul>
              <div className="mt-10 rounded-2xl border border-line bg-surface p-5">
                <p className="inline-flex items-center gap-2 font-medium"><Lock className="size-4" aria-hidden="true" /> Student privacy</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">We sign a data agreement with your school (FERPA) before any class data comes in. Class work is private to the class by default, and each student chooses what goes on their public record. Grades and teacher notes are never shown.</p>
              </div>
            </div>
            <div className="flex flex-col rounded-[1.25rem] border border-line bg-surface p-6 sm:p-8">
              <p className="text-sm font-medium text-muted">School portal</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{usd(SCHOOL.portal)}<span className="text-lg font-normal text-muted"> / year</span></p>
              <p className="mt-1 text-sm text-muted">With {SCHOOL.seatsIncluded} faculty seats. {usd(SCHOOL.perAdvisor)} per extra seat: a campus with 8 pays {usd(schoolPrice(8))}.</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[15px] text-text-2">
                {["Every student and every club included, never priced per head", "Your official school account and its verified clubs", "Faculty and advisors verify the work they saw", "Semester reports for clubs, student life and your dean"].map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />{x}</li>)}
                {SCHOOL_SOON.map((x) => <li key={x} className="flex gap-2.5 text-muted"><span aria-hidden="true" className="mt-1.5 block size-3 shrink-0 rounded-full border-2 border-dashed border-wait" />{x} <span className="sr-only">(building with pilot schools)</span></li>)}
              </ul>
              <p className="mt-4 text-xs text-faint">Dashed: being built with our pilot schools.</p>
              <Link href="/book?kind=school" className="mt-6 inline-flex h-11 items-center justify-center self-start rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:opacity-90">Start a pilot</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
