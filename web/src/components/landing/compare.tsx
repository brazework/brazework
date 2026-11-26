import { Check, Minus } from "lucide-react";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";

// Under the hero (Brazework Courses since 2026-11-26, docs/strategy.md): why a school runs its courses
// on Brazework instead of an LMS plus LinkedIn and Handshake. Profiles have the audience without the
// proof; the LMS grades a file and archives the course. Brazework is the course platform built around
// projects, and grading the work verifies it. `pilot` marks what's being built with pilot schools, so
// the page never sells what isn't there.

type Cell = { text: string; pilot?: boolean };
const ROWS = ["Built for", "Assignments", "Projects and teams", "Who confirms it", "Accreditation", "After the semester"];
const COLS: { id: string; name: string; cells: Cell[] }[] = [
  { id: "profiles", name: "LinkedIn, Handshake", cells: [{ text: "Listing what you say you did" }, { text: "None" }, { text: "One person's claim" }, { text: "Nobody: it's self-reported" }, { text: "Not counted" }, { text: "Still unverified" }] },
  { id: "lms", name: "Blackboard, Canvas", cells: [{ text: "Readings, quizzes, a gradebook" }, { text: "Upload a file, get a grade" }, { text: "A group set" }, { text: "A grade, inside the course" }, { text: "ABET evidence gathered by hand" }, { text: "The course is archived" }] },
  { id: "brazework", name: "Brazework", cells: [{ text: "Courses built around projects" }, { text: "Hand in the milestone with its evidence; grading it verifies it" }, { text: "Teams with each member's part" }, { text: "The professor, club or sponsor who saw it" }, { text: "ABET outcomes on each rubric row" }, { text: "The verified work is the student's for good" }] },
];
// On a phone the other two columns keep three rows (what it's for, who confirms it, after); Brazework keeps all six.
const GRID = "md:grid md:grid-rows-[3rem_repeat(6,minmax(3rem,auto))]";

export function Compare() {
  return (
    <section id="compare" aria-labelledby="compare-h" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="compare-h" className={cn(H2, "max-w-[24ch]")}>Everything a course needs, built around what students build.</h2>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">An LMS grades a file and archives the course. A profile lists what you say. Brazework runs the course, verifies the work as it&apos;s graded, and the student keeps the proof.</p>
        <div className="reveal mt-8 grid grid-cols-1 gap-3 md:mt-10 md:grid-cols-[8.5rem_repeat(3,minmax(0,1fr))] md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-line">
          <div aria-hidden="true" className={cn("hidden md:border-r md:border-line md:bg-surface-2/60", GRID)}>
            <span />
            {ROWS.map((r) => <span key={r} className="flex items-center border-t border-line px-4 font-mono text-[11px] text-faint">{r}</span>)}
          </div>
          {COLS.map((c) => {
            const us = c.id === "brazework";
            return (
              <div key={c.id} className={cn("rounded-2xl border border-line md:rounded-none md:border-0 md:border-r md:last:border-r-0", GRID, us ? "bg-surface ring-1 ring-brand/50 md:bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface))] md:ring-0" : "bg-surface/40")}>
                <h3 className="flex items-center gap-2 px-4 pt-4 pb-1 text-[15px] font-semibold tracking-tight md:py-0">{us && <Seal size={18} />}{c.name}</h3>
                <dl className="contents">
                  {c.cells.map((x, i) => (
                    <div key={ROWS[i]} className={cn("flex items-start gap-2.5 px-4 py-1.5 md:items-center md:border-t md:border-line md:py-2", !us && [1, 2, 4].includes(i) && "max-md:hidden")}>
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
        <p className="mt-5 max-w-[46rem] text-sm leading-relaxed text-muted">Move course by course. Coming with pilot schools: peer evaluation, importing a course from Canvas or Blackboard, your school&apos;s single sign-on, and publisher tools through LTI. Every verified project already has a link anyone on LinkedIn or Handshake can open to see who verified it.</p>
      </div>
    </section>
  );
}
