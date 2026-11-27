import type { Metadata } from "next";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/closing";
import { Nav } from "@/components/landing/nav";
import { ScrollStory } from "@/components/landing/scroll-story";
import { Organizations } from "@/components/landing/organizations";
import { Portal } from "@/components/landing/portal";
import { Offices } from "@/components/landing/schools-interactive";
import { H2 } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";

export const metadata: Metadata = {
  title: "For schools",
  description: "The portal for project work, in class and in clubs. Faculty verify what students build; your offices get accreditation evidence, engagement, placement and a showcase. Students and clubs never pay.",
};

// /schools: the page for the people who buy (the school-first realignment, 2026-11-26,
// docs/strategy.md). An engineering dean, a student life office or a career center reads it in two
// minutes: the portal itself to try (portal.tsx), what each office gets, how it rolls out, how it
// compares with Blackboard and Canvas, privacy, and a form to talk to us. No prices on this page
// (founders, 2026-11-27): a school talks to the founders, and /pricing lists them. The hero follows
// the visitor's theme. What's built is said plainly; what's being built with pilot schools says so.

const HOW = [
  { n: "1", title: "Plug into your tools", body: "IT registers Brazework once in your LMS and your single sign-on, so students and faculty arrive from the course already signed in (being built with pilot schools). Until then, a school email places them at your school, with no codes or invites." },
  { n: "2", title: "Faculty sign on from your list", body: "Faculty accounts come only from your school's own list, because only faculty verify class projects. Club advisors and officers verify club work." },
  { n: "3", title: "Projects live under a class or a club", body: "A teacher assigns a project group, or students list their project under a class they take. Updates, milestones, files and 3D models, by course and semester." },
  { n: "4", title: "Faculty verify, your offices see it", body: "A professor confirms the work and each student's part. It counts in your reports, and it stays on the student's record after they graduate." },
];

// Brazework Courses against Blackboard and Canvas (docs/strategy.md, "Brazework Courses"). The fourth
// field marks what's being built with the pilot schools, so no school pays for something not there yet.
const LMS: [string, string, string, boolean][] = [
  ["The course", "Modules, readings, quizzes, the gradebook", "Stays in your LMS. Brazework adds project milestones to its modules", true],
  ["Signing in", "Your LMS account", "Students and faculty open Brazework from the course, already signed in", true],
  ["Grading", "A score on an uploaded file", "Grade against the rubric beside the work itself; the same click verifies it and sends the grade to your gradebook", true],
  ["Teams", "A group set", "Teams with roles, one hand-in per group, and each member's part on record", false],
  ["Evidence", "Files in a course shell", "CAD you can turn, test logs and video, with who verified it", false],
  ["Teamwork", "A separate peer-evaluation tool, if you buy one", "Peer evaluation built in: each teammate rates contribution, and only faculty see it", false],
  ["Accreditation", "Assembled by hand each cycle", "Rubric rows carry ABET outcomes as faculty grade; attainment by outcome and course is a download for the self-study", false],
  ["Industry sponsors", "Can't see the course", "Sign off results by email, no account needed", false],
  ["After the course", "The shell is archived", "The verified work stays on the student's record", false],
  ["Clubs", "Outside the LMS", "Clubs run on Brazework too, so student life sees what they build", false],
];


export default function SchoolsPage() {
  return (
    <div className="landing min-h-dvh">
      <Nav />
      <ThemeChrome landing />
      <main>
        <section id="top" aria-labelledby="schools-h" className="relative isolate overflow-hidden pt-[calc(env(safe-area-inset-top)+7.5rem)] pb-14 sm:pt-36 md:pb-20">
          <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-text-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-brand" /> Brazework for schools</p>
            <h1 id="schools-h" className="mt-6 max-w-[17ch] text-[clamp(2.5rem,7.5vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">Your courses, projects and clubs, in one place.</h1>
            <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-muted">The portal for your students&apos; project work, plugged into the tools you already run: your LMS, your single sign-on and your student system. Faculty grade and verify project milestones inside the course. Your dean gets accreditation evidence, student life sees its clubs, the career center sees who&apos;s hiring your students, and admissions gets a showcase. Students and clubs never pay.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="#portal" className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-accent px-6 text-[16px] font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98]">Try the portal <ArrowRight className="size-4" aria-hidden="true" /></Link>
              <Link href="#pilot" className="inline-flex h-12 items-center justify-center rounded-xl border border-line-strong px-6 text-[16px] transition hover:bg-hover active:scale-[0.98]">Talk to us</Link>
            </div>
            <p className="mt-4 text-sm text-faint">Start with one course this semester. Canvas, Blackboard, Brightspace or Moodle keeps the course and the official grades.</p>
          </div>
        </section>

        <section id="portal" aria-labelledby="portal-h" className="scroll-mt-20 pb-16 md:pb-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="portal-h" className={H2}>Try the portal</h2>
            <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-muted">A course the way your faculty run it, and the views your offices get. Grade a team&apos;s milestone and verify it, then see where it counts.</p>
            <div className="reveal mt-8 md:mt-10"><Portal /></div>
          </div>
        </section>

        <section aria-labelledby="offices-h" className="py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="offices-h" className={H2}>What each office gets</h2>
            <div className="reveal"><Offices /></div>
          </div>
        </section>

        <ScrollStory steps={HOW} />

        <section aria-labelledby="lms-h" className="py-14 md:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 id="lms-h" className={H2}>What your LMS does, and what Brazework adds to it</h2>
            <p className="mt-5 max-w-[42rem] text-lg leading-relaxed text-muted">Your LMS keeps doing what it does well. Brazework adds what it never could: teams, milestones, real engineering files, work verified by the person who saw it, and a record that outlives the course. Start with your capstone and design courses.</p>
            <div className="reveal mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="bg-surface-2 text-sm text-muted"><tr><th className="px-5 py-3 font-medium">In a project course</th><th className="px-5 py-3 font-medium">Your LMS alone</th><th className="px-5 py-3 font-medium text-text">With Brazework inside</th></tr></thead>
                <tbody>
                  {LMS.map(([what, lms, us, soon]) => (
                    <tr key={what} className="border-t border-line align-top">
                      <td className="px-5 py-3.5 font-medium">{what}</td>
                      <td className="px-5 py-3.5 text-muted">{lms}</td>
                      <td className="px-5 py-3.5 text-text-2">{us}{soon && <span className="ml-2 rounded-full border border-line px-2 py-0.5 font-mono text-[11px] whitespace-nowrap text-faint">With pilot schools</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="privacy-h" className="pb-10 md:pb-14">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="reveal rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <h2 id="privacy-h" className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"><Lock className="size-5" aria-hidden="true" /> Student privacy</h2>
              <p className="mt-3 max-w-[48rem] text-[16px] leading-relaxed text-muted">We sign a data agreement with your school (FERPA) before any class data comes in. Class work is private to the class by default, and each student chooses what goes on their public record. A grade is seen only by its student and the course&apos;s staff: your offices see counts, never a grade.</p>
            </div>
          </div>
        </section>

        <Organizations />
      </main>
      <Footer />
    </div>
  );
}
