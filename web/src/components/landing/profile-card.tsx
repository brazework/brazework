import { BadgeCheck, Heart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/forge";
import type { Profession } from "./professions";
import { Schematic } from "./schematics";

// A Brazework profile as a visitor would see it, filled with a profession's example data.
// No hooks, so it renders on the server (auth pages) and inside client components (hero).
export function ProfileCard({ p, className }: { p: Profession; className?: string }) {
  const Icon = p.icon;
  return (
    <article className={cn("w-full overflow-hidden rounded-3xl border border-line bg-surface text-left shadow-[var(--shadow-float)]", className)}>
      <div className="relative h-24 overflow-hidden" style={{ background: p.grad }}>
        <Schematic id={p.id} className="sch-draw absolute top-1.5 right-3 h-[86px] w-auto text-white/90 drop-shadow-sm" />
        <span className="absolute top-3 left-3 rounded-full bg-black/25 px-2.5 py-1 font-mono text-[10px] tracking-wide text-white uppercase backdrop-blur">Example</span>
      </div>
      <div className="px-5 pb-5">
        <div className="relative -mt-8 flex items-end gap-3">
          <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-surface text-lg font-semibold text-white" style={{ background: p.grad }} aria-hidden="true">
            {p.person.first[0]}{p.person.last[0]}
          </span>
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-2">
            <Icon className="size-3.5" /> {p.title}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 font-semibold">
          {p.person.first} {p.person.last} <BadgeCheck className="size-4 text-info" aria-label="Verified student" />
        </div>
        <div className="text-sm text-muted">{p.person.headline}</div>

        <div className="mt-4 rounded-2xl border border-line bg-bg p-4">
          <div className="text-[11px] font-medium tracking-wide text-muted uppercase">Featured project</div>
          <div className="mt-1 font-medium">{p.project.title}</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{p.project.metric}</span>
            <span className="text-sm text-muted">{p.project.metricLabel}</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-ok">
            <BadgeCheck className="size-3.5" /> {p.project.verified}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {p.skills.map((s) => <span key={s} className="rounded-full border border-line px-2.5 py-1 text-xs text-text-2">{s}</span>)}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span className="flex items-center gap-3"><span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> 48</span><span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" /> 12</span></span>
          <span>{p.following} companies following</span>
        </div>
      </div>
    </article>
  );
}
