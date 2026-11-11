import { BadgeCheck, Clock, Cpu, FlaskConical, GitBranch, Megaphone, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { ProjectEditor } from "../u/[id]/profile-client";
import { QuickUpdate } from "./quick-update";

export type BenchProject = { id: string; title: string; summary: string; status: string; private: boolean; updated_at: string; verified: number; waiting: number; updates: number };

// Your projects first: where each one stands on the way to proof, and the next thing to do.
export function Workbench({ projects, interests, copilot, stack, specsOn = false }: { projects: BenchProject[]; interests: string[]; copilot: boolean; stack: boolean; specsOn?: boolean }) {
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
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id} className="glass-card flex flex-col rounded-3xl p-5">
            <div className="flex items-start gap-3">
              <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                <div className="truncate font-semibold hover:underline">{p.title}</div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.summary}</p>
              </Link>
              {p.private && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">Private</span>}
            </div>
            {/* Where it stands on the way to proof. */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className={p.verified ? "inline-flex items-center gap-1 font-medium text-ok" : "inline-flex items-center gap-1 text-faint"}><BadgeCheck className="size-3.5" /> {p.verified} verified</span>
              <span className={p.waiting ? "inline-flex items-center gap-1 text-text-2" : "inline-flex items-center gap-1 text-faint"}><Clock className="size-3.5" /> {p.waiting} waiting</span>
              <span className="inline-flex items-center gap-1 text-faint"><Megaphone className="size-3.5" /> {p.updates} update{p.updates === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <QuickUpdate projectId={p.id} title={p.title} />
              <Link href={`/projects/${p.id}#milestones`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-xs font-medium transition hover:bg-hover"><ShieldCheck className="size-3.5" /> {p.verified || p.waiting ? "Milestones" : "Ask to verify"}</Link>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 text-sm font-semibold">Explore what people are building</h2>
    </section>
  );
}
