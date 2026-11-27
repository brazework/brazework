import { emberCreditCost } from "@/lib/ember-credits";
import { Cpu, FlaskConical, GitBranch, Wrench } from "lucide-react";
import Link from "next/link";
import { ProjectEditor } from "../u/[id]/profile-client";
import { weekSummary } from "@/lib/build-step";
import { BenchCard } from "./bench-card";

export type BenchProject = { id: string; title: string; summary: string; status: string; private: boolean; updated_at: string; verified: number; waiting: number; updates: number; weeks: number[]; cover?: { name: string; src: string } | null; model?: { name: string; src: string } | null; log: { id: string; body: string; status: string; created_at: string }[] };

// Your projects first: where each one stands on the way to proof, and the next thing to do.
export function Workbench({ projects, interests, copilot, stack, specsOn = false, filesOn = false }: { projects: BenchProject[]; interests: string[]; copilot: boolean; stack: boolean; specsOn?: boolean; filesOn?: boolean }) {
  if (!projects.length) {
    // No projects yet (redesigned 2026-11-26: clean glass, no grid, dashes or tiles). One clear start,
    // the three kinds of work people bring, and the two ways in.
    return (
      <section aria-label="Your projects" className="home-glass relative mt-6 overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[13px] font-medium text-muted">Your projects</p>
            <h2 className="mt-1.5 text-[1.6rem] leading-tight font-semibold tracking-[-0.025em] sm:text-[2rem]">Start your first project</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-text-2">Anything you&apos;re building counts. Post updates as you go, and get each milestone signed by someone who saw it: that&apos;s what goes on your record.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProjectEditor interests={interests} copilot={copilot} stack={stack} specsOn={specsOn} />
            {copilot && <Link href="/copilot?q=Import%20my%20GitHub%20repo%20as%20a%20project" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--text)_6%,transparent)] px-4 text-sm font-medium transition hover:bg-[color-mix(in_oklab,var(--text)_10%,transparent)]"><GitBranch className="size-4" /> Import from GitHub · {emberCreditCost("ask")}</Link>}
          </div>
        </div>
        <ul className="mt-7 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          {[[Cpu, "Hardware", "A flight computer, a chassis, a test rig. Photos and specs, no repo needed."], [FlaskConical, "Research", "An experiment or a model: what you measured and what it showed."], [Wrench, "Software", "An app, a tool or a library. Torch can import it from GitHub."]].map(([Icon, t, d]) => {
            const I = Icon as typeof Cpu;
            return (
              <li key={t as string} className="flex gap-3">
                <I className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden="true" />
                <span><span className="block text-sm font-semibold">{t as string}</span><span className="mt-0.5 block text-sm leading-relaxed text-muted">{d as string}</span></span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  const { thisWeek, signed, waiting } = weekSummary(projects);
  return (
    <section aria-label="Your projects" className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your projects</h2>
          {/* The week and the record at a glance: what you logged, and how much of your work someone has signed. */}
          <p className="mt-0.5 text-sm text-muted tabular-nums">
            {thisWeek ? `${thisWeek} update${thisWeek === 1 ? "" : "s"} this week` : "Nothing logged this week yet"} · <span className={signed ? "font-medium text-ok" : undefined}>{signed} signed result{signed === 1 ? "" : "s"}</span>{waiting ? ` · ${waiting} waiting on a signature` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 [&_button]:whitespace-nowrap">
          {copilot && <Link href="/copilot?q=Import%20my%20GitHub%20repo%20as%20a%20project" className="hidden h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm transition hover:bg-hover sm:inline-flex"><GitBranch className="size-4" /> Import · {emberCreditCost("ask")}</Link>}
          <ProjectEditor interests={interests} copilot={copilot} stack={stack} specsOn={specsOn} />
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {projects.map((p) => <BenchCard key={p.id} p={p} attach={filesOn} />)}
      </ul>
      <h2 className="mt-12 text-lg font-semibold tracking-tight">Explore what people are building</h2>
    </section>
  );
}
