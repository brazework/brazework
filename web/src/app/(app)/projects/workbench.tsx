import { Cpu, FlaskConical, GitBranch, Wrench } from "lucide-react";
import Link from "next/link";
import { ProjectEditor } from "../u/[id]/profile-client";
import { BenchCard } from "./bench-card";

export type BenchProject = { id: string; title: string; summary: string; status: string; private: boolean; updated_at: string; verified: number; waiting: number; updates: number; log: { id: string; body: string; status: string; created_at: string }[] };

// Your projects first: where each one stands on the way to proof, and the next thing to do.
export function Workbench({ projects, interests, copilot, stack, specsOn = false, filesOn = false }: { projects: BenchProject[]; interests: string[]; copilot: boolean; stack: boolean; specsOn?: boolean; filesOn?: boolean }) {
  if (!projects.length) {
    return (
      <section aria-label="Your workbench" className="glass-card mt-6 rounded-3xl p-6">
        <h2 className="text-lg font-semibold tracking-tight">Start your first project</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">A project is anything you&apos;re building: a robot, a rocket, a model, an experiment, an app. Post updates as you go, and your club verifies the milestones.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[[Cpu, "Hardware", "A flight computer, a chassis, a test rig. Photos and specs, no repo needed."], [FlaskConical, "Research", "An experiment or model: what you measured and what it showed."], [Wrench, "Software", "An app, a tool or a library. Ember can import it from GitHub."]].map(([Icon, t, d]) => {
            const I = Icon as typeof Cpu;
            return (
              <div key={t as string} className="rounded-2xl border border-line bg-surface p-4">
                <I className="size-5 text-text-2" />
                <div className="mt-2 text-sm font-semibold">{t as string}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{d as string}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ProjectEditor interests={interests} copilot={copilot} stack={stack} specsOn={specsOn} />
          {copilot && <Link href="/copilot?q=Import%20my%20GitHub%20repo%20as%20a%20project" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition hover:bg-hover"><GitBranch className="size-4" /> Import from GitHub with Ember</Link>}
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Your workbench" className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Your workbench</h2>
        <div className="flex items-center gap-2">
          {copilot && <Link href="/copilot?q=Import%20my%20GitHub%20repo%20as%20a%20project" className="hidden h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm transition hover:bg-hover sm:inline-flex"><GitBranch className="size-4" /> Import</Link>}
          <ProjectEditor interests={interests} copilot={copilot} stack={stack} specsOn={specsOn} />
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {projects.map((p) => <BenchCard key={p.id} p={p} attach={filesOn} />)}
      </ul>
      <h2 className="mt-10 text-sm font-semibold">Explore what people are building</h2>
    </section>
  );
}
