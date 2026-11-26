import { Check, Minus } from "lucide-react";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";

// Under the hero (landing journey, 2026-11-26): what the tools a school and its students already use
// can't do for project work. Profiles have the audience without proof; the LMS is built for readings,
// quizzes and a gradebook, so a project course there is a group set and one file per assignment.
// Brazework runs the project course and sends the final grade back to the LMS (Josh, 2026-11-26: "Run
// your project courses on Brazework. Your LMS keeps the gradebook."). `pilot` marks what's being built
// with pilot schools, so the page never sells what isn't there.

type Cell = { text: string; pilot?: boolean };
const ROWS = ["Built for", "The team", "Progress", "Who confirms it", "Accreditation", "After the semester"];
const COLS: { id: string; name: string; cells: Cell[] }[] = [
  { id: "profiles", name: "LinkedIn, Handshake", cells: [{ text: "Listing what you say you did" }, { text: "One person's claim" }, { text: "Whatever you post" }, { text: "Nobody: it's self-reported" }, { text: "Not counted" }, { text: "Still unverified" }] },
  { id: "lms", name: "Blackboard, Canvas", cells: [{ text: "Readings, quizzes, the gradebook" }, { text: "A group set, one file per assignment" }, { text: "Due dates" }, { text: "A grade, inside the course" }, { text: "ABET evidence gathered by hand" }, { text: "Archived with the course" }] },
  { id: "brazework", name: "Brazework", cells: [{ text: "Project courses and club projects" }, { text: "Each member's part, and peer evaluation", pilot: true }, { text: "Milestones against the professor's schedule", pilot: true }, { text: "The professor, club or sponsor who saw it" }, { text: "ABET outcomes ticked as work is verified", pilot: true }, { text: "The student's for good. The final grade goes back to your LMS", pilot: true }] },
];
// On a phone the other two columns keep three rows (what it's for, who confirms it, after); Brazework keeps all six.
const GRID = "md:grid md:grid-rows-[3.25rem_repeat(6,minmax(3.25rem,auto))]";

export function Compare() {
  return (
    <section id="compare" aria-labelledby="compare-h" className="scroll-mt-20 border-b border-line py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="compare-h" className={cn(H2, "max-w-[24ch]")}>Run your project courses on Brazework. Your LMS keeps the gradebook.</h2>
        <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-muted">Profiles say it. Courses grade it. Brazework proves it, and plugs into what your school already runs.</p>
        <div className="mt-8 grid grid-cols-1 gap-3 md:mt-10 md:grid-cols-[8.5rem_repeat(3,minmax(0,1fr))] md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-line">
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
        <p className="mt-5 max-w-[46rem] text-sm leading-relaxed text-muted">Students open it from the course in Canvas or Blackboard with no new login (LTI 1.3, with pilot schools). Every verified project has a link anyone on LinkedIn or Handshake can open to see who verified it.</p>
      </div>
    </section>
  );
}
