import { ArrowRight, BadgeCheck, FileText, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { Row, Screen } from "./screens";
import { H2 } from "./sections";
import { StickyStory, type StoryStep } from "./sticky-story";

// Works inside the LMS you already have (2026-11-27, the plug-in angle: Brazework is the project layer
// for Canvas, Blackboard, Brightspace and Moodle, through LTI 1.3, instead of replacing them). The
// school keeps its LMS for the course and the official grades; Brazework adds the project, who
// verified it and the record the student keeps. Told as a scroll story (sticky-story.tsx). The LMS
// screens are a generic course frame, not any one vendor's look. Connecting to an LMS is being built
// with pilot schools, and the section says so.

const LMSES = ["Canvas", "Blackboard", "Brightspace", "Moodle"];

// A generic LMS course around what Brazework shows inside it.
function Course({ active, children }: { active: "Modules" | "Grades"; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 pt-4 pb-2.5 lg:pt-11">
        <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-text text-[10px] font-semibold text-bg">L</span>
        <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">ME 482 Robotics</span><span className="block text-[11px] text-faint">Your LMS</span></span>
      </div>
      <div className="flex gap-1 border-b border-line px-3 py-1.5 text-[12px]">
        {(["Modules", "Grades"] as const).map((t) => <span key={t} className={cn("rounded-md px-2 py-1", t === active ? "bg-hover font-medium text-text" : "text-muted")}>{t}</span>)}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3.5">{children}</div>
    </div>
  );
}

const STEPS: StoryStep[] = [
  {
    title: "Your IT adds it once",
    body: "Brazework registers in your LMS like any approved tool, for the whole campus, one department or a single pilot course. No new accounts, no rosters by hand.",
    screen: (
      <Screen title="Tools in your LMS" sub="Admin">
        <div className="flex flex-col gap-2">
          {[["Brazework", "Project milestones, verified", true], ["Video", "Lecture capture", true], ["Proctoring", "Exams", false]].map(([n, d, on]) => (
            <Row key={n as string} className={n === "Brazework" ? "border-text/30" : undefined}>
              <span className="min-w-0 flex-1"><span className="block font-medium">{n}</span><span className="block text-[12px] text-muted">{d}</span></span>
              <span aria-hidden="true" className={cn("h-5 w-9 rounded-full p-0.5 transition-colors", on ? "bg-ok" : "bg-line-strong")}><span className={cn("block size-4 rounded-full bg-white transition-transform", on && "translate-x-4")} /></span>
            </Row>
          ))}
        </div>
      </Screen>
    ),
  },
  {
    title: "A professor adds a milestone to a module",
    body: "Next to the readings and quizzes. The class list comes across from the LMS by itself.",
    screen: (
      <Course active="Modules">
        <p className="text-[12px] text-faint">Module 3: Motion planning</p>
        <div className="mt-2 flex flex-col gap-2">
          <Row><FileText className="size-4 text-muted" aria-hidden="true" /><span>Reading: Trajectory planning</span></Row>
          <Row><FileText className="size-4 text-muted" aria-hidden="true" /><span>Quiz 3</span></Row>
          <Row className="border-text/30"><BadgeCheck className="size-4 text-ok" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block font-medium">Milestone: Cycle-time test</span><span className="block text-[12px] text-muted">Brazework</span></span></Row>
          <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-[12px] text-muted"><Plus className="size-3.5" aria-hidden="true" />Add a Brazework milestone</span>
        </div>
      </Course>
    ),
  },
  {
    title: "Students hand in from the course",
    body: "They click the assignment and land in Brazework, already signed in, with the file or model that proves the work.",
    screen: (
      <Course active="Modules">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] text-faint">Brazework, inside your course</p>
          <p className="mt-1 text-[14px] leading-snug font-semibold">Cut the pick-and-place cycle from 9.4 to 7.1 seconds</p>
          <Row className="mt-2.5"><FileText className="size-4 text-muted" aria-hidden="true" /><span>cycle-test-500-runs.csv</span></Row>
          <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[12px] font-semibold text-on-accent">Hand in</span>
          <p className="mt-2.5 text-[11px] text-faint">Signed in as Maya Chen through your LMS</p>
        </div>
      </Course>
    ),
  },
  {
    title: "Grade once: it's verified, and the grade is in your gradebook",
    body: "The professor grades with the rubric. The same click verifies the work on the student's record and sends the grade back to the LMS.",
    screen: (
      <Course active="Grades">
        <div className="overflow-hidden rounded-xl border border-line text-[13px]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] bg-surface-2/60 px-3 py-2 text-[11px] text-muted"><span>Student</span><span>Cycle-time test</span></div>
          {[["Maya Chen", "27 / 30"], ["Noah Feld", "27 / 30"], ["Tara Singh", "26 / 30"]].map(([n, g]) => (
            <div key={n} className="grid grid-cols-[minmax(0,1fr)_auto] border-t border-line px-3 py-2"><span>{n}</span><span className="tabular-nums">{g}</span></div>
          ))}
        </div>
        <Row className="mt-2.5"><BadgeCheck className="size-4 text-ok" aria-hidden="true" /><span>Verified by Prof. Dana Ruiz, on each student&apos;s record</span></Row>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-faint"><Lock className="size-3" aria-hidden="true" />Grades stay in your LMS and stay private</p>
      </Course>
    ),
  },
];

export function Lms() {
  return (
    <section id="lms" aria-labelledby="lms-h" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="lms-h" className={cn(H2, "max-w-[20ch]")}>Works inside the LMS you already have.</h2>
        <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-muted">Your LMS keeps the course and the official grades. Brazework adds what it can&apos;t: the project, who verified it, and a record the student keeps after the course.</p>
        <ul aria-label="Works with" className="mt-6 flex flex-wrap gap-2">
          {LMSES.map((l) => <li key={l} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[14px] text-text-2">{l}</li>)}
        </ul>
        <p className="mt-3 text-sm text-faint">Connecting to your LMS is being built with our pilot schools.</p>
        <div className="mt-6 lg:mt-0">
          <StickyStory label="Brazework inside your LMS, from setup to the gradebook (example)" steps={STEPS} />
        </div>
        <Link href="/schools" className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-text underline-offset-4 hover:underline">How it works for your school <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
