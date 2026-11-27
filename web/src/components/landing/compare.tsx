"use client";
import { Check, Minus } from "lucide-react";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";
import { useScrollRun } from "./use-scroll-run";

// What the others can't do (the plug-in angle, 2026-11-27): profiles have the audience without the
// proof; the LMS grades a file and archives the course. Brazework adds the project and its proof inside
// the LMS the school already has, and grading the work verifies it. `pilot` marks what's being built
// with pilot schools (connecting to the LMS), so the page never sells what isn't there.

type Cell = { text: string; pilot?: boolean };
const ROWS = ["Built for", "Assignments", "Projects and teams", "Who confirms it", "Accreditation", "After the semester"];
const COLS: { id: string; name: string; cells: Cell[] }[] = [
  { id: "profiles", name: "LinkedIn, Handshake", cells: [{ text: "Listing what you say you did" }, { text: "None" }, { text: "One person's claim" }, { text: "Nobody: it's self-reported" }, { text: "Not counted" }, { text: "Still unverified" }] },
  { id: "lms", name: "Canvas or Blackboard alone", cells: [{ text: "Readings, quizzes, a gradebook" }, { text: "Upload a file, get a grade" }, { text: "A group set" }, { text: "A grade, inside the course" }, { text: "ABET evidence gathered by hand" }, { text: "The course is archived" }] },
  { id: "brazework", name: "Brazework", cells: [{ text: "Project milestones, inside your course", pilot: true }, { text: "Hand in the milestone with its evidence; grading it verifies it and sends the grade to your LMS", pilot: true }, { text: "Teams with each member's part" }, { text: "The professor, club or sponsor who saw it" }, { text: "ABET outcomes on each rubric row" }, { text: "The verified work is the student's for good" }] },
];
// On a phone the other two columns keep three rows (what it's for, who confirms it, after); Brazework keeps all six.
const GRID = "md:grid md:grid-rows-[3rem_repeat(6,minmax(3rem,auto))]";

// On a laptop it pins and plays (premium pass, 2026-11-27; use-scroll-run.ts): row by row, the
// profiles and the LMS step back and Brazework comes forward (globals.css .cmp-*). Elsewhere, the table.
export function Compare() {
  const { run, pinned, at } = useScrollRun(ROWS.length);
  const state = (i: number) => (i < at ? "done" : i === at ? "now" : "ahead");
  return (
    <section id="compare" ref={run} aria-labelledby="compare-h" data-pinned={pinned || undefined} className="story-run cmp-run scroll-mt-20">
      <div className="story-pin py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <h2 id="compare-h" className={cn(H2, "max-w-[24ch]")}>Your LMS runs the course. Brazework proves the work.</h2>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">An LMS grades a file and archives the course. A profile lists what you say. Brazework works inside the LMS: it verifies the work as it&apos;s graded, and the student keeps the proof.</p>
        <div className="cmp-stage mt-8 grid grid-cols-1 gap-3 md:mt-10 md:grid-cols-[8.5rem_repeat(3,minmax(0,1fr))] md:gap-3">
          <div aria-hidden="true" className={cn("hidden", GRID)}>
            <span />
            {ROWS.map((r, i) => <span key={r} data-state={state(i)} className="cmp-label flex items-center gap-2 border-t border-transparent px-1 text-[12px] text-faint"><span className="cmp-dot size-1.5 shrink-0 rounded-full bg-line-strong" />{r}</span>)}
          </div>
          {COLS.map((c) => {
            const us = c.id === "brazework";
            return (
              <div key={c.id} data-side={us ? "us" : "other"} className={cn("cmp-col rounded-2xl border", GRID, us ? "border-brand/40 bg-surface ring-1 ring-brand/30" : "border-line bg-surface/60")}>
                <h3 className="flex items-center gap-2 px-4 pt-4 pb-1 text-[15px] font-semibold tracking-tight md:py-0">{us && <Seal size={18} />}{c.name}</h3>
                <dl className="contents">
                  {c.cells.map((x, i) => (
                    <div key={ROWS[i]} data-state={state(i)} className={cn("cmp-cell flex items-start gap-2.5 px-4 py-1.5 md:items-center md:border-t md:border-line md:py-2", !us && [1, 2, 4].includes(i) && "max-md:hidden")}>
                      <dt className="sr-only">{ROWS[i]}</dt>
                      {us ? <Check className="mt-0.5 size-4 shrink-0 text-ok md:mt-0" aria-hidden="true" /> : <Minus className="mt-0.5 size-4 shrink-0 text-faint md:mt-0" aria-hidden="true" />}
                      <dd className={cn("text-[14px] leading-snug", us ? "font-medium text-text" : "text-muted")}>
                        <span className="font-mono text-[11px] text-faint md:hidden">{ROWS[i]}: </span>{x.text}
                        {x.pilot && <span className="ml-1.5 inline-block rounded-full border border-line px-1.5 font-mono text-[10px] font-normal whitespace-nowrap text-faint">with pilot schools</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
                <span className="block h-2 md:hidden" />
              </div>
            );
          })}
        </div>
        <p className="cmp-note mt-5 max-w-[46rem] text-sm leading-relaxed text-muted">Start with one course. Brazework connects to Canvas, Blackboard, Brightspace and Moodle through LTI, the standard they all support, and to your school&apos;s single sign-on (both being built with pilot schools). Every verified project already has a link anyone on LinkedIn or Handshake can open to see who verified it.</p>
      </div>
      </div>
    </section>
  );
}
